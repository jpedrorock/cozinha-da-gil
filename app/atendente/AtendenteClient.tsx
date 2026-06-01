"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSwipeable } from "react-swipeable";
import { AlertTriangle, Calculator, Check, Lock, MessageCircle, Minus, Pencil, Plus, RotateCcw, Tag, X } from "lucide-react";
import type { Ingredient, OrderStatus } from "@prisma/client";
import { AppHeader } from "@/components/AppHeader";
import { TrocoCalculator } from "@/components/TrocoCalculator";
import { OrderCard } from "@/components/OrderCard";
import { CancelDialog } from "@/components/CancelDialog";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { SwipeableCartItem } from "@/components/SwipeableCartItem";
import { buildWaNativeUrl, buildWaUrl, templateOrderReady, templateReceipt } from "@/lib/whatsapp-templates";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import {
  BebidaIcon,
  MacarraoIcon,
  PackMiniIcon,
  PastelDoceIcon,
  PastelSalgadoIcon,
  PromocaoIcon,
} from "@/components/icons";
import { useIdleLogout } from "@/lib/use-idle-logout";
import { useSSE } from "@/lib/use-sse";
import { sseDebugEnabled } from "@/lib/sse-debug";
import { useOperator } from "@/lib/use-operator";
import type { OrderView } from "@/lib/orders";
import { isStaleEventSession, type EventSessionStatus } from "@/lib/event-session-shared";
import type { ProductView } from "@/lib/products";
import { isExpressProduct } from "@/lib/products";
import { computeDiscount, detectApplicable, findCouponMatch, type PromotionView } from "@/lib/promotions";
import {
  formatBRL,
  MAX_TOPPINGS_PEQUENO,
  PRICE,
  type Kind,
  type Size,
} from "@/lib/pricing";

// Phase "product" foi adicionada como primeiro passo após "client".
// Quando produto é salgado/doce, flui pro caminho legacy (size → content...).
// Phases simplificadas pós-redesign:
//   client    → nome opcional + telefone
//   product   → escolhe categoria (com express add pra bebidas)
//   configure → hub único: tamanho + ingredientes + extras + qty (substitui
//               size/content/sauces/notes/quantity que existiam separados)
//   cart      → revisão final
// Phases legacy mantidas no tipo durante migração — phasesForProduct
// agora só retorna client/product/configure/cart.
type Phase = "client" | "product" | "kind" | "size" | "content" | "sauces" | "notes" | "quantity" | "configure" | "cart";

type Building = {
  // Fase 6 — produto escolhido
  productId?: string;
  productSizeId?: string;
  productType?: string;   // 'salgado' | 'doce' | 'bebida' | 'macarrao' | 'combo'
  productName?: string;
  // Conteúdo (genérico)
  ingredients: string[];   // toppings/flavor/4-sabores — universal
  sauces: string[];
  notes?: string;
  quantity: number;
  // Legacy (mantido pra back-compat com cart/edit UI)
  kind?: Kind;
  size?: Size;
};

type Built = {
  productId: string | null;
  productSizeId: string | null;
  productType: string;
  productName: string;
  sizeName: string | null;
  ingredients: string[];
  sauces: string[];
  notes: string | null;
  quantity: number;
  unitPriceCents: number; // pré-calculado pro cart
  // Legacy display
  kind: Kind | null;
  size: Size | null;
};


function emptyBuilding(): Building {
  return { ingredients: [], sauces: [], quantity: 1 };
}

function isBuildingComplete(b: Building, product: ProductView | null): boolean {
  if (!product) return false;
  // by_size precisa de productSizeId
  if (product.pricingMode === "by_size" && !b.productSizeId) return false;
  // ingredientes: respeita min
  if (product.allowsIngredients && product.minIngredients && b.ingredients.length < product.minIngredients) {
    return false;
  }
  // ingredientes obrigatórios pra salgado/macarrao (regra histórica: pelo menos 1)
  if ((product.type === "salgado" || product.type === "macarrao") && b.ingredients.length === 0) {
    return false;
  }
  return true;
}

function unitPriceOfBuilding(b: Building, product: ProductView | null): number {
  if (!product) return 0;
  const sizePrice =
    product.pricingMode === "fixed"
      ? product.basePriceCents ?? 0
      : product.sizes.find((s) => s.id === b.productSizeId)?.priceCents ?? 0;
  return sizePrice + b.sauces.length * 150;
}

function builtFromOrderItem(
  it: {
    kind: string;
    size: string;
    toppings: string[];
    flavor: string | null;
    sauces: string[];
    notes: string | null;
    quantity: number;
    productId?: string | null;
    productSizeId?: string | null;
    productName?: string | null;
    unitPrice: number;
  },
): Built {
  // Reconstrói o "Built" snapshot do que veio do DB.
  // Combina ingredients: toppings ∪ {flavor} dependendo do kind.
  const ingredients =
    it.kind === "doce" && it.flavor ? [it.flavor] : it.toppings;
  return {
    productId: it.productId ?? null,
    productSizeId: it.productSizeId ?? null,
    productType: it.kind,
    productName: it.productName || (it.kind === "salgado" ? "Pastel Salgado" : it.kind === "doce" ? "Pastel Doce" : it.kind),
    sizeName: it.size || null,
    ingredients,
    sauces: it.sauces,
    notes: it.notes,
    quantity: Math.max(1, it.quantity || 1),
    unitPriceCents: it.unitPrice,
    kind: (it.kind === "salgado" || it.kind === "doce") ? (it.kind as Kind) : null,
    size: it.size ? (it.size as Size) : null,
  };
}

function priceOfBuilt(b: Built): number {
  return b.unitPriceCents * b.quantity;
}

