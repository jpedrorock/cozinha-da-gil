import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { asKind, asSize, normalizePhone, serializeOrder } from "@/lib/orders";
import { getCurrentEventSession } from "@/lib/event-session";
import { requireRole } from "@/lib/session";
import { computeUnitPrice, validateIngredientSelection } from "@/lib/products";
import { computeDiscount, isApplicable, serializePromotion } from "@/lib/promotions";
import { MAX_TOPPINGS_PEQUENO } from "@/lib/pricing";
import { broadcast } from "@/lib/sse";
import { getCachedIdempotency, isValidIdempotencyKey, setCachedIdempotency } from "@/lib/idempotency";
import type { Product, ProductSize } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? "today";
  const eventSessionId = url.searchParams.get("eventSessionId");

  type Where = {
    createdAt?: { gte: Date };
    eventSessionId?: string;
  };
  const where: Where = {};

  if (eventSessionId) {
    // Filtro por evento — prioritário, ignora scope
    where.eventSessionId = eventSessionId;
  } else if (scope === "today") {
    where.createdAt = { gte: startOfToday() };
  }

  const orders = await prisma.order.findMany({
    where,
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(orders.map(serializeOrder));
}

type RawItem = {
  // Novo formato (Fase 6) — preferido
  productId?: unknown;
  productSizeId?: unknown;
  ingredients?: unknown; // genérico (substitui toppings/flavor pra produtos novos)
  // Formato legacy (Fase 5) — ainda aceito
  kind?: unknown;
  size?: unknown;
  toppings?: unknown;
  flavor?: unknown;
  // Comum
  sauces?: unknown;
  notes?: unknown;
  quantity?: unknown;
};

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];
}

function asQuantity(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 1) return 1;
  if (n > 20) return 20;
  return Math.floor(n);
}

/**
 * Resolve o produto a usar — tenta productId (formato novo), senão
 * cai pra kind+size (formato legacy). Retorna null se não der pra resolver.
 */
async function resolveProduct(item: RawItem): Promise<{
  product: Product;
  productSize: ProductSize | null;
} | null> {
  const productId = asString(item.productId);
  if (productId) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { sizes: true },
    });
    if (!product) return null;
    const sizeId = asString(item.productSizeId);
    const productSize = sizeId ? product.sizes.find((s) => s.id === sizeId) ?? null : null;
    return { product, productSize };
  }
  // Legacy: kind+size — só funciona pra salgado/doce (formato Fase 5)
  const kind = asKind(item.kind);
  const size = asSize(item.size);
  if (!kind || !size) return null;
  const sizeName = size === "pequeno" ? "Pequeno" : size === "grande" ? "Grande" : size === "normal" ? "Normal" : "Mini Pack";
  const product = await prisma.product.findFirst({
    where: { type: kind, name: kind === "salgado" ? "Pastel Salgado" : "Pastel Doce" },
    include: { sizes: true },
  });
  if (!product) return null;
  const productSize = product.sizes.find((s) => s.name === sizeName) ?? null;
  return { product, productSize };
}

/**
 * Audit-Crit B #15+#25: decrementa estoque de produtos e ingredientes
 * usados no pedido. Best-effort — se algo falha, log e segue. Order
 * já tá commitado.
 *
 * Estratégia:
 *   - Produtos: decrement por quantity (ex: bebidas com stock=12, vendeu
 *     2 → stock=10)
 *   - Ingredientes: indexa por NAME (ordem armazena nome, não id).
 *     Soma uso total por nome (toppings+flavor+sauces × quantity) e
 *     decrementa em batch.
 *   - Não bloqueia negativo: stock=−1 é sinal de que admin esqueceu
 *     de atualizar. UI mostra "✕ acabou" e admin reconcilia.
 *
 * Broadcast `ingredient:updated` / `product:updated` pro atendente
 * refletir disponibilidade em tempo real no stepper (sem reload).
 */
