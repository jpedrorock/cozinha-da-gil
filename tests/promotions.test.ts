import { describe, expect, it } from "vitest";
import {
  computeDiscount,
  detectApplicable,
  findCouponMatch,
  serializePromotion,
  type PromotionView,
} from "@/lib/promotions";

function makePromo(overrides: Partial<PromotionView> = {}): PromotionView {
  return {
    id: "p1",
    name: "Test promo",
    description: null,
    discountType: "percent",
    discountValue: 10,
    active: true,
    validFromDate: null,
    validUntilDate: null,
    appliesToProductIds: [],
    minItems: null,
    minTotalCents: null,
    couponCode: null,
    createdBy: "Gil",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("serializePromotion", () => {
  it("parses appliesToProductIds JSON to array", () => {
    const raw = {
      id: "p1",
      name: "x",
      description: null,
      discountType: "percent",
      discountValue: 10,
      active: true,
      validFromDate: null,
      validUntilDate: null,
      appliesToProductIds: '["prod-a","prod-b"]',
      minItems: null,
      minTotalCents: null,
      couponCode: null,
      createdBy: "Gil",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const view = serializePromotion(raw);
    expect(view.appliesToProductIds).toEqual(["prod-a", "prod-b"]);
  });

  it("returns empty array when JSON is invalid", () => {
    const raw = {
      id: "p1",
      name: "x",
      description: null,
      discountType: "percent",
      discountValue: 10,
      active: true,
      validFromDate: null,
      validUntilDate: null,
      appliesToProductIds: "not-json",
      minItems: null,
      minTotalCents: null,
      couponCode: null,
      createdBy: "Gil",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const view = serializePromotion(raw);
    expect(view.appliesToProductIds).toEqual([]);
  });
});

describe("computeDiscount", () => {
  it("applies percent discount correctly", () => {
    const promo = makePromo({ discountType: "percent", discountValue: 10 });
    expect(computeDiscount(promo, 10000)).toBe(1000); // 10% of R$100 = R$10
  });

  it("applies fixed_cents discount correctly", () => {
    const promo = makePromo({ discountType: "fixed_cents", discountValue: 500 });
    expect(computeDiscount(promo, 10000)).toBe(500); // R$5 off
  });

  it("clamps fixed discount to total (never negative)", () => {
    const promo = makePromo({ discountType: "fixed_cents", discountValue: 10000 });
    expect(computeDiscount(promo, 5000)).toBe(5000); // not 10000
  });

  it("clamps percent to 0..100", () => {
    const p1 = makePromo({ discountType: "percent", discountValue: 150 });
    expect(computeDiscount(p1, 10000)).toBe(10000); // 100% max
    const p2 = makePromo({ discountType: "percent", discountValue: -5 });
    expect(computeDiscount(p2, 10000)).toBe(0); // negative → 0
  });

  it("returns 0 for unknown discount type", () => {
    const promo = makePromo({ discountType: "free_item", discountValue: 1 });
    expect(computeDiscount(promo, 10000)).toBe(0);
  });
});

describe("detectApplicable", () => {
  const cart = [
    { productId: "prod-pastel", unitPriceCents: 1500, quantity: 2 },
    { productId: "prod-bebida", unitPriceCents: 600, quantity: 1 },
  ];
  // totalQty = 3, totalCents = 3600

  it("returns inactive promotions filtered out", () => {
    const p = makePromo({ active: false });
    expect(detectApplicable([p], cart)).toEqual([]);
  });

  it("filters by validFromDate", () => {
    const future = new Date(Date.now() + 86400_000);
    const p = makePromo({ validFromDate: future });
    expect(detectApplicable([p], cart)).toEqual([]);
  });

  it("filters by validUntilDate", () => {
    const past = new Date(Date.now() - 86400_000);
    const p = makePromo({ validUntilDate: past });
    expect(detectApplicable([p], cart)).toEqual([]);
  });

  it("applies when validFrom and validUntil bracket now", () => {
    const past = new Date(Date.now() - 86400_000);
    const future = new Date(Date.now() + 86400_000);
    const p = makePromo({ validFromDate: past, validUntilDate: future });
    expect(detectApplicable([p], cart)).toHaveLength(1);
  });

  it("requires at least one matching product when appliesToProductIds is set", () => {
    const p1 = makePromo({ appliesToProductIds: ["prod-pastel"] });
    expect(detectApplicable([p1], cart)).toHaveLength(1);
    const p2 = makePromo({ appliesToProductIds: ["prod-otro"] });
    expect(detectApplicable([p2], cart)).toEqual([]);
  });

  it("empty appliesToProductIds means applies to all", () => {
    const p = makePromo({ appliesToProductIds: [] });
    expect(detectApplicable([p], cart)).toHaveLength(1);
  });

  it("respects minItems (sum of quantity)", () => {
    const p1 = makePromo({ minItems: 3 });
    expect(detectApplicable([p1], cart)).toHaveLength(1);
    const p2 = makePromo({ minItems: 4 });
    expect(detectApplicable([p2], cart)).toEqual([]);
  });

  it("respects minTotalCents", () => {
    const p1 = makePromo({ minTotalCents: 3600 });
    expect(detectApplicable([p1], cart)).toHaveLength(1);
    const p2 = makePromo({ minTotalCents: 3601 });
    expect(detectApplicable([p2], cart)).toEqual([]);
  });

  it("returns all applicable promotions when multiple match", () => {
    const promos = [makePromo({ id: "a" }), makePromo({ id: "b" })];
    expect(detectApplicable(promos, cart)).toHaveLength(2);
  });

  it("EXCLUI promoções com couponCode da auto-detecção", () => {
    const auto = makePromo({ id: "auto" });
    const coupon = makePromo({ id: "coupon", couponCode: "FESTA10" });
    const result = detectApplicable([auto, coupon], cart);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("auto");
  });
});

describe("findCouponMatch", () => {
  const cart = [
    { productId: "prod-pastel", unitPriceCents: 1500, quantity: 2 },
  ];

  it("encontra cupom case-insensitive", () => {
    const promo = makePromo({ couponCode: "FESTA10" });
    expect(findCouponMatch([promo], "festa10", cart).reason).toBe("ok");
    expect(findCouponMatch([promo], "FESTA10", cart).reason).toBe("ok");
    expect(findCouponMatch([promo], " Festa10 ", cart).reason).toBe("ok");
  });

  it("retorna not-found quando cupom não existe", () => {
    const promo = makePromo({ couponCode: "FESTA10" });
    const result = findCouponMatch([promo], "OUTROCUPOM", cart);
    expect(result.reason).toBe("not-found");
    expect(result.promo).toBeNull();
  });

  it("retorna not-applicable quando cupom existe mas não passa critérios", () => {
    const promo = makePromo({
      couponCode: "MIN50",
      minTotalCents: 50000, // R$500 — cart só tem R$30
    });
    const result = findCouponMatch([promo], "MIN50", cart);
    expect(result.reason).toBe("not-applicable");
  });

  it("ignora cupom inativo", () => {
    const promo = makePromo({ couponCode: "OFF", active: false });
    expect(findCouponMatch([promo], "OFF", cart).reason).toBe("not-applicable");
  });

  it("retorna not-found pra string vazia", () => {
    expect(findCouponMatch([], "", cart).reason).toBe("not-found");
    expect(findCouponMatch([], "   ", cart).reason).toBe("not-found");
  });
});