export function AtendenteClient({
  ingredients: initialIngredientsArg,
  initialOrders,
  initialEventStatus,
  initialProducts,
  initialPromotions,
}: {
  ingredients: Record<string, Ingredient[]>;
  initialOrders: OrderView[];
  initialEventStatus: EventSessionStatus;
  initialProducts: ProductView[];
  initialPromotions: PromotionView[];
}) {
  const router = useRouter();
  const { operator, ready, clear } = useOperator();

  useEffect(() => {
    if (ready && (!operator || operator.role !== "atendente")) {
      router.replace("/");
    }
  }, [ready, operator, router]);

  // Auto-logout por inatividade (30min). Tablet esquecido em festa.
  // Pausado durante creating=true: atendente conversa com cliente em pé,
  // não toca a tela por 5min e o draft sumia. Audit P0 #01.

  // Fase 6: lista de produtos disponíveis. SSR já entrega via initialProducts —
  // não refazemos o fetch no mount pra evitar request duplicado em cada nav.
  // Audit-Crit B #25: mudanças do admin (stock, available, preço) propagam
  // via SSE — listener abaixo faz merge no state local sem reload.
  const [products, setProducts] = useState<ProductView[]>(initialProducts);
  // Ingredientes vêm do SSR (initialIngredients) — converto pra state pra
  // poder fazer merge via SSE quando admin toggla available ou ajusta stock.
  const [ingredients, setIngredients] = useState(initialIngredientsArg);

  const allToppings = ingredients.topping ?? [];
  const allDoces = ingredients.doce ?? [];
  const allMolhos = ingredients.molho ?? [];
  const allMacarraoToppings = ingredients.macarrao_topping ?? [];
  const allMacarraoMolhos = ingredients.macarrao_molho ?? [];
  const toppings = allToppings.filter((i) => i.available);
  const doces = allDoces.filter((i) => i.available);
  const molhos = allMolhos.filter((i) => i.available);
  const macarraoToppings = allMacarraoToppings.filter((i) => i.available);
  const macarraoMolhos = allMacarraoMolhos.filter((i) => i.available);

  // Promoções ativas — vêm do SSR (page.tsx faz query no boot).
  // Sem useEffect+fetch — atende o critério do backlog (eliminação do
  // round-trip extra após mount, mesma latência do produto/orders).
  const [promotions] = useState<PromotionView[]>(initialPromotions);
  const [selectedPromoId, setSelectedPromoId] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("client");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  // Opt-in marketing — só promove false → true (default off pra ser explícito).
  // Backend não rebaixa true → false em update; remoção é manual via admin.
  const [clientOptInMarketing, setClientOptInMarketing] = useState(false);
  const [built, setBuilt] = useState<Built[]>([]);
  const [current, setCurrent] = useState<Building>(emptyBuilding());
  // Edição in-place: idx do item sendo editado no cart (drawer aberto).
  // Quando setado, EditDrawer renderiza com snapshot em editDraft.
  const [editingDraftIdx, setEditingDraftIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Building>(emptyBuilding());
  const [orders, setOrders] = useState<OrderView[]>(initialOrders);
  const [filter, setFilter] = useState<"todos" | OrderStatus>("PRONTO");
  const [submitting, setSubmitting] = useState(false);
  // Audit-Crit B #14: toasts agora aceitam action opcional (Undo etc).
  // Com action, fica 6s em vez de 2.6s pra dar tempo do user reagir.
  const [toast, setToast] = useState<
    { text: string; action?: { label: string; onClick: () => void } } | null
  >(null);
  const [cancelTarget, setCancelTarget] = useState<OrderView | null>(null);
  // Hook imperativo de confirmação (substitui window.confirm). Retorna
  // `confirm({ title, message, ... })` que resolve true/false, mais o `node`
  // que precisa ser montado no JSX. Audit-Crit #2: dedup server-side.
  const { confirm, node: confirmNode } = useConfirmDialog();
  const [eventStatus, setEventStatus] = useState<EventSessionStatus>(initialEventStatus);
  const caixaFechado = !eventStatus.open;
  // Caixa órfão: aberto há +12h, provavelmente Gil esqueceu de fechar.
  // Vendas novas vão pra esse caixa errado se não alertar. Audit-Crit #5.
  const caixaOrfao =
    eventStatus.open && isStaleEventSession(eventStatus.openedAt, 12);
  // Dismiss do banner dentro da sessão atual — atendente pode ignorar se
  // sabe que tá certo (festa overnight legítima). Reabre se trocar caixa.
  const [staleDismissed, setStaleDismissed] = useState(false);

  // Auto-logout por inatividade (30min). Pausado durante `creating`: atendente
  // conversa com cliente em pé, fica 5min sem tocar a tela e o draft sumia
  // com o logout. Audit P0 #01.
  useIdleLogout(
    () => {
      clear();
      router.replace("/");
    },
    30 * 60 * 1000,
    creating,
  );

  // === Draft persistido em sessionStorage (audit P0 #01) ===========
  // Cobertura: idle logout, refresh acidental do navegador, navegar pra
  // outra aba e voltar. NÃO cobre fechar a aba (sessionStorage some no
  // close). Pra isso seria localStorage — mas aí dois atendentes no mesmo
  // browser veriam o draft um do outro. Trade-off OK pra single-device.
  const DRAFT_KEY = "pdg:atendente-draft-v1";
  type Draft = {
    creating: boolean;
    phase: Phase;
    clientName: string;
    clientPhone: string;
    clientOptInMarketing: boolean;
    built: Built[];
    current: Building;
    editingOrderId: number | null;
    selectedPromoId: string | null;
  };
  // Restore no mount — se houver draft + estava em creating, restaura.
  // Refs pra evitar dependências que disparariam o save logo após restore.
  const draftRestoredRef = useRef(false);
  useEffect(() => {
    if (draftRestoredRef.current) return;
    draftRestoredRef.current = true;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d: Draft = JSON.parse(raw);
      if (!d.creating) return; // só restaura se estava no meio de um pedido
      setCreating(true);
      setPhase(d.phase);
      setClientName(d.clientName);
      setClientPhone(d.clientPhone);
      setClientOptInMarketing(d.clientOptInMarketing);
      setBuilt(d.built);
      setCurrent(d.current);
      setEditingOrderId(d.editingOrderId);
      setSelectedPromoId(d.selectedPromoId);
    } catch {
      // Draft corrompido — descarta silencioso, não vale travar UI por isso
      sessionStorage.removeItem(DRAFT_KEY);
    }
  }, []);

  // Salva a cada mudança relevante. Roda DEPOIS do restore (ref guard).
  useEffect(() => {
    if (!draftRestoredRef.current) return;
    // Só persiste enquanto está criando. Fora disso, limpa pra não sujar.
    if (!creating) {
      sessionStorage.removeItem(DRAFT_KEY);
      return;
    }
    const draft: Draft = {
      creating,
      phase,
      clientName,
      clientPhone,
      clientOptInMarketing,
      built,
      current,
      editingOrderId,
      selectedPromoId,
    };
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // QuotaExceeded ou modo privado — não dá pra fazer nada, segue UI
    }
  }, [creating, phase, clientName, clientPhone, clientOptInMarketing, built, current, editingOrderId, selectedPromoId]);

  // Idempotency-key: gerado uma vez por "intent" (uma submissão de pedido).
  // Reusado em retries dentro da mesma submitOrder (double-tap, network blip)
  // pra que o servidor devolva a mesma resposta em vez de criar pedidos
  // duplicados. Limpo a cada resetOrder() — nova intent gera novo key.
  // O cache server-side em lib/idempotency.ts só popula em sucesso, então
  // se falhar o usuário pode tentar novamente com o mesmo key sem trava.
  const idemKeyRef = useRef<string | null>(null);
  function ensureIdemKey(): string {
    if (!idemKeyRef.current) {
      idemKeyRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `pdg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
    }
    return idemKeyRef.current;
  }

  useSSE("/api/sse", {
    "order:created": (data) => {
      const order = data as OrderView;
      setOrders((prev) => [order, ...prev.filter((o) => o.id !== order.id)]);
    },
    "order:updated": (data) => {
      const order = data as OrderView;
      setOrders((prev) => prev.map((o) => (o.id === order.id ? order : o)));
      // Fase 7 #4 — auto-surface 1-toque: quando cozinha marca PRONTO e o
      // pedido tem telefone (e ainda não foi notificado), pop o banner.
      // surfacedReadyRef garante que não re-aparece se o user dispensar.
      if (
        order.status === "PRONTO" &&
        order.clientPhone &&
        !order.notifiedReadyAt &&
        !surfacedReadyRef.current.has(order.id)
      ) {
        surfacedReadyRef.current.add(order.id);
        setPendingNotify(order);
      }
    },
    "event:opened": (data) => {
      const d = data as { id: string; name: string | null; eventDate: string | null; openedAt: string; openedBy: string };
      setEventStatus({ open: true, id: d.id, name: d.name, eventDate: d.eventDate ?? null, openedAt: d.openedAt, openedBy: d.openedBy });
    },
    "event:closed": () => {
      setEventStatus({ open: false, id: null, name: null, eventDate: null, openedAt: null, openedBy: null });
    },
    // Audit-Crit B #25: admin marca "acabou bacon" → atendente vê chip
    // desabilitado em ~1s. Sem isso, atendente vendia algo indisponível e
    // cozinha rejeitava no balcão. Merge no objeto Record<category, Ingredient[]>
    // mantendo posição original (apenas atualiza campos do item afetado).
    "ingredient:updated": (data) => {
      const ing = data as {
        id: string;
        name: string;
        category: string;
        available: boolean;
        stock: number | null;
        lowStockThreshold: number | null;
      };
      setIngredients((prev) => {
        const list = prev[ing.category] ?? [];
        const next = list.map((i) =>
          i.id === ing.id
            ? { ...i, available: ing.available, stock: ing.stock, lowStockThreshold: ing.lowStockThreshold }
            : i,
        );
        return { ...prev, [ing.category]: next };
      });
    },
    // Admin arrastou ingredientes pra nova ordem — chips do stepper
    // reordenam em tempo real sem reload. Items que sumiram do array
    // (deletados em paralelo) ficam onde estavam até o próximo refresh.
    "ingredient:reordered": (data) => {
      const evt = data as { category: string; orderedIds: string[] };
      setIngredients((prev) => {
        const list = prev[evt.category];
        if (!list) return prev;
        const byId = new Map(list.map((i) => [i.id, i]));
        const reordered: Ingredient[] = [];
        evt.orderedIds.forEach((id) => {
          const i = byId.get(id);
          if (i) {
            reordered.push(i);
            byId.delete(id);
          }
        });
        // Items não mencionados (stale local) ficam no fim
        const rest = Array.from(byId.values());
        return { ...prev, [evt.category]: [...reordered, ...rest] };
      });
    },
    "product:updated": (data) => {
      const p = data as {
        id: string;
        name: string;
        available: boolean;
        stock: number | null;
        lowStockThreshold: number | null;
        basePriceCents: number | null;
      };
      setProducts((prev) =>
        prev.map((item) =>
          item.id === p.id
            ? {
                ...item,
                available: p.available,
                stock: p.stock,
                lowStockThreshold: p.lowStockThreshold,
                basePriceCents: p.basePriceCents,
              }
            : item,
        ),
      );
    },
  });

  function showToast(
    msg: string,
    action?: { label: string; onClick: () => void },
  ) {
    setToast({ text: msg, action });
    setTimeout(() => setToast(null), action ? 6000 : 2600);
  }

  function resetOrder() {
    setClientName("");
    setClientPhone("");
    setClientOptInMarketing(false);
    setBuilt([]);
    setCurrent(emptyBuilding());
    setPhase("client");
    setCreating(false);
    setEditingOrderId(null);
    setSelectedPromoId(null);
    // Encerra a "intent" — próxima submissão é considerada um pedido novo.
    idemKeyRef.current = null;
  }

  function startBuilding() {
    // Nome opcional: se vazio, vira "Balcão" automaticamente.
    // Atendimento de balcão alta-rotação não precisa anotar nome.
    if (!clientName.trim()) setClientName("Balcão");
    setPhase("product");
  }

  function openNew() {
    if (caixaFechado) return;
    setClientName("");
    setClientPhone("");
    setClientOptInMarketing(false);
    setBuilt([]);
    setCurrent(emptyBuilding());
    setPhase("client");
    setCreating(true);
    setEditingOrderId(null);
  }

  function openEdit(order: OrderView) {
    setClientName(order.clientName);
    setClientPhone(order.clientPhone ?? "");
    setBuilt(order.items.map((it) => builtFromOrderItem(it)));
    setCurrent(emptyBuilding());
    setPhase("cart");
    setCreating(true);
    setEditingOrderId(order.id);
  }

  function finishCurrentPastel() {
    const product = products.find((p) => p.id === current.productId) ?? null;
    if (!isBuildingComplete(current, product) || !product) return;
    const productSize = product.sizes.find((s) => s.id === current.productSizeId) ?? null;
    const unitPriceCents = unitPriceOfBuilding(current, product);
    const isLegacy = product.type === "salgado" || product.type === "doce";
    setBuilt((prev) => [
      ...prev,
      {
        productId: product.id,
        productSizeId: productSize?.id ?? null,
        productType: product.type,
        productName: product.name,
        sizeName: productSize?.name ?? null,
        ingredients: current.ingredients,
        sauces: current.sauces,
        notes: current.notes?.trim() || null,
        quantity: Math.max(1, current.quantity || 1),
        unitPriceCents,
        kind: isLegacy ? (product.type as Kind) : null,
        size: current.size ?? null,
      },
    ]);
    setCurrent(emptyBuilding());
    setPhase("cart");
  }

  function addAnotherPastel() {
    setCurrent(emptyBuilding());
    setPhase("product");
  }

  /** Express add — adiciona produto sem passar por configure. Pra bebidas
   *  (Coca, Suco, Água) que não têm tamanho/ingrediente/molho. 1 toque
   *  = 1 item no cart. */
  function addExpressToCart(product: ProductView) {
    const unitPriceCents = product.basePriceCents ?? 0;
    setBuilt((prev) => [
      ...prev,
      {
        productId: product.id,
        productSizeId: null,
        productType: product.type,
        productName: product.name,
        sizeName: null,
        ingredients: [],
        sauces: [],
        notes: null,
        quantity: 1,
        unitPriceCents,
        kind: null,
        size: null,
      },
    ]);
    setCurrent(emptyBuilding());
    setPhase("cart");
  }

  function setBuiltQuantity(idx: number, delta: number) {
    setBuilt((prev) =>
      prev.map((b, i) =>
        i === idx ? { ...b, quantity: Math.min(20, Math.max(1, b.quantity + delta)) } : b,
      ),
    );
  }

  /** Duplica item do cart — pra "+ Mais 1 igual" (atendente ouve cliente
   *  dizer "outro igual" sem refazer todo o setup do pastel). */
  function duplicateBuilt(idx: number) {
    setBuilt((prev) => {
      const item = prev[idx];
      if (!item) return prev;
      // Shallow copy basta — arrays internos (ingredients/sauces) são
      // imutados no cart (só dá pra editar via editBuiltItem que substitui).
      return [...prev, { ...item }];
    });
  }

  /** Abre drawer de edição in-place. NÃO remove o item do cart — mantém
   *  posição. Quando atendente "Salva", substitui; "Cancela" fecha sem
   *  alterar. Mantém contexto do cart visível atrás do drawer. */
  function editBuiltItem(idx: number) {
    const item = built[idx];
    if (!item) return;
    const isLegacy = item.productType === "salgado" || item.productType === "doce";
    setEditDraft({
      productId: item.productId ?? undefined,
      productSizeId: item.productSizeId ?? undefined,
      productType: item.productType,
      productName: item.productName,
      ingredients: [...item.ingredients],
      sauces: [...item.sauces],
      notes: item.notes ?? undefined,
      quantity: item.quantity,
      kind: isLegacy ? (item.productType as Kind) : undefined,
      size: item.size ?? undefined,
    });
    setEditingDraftIdx(idx);
  }

  /** Confirma edição: substitui built[idx] com o draft editado. */
  function commitEdit() {
    if (editingDraftIdx === null) return;
    const product = products.find((p) => p.id === editDraft.productId) ?? null;
    if (!product) {
      setEditingDraftIdx(null);
      return;
    }
    const productSize = product.sizes.find((s) => s.id === editDraft.productSizeId) ?? null;
    const unitPriceCents = unitPriceOfBuilding(editDraft, product);
    const isLegacy = product.type === "salgado" || product.type === "doce";
    const newItem: Built = {
      productId: product.id,
      productSizeId: productSize?.id ?? null,
      productType: product.type,
      productName: product.name,
      sizeName: productSize?.name ?? null,
      ingredients: editDraft.ingredients,
      sauces: editDraft.sauces,
      notes: editDraft.notes?.trim() || null,
      quantity: Math.max(1, editDraft.quantity || 1),
      unitPriceCents,
      kind: isLegacy ? (product.type as Kind) : null,
      size: editDraft.size ?? null,
    };
    const idx = editingDraftIdx;
    setBuilt((prev) => prev.map((b, i) => (i === idx ? newItem : b)));
    setEditingDraftIdx(null);
    setEditDraft(emptyBuilding());
  }

  function cancelEdit() {
    setEditingDraftIdx(null);
    setEditDraft(emptyBuilding());
  }

  async function submitOrder(force = false) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const isEditing = editingOrderId !== null;
      const url = isEditing ? `/api/orders/${editingOrderId}/items` : "/api/orders";
      const method = isEditing ? "PATCH" : "POST";
      // Fase 6: serializa cada Built no formato novo da API
      // (productId + ingredients) — back-compat fica pelo lado do servidor
      // ler ambos os formatos quando recebe.
      const items = built.map((b) => ({
        productId: b.productId ?? undefined,
        productSizeId: b.productSizeId ?? undefined,
        ingredients: b.ingredients,
        sauces: b.sauces,
        notes: b.notes ?? undefined,
        quantity: b.quantity,
        // Mantém legacy fields pra rotas antigas que possam ler
        kind: b.kind ?? undefined,
        size: b.size ?? undefined,
        toppings: b.kind === "salgado" ? b.ingredients : undefined,
        flavor: b.kind === "doce" ? b.ingredients[0] ?? undefined : undefined,
      }));
      const payload = isEditing
        ? { items, operator: operator?.name }
        : {
            clientName: clientName.trim(),
            clientPhone: clientPhone.trim() || undefined,
            optInMarketing: clientOptInMarketing,
            items,
            operator: operator?.name,
            promotionId: selectedPromoId ?? undefined,
            // force: true pula a checagem de duplicado server-side. Setado
            // apenas após user confirmar no dialog "É outro pedido mesmo?".
            // Audit-Crit #2.
            ...(force ? { force: true } : {}),
          };
      // [LATÊNCIA] mede round-trip do fetch — comparar com log do
      // servidor (POST /api/orders) e do listener da cozinha.
      const tFetch = performance.now();
      // Idempotency só no POST (criação). PATCH /items é mais raro e
      // já tem 409 Conflict server-side quando status não permite.
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (!isEditing) {
        headers["X-Idempotency-Key"] = ensureIdemKey();
      }
      const res = await fetch(url, {
        method,
        cache: "no-store",
        headers,
        body: JSON.stringify(payload),
      });
      const tResp = performance.now();
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro" }));
        // Duplicado suspeito: backend detectou pedido similar nos últimos 90s.
        // Pergunta pro user se é mesmo um novo pedido. Se sim, re-submete
        // com force=true (que pula a checagem).
        if (err.code === "DUPLICATE_SUSPECTED") {
          setSubmitting(false);
          const isReally = await confirm({
            title: "Pedido parecido há poucos segundos",
            message: err.error || "É realmente um novo pedido?",
            confirmLabel: "Sim, é novo pedido",
            cancelLabel: "Não, cancelar",
          });
          if (isReally) {
            // Reset idempotency key — novo intent, novo key
            idemKeyRef.current = null;
            await submitOrder(true);
          }
          return;
        }
        showToast(err.error || "Não foi possível confirmar.");
        setSubmitting(false);
        return;
      }
      const order = (await res.json()) as OrderView;
      if (sseDebugEnabled()) {
        console.log(`[SSE-LAT] atendente ${method} id=${order.id} fetch=${(tResp - tFetch).toFixed(0)}ms`);
      }

      // Pedido NOVO com telefone → cumpre a promessa "manda direto no WhatsApp":
      // auto-abre wa.me com o recibo completo prefillado (1 toque humano no
      // WhatsApp pra enviar). Tenta nativo (anchor sintético, iOS-friendly) com
      // fallback web em 600ms. Não envia pelo banco — só dispara o link. Em
      // edição, NÃO abre (atendente já mandou recibo da 1ª vez; reenviar manualmente
      // pelo botão "Comprovante" no card).
      if (!isEditing && order.clientPhone) {
        const text = templateReceipt(order);
        const nativeUrl = buildWaNativeUrl(order.clientPhone, text);
        const webUrl = buildWaUrl(order.clientPhone, text);
        const a = document.createElement("a");
        a.href = nativeUrl;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 100);
        const fallbackTimer = setTimeout(() => {
          if (document.visibilityState === "visible") {
            window.open(webUrl, "_blank", "noopener,noreferrer");
          }
        }, 600);
        const onBlur = () => {
          clearTimeout(fallbackTimer);
          window.removeEventListener("blur", onBlur);
        };
        window.addEventListener("blur", onBlur);
      }

      showToast(
        isEditing
          ? `Pedido #${String(order.id).padStart(3, "0")} atualizado.`
          : `Pedido #${String(order.id).padStart(3, "0")} enviado pra cozinha.`,
      );
      resetOrder();
    } catch {
      showToast("Sem conexão. Tente de novo.");
    } finally {
      setSubmitting(false);
    }
  }

  function requestCancel(id: number) {
    const o = orders.find((x) => x.id === id);
    if (o) setCancelTarget(o);
  }

  async function confirmCancel(reason: string) {
    if (!cancelTarget) return;
    await fetch(`/api/orders/${cancelTarget.id}`, {
      method: "PATCH",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELADO", operator: operator?.name, reason }),
    });
    setCancelTarget(null);
  }

  /**
   * Audit-Crit #1+#6: Remove UM item específico do pedido sem abrir o
   * stepper inteiro. Atendente clica X numa linha → confirma → backend
   * recebe lista de items remanescentes via PATCH /items.
   *
   * Funciona em PEDIDO_FEITO e EM_PREPARO (backend libera ambos).
   * Botão só aparece se sobrar ≥1 item — pro último, atendente cai no
   * fluxo de Cancelar pedido inteiro (que tem motivo, etc).
   */
  async function handleRemoveItem(orderId: number, itemId: string) {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    const item = order.items.find((i) => i.id === itemId);
    if (!item) return;

    const itemDesc = item.productName ||
      (item.kind === "doce" ? "Pastel Doce" : item.kind === "salgado" ? "Pastel Salgado" : item.kind);

    const ok = await confirm({
      title: "Remover esse item?",
      message:
        order.status === "EM_PREPARO"
          ? `Cozinha já tá preparando. Remover "${itemDesc}" agora? Eles vão receber alerta.`
          : `Remover "${itemDesc}" do pedido?`,
      confirmLabel: "Remover",
      cancelLabel: "Não",
      destructive: true,
    });
    if (!ok) return;

    const remaining = order.items.filter((i) => i.id !== itemId);
    // Defesa: nunca deveria chegar aqui (botão escondido se length<=1)
    if (remaining.length === 0) {
      showToast("Esse era o único item. Use Cancelar pedido.");
      return;
    }

    // Reconstrói o payload no mesmo formato que submitOrder usa, sem o
    // item removido. PATCH /items recalcula preço no servidor.
    const items = remaining.map((it) => ({
      productId: it.productId ?? undefined,
      productSizeId: it.productSizeId ?? undefined,
      ingredients:
        it.kind === "doce" && it.flavor ? [it.flavor] : it.toppings,
      sauces: it.sauces,
      notes: it.notes ?? undefined,
      quantity: it.quantity,
      kind: it.kind,
      size: it.size,
      toppings: it.kind === "salgado" ? it.toppings : undefined,
      flavor: it.kind === "doce" ? it.flavor ?? undefined : undefined,
    }));

    // Snapshot ANTES do PATCH — usado pelo Undo (audit-crit B #14).
    // Re-PATCH com a lista completa original restaura o item removido.
    const originalItems = order.items.map((it) => ({
      productId: it.productId ?? undefined,
      productSizeId: it.productSizeId ?? undefined,
      ingredients:
        it.kind === "doce" && it.flavor ? [it.flavor] : it.toppings,
      sauces: it.sauces,
      notes: it.notes ?? undefined,
      quantity: it.quantity,
      kind: it.kind,
      size: it.size,
      toppings: it.kind === "salgado" ? it.toppings : undefined,
      flavor: it.kind === "doce" ? it.flavor ?? undefined : undefined,
    }));

    try {
      const res = await fetch(`/api/orders/${orderId}/items`, {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, operator: operator?.name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro" }));
        showToast(err.error || "Não foi possível remover.");
        return;
      }
      // Toast com Undo: 6s pra atendente perceber erro e reverter.
      // Re-PATCH com items originais — backend aceita, cozinha recebe
      // outro `_editedInPreparation` se aplicável (já implementado).
      showToast(
        `Item removido do pedido #${String(orderId).padStart(3, "0")}.`,
        {
          label: "Desfazer",
          onClick: async () => {
            try {
              await fetch(`/api/orders/${orderId}/items`, {
                method: "PATCH",
                cache: "no-store",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: originalItems, operator: operator?.name }),
              });
              showToast("Item restaurado.");
            } catch {
              showToast("Não consegui desfazer. Tente editar manual.");
            }
          },
        },
      );
      // SSE order:updated vai chegar e atualizar a lista.
    } catch {
      showToast("Sem conexão. Tente de novo.");
    }
  }

  async function deliverOrder(id: number) {
    await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ENTREGUE", operator: operator?.name }),
    });
  }

  /** Avisar cliente via WhatsApp que pedido tá pronto.
   *  Tenta deep-link nativo `whatsapp://` (abre o app instalado em iOS/Android
   *  sem cair no Safari embutido — audit P1 #07). Cria <a> dinâmico em vez
   *  de window.open() porque anchor é o que iOS reconhece pro deep-link.
   *  Fallback pra wa.me em 600ms se o nativo falhar (app não instalado etc). */
  function notifyReady(order: OrderView) {
    const text = templateOrderReady(order);
    const nativeUrl = buildWaNativeUrl(order.clientPhone, text);
    const webUrl = buildWaUrl(order.clientPhone, text);

    // Tenta nativo via anchor click sintético (iOS-friendly)
    const a = document.createElement("a");
    a.href = nativeUrl;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 100);

    // Fallback web se nada aconteceu em 600ms (app não instalado, browser desktop)
    const fallbackTimer = setTimeout(() => {
      if (document.visibilityState === "visible") {
        window.open(webUrl, "_blank", "noopener,noreferrer");
      }
    }, 600);
    // Se a aba perdeu foco antes do timer (app abriu), cancela fallback
    const onBlur = () => {
      clearTimeout(fallbackTimer);
      window.removeEventListener("blur", onBlur);
    };
    window.addEventListener("blur", onBlur);

    // Fire-and-forget: erro silencioso pq Gil já mandou. SSE atualiza UI.
    fetch(`/api/orders/${order.id}/notify-ready`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operator: operator?.name }),
    }).catch(() => {});
  }

  const [trocoOpen, setTrocoOpen] = useState(false);
  // Fase 7 #4 — banner 1-toque pra avisar cliente quando vira PRONTO
  const surfacedReadyRef = useRef<Set<number>>(new Set());
  const [pendingNotify, setPendingNotify] = useState<OrderView | null>(null);

  return (
    <div className="min-h-dvh flex flex-col">
      <AppHeader
        right={
          <button
            type="button"
            onClick={() => setTrocoOpen(true)}
            aria-label="Calculadora de troco"
            title="Troco"
            className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-line-strong text-ink-2 hover:border-ink-3 hover:text-ink"
          >
            <Calculator size={18} strokeWidth={2} />
          </button>
        }
      />
      <TrocoCalculator open={trocoOpen} onClose={() => setTrocoOpen(false)} />

      {/* Fase 7 #4 — Banner auto-surface "tá pronto" */}
      {pendingNotify && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 px-3 pt-3 animate-fade-in"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
        >
          <div className="max-w-md mx-auto bg-status-ready text-white rounded-2xl shadow-lg p-3 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wide text-white/80">
                Pedido pronto — avisar cliente
              </div>
              <div className="font-extrabold truncate text-base">
                #{String(pendingNotify.id).padStart(3, "0")} — {pendingNotify.clientName}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                notifyReady(pendingNotify);
                setPendingNotify(null);
              }}
              className="shrink-0 h-11 px-4 rounded-lg bg-brand-yellow text-ink font-bold inline-flex items-center gap-1.5"
            >
              <MessageCircle size={18} strokeWidth={2.5} />
              Avisar
            </button>
            <button
              type="button"
              onClick={() => setPendingNotify(null)}
              aria-label="Dispensar"
              className="shrink-0 h-11 w-11 rounded-lg text-white/80 hover:text-white inline-flex items-center justify-center"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}

      {caixaFechado && !creating && (
        <div className="bg-danger text-white px-4 py-3 flex items-center gap-2 sticky top-16 z-20 shadow-md">
          <Lock size={18} strokeWidth={2.5} />
          <span className="text-sm font-bold">
            Caixa fechado. Peça pra Gil abrir um caixa no admin.
          </span>
        </div>
      )}

      {/* Banner caixa órfão — alerta de caixa esquecido aberto há +12h.
          Vendas novas agregam nele se não fechar. Audit-Crit #5. */}
      {!caixaFechado && caixaOrfao && !staleDismissed && !creating && (
        <div className="bg-brand-orange/15 border-b border-brand-orange/40 text-ink px-4 py-2.5 flex items-center gap-2 sticky top-16 z-20 shadow-sm">
          <AlertTriangle size={18} strokeWidth={2.5} className="shrink-0 text-brand-orange" />
          <div className="flex-1 min-w-0 text-sm">
            <span className="font-bold">Caixa aberto há +12h</span>
            <span className="text-ink-2">
              {" — "}
              {eventStatus.name ? `"${eventStatus.name}" ` : ""}desde{" "}
              {eventStatus.openedAt &&
                new Date(eventStatus.openedAt).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              . Esqueceram de fechar? Peça pra Gil revisar.
            </span>
          </div>
          <button
            onClick={() => setStaleDismissed(true)}
            className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-md text-ink-3 hover:text-ink hover:bg-brand-orange/10"
            aria-label="Dispensar aviso"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {creating ? (
        <NovoPedido
          products={products}
          promotions={promotions}
          selectedPromoId={selectedPromoId}
          setSelectedPromoId={setSelectedPromoId}
          toppings={toppings}
          doces={doces}
          molhos={molhos}
          macarraoToppings={macarraoToppings}
          macarraoMolhos={macarraoMolhos}
          phase={phase}
          setPhase={setPhase}
          clientName={clientName}
          setClientName={setClientName}
          clientPhone={clientPhone}
          setClientPhone={setClientPhone}
          clientOptInMarketing={clientOptInMarketing}
          setClientOptInMarketing={setClientOptInMarketing}
          built={built}
          current={current}
          setCurrent={setCurrent}
          submitting={submitting}
          editing={editingOrderId !== null}
          onStart={startBuilding}
          onFinishPastel={finishCurrentPastel}
          onAddAnother={addAnotherPastel}
          onExpressAdd={addExpressToCart}
          onSubmit={submitOrder}
          onDiscard={resetOrder}
          onRemoveBuilt={(idx) => {
            const next = built.filter((_, i) => i !== idx);
            setBuilt(next);
            if (next.length === 0) {
              setCurrent(emptyBuilding());
              setPhase("product");
            }
          }}
          onBuiltQuantity={setBuiltQuantity}
          onEditBuilt={editBuiltItem}
          onDuplicateBuilt={duplicateBuilt}
          editingDraftIdx={editingDraftIdx}
          editDraft={editDraft}
          setEditDraft={setEditDraft}
          onCommitEdit={commitEdit}
          onCancelEdit={cancelEdit}
          ingredientsForEdit={() => {
            const p = products.find((x) => x.id === editDraft.productId);
            if (!p) return [];
            const cat = p.ingredientCategory;
            if (cat === "topping") return toppings;
            if (cat === "doce") return doces;
            if (cat === "macarrao_topping") return macarraoToppings;
            return [];
          }}
          molhosForEdit={() => {
            const p = products.find((x) => x.id === editDraft.productId);
            if (!p) return [];
            const cat = p.sauceCategory ?? "molho";
            if (cat === "macarrao_molho") return macarraoMolhos;
            return molhos;
          }}
        />
      ) : (
        <>
          <Fila
            orders={orders}
            filter={filter}
            onFilter={setFilter}
            onCancel={requestCancel}
            onAdvance={deliverOrder}
            onEdit={openEdit}
            onRemoveItem={handleRemoveItem}
            onNotifyReady={notifyReady}
          />
          <div
            className="fixed left-1/2 -translate-x-1/2 z-40 pointer-events-none"
            // 48px de offset evita zona de gesto do iOS home indicator
            style={{ bottom: "max(env(safe-area-inset-bottom), 48px)" }}
          >
            <button
              onClick={openNew}
              disabled={caixaFechado}
              className={`pointer-events-auto inline-flex items-center gap-2 h-14 min-w-[200px] px-6 rounded-full font-bold text-[15px] shadow-lg active:scale-[0.96] transition-colors whitespace-nowrap justify-center ${
                caixaFechado
                  ? "bg-surface-sunken text-ink-3 cursor-not-allowed"
                  : // Pulse só quando fila tá vazia (chama atenção pra "comece um novo").
                    // Quando há pedidos visíveis, atendente já tá engajado — pulse vira
                    // motion fatigue periférica em jornada de 6h. Audit P1 #14.
                    orders.length === 0
                    ? "bg-brand-yellow text-ink animate-fab-pulse hover:bg-brand-yellow-hover hover:animate-none active:animate-none"
                    : "bg-brand-yellow text-ink hover:bg-brand-yellow-hover"
              }`}
              aria-label="Novo pedido"
              title={caixaFechado ? "Caixa fechado" : "Novo pedido"}
            >
              {caixaFechado ? <Lock size={20} strokeWidth={3} /> : <Plus size={22} strokeWidth={3} />}
              <span>{caixaFechado ? "Caixa fechado" : "Novo pedido"}</span>
            </button>
          </div>
        </>
      )}

      <CancelDialog
        open={cancelTarget !== null}
        orderLabel={cancelTarget ? `#${String(cancelTarget.id).padStart(3, "0")} · ${cancelTarget.clientName}` : ""}
        onConfirm={confirmCancel}
        onClose={() => setCancelTarget(null)}
      />

      {/* ConfirmDialog node — montado uma vez, controlado via hook.
          Usado pelo handler de DUPLICATE_SUSPECTED (audit-crit #2). */}
      {confirmNode}

      {toast && (
        /* Toast bottom-center (padrão Material) — fica acima do FAB,
           não colide com banner caixa fechado (top-16 sticky) nem é
           coberto pelo bottom nav admin. Respeita safe-area do iOS. */
        <div
          className="fixed left-1/2 -translate-x-1/2 z-50 bg-status-ready text-white px-4 py-3 rounded-md shadow-lg font-semibold animate-toast-drop inline-flex items-center gap-2"
          style={{ bottom: "max(env(safe-area-inset-bottom), 120px)" }}
        >
          <Check size={18} strokeWidth={3} />
          <span>{toast.text}</span>
          {toast.action && (
            <button
              onClick={() => {
                toast.action!.onClick();
                setToast(null);
              }}
              className="ml-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/20 hover:bg-white/30 active:scale-95 transition uppercase tracking-wide text-xs font-bold"
            >
              <RotateCcw size={14} strokeWidth={3} />
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Phases possíveis em ordem canônica. Para um produto específico,
// usamos `phasesForProduct(product)` pra computar quais aparecem.
function phasesForProduct(product: ProductView | null): Phase[] {
  // sem produto selecionado: só "product"
  if (!product) return ["product"];
  // Express product (bebida sem config): vai direto pro cart sem passar
  // por configure. Tratado em StepProduct via onExpressAdd.
  if (isExpressProduct(product)) return ["product"];
  // Todos os outros produtos passam por "configure" único:
  // tamanho + ingredientes + extras (molho/obs) + qty.
  return ["product", "configure"];
}

function formatPhoneMask(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function NovoPedido({
  products,
  promotions,
  selectedPromoId,
  setSelectedPromoId,
  toppings,
  doces,
  molhos,
  macarraoToppings,
  macarraoMolhos,
  phase,
  setPhase,
  clientName,
  setClientName,
  clientPhone,
  setClientPhone,
  clientOptInMarketing,
  setClientOptInMarketing,
  built,
  current,
  setCurrent,
  submitting,
  editing,
  onStart,
  onFinishPastel,
  onAddAnother,
  onExpressAdd,
  onSubmit,
  onDiscard,
  onRemoveBuilt,
  onBuiltQuantity,
  onEditBuilt,
  onDuplicateBuilt,
  editingDraftIdx,
  editDraft,
  setEditDraft,
  onCommitEdit,
  onCancelEdit,
  ingredientsForEdit,
  molhosForEdit,
}: {
  products: ProductView[];
  promotions: PromotionView[];
  selectedPromoId: string | null;
  setSelectedPromoId: (id: string | null) => void;
  toppings: Ingredient[];
  doces: Ingredient[];
  molhos: Ingredient[];
  macarraoToppings: Ingredient[];
  macarraoMolhos: Ingredient[];
  phase: Phase;
  setPhase: (p: Phase) => void;
  clientName: string;
  setClientName: (v: string) => void;
  clientPhone: string;
  setClientPhone: (v: string) => void;
  clientOptInMarketing: boolean;
  setClientOptInMarketing: (v: boolean) => void;
  built: Built[];
  current: Building;
  setCurrent: (c: Building) => void;
  submitting: boolean;
  editing: boolean;
  onStart: () => void;
  onFinishPastel: () => void;
  onAddAnother: () => void;
  onExpressAdd: (product: ProductView) => void;
  onSubmit: () => void;
  onDiscard: () => void;
  onRemoveBuilt: (idx: number) => void;
  onBuiltQuantity: (idx: number, delta: number) => void;
  onEditBuilt: (idx: number) => void;
  onDuplicateBuilt: (idx: number) => void;
  editingDraftIdx: number | null;
  editDraft: Building;
  setEditDraft: (c: Building) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  ingredientsForEdit: () => Ingredient[];
  molhosForEdit: () => Ingredient[];
}) {
  // Produto atual em construção
  const currentProduct = products.find((p) => p.id === current.productId) ?? null;
  const phasesActive = phasesForProduct(currentProduct);

  // Ingredientes/molhos certos pro produto atual
  function ingredientsForCurrent(): Ingredient[] {
    if (!currentProduct) return [];
    const cat = currentProduct.ingredientCategory;
    if (cat === "topping") return toppings;
    if (cat === "doce") return doces;
    if (cat === "macarrao_topping") return macarraoToppings;
    return [];
  }
  function saucesForCurrent(): Ingredient[] {
    if (!currentProduct) return [];
    const cat = currentProduct.sauceCategory ?? "molho";
    if (cat === "macarrao_molho") return macarraoMolhos;
    return molhos;
  }

  // Swipe gestures: hook chamado ANTES de qualquer early return pra
  // obedecer rules-of-hooks. Handlers usam closure pra ler back/advance/
  // canAdvance que são declarados depois — closures resolvem em tempo de
  // execução, então OK. isInStopRegion idem.
  function isInStopRegion(target: EventTarget | null) {
    if (!(target instanceof Element)) return false;
    return target.closest("[data-stop-swipe]") !== null;
  }
  const swipeHandlers = useSwipeable({
    onSwipedRight: (e) => {
      if (isInStopRegion(e.event.target)) return;
      back();
    },
    onSwipedLeft: (e) => {
      if (isInStopRegion(e.event.target)) return;
      if (canAdvance) advance();
    },
    trackMouse: false,
    preventScrollOnSwipe: false,
    delta: 60, // 60px pra evitar trigger acidental enquanto rola
  });

  if (phase === "client") {
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex-1 px-4 md:px-8 pt-6 md:pt-10 max-w-2xl md:max-w-4xl w-full mx-auto">
          <h1 className="t-h1 mb-1">Novo pedido</h1>
          <p className="t-body-sm mb-5">Quem é o cliente?</p>

          {/* Atalho rápido pro caso "balcão alta-rotação" — pula essa tela
              e cai direto na seleção de produto. Sem nome registrado.
              Botão chamativo no topo pra atendente experiente achar fácil. */}
          <button
            onClick={onStart}
            className="w-full h-14 mb-5 rounded-md border-2 border-dashed border-brand-yellow bg-[#FFFCE5] text-ink font-bold text-[15px] hover:bg-brand-yellow-soft transition-colors inline-flex items-center justify-center gap-2"
          >
            <span>⚡</span>
            Atendimento rápido (Balcão)
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-line" />
            <span className="t-caption">ou anote o nome</span>
            <div className="flex-1 h-px bg-line" />
          </div>

          <label className="block t-label mb-2">
            Cliente
          </label>
          <input
            autoFocus
            className="input"
            placeholder="Ex: Mesa 7 ou João"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && clientName.trim()) onStart();
            }}
          />

          <label className="block t-label mb-2 mt-6">
            Telefone <span className="text-ink-3 normal-case tracking-normal font-medium">(opcional)</span>
          </label>
          <input
            className="input"
            type="tel"
            inputMode="numeric"
            placeholder="(11) 99999-9999"
            value={formatPhoneMask(clientPhone)}
            onChange={(e) => setClientPhone(e.target.value.replace(/\D/g, ""))}
          />
          <p className="t-caption mt-1.5">
            Se preencher, o comprovante manda direto no WhatsApp dele.
          </p>

          {/* Opt-in marketing — só faz sentido se cliente deu telefone */}
          {clientPhone.replace(/\D/g, "").length >= 10 && (
            <label className="flex items-start gap-3 mt-4 p-3 rounded-md border border-line bg-surface cursor-pointer hover:border-ink-3">
              <input
                type="checkbox"
                checked={clientOptInMarketing}
                onChange={(e) => setClientOptInMarketing(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-brand-yellow"
              />
              <div>
                <div className="t-body-sm font-semibold text-ink">
                  Cliente quer receber promoções por WhatsApp
                </div>
                <div className="t-caption">
                  Sem isso, só mandamos recibo e aviso quando ficar pronto.
                </div>
              </div>
            </label>
          )}
        </div>
        <BottomBar>
          <button
            onClick={onStart}
            className="btn btn-primary flex-1"
          >
            Começar →
          </button>
        </BottomBar>
      </div>
    );
  }

  if (phase === "cart") {
    const subtotal = built.reduce((sum, item) => sum + priceOfBuilt(item), 0);
    const totalUnits = built.reduce((s, b) => s + b.quantity, 0);
    // Detecta promoções aplicáveis ao carrinho atual
    const cartForPromo = built.map((b) => ({
      productId: b.productId,
      unitPriceCents: b.unitPriceCents,
      quantity: b.quantity,
    }));
    const applicable = detectApplicable(promotions, cartForPromo);
    // Promoção selecionada pode ser auto-detectada OU via cupom.
    // Procura primeiro nas aplicáveis (auto); senão na lista inteira (cupom).
    const selectedPromo =
      applicable.find((p) => p.id === selectedPromoId) ??
      promotions.find((p) => p.id === selectedPromoId && p.couponCode) ??
      null;
    const discount = selectedPromo ? computeDiscount(selectedPromo, subtotal, cartForPromo) : 0;
    const total = Math.max(0, subtotal - discount);
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto px-4 md:px-8 pt-6 max-w-2xl md:max-w-4xl w-full mx-auto">
          <div className="flex items-baseline justify-between mb-1">
            <h1 className="t-h1">{editing ? "Editar pedido" : "Resumo"}</h1>
            <div className="flex flex-col items-end gap-0.5">
              <span className="t-body-sm">{clientName}</span>
              {/* Audit P1 #10: quick start Balcão pula tela de cliente.
                  Se o cliente pediu pra avisar no WhatsApp depois, atendente
                  precisa adicionar phone aqui sem refazer pedido. */}
              {!clientPhone && !editing && (
                <button
                  onClick={() => {
                    const input = window.prompt(
                      "Telefone do cliente (opcional)\nFormato: (11) 99999-9999",
                      "",
                    );
                    if (input === null) return;
                    const digits = input.replace(/\D/g, "");
                    if (digits.length >= 10 && digits.length <= 11) {
                      setClientPhone(digits);
                    } else if (digits.length > 0) {
                      window.alert("Telefone precisa ter 10 ou 11 dígitos com DDD.");
                    }
                  }}
                  className="t-caption text-ink-2 hover:text-ink underline decoration-dotted"
                >
                  + Adicionar telefone
                </button>
              )}
              {clientPhone && !editing && (
                <span className="t-caption t-num text-ink-3">
                  {formatPhoneMask(clientPhone)}
                </span>
              )}
            </div>
          </div>
          <p className="t-body-sm mb-3">
            {totalUnits} {totalUnits === 1 ? "item" : "itens"} ·{" "}
            {discount > 0 ? (
              <>
                <span className="line-through text-ink-3">{formatBRL(subtotal)}</span>{" "}
                <span className="font-bold text-status-ready">{formatBRL(total)}</span>
              </>
            ) : (
              <span className="font-bold text-ink">{formatBRL(total)}</span>
            )}
          </p>

          <CouponInput
            promotions={promotions}
            cart={cartForPromo}
            selectedPromo={selectedPromo}
            onApply={(id) => setSelectedPromoId(id)}
          />

          {applicable.length > 0 && (
            <div className="mb-4 p-3 rounded-md border-2 border-status-ready bg-status-ready-bg flex flex-col gap-2">
              <div className="t-label text-status-ready-ink">
                {applicable.length === 1
                  ? "Promoção disponível"
                  : `${applicable.length} promoções disponíveis`}
              </div>
              {applicable.map((p) => {
                const dCents = computeDiscount(p, subtotal, cartForPromo);
                const isActive = selectedPromoId === p.id;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between gap-3 p-2 rounded ${
                      isActive ? "bg-status-ready text-white" : "bg-surface-elevated"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-bold ${isActive ? "text-white" : "text-ink"}`}>
                        {p.name}
                      </div>
                      <div className={`text-xs ${isActive ? "text-white/90" : "text-ink-3"}`}>
                        −{formatBRL(dCents)}
                        {p.description ? ` · ${p.description}` : ""}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedPromoId(isActive ? null : p.id)}
                      className={`shrink-0 h-9 px-3 rounded-md text-xs font-bold uppercase tracking-[0.04em] ${
                        isActive
                          ? "bg-white text-status-ready"
                          : "bg-ink text-brand-yellow hover:brightness-110"
                      }`}
                    >
                      {isActive ? "Remover" : "Aplicar"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <ul className="flex flex-col gap-3">
            {built.map((item, idx) => {
              const lineTotal = priceOfBuilt(item);
              return (
                <li key={idx}>
                <SwipeableCartItem onRemove={() => onRemoveBuilt(idx)}>
                <div className="card p-4 flex gap-3">
                  <div className="h-9 w-9 rounded-md bg-brand-yellow text-ink font-extrabold text-base inline-flex items-center justify-center shrink-0 t-num">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="font-bold text-base flex items-baseline gap-1.5">
                        <BuiltIcon type={item.productType} />
                        <span>
                          {item.productName}
                          {item.sizeName ? ` · ${item.sizeName}` : ""}
                        </span>
                      </div>
                      <div className="text-sm t-num font-bold">{formatBRL(lineTotal)}</div>
                    </div>
                    {item.ingredients.length > 0 && (
                      <div className="text-sm text-ink-2 leading-snug">
                        {item.ingredients.join(", ")}
                      </div>
                    )}
                    {item.sauces.length > 0 && (
                      <div className="text-xs text-ink-2 mt-1">
                        Molhos: {item.sauces.join(", ")}
                      </div>
                    )}
                    {item.notes && (
                      <div className="text-xs text-ink-2 mt-1 italic">&ldquo;{item.notes}&rdquo;</div>
                    )}
                    {/* Footer do item: qty controls (esq) vs edit+remove (dir).
                        Hitboxes 44px (h-11) — Apple/Material guideline pra touch.
                        Disabled usa text-ink-3 sólido em vez de opacity-40, mais legível. */}
                    <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                      <div className="inline-flex items-center gap-2">
                        <span className="t-label">Qtd</span>
                        <button
                          onClick={() => onBuiltQuantity(idx, -1)}
                          disabled={item.quantity <= 1}
                          className="h-11 w-11 rounded-md border border-line-strong inline-flex items-center justify-center text-ink-2 disabled:text-ink-3 disabled:border-line disabled:cursor-not-allowed active:scale-[0.92] transition-transform"
                          aria-label="Diminuir quantidade"
                        >
                          <Minus size={18} strokeWidth={2.5} />
                        </button>
                        <span
                          key={item.quantity}
                          className="t-num font-extrabold text-lg min-w-8 text-center inline-block animate-number-bump"
                        >
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onBuiltQuantity(idx, 1)}
                          disabled={item.quantity >= 20}
                          className="h-11 w-11 rounded-md border border-line-strong inline-flex items-center justify-center text-ink-2 disabled:text-ink-3 disabled:border-line disabled:cursor-not-allowed active:scale-[0.92] transition-transform"
                          aria-label="Aumentar quantidade"
                        >
                          <Plus size={18} strokeWidth={2.5} />
                        </button>
                      </div>
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => onDuplicateBuilt(idx)}
                          className="inline-flex items-center gap-1.5 h-11 px-3 rounded-md border border-line-strong text-ink-2 hover:border-brand-yellow hover:text-ink text-sm font-semibold active:scale-[0.97] transition"
                          aria-label="Adicionar outro igual"
                          title="Adicionar outro igual"
                        >
                          <Plus size={14} strokeWidth={2.5} />
                          Mais 1
                        </button>
                        <button
                          onClick={() => onEditBuilt(idx)}
                          className="inline-flex items-center gap-1.5 h-11 px-3 rounded-md border border-line-strong text-ink-2 hover:border-ink-3 hover:text-ink text-sm font-semibold active:scale-[0.97] transition"
                          aria-label="Editar pastel"
                        >
                          <Pencil size={14} strokeWidth={2.5} />
                          Editar
                        </button>
                        <button
                          onClick={() => onRemoveBuilt(idx)}
                          className="h-11 w-11 rounded-md inline-flex items-center justify-center text-ink-3 hover:bg-danger-bg hover:text-danger active:scale-[0.92] transition"
                          aria-label="Remover pastel"
                          title="Remover item"
                        >
                          <X size={18} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                </SwipeableCartItem>
                </li>
              );
            })}
          </ul>

          <button
            onClick={onAddAnother}
            className="mt-3 w-full h-14 rounded-md border-2 border-dashed border-line-strong text-ink-2 font-semibold hover:border-brand-orange hover:text-brand-orange transition-colors"
          >
            + Adicionar outro item
          </button>

          <button
            onClick={onDiscard}
            className="mt-6 mb-2 text-ink-3 text-sm hover:text-danger"
          >
            {editing ? "Voltar sem salvar" : "Cancelar pedido"}
          </button>
        </div>
        <BottomBar>
          <button
            onClick={onSubmit}
            disabled={submitting || built.length === 0}
            className="btn btn-primary flex-1"
          >
            {submitting ? (
              <>
                <span className="spinner-inline" aria-hidden />
                <span>{editing ? "Salvando..." : "Enviando..."}</span>
              </>
            ) : editing ? (
              `Salvar alterações · ${formatBRL(total)}`
            ) : (
              `Confirmar pedido · ${formatBRL(total)}`
            )}
          </button>
        </BottomBar>
      </div>
    );
  }

  const currentStepIdx = phasesActive.indexOf(phase);

  function back() {
    if (currentStepIdx <= 0) {
      // back to client
      if (built.length > 0) setPhase("cart");
      else setPhase("client");
      return;
    }
    setPhase(phasesActive[currentStepIdx - 1]);
  }

  function advance() {
    if (phase === "configure" || phase === "quantity") {
      onFinishPastel();
      return;
    }
    const next = phasesActive[currentStepIdx + 1];
    if (next) setPhase(next);
  }

  let canAdvance = false;
  if (phase === "product") canAdvance = !!current.productId;
  if (phase === "size") canAdvance = !!current.productSizeId;
  if (phase === "content") {
    if (currentProduct) {
      const min = currentProduct.minIngredients ?? (currentProduct.type === "salgado" || currentProduct.type === "macarrao" ? 1 : 0);
      const max = currentProduct.maxIngredients;
      const len = current.ingredients.length;
      canAdvance = len >= min && (max === null || max === undefined || len <= max);
    }
  }
  if (phase === "sauces") canAdvance = true;
  if (phase === "notes") canAdvance = true;
  if (phase === "quantity") canAdvance = current.quantity >= 1;
  if (phase === "configure") {
    // Configure precisa que isBuildingComplete passe (size + ingredients).
    canAdvance = isBuildingComplete(current, currentProduct) && current.quantity >= 1;
  }

  return (
    <div className="flex-1 flex flex-col md:flex-row">
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 md:px-8 pt-4 pb-3 bg-surface-elevated border-b border-line">
          <Stepper
            phase={phase}
            clientName={clientName}
            pastelIdx={built.length + 1}
          />
        </div>

        <div
          {...swipeHandlers}
          // touch-action: pan-y deixa scroll vertical livre mas captura
          // o gesto horizontal antes do iOS Safari triggerar swipe-back
          // (margem esquerda → arrastar direita = página anterior).
          style={{ touchAction: "pan-y" }}
          className="flex-1 overflow-y-auto px-4 md:px-8 pt-5 pb-6 max-w-2xl md:max-w-4xl w-full mx-auto"
        >
          <div key={phase} className="animate-step-in">
            {phase === "product" && (
              <StepProduct products={products} current={current} setCurrent={setCurrent} setPhase={setPhase} onExpressAdd={onExpressAdd} />
            )}
            {phase === "configure" && currentProduct && (
              <StepConfigure
                product={currentProduct}
                current={current}
                setCurrent={setCurrent}
                ingredients={ingredientsForCurrent()}
                molhos={saucesForCurrent()}
              />
            )}
            {/* Phases legacy — não aparecem com phasesForProduct novo, mas
                mantidas pro caso de algum edit/url state inválido. */}
            {phase === "size" && currentProduct && (
              <StepProductSize product={currentProduct} current={current} setCurrent={setCurrent} setPhase={setPhase} />
            )}
            {phase === "content" && currentProduct && (
              <StepIngredients
                product={currentProduct}
                current={current}
                setCurrent={setCurrent}
                ingredients={ingredientsForCurrent()}
              />
            )}
            {phase === "sauces" && currentProduct && (
              <StepSauces current={current} setCurrent={setCurrent} molhos={saucesForCurrent()} />
            )}
            {phase === "notes" && (
              <StepNotes current={current} setCurrent={setCurrent} />
            )}
            {phase === "quantity" && (
              <StepQuantity current={current} setCurrent={setCurrent} product={currentProduct} />
            )}
          </div>
        </div>
      </div>

      <aside className="hidden md:flex md:w-80 lg:w-96 border-l border-line bg-surface-elevated p-6 flex-col overflow-y-auto">
        <div className="t-label mb-1">Pedido</div>
        <div className="t-h2 mb-4">{clientName}</div>

        {built.length > 0 ? (
          <>
            <div className="t-label mb-2">
              {built.length} {built.length === 1 ? "item confirmado" : "items confirmados"}
            </div>
            <ul className="flex flex-col gap-2 mb-5">
              {built.map((it, idx) => {
                const subtotal = it.unitPriceCents * it.quantity;
                return (
                  <li
                    key={idx}
                    className="card p-3 flex items-start gap-2"
                  >
                    <span className="t-caption font-bold text-ink-3 t-num shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="shrink-0 mt-0.5">
                      <BuiltIcon type={it.productType} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="t-body-sm font-semibold text-ink truncate">
                        {it.quantity > 1 && (
                          <span className="text-ink-2">{it.quantity}× </span>
                        )}
                        {it.productName}
                        {it.sizeName ? ` · ${it.sizeName}` : ""}
                      </div>
                      {it.ingredients.length > 0 && (
                        <div className="t-caption truncate">
                          {it.ingredients.join(", ")}
                        </div>
                      )}
                      {it.sauces.length > 0 && (
                        <div className="t-caption truncate">
                          Molhos: {it.sauces.join(", ")}
                        </div>
                      )}
                    </div>
                    <div className="t-body-sm font-bold t-num shrink-0">
                      {formatBRL(subtotal)}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}

        <div className="t-label mb-2">Montando agora</div>
        <div className="card p-3 bg-[#FFFCE5] border-brand-yellow">
          <SummaryDraft draft={current} products={products} />
        </div>
      </aside>

      <BottomBar>
        <button onClick={back} className="btn btn-ghost w-16" aria-label="Voltar">
          ←
        </button>
        <button
          disabled={!canAdvance}
          onClick={advance}
          className="btn btn-primary flex-1"
        >
          {phase === "configure" || phase === "quantity" ? "Adicionar ao pedido →" : "Próximo →"}
        </button>
      </BottomBar>

      {/* Drawer de edição in-place — abre sobre o cart, mantém o cart visível
          atrás. Cancelar não altera o item; Salvar substitui no built[idx]. */}
      {editingDraftIdx !== null && (
        <EditDrawer
          product={products.find((p) => p.id === editDraft.productId) ?? null}
          draft={editDraft}
          setDraft={setEditDraft}
          ingredients={ingredientsForEdit()}
          molhos={molhosForEdit()}
          onSave={onCommitEdit}
          onCancel={onCancelEdit}
        />
      )}
    </div>
  );
}

function BuiltIcon({ type }: { type: string }) {
  if (type === "doce") return <PastelDoceIcon size={22} />;
  if (type === "bebida") return <BebidaIcon size={22} />;
  if (type === "macarrao") return <MacarraoIcon size={22} />;
  if (type === "combo") return <PromocaoIcon size={22} />;
  return <PastelSalgadoIcon size={22} />;
}

type MenuCategory = "pastel" | "macarrao" | "bebidas" | "promocoes";

function StepProduct({
  products,
  current,
  setCurrent,
  setPhase,
  onExpressAdd,
}: {
  products: ProductView[];
  current: Building;
  setCurrent: (c: Building) => void;
  setPhase: (p: Phase) => void;
  /** Express add — adiciona produto direto no cart sem passar por configure.
   *  Usado pelos cards do carrossel "Adicionar rápido". */
  onExpressAdd: (p: ProductView) => void;
}) {
  // Menu em 2 níveis: categoria → opção.
  // Mantém categoria selecionada em state local; volta = limpa.
  const [category, setCategory] = useState<MenuCategory | null>(null);

  // Agrupa produtos por nossas categorias visuais
  // Produtos no atendente: SÓ os disponíveis (Gil pode desligar qualquer
  // um via Admin → Cardápio). Indisponíveis somem da seleção totalmente —
  // atendente nem vê. Card de tipo (Salgado/Doce/Macarrão) some quando o
  // produto singleton dele tá desligado. Bebida/Combo aparecem só as ativas.
  const pastelSalgado = products.find((p) => p.type === "salgado" && p.available);
  const pastelDoce = products.find((p) => p.type === "doce" && p.available);
  const miniPackSize = pastelDoce?.sizes.find((s) => s.name === "Mini Pack");
  const macarrao = products.find((p) => p.type === "macarrao" && p.available);
  const bebidas = products.filter((p) => p.type === "bebida" && p.available);
  const combos = products.filter((p) => p.type === "combo" && p.available);

  // Pre-selecionar size opcional (caso "Pack mini pastéis")
  function pick(product: ProductView, preSelectedSize?: { id: string; name: string }) {
    const isLegacy = product.type === "salgado" || product.type === "doce";
    const legacySizeMap: Record<string, Size> = {
      "Pequeno": "pequeno",
      "Grande": "grande",
      "Normal": "normal",
      "Mini Pack": "mini",
    };
    setCurrent({
      ...current,
      productId: product.id,
      productSizeId: preSelectedSize?.id,
      productType: product.type,
      productName: product.name,
      ingredients: [],
      sauces: [],
      kind: isLegacy ? (product.type as Kind) : undefined,
      size: preSelectedSize ? legacySizeMap[preSelectedSize.name] : undefined,
    });
    setTimeout(() => {
      // Se já tem size escolhido, pula direto pra content
      const phases = phasesForProduct(product);
      const sizeIdx = phases.indexOf("size");
      const next = preSelectedSize && sizeIdx >= 0
        ? phases[sizeIdx + 1] ?? "quantity"
        : phases[1] ?? "quantity";
      if (next) setPhase(next);
    }, 180);
  }

  // === NÍVEL 1: categorias ===
  if (category === null) {
    const cards: Array<{ id: MenuCategory; label: string; icon: React.ReactNode; desc: string; available: boolean }> = [
      {
        id: "pastel",
        label: "Pastel",
        icon: <PastelSalgadoIcon size={64} />,
        desc: "Salgado, doce ou pack",
        available: !!(pastelSalgado || pastelDoce),
      },
      {
        id: "macarrao",
        label: "Macarrão",
        icon: <MacarraoIcon size={64} />,
        desc: macarrao
          ? formatBRL(macarrao.basePriceCents ?? 0)
          : "—",
        available: !!macarrao,
      },
      {
        id: "bebidas",
        label: "Bebidas",
        icon: <BebidaIcon size={64} />,
        desc: `${bebidas.length} ${bebidas.length === 1 ? "opção" : "opções"}`,
        available: bebidas.length > 0,
      },
      {
        id: "promocoes",
        label: "Promoções",
        icon: <PromocaoIcon size={64} />,
        desc: combos.length > 0 ? `${combos.length} combo${combos.length === 1 ? "" : "s"}` : "Em breve",
        available: combos.length > 0,
      },
    ];

    // Express products = produtos sem config (bebidas hoje).
    // Carrossel horizontal no topo: 1 toque = adiciona direto ao cart.
    const expressProducts = products.filter((p) =>
      isExpressProduct(p) && p.available,
    );

    return (
      <>
        <h2 className="t-h1 mb-1">O que vai pedir?</h2>
        <p className="t-body-sm mb-5">Escolha a categoria.</p>

        {expressProducts.length > 0 && (
          <div className="mb-6">
            <div className="t-label mb-2">⚡ Adicionar rápido</div>
            <div
              data-stop-swipe
              className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 md:mx-0 md:px-0"
            >
              {expressProducts.map((p) => (
                <ExpressCard key={p.id} product={p} onAdd={() => onExpressAdd(p)} />
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {cards.map((c) => (
            <KindCard
              key={c.id}
              icon={c.icon}
              label={c.label}
              desc={c.desc}
              selected={false}
              onClick={c.available ? () => setCategory(c.id) : () => {}}
            />
          ))}
        </div>
      </>
    );
  }

  // === NÍVEL 2: opções da categoria selecionada ===

  // Header com botão voltar
  const Header = (
    <div className="flex items-center gap-2 mb-1">
      <button
        onClick={() => setCategory(null)}
        className="h-8 px-2 -ml-2 rounded-md text-ink-3 hover:text-ink text-sm font-semibold"
        aria-label="Voltar pra categorias"
      >
        ←
      </button>
      <h2 className="t-h1">
        {category === "pastel" ? "Pastel" :
         category === "macarrao" ? "Macarrão" :
         category === "bebidas" ? "Bebidas" :
         "Promoções"}
      </h2>
    </div>
  );

  if (category === "pastel") {
    type SubOption = {
      key: string;
      label: string;
      desc: string;
      icon: React.ReactNode;
      onClick: () => void;
    };
    const subOptions: SubOption[] = [];
    if (pastelSalgado) {
      const minPrice = Math.min(...pastelSalgado.sizes.map((s) => s.priceCents));
      subOptions.push({
        key: "salgado",
        label: "Salgado",
        icon: <PastelSalgadoIcon size={64} />,
        desc: `a partir de ${formatBRL(minPrice)}`,
        onClick: () => pick(pastelSalgado),
      });
    }
    if (pastelDoce) {
      const minPrice = Math.min(...pastelDoce.sizes.map((s) => s.priceCents));
      subOptions.push({
        key: "doce",
        label: "Doce",
        icon: <PastelDoceIcon size={64} />,
        desc: `a partir de ${formatBRL(minPrice)}`,
        onClick: () => pick(pastelDoce),
      });
    }
    if (pastelDoce && miniPackSize) {
      subOptions.push({
        key: "mini-pack",
        label: "Pack Mini Pastéis",
        icon: <PackMiniIcon size={64} />,
        desc: `${miniPackSize.description ?? "10 unidades"} · ${formatBRL(miniPackSize.priceCents)}`,
        onClick: () => pick(pastelDoce, { id: miniPackSize.id, name: miniPackSize.name }),
      });
    }
    return (
      <>
        {Header}
        <p className="t-body-sm mb-5 ml-9">Salgado, doce ou pack?</p>
        <div className="grid grid-cols-2 gap-3">
          {subOptions.map((s) => (
            <KindCard
              key={s.key}
              icon={s.icon}
              label={s.label}
              desc={s.desc}
              selected={false}
              onClick={s.onClick}
            />
          ))}
        </div>
      </>
    );
  }

  if (category === "macarrao") {
    // Macarrão tem 1 produto só → mostra como card único e o user clica
    // (mais previsível que auto-pick durante render).
    return (
      <>
        {Header}
        <p className="t-body-sm mb-5 ml-9">Monte seu macarrão.</p>
        {macarrao && (
          <KindCard
            icon={<MacarraoIcon size={64} />}
            label={macarrao.name}
            desc={`${formatBRL(macarrao.basePriceCents ?? 0)} · monte com toppings e molho`}
            selected={current.productId === macarrao.id}
            onClick={() => pick(macarrao)}
          />
        )}
      </>
    );
  }

  if (category === "bebidas") {
    return (
      <>
        {Header}
        <p className="t-body-sm mb-5 ml-9">Qual bebida?</p>
        <div className="grid grid-cols-2 gap-3">
          {bebidas.map((b) => (
            <KindCard
              key={b.id}
              icon={
                /* imageUrl (filesystem) preferido; imageDataUrl é fallback
                   legacy enquanto migração antiga não rodou. Audit #63. */
                (b.imageUrl ?? b.imageDataUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={b.imageUrl ?? b.imageDataUrl ?? ""}
                    alt=""
                    width={64}
                    height={64}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="w-16 h-16 object-contain select-none"
                    style={{ WebkitTouchCallout: "none" }}
                  />
                ) : (
                  <BebidaIcon size={64} />
                )
              }
              label={b.name}
              desc={formatBRL(b.basePriceCents ?? 0)}
              selected={current.productId === b.id}
              onClick={() => pick(b)}
            />
          ))}
        </div>
      </>
    );
  }

  // category === "promocoes" → mostra combos (e no futuro pode listar promoções ativas)
  return (
    <>
      {Header}
      <p className="t-body-sm mb-5 ml-9">Promoções e combos especiais.</p>
      <div className="grid grid-cols-2 gap-3">
        {combos.map((c) => (
          <KindCard
            key={c.id}
            icon={<PromocaoIcon size={64} />}
            label={c.name}
            desc={formatBRL(c.basePriceCents ?? 0)}
            selected={current.productId === c.id}
            onClick={() => pick(c)}
          />
        ))}
      </div>
    </>
  );
}

function StepProductSize({
  product,
  current,
  setCurrent,
  setPhase,
}: {
  product: ProductView;
  current: Building;
  setCurrent: (c: Building) => void;
  setPhase: (p: Phase) => void;
}) {
  function pick(sizeId: string, sizeName: string) {
    // Mantém legacy `size` em sync pra StepToppings (pastel pequeno tem regra de max 2)
    const legacySizeMap: Record<string, Size> = {
      "Pequeno": "pequeno",
      "Grande": "grande",
      "Normal": "normal",
      "Mini Pack": "mini",
    };
    setCurrent({
      ...current,
      productSizeId: sizeId,
      size: legacySizeMap[sizeName],
    });
    setTimeout(() => {
      const phases = phasesForProduct(product);
      const idx = phases.indexOf("size");
      const next = phases[idx + 1];
      if (next) setPhase(next);
    }, 180);
  }
  return (
    <>
      <h2 className="t-h1 mb-1">Tamanho</h2>
      <p className="t-body-sm mb-5">{product.name}: qual tamanho?</p>
      <div className="grid grid-cols-2 gap-3">
        {product.sizes.map((s) => {
          const selected = current.productSizeId === s.id;
          return (
            <button
              key={s.id}
              onClick={() => pick(s.id, s.name)}
              className={`h-36 rounded-lg border-2 flex flex-col items-center justify-center gap-1.5 p-3 transition-colors ${
                selected
                  ? "border-brand-yellow bg-[#FFFCE5]"
                  : "border-line bg-surface-elevated hover:border-ink-3"
              }`}
            >
              <div className="text-[17px] font-semibold text-ink">{s.name}</div>
              {s.description && (
                <div className="t-body-sm text-center line-clamp-2">{s.description}</div>
              )}
              <div className="text-xl t-num font-bold text-status-ready-ink mt-1">
                {formatBRL(s.priceCents)}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

function StepIngredients({
  product,
  current,
  setCurrent,
  ingredients,
}: {
  product: ProductView;
  current: Building;
  setCurrent: (c: Building) => void;
  ingredients: Ingredient[];
}) {
  // Modo de seleção depende de min/max:
  // - max=1, min=1 → radio (escolha única — pastel doce)
  // - max=N (fixo) → checklist com limite (combo 4 sabores)
  // - sem max → checklist livre (pastel salgado, macarrão)
  const min = product.minIngredients ?? (product.type === "salgado" || product.type === "macarrao" ? 1 : 0);
  const max = product.maxIngredients;
  // Regra extra legacy: pastel pequeno → max 2 toppings
  const legacyMax = product.type === "salgado" && current.size === "pequeno" ? MAX_TOPPINGS_PEQUENO : max;
  const isSingle = max === 1 && min === 1;
  const isExact = max !== null && max !== undefined && min === max;

  function toggle(name: string) {
    if (isSingle) {
      setCurrent({ ...current, ingredients: [name] });
      return;
    }
    const selected = current.ingredients.includes(name);
    if (selected) {
      setCurrent({ ...current, ingredients: current.ingredients.filter((x) => x !== name) });
    } else {
      if (legacyMax !== null && legacyMax !== undefined && current.ingredients.length >= legacyMax) return;
      setCurrent({ ...current, ingredients: [...current.ingredients, name] });
    }
  }

  let helper = "Escolha o que vai dentro.";
  if (isSingle) helper = "Escolha 1 sabor.";
  else if (isExact) helper = `Escolha exatamente ${min} sabor${min === 1 ? "" : "es"}.`;
  else if (legacyMax !== null && legacyMax !== undefined) helper = `Até ${legacyMax} ingredientes.`;
  else if (min > 0) helper = `Pelo menos ${min}.`;

  // Quando faz sentido "Marcar todos": só pra modos onde pode escolher
  // quantos quiser (não single, não exact) E sem limite baixo. Caso
  // clássico de uso: pastel GRANDE "tudo menos cebola". No pastel pequeno
  // (máx 2 de 12), marcar todos não economiza nada — é mais rápido tocar
  // nos 2 que quer. Esconde quando legacyMax ≤ 2 (feedback Gil).
  const hasLowCap = legacyMax !== null && legacyMax !== undefined && legacyMax <= 2;
  const allowBulk = !isSingle && !isExact && !hasLowCap;
  const allAvailable = ingredients.filter((i) => i.stock !== 0);
  const allMarked = allAvailable.length > 0 && allAvailable.every((i) => current.ingredients.includes(i.name));

  function markAll() {
    const names = allAvailable.map((i) => i.name);
    // Respeita legacyMax (pastel pequeno = 2)
    const finalList = legacyMax !== null && legacyMax !== undefined ? names.slice(0, legacyMax) : names;
    setCurrent({ ...current, ingredients: finalList });
  }
  function clearAll() {
    setCurrent({ ...current, ingredients: [] });
  }

  return (
    <>
      <h2 className="t-h1 mb-1">
        {product.type === "doce" ? "Sabor" : product.type === "combo" ? "Sabores" : "Ingredientes"}
      </h2>
      <p className="t-body-sm mb-1">{product.name}</p>
      <p className="t-body-sm mb-4 text-ink-3">
        {helper} {legacyMax !== null && legacyMax !== undefined && !isSingle && (
          <span className="font-bold text-ink-2">
            ({current.ingredients.length}/{legacyMax})
          </span>
        )}
      </p>

      {allowBulk && (
        <div className="flex gap-2 mb-3">
          <button
            onClick={markAll}
            disabled={allMarked}
            className="h-9 px-4 rounded-full border-2 border-line-strong t-body-sm font-semibold text-ink-2 hover:border-ink-3 hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1.5"
          >
            <Check size={14} strokeWidth={3} />
            {legacyMax ? `Marcar ${legacyMax}` : "Marcar tudo"}
          </button>
          <button
            onClick={clearAll}
            disabled={current.ingredients.length === 0}
            className="h-9 px-4 rounded-full border-2 border-line-strong t-body-sm font-semibold text-ink-2 hover:border-ink-3 hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Limpar
          </button>
        </div>
      )}

      {/* Audit-Crit C #23: ARIA pra ingredient toggles. Grid sem role
          implícito; chips usam aria-pressed (button toggle pattern WAI-ARIA).
          Texto do aria-label inclui estado pra leitor de tela ouvir
          "Bacon, selecionado" ou "Catupiry, esgotado, indisponível". */}
      <div className="grid grid-cols-2 gap-2.5" role="group" aria-label="Ingredientes disponíveis">
        {ingredients.map((opt) => {
          const isSelected = current.ingredients.includes(opt.name);
          // Ingredientes indisponíveis (toggled off pelo admin) já foram
          // filtrados upstream (toppings = allToppings.filter(i => i.available)).
          // Aqui todos os chips visíveis são selecionáveis.
          const ariaParts = [opt.name];
          if (isSelected) ariaParts.push("selecionado");
          return (
            <button
              key={opt.id}
              onClick={() => toggle(opt.name)}
              aria-pressed={isSelected}
              aria-label={ariaParts.join(", ")}
              className={`min-h-14 px-4 py-2.5 rounded-md text-[15px] font-semibold border-2 flex items-center justify-between gap-2 transition-colors text-left ${
                isSelected
                  ? "border-brand-yellow bg-[#FFFCE5] text-ink"
                  : "border-line bg-surface-elevated text-ink-2 hover:border-ink-3 hover:text-ink"
              }`}
            >
              <span className="truncate">{opt.name}</span>
              {isSelected && (
                <Check size={18} strokeWidth={3} className="shrink-0" aria-hidden />
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ============================================================
   EDIT DRAWER — edição in-place de item no cart.
   Slide-up sobre o cart (mantém contexto visual atrás).
   Reusa StepConfigure pra não duplicar UI.
   ============================================================ */
function EditDrawer({
  product,
  draft,
  setDraft,
  ingredients,
  molhos,
  onSave,
  onCancel,
}: {
  product: ProductView | null;
  draft: Building;
  setDraft: (c: Building) => void;
  ingredients: Ingredient[];
  molhos: Ingredient[];
  onSave: () => void;
  onCancel: () => void;
}) {
  // Esc fecha drawer
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  useBodyScrollLock(true);

  if (!product) return null;
  const canSave = isBuildingComplete(draft, product) && draft.quantity >= 1;

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-[3px] flex items-end md:items-center justify-center md:p-4 animate-fade-in"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Editar item"
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-2xl bg-surface rounded-t-xl md:rounded-xl max-h-[92dvh] flex flex-col animate-sheet-up"
      >
        <header className="flex items-center justify-between p-4 border-b border-line bg-surface-elevated rounded-t-xl">
          <div>
            <div className="t-label">Editar item</div>
            <h2 className="t-h2">{product.name}</h2>
          </div>
          <button
            onClick={onCancel}
            className="shrink-0 inline-flex items-center justify-center w-11 h-11 -mr-2 rounded-md text-ink-3 hover:text-ink hover:bg-surface-sunken"
            aria-label="Cancelar"
          >
            <X size={22} strokeWidth={2.5} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          <StepConfigure
            product={product}
            current={draft}
            setCurrent={setDraft}
            ingredients={ingredients}
            molhos={molhos}
          />
        </div>

        <footer className="border-t border-line p-4 flex gap-2 bg-surface-elevated rounded-b-xl">
          <button onClick={onCancel} className="btn btn-ghost flex-1">
            Cancelar
          </button>
          <button onClick={onSave} disabled={!canSave} className="btn btn-primary flex-1">
            Salvar
          </button>
        </footer>
      </div>
    </div>
  );
}

/* ============================================================
   STEP CONFIGURE — hub único de configuração do produto.
   Substitui size + content + sauces + notes + quantity em 1 tela.

   Layout vertical scrollable:
     1) Tamanho (se by_size)
     2) Ingredientes (se allowsIngredients) — após escolher tamanho
     3) Extras accordion (molhos + observações) — colapsado por default
     4) Quantidade inline com quick-pick
     5) Subtotal grande no fim (botão "Adicionar" tá na bottom bar)
   ============================================================ */
function StepConfigure({
  product,
  current,
  setCurrent,
  ingredients,
  molhos,
}: {
  product: ProductView;
  current: Building;
  setCurrent: (c: Building) => void;
  ingredients: Ingredient[];
  molhos: Ingredient[];
}) {
  const [extrasOpen, setExtrasOpen] = useState(
    // Default expandido se já tem molho/obs (provavelmente está editando)
    current.sauces.length > 0 || !!current.notes?.trim(),
  );

  const hasSize = product.pricingMode === "by_size" && product.sizes.length > 0;
  const productSize = product.sizes.find((s) => s.id === current.productSizeId) ?? null;
  const showIngredients = product.allowsIngredients && (hasSize ? !!productSize : true);
  const unitPrice = unitPriceOfBuilding(current, product);
  const subtotal = unitPrice * (current.quantity || 1);

  function setSize(size: ProductView["sizes"][number], legacySize?: Size) {
    setCurrent({ ...current, productSizeId: size.id, size: legacySize });
  }

  function toggleIngredient(name: string) {
    const has = current.ingredients.includes(name);
    if (has) {
      setCurrent({ ...current, ingredients: current.ingredients.filter((n) => n !== name) });
    } else {
      const max = product.maxIngredients;
      if (max !== null && max !== undefined && current.ingredients.length >= max) return;
      setCurrent({ ...current, ingredients: [...current.ingredients, name] });
    }
  }

  function toggleSauce(name: string) {
    const has = current.sauces.includes(name);
    if (has) {
      setCurrent({ ...current, sauces: current.sauces.filter((n) => n !== name) });
    } else {
      setCurrent({ ...current, sauces: [...current.sauces, name] });
    }
  }

  const isSingle = (product.minIngredients ?? 0) === 1 && (product.maxIngredients ?? 0) === 1;
  const isExact =
    product.minIngredients !== null &&
    product.minIngredients !== undefined &&
    product.minIngredients === product.maxIngredients;
  const min = product.minIngredients ?? 0;
  const max = product.maxIngredients;
  const allowBulk = !isSingle && !isExact && ingredients.length > 1;
  const availableIngredients = ingredients.filter((i) => i.stock !== 0);
  const allMarked =
    availableIngredients.length > 0 &&
    availableIngredients.every((i) => current.ingredients.includes(i.name));

  function markAll() {
    const names = availableIngredients.map((i) => i.name);
    const final = max !== null && max !== undefined ? names.slice(0, max) : names;
    setCurrent({ ...current, ingredients: final });
  }
  function clearAll() {
    setCurrent({ ...current, ingredients: [] });
  }

  const helperText = isSingle
    ? "Escolha 1."
    : isExact
    ? `Escolha exatamente ${min}.`
    : max !== null && max !== undefined
    ? `Até ${max} ingredientes.`
    : min > 0
    ? `Pelo menos ${min}.`
    : "Pode escolher quantos quiser.";

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="t-h1 mb-1">{product.name}</h1>
        {product.basePriceCents !== null && product.basePriceCents !== undefined && (
          <p className="t-body-sm">
            {formatBRL(product.basePriceCents)}
            {product.allowsSauces && " · molho extra R$ 1,50"}
          </p>
        )}
      </header>

      {/* === BLOCO 1: TAMANHO === */}
      {hasSize && (
        <section>
          <div className="t-label mb-3">Tamanho</div>
          <div className="grid grid-cols-2 gap-3">
            {product.sizes.map((s) => {
              const selected = current.productSizeId === s.id;
              const legacySizeMap: Record<string, Size> = {
                Pequeno: "pequeno",
                Grande: "grande",
                Normal: "normal",
                "Mini Pack": "mini",
              };
              return (
                <button
                  key={s.id}
                  onClick={() => setSize(s, legacySizeMap[s.name])}
                  className={`p-4 rounded-lg border-2 flex flex-col items-center justify-center gap-1.5 transition-colors ${
                    selected
                      ? "border-brand-yellow bg-[#FFFCE5]"
                      : "border-line bg-surface-elevated hover:border-ink-3"
                  }`}
                >
                  <div className="text-[17px] font-semibold text-ink">{s.name}</div>
                  {s.description && (
                    <div className="t-body-sm text-center line-clamp-2">{s.description}</div>
                  )}
                  <div className="text-xl t-num font-bold text-status-ready-ink mt-1">
                    {formatBRL(s.priceCents)}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* === BLOCO 2: INGREDIENTES === */}
      {showIngredients && ingredients.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <div className="t-label">
              {product.type === "doce" ? "Sabor" : product.type === "combo" ? "Sabores" : "Ingredientes"}
            </div>
            {max !== null && max !== undefined && !isSingle && (
              <div className="t-body-sm font-bold text-ink-2 t-num">
                {current.ingredients.length}/{max}
              </div>
            )}
          </div>
          <p className="t-body-sm text-ink-3 mb-3">{helperText}</p>

          {allowBulk && (
            <div className="flex gap-2 mb-3">
              <button
                onClick={markAll}
                disabled={allMarked}
                className="h-9 px-4 rounded-full border-2 border-line-strong t-body-sm font-semibold text-ink-2 hover:border-ink-3 hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
              >
                <Check size={14} strokeWidth={3} />
                {max ? `Marcar ${max}` : "Marcar tudo"}
              </button>
              <button
                onClick={clearAll}
                disabled={current.ingredients.length === 0}
                className="h-9 px-4 rounded-full border-2 border-line-strong t-body-sm font-semibold text-ink-2 hover:border-ink-3 hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Limpar
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5" role="group" aria-label="Ingredientes disponíveis">
            {ingredients.map((opt) => {
              const isSelected = current.ingredients.includes(opt.name);
              // Indisponíveis já foram filtrados upstream — todos os chips
              // visíveis são selecionáveis.
              const ariaParts = [opt.name];
              if (isSelected) ariaParts.push("selecionado");
              return (
                <button
                  key={opt.id}
                  onClick={() => toggleIngredient(opt.name)}
                  aria-pressed={isSelected}
                  aria-label={ariaParts.join(", ")}
                  className={`min-h-14 px-4 py-2.5 rounded-md text-[15px] font-semibold border-2 flex items-center justify-between gap-2 transition-colors text-left ${
                    isSelected
                      ? "border-brand-yellow bg-[#FFFCE5] text-ink"
                      : "border-line bg-surface-elevated text-ink-2 hover:border-ink-3 hover:text-ink"
                  }`}
                >
                  <span className="truncate">{opt.name}</span>
                  {isSelected && <Check size={18} strokeWidth={3} className="shrink-0" />}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* === BLOCO 3: EXTRAS (accordion: molhos + observações) === */}
      {(product.allowsSauces || true) && (
        <section className="border border-line rounded-lg overflow-hidden">
          <button
            onClick={() => setExtrasOpen(!extrasOpen)}
            className="w-full flex items-center justify-between px-4 py-3 bg-surface hover:bg-surface-sunken transition-colors"
          >
            <div className="flex-1 text-left">
              <div className="t-label">Extras</div>
              <div className="t-body-sm text-ink-3">
                {current.sauces.length === 0 && !current.notes?.trim()
                  ? "Sem molho extra · Sem observação"
                  : [
                      current.sauces.length > 0
                        ? `${current.sauces.length} molho${current.sauces.length === 1 ? "" : "s"}`
                        : null,
                      current.notes?.trim() ? "obs" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
              </div>
            </div>
            <span className="t-body-sm font-semibold text-ink-2">{extrasOpen ? "−" : "+"}</span>
          </button>
          {extrasOpen && (
            <div className="border-t border-line p-4 flex flex-col gap-4">
              {product.allowsSauces && molhos.length > 0 && (
                <div>
                  <div className="t-label mb-2">
                    Molho extra <span className="text-ink-3">(R$ 1,50 cada)</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {molhos.map((m) => {
                      const selected = current.sauces.includes(m.name);
                      return (
                        <button
                          key={m.id}
                          onClick={() => toggleSauce(m.name)}
                          className={`h-10 px-4 rounded-full border-2 text-[13px] font-semibold transition-colors ${
                            selected
                              ? "border-brand-yellow bg-[#FFFCE5] text-ink"
                              : "border-line-strong text-ink-2 hover:border-ink-3"
                          }`}
                        >
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div>
                <div className="t-label mb-2">Observação pra cozinha</div>
                <textarea
                  value={current.notes ?? ""}
                  onChange={(e) => setCurrent({ ...current, notes: e.target.value })}
                  placeholder="Ex: sem cebola · bem passado · sem sal"
                  rows={2}
                  className="textarea text-[13px]"
                />
              </div>
            </div>
          )}
        </section>
      )}

      {/* === BLOCO 4: QUANTIDADE inline === */}
      <section>
        <div className="t-label mb-3">Quantidade</div>
        <div className="flex items-center gap-3 flex-wrap">
          {[1, 2, 3, 5, 10].map((n) => (
            <button
              key={n}
              onClick={() => setCurrent({ ...current, quantity: n })}
              className={`h-12 min-w-[64px] px-4 rounded-full border-2 text-[15px] font-bold transition-colors ${
                current.quantity === n
                  ? "border-brand-yellow bg-[#FFFCE5] text-ink"
                  : "border-line-strong text-ink-2 hover:border-ink-3"
              }`}
            >
              {n}
            </button>
          ))}
          <div className="inline-flex items-center gap-2 ml-auto">
            <button
              onClick={() =>
                setCurrent({ ...current, quantity: Math.max(1, (current.quantity || 1) - 1) })
              }
              disabled={(current.quantity || 1) <= 1}
              className="h-11 w-11 rounded-md border border-line-strong inline-flex items-center justify-center text-ink-2 disabled:text-ink-3 disabled:border-line"
              aria-label="Diminuir"
            >
              <Minus size={18} strokeWidth={2.5} />
            </button>
            <span className="t-num font-extrabold text-xl min-w-8 text-center inline-block">
              {current.quantity || 1}
            </span>
            <button
              onClick={() =>
                setCurrent({ ...current, quantity: Math.min(20, (current.quantity || 1) + 1) })
              }
              disabled={(current.quantity || 1) >= 20}
              className="h-11 w-11 rounded-md border border-line-strong inline-flex items-center justify-center text-ink-2 disabled:text-ink-3 disabled:border-line"
              aria-label="Aumentar"
            >
              <Plus size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </section>

      {/* === BLOCO 5: SUBTOTAL === */}
      <section className="card p-4 flex items-baseline justify-between bg-surface">
        <div>
          <div className="t-label">Subtotal</div>
          <div className="t-caption">
            {formatBRL(unitPrice)} × {current.quantity || 1}
          </div>
        </div>
        <div className="text-2xl font-bold t-num">{formatBRL(subtotal)}</div>
      </section>
    </div>
  );
}

function KindCard({
  icon,
  label,
  desc,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-40 rounded-lg border-2 flex flex-col items-center justify-center gap-2.5 font-semibold transition-colors ${
        selected ? "border-brand-yellow bg-[#FFFCE5]" : "border-line bg-surface-elevated hover:border-ink-3"
      }`}
    >
      {icon}
      <span className="text-lg">{label}</span>
      <span className="text-xs text-ink-3 font-medium">{desc}</span>
    </button>
  );
}

/** Card horizontal compacto pra carrossel "Adicionar rápido".
 *  1 toque = adiciona produto no cart. Visual menor que KindCard
 *  pra distinguir afordância (não é "abrir menu" e sim "+1"). */
function ExpressCard({ product, onAdd }: { product: ProductView; onAdd: () => void }) {
  return (
    <button
      onClick={onAdd}
      className="shrink-0 w-32 h-28 rounded-lg border-2 border-line bg-surface-elevated hover:border-brand-yellow hover:bg-[#FFFCE5] active:scale-[0.96] transition flex flex-col items-center justify-center gap-1.5 relative p-2"
    >
      {/* Badge "+" no canto pra sinalizar "adiciona direto" */}
      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-brand-yellow text-ink flex items-center justify-center font-bold text-xs">
        +
      </div>
      {(product.imageUrl ?? product.imageDataUrl) ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={product.imageUrl ?? product.imageDataUrl ?? ""}
          alt=""
          width={40}
          height={40}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="w-10 h-10 object-contain select-none"
          style={{ WebkitTouchCallout: "none" }}
        />
      ) : (
        <BebidaIcon size={36} />
      )}
      <span className="text-[13px] font-bold text-ink leading-tight text-center line-clamp-2">{product.name}</span>
      <span className="t-caption t-num">{formatBRL(product.basePriceCents ?? 0)}</span>
    </button>
  );
}

function StepSauces({
  current,
  setCurrent,
  molhos,
}: {
  current: Building;
  setCurrent: (c: Building) => void;
  molhos: Ingredient[];
}) {
  const selected = new Set(current.sauces);
  const none = selected.size === 0;

  function toggle(name: string) {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setCurrent({ ...current, sauces: [...next] });
  }

  function selectNone() {
    setCurrent({ ...current, sauces: [] });
  }

  return (
    <>
      <h2 className="t-h1 mb-1">Molhos extras</h2>
      <p className="t-body-sm mb-5">
        Cada molho extra <span className="font-bold text-ink">{formatBRL(PRICE.sauce)}</span> · opcional, pode marcar mais de um.
      </p>
      <div className="flex flex-col gap-2.5">
        <button
          onClick={selectNone}
          className={`h-14 px-4 rounded-md border-2 flex items-center justify-between font-semibold text-base transition-colors ${
            none
              ? "border-brand-yellow bg-[#FFFCE5]"
              : "border-line bg-surface-elevated hover:border-ink-3"
          }`}
        >
          <span className="text-ink-2">Nenhum molho</span>
          <span className="text-xs font-bold text-ink-3 uppercase tracking-[0.06em]">
            grátis
          </span>
        </button>

        {molhos.map((opt) => {
          const isSelected = selected.has(opt.name);
          // Audit-Crit C #23: ARIA pra molhos (mesmo pattern dos toppings)
          const ariaParts = [opt.name];
          if (!opt.available) ariaParts.push("indisponível");
          if (isSelected) ariaParts.push("selecionado");
          return (
            <button
              key={opt.id}
              disabled={!opt.available}
              onClick={() => toggle(opt.name)}
              aria-pressed={isSelected}
              aria-label={ariaParts.join(", ")}
              className={`h-14 px-4 rounded-md border-2 flex items-center justify-between font-semibold text-base transition-colors ${
                !opt.available
                  ? "opacity-40 cursor-not-allowed border-line bg-surface-sunken"
                  : isSelected
                  ? "border-brand-yellow bg-[#FFFCE5]"
                  : "border-line bg-surface-elevated hover:border-ink-3"
              }`}
            >
              <span>{opt.name}</span>
              <span className="text-sm t-num text-ink-3 inline-flex items-center gap-2">
                +{formatBRL(PRICE.sauce)}
                {isSelected && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-ink">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

// Audit-Crit #3: modificadores rápidos. Cliente fala "sem cebola, bem
// dourado" e atendente leva 15s digitando. Chips de 1-tap canónicos
// resolvem 80% dos casos comuns. Free text continua disponível pro resto.
//
// Os chips são divididos em 2 grupos:
//   - NEGATIVOS ("sem X") em vermelho — destacam pra cozinha o que NÃO
//     pôr. Atalho pro caso mais comum de erro (cliente reclama porque
//     veio com cebola que ele disse pra tirar).
//   - PREFERÊNCIAS (ponto, temperatura) — neutros, mas estruturados.
//
// Toggle por substring no notes — se "sem cebola" já tá lá, remove.
// Senão append. Permite mistura com free text natural.
const QUICK_MODIFIERS: { label: string; phrase: string; negative: boolean }[] = [
  { label: "sem cebola", phrase: "sem cebola", negative: true },
  { label: "sem alho", phrase: "sem alho", negative: true },
  { label: "sem orégano", phrase: "sem orégano", negative: true },
  { label: "sem molho", phrase: "sem molho", negative: true },
  { label: "extra queijo", phrase: "extra queijo", negative: false },
  { label: "extra molho", phrase: "extra molho", negative: false },
  { label: "bem dourado", phrase: "bem dourado", negative: false },
  { label: "mal dourado", phrase: "mal dourado", negative: false },
];

function notesHas(notes: string, phrase: string): boolean {
  const n = notes.toLowerCase();
  return n.includes(phrase.toLowerCase());
}

function toggleModifier(notes: string, phrase: string): string {
  if (notesHas(notes, phrase)) {
    // Remove + limpa vírgulas/espaços órfãos
    return notes
      .replace(new RegExp(`\\s*,?\\s*${phrase}\\s*,?\\s*`, "i"), ", ")
      .replace(/,\s*,/g, ",")
      .replace(/^[,\s]+|[,\s]+$/g, "")
      .trim();
  }
  return notes.trim() ? `${notes.trim()}, ${phrase}` : phrase;
}

function StepNotes({
  current,
  setCurrent,
}: {
  current: Building;
  setCurrent: (c: Building) => void;
}) {
  const notes = current.notes ?? "";
  return (
    <>
      <h2 className="t-h1 mb-1">Observações</h2>
      <p className="t-body-sm mb-4">Toque os mais comuns ou escreva à vontade.</p>

      <div className="flex flex-wrap gap-2 mb-4">
        {QUICK_MODIFIERS.map((mod) => {
          const active = notesHas(notes, mod.phrase);
          const baseCls =
            "inline-flex items-center gap-1.5 px-3 py-2 rounded-md t-body-sm font-semibold border-2 active:scale-[0.96] transition-colors";
          const cls = active
            ? mod.negative
              ? `${baseCls} bg-danger-bg border-danger text-danger`
              : `${baseCls} bg-brand-yellow-soft border-brand-orange text-ink`
            : mod.negative
              ? `${baseCls} bg-surface-elevated border-line text-ink-2 hover:border-danger hover:text-danger`
              : `${baseCls} bg-surface-elevated border-line text-ink-2 hover:border-ink-3 hover:text-ink`;
          return (
            <button
              key={mod.phrase}
              type="button"
              onClick={() =>
                setCurrent({ ...current, notes: toggleModifier(notes, mod.phrase) })
              }
              className={cls}
              aria-pressed={active}
            >
              {mod.negative && <span className="text-xs leading-none">✕</span>}
              {!mod.negative && active && <span className="text-xs leading-none">✓</span>}
              {mod.label}
            </button>
          );
        })}
      </div>

      <textarea
        className="textarea h-28"
        placeholder="Outra observação livre"
        value={notes}
        onChange={(e) => setCurrent({ ...current, notes: e.target.value })}
      />
    </>
  );
}

function StepQuantity({
  current,
  setCurrent,
  product,
}: {
  current: Building;
  setCurrent: (c: Building) => void;
  product: ProductView | null;
}) {
  const qty = Math.max(1, current.quantity || 1);
  function setQty(n: number) {
    setCurrent({ ...current, quantity: Math.min(20, Math.max(1, n)) });
  }
  const unit = unitPriceOfBuilding(current, product);
  return (
    <>
      <h2 className="t-h1 mb-1">Quantidade</h2>
      <p className="t-body-sm mb-6">Quantos pastéis iguais a esse? Se for só um, deixa em 1.</p>

      <div className="flex items-center justify-center gap-5">
        <button
          onClick={() => setQty(qty - 1)}
          disabled={qty <= 1}
          className="h-16 w-16 rounded-full border-2 border-line-strong bg-surface-elevated text-ink inline-flex items-center justify-center disabled:opacity-40 hover:border-ink-3 active:scale-[0.94] transition-transform"
          aria-label="Diminuir"
        >
          <Minus size={28} strokeWidth={3} />
        </button>
        {/* key={qty} dispara number-bump a cada incremento */}
        <div
          key={qty}
          className="text-6xl font-extrabold t-num min-w-[5rem] text-center animate-number-bump"
        >
          {qty}
        </div>
        <button
          onClick={() => setQty(qty + 1)}
          disabled={qty >= 20}
          className="h-16 w-16 rounded-full border-2 border-brand-yellow bg-brand-yellow text-ink inline-flex items-center justify-center disabled:opacity-40 hover:bg-brand-yellow-hover active:scale-[0.94] transition-transform"
          aria-label="Aumentar"
        >
          <Plus size={28} strokeWidth={3} />
        </button>
      </div>

      <div className="mt-8 text-center">
        <div className="t-label">
          Subtotal
        </div>
        <div className="text-2xl font-extrabold t-num">{formatBRL(unit * qty)}</div>
        <div className="text-xs text-ink-3 mt-0.5">
          {qty}× {formatBRL(unit)} unidade
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 justify-center">
        {[1, 2, 3, 5, 10].map((n) => (
          <button
            key={n}
            onClick={() => setQty(n)}
            className={`h-9 px-4 rounded-full border text-sm font-semibold ${
              qty === n
                ? "bg-ink text-brand-yellow border-ink"
                : "bg-surface-elevated text-ink-2 border-line-strong"
            }`}
          >
            {n}×
          </button>
        ))}
      </div>
    </>
  );
}

function Stepper({
  phase,
  clientName,
  pastelIdx,
}: {
  phase: Phase;
  clientName: string;
  pastelIdx: number;
}) {
  // 4 passos universais com labels claros (em vez de "Etapa 3/5" abstrato).
  // Phases legacy (size/content/sauces/notes/quantity) mapeiam pra "Configurar".
  // Labels enxutos pra caber em viewport 320px (iPhone SE) — antes "Configurar"
  // estourava o chip; "Montar" entrega o mesmo significado em 6 letras.
  const STEPS: Array<{ id: string; label: string; matches: Phase[] }> = [
    { id: "client", label: "Cliente", matches: ["client"] },
    { id: "product", label: "Produto", matches: ["product"] },
    {
      id: "configure",
      label: "Montar",
      matches: ["configure", "size", "content", "sauces", "notes", "quantity", "kind"],
    },
    { id: "cart", label: "Resumo", matches: ["cart"] },
  ];
  const currentIdx = STEPS.findIndex((s) => s.matches.includes(phase));

  return (
    <div>
      <div className="text-xs font-semibold mb-2 text-ink-2">
        Pastel <span className="text-ink t-num">{pastelIdx}</span> · {clientName}
      </div>
      <div className="flex items-center gap-1.5">
        {STEPS.map((s, i) => {
          const isCurrent = i === currentIdx;
          const isPast = i < currentIdx;
          return (
            <div key={s.id} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`h-1.5 w-full rounded-full transition-colors ${
                  isPast
                    ? "bg-status-ready"
                    : isCurrent
                    ? "bg-brand-yellow"
                    : "bg-surface-sunken"
                }`}
              />
              <span
                className={`text-[10px] font-bold uppercase tracking-[0.04em] truncate ${
                  isCurrent ? "text-ink" : isPast ? "text-status-ready-ink" : "text-ink-3"
                }`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryDraft({ draft, products }: { draft: Building; products: ProductView[] }) {
  const product = products.find((p) => p.id === draft.productId);
  const sizeName = product?.sizes.find((s) => s.id === draft.productSizeId)?.name ?? null;
  const rows: Array<[string, string | null]> = [
    ["Produto", product?.name ?? null],
    ["Tamanho", sizeName],
    ["Conteúdo", draft.ingredients.length > 0 ? draft.ingredients.join(", ") : null],
    ["Molhos", draft.sauces.length > 0 ? draft.sauces.join(", ") : null],
    ["Obs", draft.notes?.trim() || null],
  ];
  const hasAny = rows.some(([, v]) => v);
  if (!hasAny) {
    return <div className="text-sm text-ink-3 italic">Comece escolhendo o produto.</div>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {rows
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <li key={k} className="t-body-sm flex gap-2">
            <span className="t-label w-20 shrink-0 mt-0.5">{k}</span>
            <span className="text-ink-2">{v}</span>
          </li>
        ))}
    </ul>
  );
}

/**
 * Input pra digitar cupom de promoção (não auto-detectada).
 * Valida via findCouponMatch — só aplica se passar nos critérios do cart.
 */
function CouponInput({
  promotions,
  cart,
  selectedPromo,
  onApply,
}: {
  promotions: PromotionView[];
  cart: Array<{ productId: string | null; unitPriceCents: number; quantity: number }>;
  selectedPromo: PromotionView | null;
  onApply: (id: string | null) => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Esconde input se uma promo de cupom já está aplicada
  const couponApplied = selectedPromo?.couponCode ?? null;
  if (couponApplied) {
    return (
      <div className="mb-4 p-3 rounded-md border-2 border-brand-yellow bg-[#FFFCE5] flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="t-label">
            Cupom aplicado
          </div>
          <div className="font-bold text-ink t-num">{couponApplied}</div>
        </div>
        <button
          onClick={() => onApply(null)}
          className="shrink-0 h-9 px-3 rounded-md bg-ink text-brand-yellow text-xs font-bold uppercase"
        >
          Remover
        </button>
      </div>
    );
  }

  function tryApply() {
    setError(null);
    const result = findCouponMatch(promotions, code, cart);
    if (result.reason === "ok" && result.promo) {
      onApply(result.promo.id);
      setCode("");
    } else if (result.reason === "not-found") {
      setError("Cupom inválido.");
    } else {
      setError("Cupom não se aplica a esse pedido.");
    }
  }

  return (
    <div className="mb-4 flex flex-col gap-1">
      <div className="flex gap-2">
        {/* Ícone Tag à esquerda + placeholder explícito (audit P2 #19):
            sem affordance forte o input passava batido como label de fase
            do stepper, cupons ficavam não-descobertos. */}
        <div className="relative flex-1">
          <Tag
            size={16}
            strokeWidth={2.25}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none"
            aria-hidden
          />
          <input
            type="text"
            className="input h-11 text-sm uppercase t-num w-full pl-9"
            placeholder="Código do cupom (opcional)"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase().replace(/\s/g, ""));
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") tryApply();
            }}
          />
        </div>
        <button
          onClick={tryApply}
          disabled={!code.trim()}
          className="h-11 px-4 rounded-md bg-ink text-brand-yellow font-bold text-[13px] disabled:opacity-40"
        >
          Aplicar
        </button>
      </div>
      {error && (
        <div className="text-xs text-danger px-1">{error}</div>
      )}
    </div>
  );
}

function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 bg-surface-elevated border-t border-line px-4 py-3 pb-[max(env(safe-area-inset-bottom),12px)] flex gap-2 md:px-6">
      {/* Alinha com a largura do stepper acima: max-w-2xl no mobile,
          max-w-4xl no desktop (audit UX desktop 2026-05-27). */}
      <div className="max-w-2xl md:max-w-4xl w-full mx-auto flex gap-2">{children}</div>
    </div>
  );
}

type FilterId = OrderStatus;

const FILTER_TABS: Array<{
  id: FilterId;
  label: string;
  active: string;
  idle: string;
  pillActive: string;
  pillIdle: string;
}> = [
  {
    id: "PRONTO",
    label: "Prontos",
    active: "bg-status-ready text-white border-status-ready shadow-sm",
    idle: "bg-status-ready-bg text-status-ready-ink border-status-ready-bg hover:border-status-ready",
    pillActive: "bg-white/25 text-white",
    pillIdle: "bg-white/60 text-status-ready-ink",
  },
  {
    id: "PEDIDO_FEITO",
    label: "Efetuado",
    active: "bg-status-incoming text-white border-status-incoming shadow-sm",
    idle: "bg-status-incoming-bg text-status-incoming-ink border-status-incoming-bg hover:border-status-incoming",
    pillActive: "bg-white/25 text-white",
    pillIdle: "bg-white/60 text-status-incoming-ink",
  },
  {
    id: "EM_PREPARO",
    label: "Em preparo",
    active: "bg-status-preparing text-ink border-status-preparing shadow-sm",
    idle: "bg-status-preparing-bg text-status-preparing-ink border-status-preparing-bg hover:border-status-preparing",
    pillActive: "bg-ink/15 text-ink",
    pillIdle: "bg-white/60 text-status-preparing-ink",
  },
  {
    id: "ENTREGUE",
    label: "Entregue",
    active: "bg-status-delivered text-white border-status-delivered shadow-sm",
    idle: "bg-status-delivered-bg text-status-delivered-ink border-status-delivered-bg hover:border-status-delivered",
    pillActive: "bg-white/25 text-white",
    pillIdle: "bg-white/60 text-status-delivered-ink",
  },
];

function Fila({
  orders,
  filter,
  onFilter,
  onCancel,
  onAdvance,
  onEdit,
  onRemoveItem,
  onNotifyReady,
}: {
  orders: OrderView[];
  filter: "todos" | OrderStatus;
  onFilter: (f: "todos" | OrderStatus) => void;
  onCancel: (id: number) => void;
  onAdvance: (id: number) => void;
  onEdit: (order: OrderView) => void;
  onRemoveItem: (orderId: number, itemId: string) => void;
  onNotifyReady: (order: OrderView) => void;
}) {
  const effectiveFilter: OrderStatus = filter === "todos" ? "PRONTO" : filter;
  const filtered = orders.filter((o) => o.status === effectiveFilter);
  // Um único timer pra todos os cards (em vez de cada OrderCard com o seu).
  // Em fila com 30 pedidos isso é 30→1 setInterval — ganho perceptível em
  // bateria de tablet ocioso na barraca.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const counts: Record<FilterId, number> = {
    PEDIDO_FEITO: orders.filter((o) => o.status === "PEDIDO_FEITO").length,
    EM_PREPARO: orders.filter((o) => o.status === "EM_PREPARO").length,
    PRONTO: orders.filter((o) => o.status === "PRONTO").length,
    ENTREGUE: orders.filter((o) => o.status === "ENTREGUE").length,
    CANCELADO: orders.filter((o) => o.status === "CANCELADO").length,
  };

  return (
    <div
      className="flex-1 flex flex-col"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 140px)" }}
    >
      <div className="px-4 md:px-8 pt-5 max-w-3xl w-full mx-auto">
        <h1 className="t-h1 mb-4">Fila</h1>
      </div>
      <div className="px-4 md:px-8 mb-3 max-w-3xl w-full mx-auto">
        {/* flex-wrap pra caber todos os chips em 2 linhas no mobile sem
            scroll horizontal. No desktop com mais espaço fica em 1 linha. */}
        <div className="flex flex-wrap gap-2">
          {FILTER_TABS.map((t) => {
            const active = effectiveFilter === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onFilter(t.id)}
                className={`shrink-0 h-9 px-4 rounded-full text-sm font-semibold border-2 inline-flex items-center gap-1.5 transition-colors ${
                  active ? t.active : t.idle
                }`}
              >
                {t.label}
                <span
                  className={`t-caption font-bold px-1.5 rounded-full t-num ${
                    active ? t.pillActive : t.pillIdle
                  }`}
                >
                  {counts[t.id]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 px-4 md:px-8 pb-8 max-w-3xl w-full mx-auto">
        {/* key={effectiveFilter} faz fade rápido ao trocar filtro */}
        <div key={effectiveFilter} className="animate-fade-in">
          {filtered.length === 0 ? (
            <div className="card p-10 text-center border-dashed">
              <div className="flex justify-center mb-2 opacity-50">
                <PastelSalgadoIcon size={64} />
              </div>
              {(() => {
                // Audit P1 #09: cada filtro tem voz própria no empty.
                // Genérico ("ele aparece aqui") era ruim — em "Cancelado" parece
                // que tá esperando coisa que não devia aparecer.
                const messages: Record<OrderStatus | "todos", { title: string; body: string }> = {
                  PEDIDO_FEITO: {
                    title: "Nenhum pedido novo.",
                    body: "Próximo cliente, próxima entrada.",
                  },
                  EM_PREPARO: {
                    title: "Nada em preparo agora.",
                    body: "Cozinha tá esperando o próximo.",
                  },
                  PRONTO: {
                    title: "Nenhum pedido pronto agora.",
                    body: "Cozinha tá no fluxo.",
                  },
                  ENTREGUE: {
                    title: "Nenhum pedido entregue ainda hoje.",
                    body: "O dia tá começando.",
                  },
                  CANCELADO: {
                    title: "Sem cancelamentos hoje.",
                    body: "Tudo certinho até agora.",
                  },
                  todos: {
                    title: "Nada por aqui.",
                    body: "Filtra por outro status pra ver os pedidos.",
                  },
                };
                const m = messages[effectiveFilter] ?? messages.todos;
                return (
                  <>
                    <div className="t-h4 text-ink-2">{m.title}</div>
                    <div className="t-body-sm mt-1">{m.body}</div>
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtered.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  now={now}
                  onCancel={onCancel}
                  onAdvance={onAdvance}
                  onEdit={() => onEdit(o)}
                  onRemoveItem={onRemoveItem}
                  onNotifyReady={onNotifyReady}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
