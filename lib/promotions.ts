import type { Promotion } from "@prisma/client";

export type PromotionView = Omit<Promotion, "appliesToProductIds"> & {
  appliesToProductIds: string[];
};

export function serializePromotion(p: Promotion): PromotionView {
  let ids: string[] = [];
  try {
    const parsed = JSON.parse(p.appliesToProductIds);
    if (Array.isArray(parsed)) ids = parsed.filter((x): x is string => typeof x === "string");
  } catch {}
  return { ...p, appliesToProductIds: ids };
}

export type CartItem = {
  productId: string | null;
  unitPriceCents: number;
  quantity: number;
};

/**
 * Filtra promoções aplicáveis ao carrinho atual.
 *
 * Regras:
 * - active=true e dentro do range de datas (se setado)
 * - **Promoções com couponCode são EXCLUÍDAS** da auto-detecção
 *   (precisam de `applyCoupon` separado pra entrar)
 * - se appliesToProductIds não vazio: cart precisa ter pelo menos 1 item com productId nessa lista
 * - se minItems setado: soma de quantity do cart ≥ minItems
 * - se minTotalCents setado: soma de unitPrice*qty do cart ≥ minTotalCents
 */
export function detectApplicable(
  promotions: PromotionView[],
  cart: CartItem[],
): PromotionView[] {
  return promotions
    .filter((p) => !p.couponCode) // cupons só entram por código
    .filter((p) => isApplicable(p, cart));
}

/**
 * Verifica se uma promoção específica passa nos critérios.
 * Compartilhado entre auto-detect, validação de cupom, e revalidação
 * server-side. Independente de couponCode (não filtra por cupom aqui —
 * isso é responsabilidade do caller).
 */
export function isApplicable(p: PromotionView, cart: CartItem[]): boolean {
  const now = new Date();
  const totalQty = cart.reduce((s, i) => s + i.quantity, 0);
  const totalCents = cart.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0);

  if (!p.active) return false;
  if (p.validFromDate && now < new Date(p.validFromDate)) return false;
  if (p.validUntilDate && now > new Date(p.validUntilDate)) return false;

  if (p.appliesToProductIds.length > 0) {
    const hasMatch = cart.some(
      (i) => i.productId !== null && p.appliesToProductIds.includes(i.productId),
    );
    if (!hasMatch) return false;
  }

  if (p.minItems !== null && p.minItems !== undefined && totalQty < p.minItems) return false;
  if (p.minTotalCents !== null && p.minTotalCents !== undefined && totalCents < p.minTotalCents) {
    return false;
  }
  return true;
}

/**
 * Busca promoção por código de cupom (case-insensitive) na lista
 * fornecida E valida que ela passa nos critérios do carrinho atual.
 * Retorna a promoção se OK; senão null.
 */
export function findCouponMatch(
  promotions: PromotionView[],
  code: string,
  cart: CartItem[],
): { promo: PromotionView; reason: "ok" } | { promo: null; reason: "not-found" | "not-applicable" } {
  const normalized = code.trim().toLowerCase();
  if (!normalized) return { promo: null, reason: "not-found" };
  const found = promotions.find(
    (p) => p.couponCode && p.couponCode.toLowerCase() === normalized,
  );
  if (!found) return { promo: null, reason: "not-found" };
  if (!isApplicable(found, cart)) return { promo: null, reason: "not-applicable" };
  return { promo: found, reason: "ok" };
}

/**
 * Calcula desconto em centavos pra um total e uma promoção.
 * - percent: discountValue=10 → 10% off
 * - fixed_cents: discountValue=500 → R$5 off (clamp a 0)
 * - free_item: precisa do cart pra calcular — chama computeFreeItemDiscount
 */
export function computeDiscount(
  promotion: PromotionView,
  totalCents: number,
  cart?: CartItem[],
): number {
  if (promotion.discountType === "percent") {
    const pct = Math.max(0, Math.min(100, promotion.discountValue));
    return Math.floor((totalCents * pct) / 100);
  }
  if (promotion.discountType === "fixed_cents") {
    return Math.max(0, Math.min(totalCents, promotion.discountValue));
  }
  if (promotion.discountType === "free_item" && cart) {
    return computeFreeItemDiscount(promotion, cart);
  }
  return 0;
}

/**
 * Desconto "1 item grátis" — pega o item ELEGÍVEL mais barato do cart
 * (entre os productIds em appliesToProductIds, ou qualquer um se vazio)
 * e zera seu preço. Sempre o mais barato pra evitar abuso.
 */
function computeFreeItemDiscount(
  promotion: PromotionView,
  cart: CartItem[],
): number {
  const eligible = promotion.appliesToProductIds.length > 0
    ? cart.filter(
        (i) => i.productId !== null && promotion.appliesToProductIds.includes(i.productId),
      )
    : cart;
  if (eligible.length === 0) return 0;
  // Mais barato
  const cheapest = eligible.reduce((min, cur) =>
    cur.unitPriceCents < min.unitPriceCents ? cur : min,
  );
  return cheapest.unitPriceCents;
}
