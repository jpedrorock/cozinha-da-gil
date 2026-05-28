import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { asKind, asSize, serializeOrder } from "@/lib/orders";
import { computeUnitPrice, validateIngredientSelection } from "@/lib/products";
import { MAX_TOPPINGS_PEQUENO } from "@/lib/pricing";
import { broadcast } from "@/lib/sse";
import { requireRole } from "@/lib/session";
import type { Product, ProductSize } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RawItem = {
  productId?: unknown;
  productSizeId?: unknown;
  ingredients?: unknown;
  kind?: unknown;
  size?: unknown;
  toppings?: unknown;
  flavor?: unknown;
  sauces?: unknown;
  notes?: unknown;
  quantity?: unknown;
};

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : [];
}

function asQuantity(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 1) return 1;
  if (n > 20) return 20;
  return Math.floor(n);
}

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
  // Legacy: kind+size
  const kind = asKind(item.kind);
  const size = asSize(item.size);
  if (!kind || !size) return null;
  const sizeName =
    size === "pequeno" ? "Pequeno" :
    size === "grande" ? "Grande" :
    size === "normal" ? "Normal" :
    "Mini Pack";
  const product = await prisma.product.findFirst({
    where: { type: kind, name: kind === "salgado" ? "Pastel Salgado" : "Pastel Doce" },
    include: { sizes: true },
  });
  if (!product) return null;
  const productSize = product.sizes.find((s) => s.name === sizeName) ?? null;
  return { product, productSize };
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireRole(["atendente", "admin"]);
  if (auth instanceof NextResponse) return auth;

  const id = Number.parseInt(params.id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  let body: { items?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  // Audit-Crit #1+#6: permite editar em EM_PREPARO também. Cliente desiste
  // de UM item ("esquece o suco") com cozinha já preparando — bloquear edit
  // força cancelar pedido inteiro + refazer (perde histórico, irrita cozinha).
  // Sinaliza a edição com `_editedInPreparation: true` no payload do
  // broadcast: cozinha pode dar flash visual no card pra não passar batido.
  const canEdit =
    existing.status === "PEDIDO_FEITO" || existing.status === "EM_PREPARO";
  if (!canEdit) {
    // Audit-Crit C #19: ORDER_LOCKED code permite frontend mostrar
    // estado atual ("Pedido já entregue, não dá pra editar").
    return NextResponse.json(
      {
        error: "Pedido encerrado, não dá pra editar.",
        code: "ORDER_LOCKED",
        currentStatus: existing.status,
      },
      { status: 409 },
    );
  }
  const wasInPreparation = existing.status === "EM_PREPARO";

  const rawItems = Array.isArray(body.items) ? (body.items as RawItem[]) : [];
  if (rawItems.length === 0) {
    return NextResponse.json({ error: "O pedido precisa ter ao menos um item." }, { status: 400 });
  }

  try {
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

    const resolved: ResolvedItem[] = [];
    for (let idx = 0; idx < rawItems.length; idx++) {
      const item = rawItems[idx];
      const r = await resolveProduct(item);
      if (!r) throw new Error(`Item ${idx + 1}: produto inválido ou não cadastrado.`);
      const { product, productSize } = r;

      if (product.pricingMode === "by_size" && !productSize) {
        throw new Error(`Item ${idx + 1}: ${product.name} precisa de tamanho.`);
      }

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

      if (
        product.type === "salgado" &&
        productSize?.name === "Pequeno" &&
        ingredients.length > MAX_TOPPINGS_PEQUENO
      ) {
        throw new Error(`Item ${idx + 1}: Pequeno aceita no máximo ${MAX_TOPPINGS_PEQUENO} ingredientes.`);
      }

      const validationErr = validateIngredientSelection(product, ingredients);
      if (validationErr) throw new Error(`Item ${idx + 1}: ${validationErr}`);

      const sauces = product.allowsSauces ? asStringArray(item.sauces) : [];
      const unitPrice = computeUnitPrice(product, productSize, sauces.length);

      const legacySizeMap: Record<string, string> = {
        "pequeno": "pequeno", "grande": "grande", "normal": "normal", "mini pack": "mini",
      };
      const sizeNameLower = productSize?.name?.toLowerCase() ?? "";
      const finalLegacySize = legacySizeMap[sizeNameLower] ?? sizeNameLower;
      const legacyToppings =
        product.type === "salgado" || product.type === "macarrao" || product.type === "combo"
          ? ingredients : [];
      const legacyFlavor = product.type === "doce" ? ingredients[0] ?? null : null;

      resolved.push({
        productId: product.id,
        productSizeId: productSize?.id ?? null,
        productName: product.name,
        kind: product.type,
        size: finalLegacySize,
        toppings: legacyToppings,
        flavor: legacyFlavor,
        sauces,
        notes: asString(item.notes),
        unitPrice,
        quantity: asQuantity(item.quantity),
      });
    }

    const order = await prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { orderId: id } });
      await tx.orderItem.createMany({
        data: resolved.map((it) => ({
          orderId: id,
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
      });
      return tx.order.findUniqueOrThrow({
        where: { id },
        include: { items: true },
      });
    });

    const serialized = serializeOrder(order);
    // Anexa hint transiente (não persistido) pra cozinha destacar visualmente
    // que esse pedido foi mexido enquanto preparava. Sem isso, o card só
    // re-renderiza silenciosamente e o cozinheiro pode pegar a versão antiga.
    const payload = wasInPreparation
      ? { ...serialized, _editedInPreparation: true }
      : serialized;
    broadcast("order:updated", payload);

    return NextResponse.json(serialized);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao atualizar pedido.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