type StockItem = {
  productId: string | null;
  toppings: string[];
  flavor: string | null;
  sauces: string[];
  quantity: number;
};

async function decrementStockBestEffort(items: StockItem[]) {
  // 1. Produtos: agrega por productId, decrement só se stock != null.
  const productQty = new Map<string, number>();
  for (const it of items) {
    if (!it.productId) continue;
    productQty.set(it.productId, (productQty.get(it.productId) ?? 0) + it.quantity);
  }
  for (const [productId, qty] of productQty) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.stock === null || product.stock === undefined) continue;
    const updated = await prisma.product.update({
      where: { id: productId },
      data: { stock: { decrement: qty } },
    });
    broadcast("product:updated", { id: updated.id, stock: updated.stock, available: updated.available });
  }

  // 2. Ingredientes: agrega por NOME (sauces, toppings, flavor todos
  //    contam). Multiplica pelo qty do item (3× Frango usa 3 frangos).
  const ingredientUsage = new Map<string, number>();
  for (const it of items) {
    for (const t of it.toppings) {
      ingredientUsage.set(t, (ingredientUsage.get(t) ?? 0) + it.quantity);
    }
    if (it.flavor) {
      ingredientUsage.set(it.flavor, (ingredientUsage.get(it.flavor) ?? 0) + it.quantity);
    }
    for (const s of it.sauces) {
      ingredientUsage.set(s, (ingredientUsage.get(s) ?? 0) + it.quantity);
    }
  }
  if (ingredientUsage.size === 0) return;

  const names = Array.from(ingredientUsage.keys());
  // Resolve por nome — mesma string pode aparecer em categorias diferentes
  // (ex: "Queijo" como topping E como combo). Decrementa todas as ocorrências.
  const found = await prisma.ingredient.findMany({
    where: { name: { in: names }, stock: { not: null } },
  });
  for (const ing of found) {
    const qty = ingredientUsage.get(ing.name) ?? 0;
    if (qty === 0) continue;
    const updated = await prisma.ingredient.update({
      where: { id: ing.id },
      data: { stock: { decrement: qty } },
    });
    broadcast("ingredient:updated", {
      id: updated.id,
      name: updated.name,
      category: updated.category,
      available: updated.available,
      stock: updated.stock,
      lowStockThreshold: updated.lowStockThreshold,
    });
  }
}

export async function POST(request: Request) {
  const auth = await requireRole(["atendente", "cozinha", "admin"]);
  if (auth instanceof NextResponse) return auth;

  // Idempotency-Key: se o cliente reusar a mesma key (double-tap, retry após
  // network blip), devolve a resposta cacheada em vez de criar pedido novo.
  // Cache TTL 10min em memória — vide lib/idempotency.ts.
  const idemKey = request.headers.get("x-idempotency-key");
  if (isValidIdempotencyKey(idemKey)) {
    const cached = getCachedIdempotency(idemKey);
    if (cached) {
      return NextResponse.json(cached.payload, { status: cached.status });
    }
  }

  const tHandler = performance.now();
  // Fase 6: trava agora é por EventSession (não mais DayClose).
  // Se nenhum caixa aberto, bloqueia. Se aberto, atribui o pedido a ele.
  const session = await getCurrentEventSession();
  if (!session) {
    return NextResponse.json(
      { error: "Caixa fechado. Peça pra abrir um caixa no admin antes de criar pedidos." },
      { status: 423 },
    );
  }

  let body: {
    clientName?: unknown;
    clientPhone?: unknown;
    optInMarketing?: unknown;
    items?: unknown;
    operator?: unknown;
    promotionId?: unknown;
    force?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const clientName = asString(body.clientName);
  if (!clientName) {
    return NextResponse.json({ error: "Nome do cliente é obrigatório." }, { status: 400 });
  }

  const clientPhone = normalizePhone(asString(body.clientPhone) ?? "");
  const optInMarketing = body.optInMarketing === true;
  const createdBy = asString(body.operator) ?? "—";
  // `force: true` no body bypassa a checagem de duplicado (audit-crit #2).
  // UI atendente seta isso após confirmação explícita no dialog "esse é um
  // novo pedido mesmo?". Não bypassa idempotency (caso UI envie outra coisa).
  const forceDuplicate = body.force === true;

  const rawItems = Array.isArray(body.items) ? (body.items as RawItem[]) : [];
  if (rawItems.length === 0) {
    return NextResponse.json({ error: "O pedido precisa ter ao menos um item." }, { status: 400 });
  }

  // session já foi resolvida no topo do handler — guardada pra usar abaixo
  try {
    // Resolve produtos pra todos os items antes de criar o pedido
    type ResolvedItem = {
      productId: string | null;
      productSizeId: string | null;
      productName: string;
      kind: string;
      size: string;
      toppings: string[];
      flavor: string | null;
      sauces: string[];
      notes: string | null;
      unitPrice: number;
      quantity: number;
    };

    const resolvedItems: ResolvedItem[] = [];
    for (let idx = 0; idx < rawItems.length; idx++) {
      const item = rawItems[idx];
      const resolved = await resolveProduct(item);
      if (!resolved) {
        throw new Error(`Item ${idx + 1}: produto inválido ou não cadastrado.`);
      }
      const { product, productSize } = resolved;

      // pricingMode='by_size' exige size escolhido
      if (product.pricingMode === "by_size" && !productSize) {
        throw new Error(`Item ${idx + 1}: ${product.name} precisa de tamanho.`);
      }

      // Ingredientes — aceita tanto `ingredients` (novo) quanto `toppings`/`flavor` (legacy)
      let ingredients: string[];
      const newIngs = asStringArray(item.ingredients);
      if (newIngs.length > 0) {
        ingredients = newIngs;
      } else if (product.type === "salgado" || product.type === "macarrao") {
        ingredients = asStringArray(item.toppings);
      } else if (product.type === "doce") {
        const f = asString(item.flavor);
        ingredients = f ? [f] : [];
      } else if (product.type === "combo") {
        ingredients = asStringArray(item.toppings);
      } else {
        ingredients = [];
      }

      // Regra legacy do pastel pequeno (mantém pra UI atual)
      if (
        product.type === "salgado" &&
        productSize?.name === "Pequeno" &&
        ingredients.length > MAX_TOPPINGS_PEQUENO
      ) {
        throw new Error(`Item ${idx + 1}: Pequeno aceita no máximo ${MAX_TOPPINGS_PEQUENO} ingredientes.`);
      }

      // Valida min/max do produto
      const validationErr = validateIngredientSelection(product, ingredients);
      if (validationErr) {
        throw new Error(`Item ${idx + 1}: ${validationErr}`);
      }

      const sauces = product.allowsSauces ? asStringArray(item.sauces) : [];

      // Preço sempre do DB (Fase 6) — admin edita produto/size e reflete
      // automaticamente em pedidos novos. lib/pricing.ts vira só display.
      const unitPrice = computeUnitPrice(product, productSize, sauces.length);

      // Snapshot legacy fields pra manter código antigo funcionando
      const legacyKind = product.type;
      const legacySize = productSize?.name?.toLowerCase() ?? "";
      // Mapeia size de volta pros valores antigos (pequeno/grande/normal/mini)
      const legacySizeMap: Record<string, string> = {
        "pequeno": "pequeno",
        "grande": "grande",
        "normal": "normal",
        "mini pack": "mini",
      };
      const finalLegacySize = legacySizeMap[legacySize] ?? legacySize;

      // Pra back-compat: salgado precisa de "toppings", doce precisa de "flavor"
      const legacyToppings =
        product.type === "salgado" || product.type === "macarrao" || product.type === "combo"
          ? ingredients
          : [];
      const legacyFlavor = product.type === "doce" ? ingredients[0] ?? null : null;

      resolvedItems.push({
        productId: product.id,
        productSizeId: productSize?.id ?? null,
        productName: product.name,
        kind: legacyKind,
        size: finalLegacySize,
        toppings: legacyToppings,
        flavor: legacyFlavor,
        sauces,
        notes: asString(item.notes),
        unitPrice,
        quantity: asQuantity(item.quantity),
      });
    }

    // Promoção (opcional) — valida elegibilidade e calcula desconto
    let promotionId: string | null = null;
    let promotionName: string | null = null;
    let discountCents = 0;
    const promoIdInput = typeof body.promotionId === "string" ? body.promotionId : null;
    if (promoIdInput) {
      const promoRaw = await prisma.promotion.findUnique({ where: { id: promoIdInput } });
      if (promoRaw && promoRaw.active) {
        const promo = serializePromotion(promoRaw);
        const cart = resolvedItems.map((it) => ({
          productId: it.productId,
          unitPriceCents: it.unitPrice,
          quantity: it.quantity,
        }));
        // Revalida server-side — independente se promo é auto ou cupom.
        // Cliente já validou ao aplicar; servidor reconfirma pra evitar
        // bypass via curl direto.
        if (isApplicable(promo, cart)) {
          const subtotal = cart.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0);
          discountCents = computeDiscount(promo, subtotal, cart);
          promotionId = promo.id;
          promotionName = promo.name;
        }
      }
    }

    // Regra de bypass: se TODO mundo no pedido é bebida, não precisa
    // passar pela cozinha — vai direto pra PRONTO (atendente entrega).
    // Se tiver mix (pastel + bebida), segue fluxo normal e a cozinha
    // filtra os items que ela precisa preparar (vide CozinhaClient).
    const allBebida = resolvedItems.every((it) => it.kind === "bebida");
    const initialStatus = allBebida ? "PRONTO" : "PEDIDO_FEITO";
    const now = new Date();

    // === Detecção de pedido duplicado (audit-crit #2) ===========
    // Cenário: internet caiu, Maria clicou "Confirmar" 2 vezes, criou 2
    // pedidos idênticos. Idempotency-Key cobre double-tap mesma submissão;
    // ESSE check cobre intervalos curtos com chamadas separadas.
    //
    // Heurística: mesmo clientPhone (se setado) + mesmo total + mesmo
    // count de items nos últimos 90s. Conservador — só dispara em padrão
    // muito provável de duplicação. UI mostra dialog "Esse é um novo
    // pedido mesmo?" e re-submete com force:true se confirmado.
    //
    // Se SEM telefone, não checa — atendente "Balcão" pode ter 2 pessoas
    // diferentes pedindo igual de seguida e isso é legítimo.
    if (clientPhone && !forceDuplicate) {
      const ninetySecondsAgo = new Date(now.getTime() - 90_000);
      const expectedTotal = resolvedItems.reduce(
        (s, it) => s + it.unitPrice * it.quantity,
        0,
      );
      const expectedItemCount = resolvedItems.length;
      const candidates = await prisma.order.findMany({
        where: {
          clientPhone,
          createdAt: { gte: ninetySecondsAgo },
          status: { notIn: ["CANCELADO"] },
        },
        include: { items: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
      const duplicate = candidates.find((o) => {
        if (o.items.length !== expectedItemCount) return false;
        const oTotal = o.items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
        return Math.abs(oTotal - expectedTotal) < 1; // tolerância 1 centavo
      });
      if (duplicate) {
        return NextResponse.json(
          {
            error: `Já tem pedido similar pra ${clientName} (#${String(duplicate.id).padStart(3, "0")}) há poucos segundos. É outro pedido novo?`,
            code: "DUPLICATE_SUSPECTED",
            existingOrderId: duplicate.id,
            existingCreatedAt: duplicate.createdAt.toISOString(),
          },
          { status: 409 },
        );
      }
    }

    // Fase 7 CRM: se tem telefone, upsert no Customer. Agrega totais.
    // Phone vem normalizado +55XXX do normalizePhone().
    // finalCents é o valor real cobrado (já com desconto aplicado).
    const finalCentsForCustomer =
      resolvedItems.reduce((s, it) => s + it.unitPrice * it.quantity, 0) - discountCents;
    let customerId: string | null = null;
    if (clientPhone) {
      // Opt-in marketing: só promove false → true. Não rebaixa true → false
      // automaticamente (revogação tem que ser explícita via /api/customers/[id]).
      const existingCustomer = await prisma.customer.findUnique({
        where: { phone: clientPhone },
      });
      const finalOptInMarketing =
        existingCustomer?.optInMarketing === true ? true : optInMarketing;

      const customer = await prisma.customer.upsert({
        where: { phone: clientPhone },
        create: {
          phone: clientPhone,
          name: clientName,
          optInMarketing: finalOptInMarketing,
          firstOrderAt: now,
          lastOrderAt: now,
          totalOrders: 1,
          totalSpentCents: Math.max(0, finalCentsForCustomer),
        },
        update: {
          name: clientName, // atualiza nome se mudou desde último pedido
          optInMarketing: finalOptInMarketing,
          lastOrderAt: now,
          totalOrders: { increment: 1 },
          totalSpentCents: { increment: Math.max(0, finalCentsForCustomer) },
          // Se cliente havia sido soft-deletado e voltou, "ressuscita"
          deletedAt: null,
        },
      });
      customerId = customer.id;
    }

    const tBeforeDb = performance.now();
    const order = await prisma.order.create({
      data: {
        clientName,
        clientPhone,
        createdBy,
        status: initialStatus,
        // Quando bypassa, marca como "pronto" pelo próprio atendente que criou
        readyBy: allBebida ? createdBy : null,
        readyAt: allBebida ? now : null,
        eventSessionId: session?.id ?? null,
        promotionId,
        promotionName,
        discountCents,
        customerId,
        items: {
          create: resolvedItems.map((it) => ({
            productId: it.productId,
            productSizeId: it.productSizeId,
            productName: it.productName,
            kind: it.kind,
            size: it.size,
            toppings: JSON.stringify(it.toppings),
            flavor: it.flavor,
            sauces: JSON.stringify(it.sauces),
            notes: it.notes,
            unitPrice: it.unitPrice,
            quantity: it.quantity,
          })),
        },
      },
      include: { items: true },
    });
    const tAfterDb = performance.now();

    const serialized = serializeOrder(order);
    broadcast("order:created", serialized);

    // Audit-Crit B #15: auto-decrement de estoque pra produtos e ingredientes
    // cadastrados com `stock != null`. Best-effort — falha aqui NÃO derruba
    // o pedido (order já tá commitado; estoque é correção, não verdade).
    // Admin vê os badges "acabando/acabou" no Cardápio e ajusta.
    //
    // Broadcast `ingredient:updated` / `product:updated` (B #25) pra
    // atendente refletir disponibilidade em tempo real no stepper.
    decrementStockBestEffort(resolvedItems).catch((e) => {
      console.error(`[stock] decrement failed for order ${order.id}:`, e);
    });

    const tEnd = performance.now();
    console.log(
      `[SSE-LAT] POST /api/orders id=${order.id} parse+validate=${(tBeforeDb - tHandler).toFixed(1)}ms db=${(tAfterDb - tBeforeDb).toFixed(1)}ms broadcast+resp=${(tEnd - tAfterDb).toFixed(1)}ms total=${(tEnd - tHandler).toFixed(1)}ms session=${session?.id ?? "—"}`,
    );

    // Cacheia idempotency só em caso de sucesso — se der erro, o cliente
    // pode tentar de novo com o mesmo key sem ficar preso a uma resposta ruim
    if (isValidIdempotencyKey(idemKey)) {
      setCachedIdempotency(idemKey, 201, serialized);
    }

    return NextResponse.json(serialized, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao criar pedido.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
