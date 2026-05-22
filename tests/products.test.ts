import { describe, expect, it } from "vitest";
import { computeUnitPrice, validateIngredientSelection } from "@/lib/products";
import type { Product, ProductSize } from "@prisma/client";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    name: "Pastel Salgado",
    type: "salgado",
    pricingMode: "by_size",
    basePriceCents: null,
    available: true,
    position: 0,
    allowsIngredients: true,
    ingredientCategory: "topping",
    maxIngredients: null,
    minIngredients: null,
    allowsSauces: true,
    sauceCategory: null,
    stock: null,
    lowStockThreshold: null,
    imageUrl: null,
    imageDataUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeSize(overrides: Partial<ProductSize> = {}): ProductSize {
  return {
    id: "s1",
    productId: "p1",
    name: "Grande",
    description: null,
    priceCents: 2000,
    position: 0,
    ...overrides,
  };
}

describe("computeUnitPrice", () => {
  it("fixed pricing uses basePriceCents + sauces", () => {
    const macarrao = makeProduct({
      type: "macarrao",
      pricingMode: "fixed",
      basePriceCents: 2000,
    });
    expect(computeUnitPrice(macarrao, null, 0)).toBe(2000);
    expect(computeUnitPrice(macarrao, null, 1)).toBe(2150); // R$1.50 por molho
    expect(computeUnitPrice(macarrao, null, 3)).toBe(2450);
  });

  it("by_size pricing uses ProductSize.priceCents", () => {
    const p = makeProduct({ pricingMode: "by_size", basePriceCents: null });
    const small = makeSize({ priceCents: 1500 });
    const big = makeSize({ name: "Grande", priceCents: 2000 });
    expect(computeUnitPrice(p, small, 0)).toBe(1500);
    expect(computeUnitPrice(p, big, 0)).toBe(2000);
  });

  it("by_size with no size selected returns 0 base + sauces", () => {
    const p = makeProduct({ pricingMode: "by_size", basePriceCents: null });
    expect(computeUnitPrice(p, null, 2)).toBe(300); // só os molhos
  });

  it("fixed with null basePriceCents returns just sauces", () => {
    const p = makeProduct({ pricingMode: "fixed", basePriceCents: null });
    expect(computeUnitPrice(p, null, 1)).toBe(150);
  });

  it("sauce price is fixed at 150 cents (R$1.50)", () => {
    const p = makeProduct({ pricingMode: "fixed", basePriceCents: 1000 });
    expect(computeUnitPrice(p, null, 4)).toBe(1000 + 4 * 150);
  });
});

describe("validateIngredientSelection", () => {
  it("returns error when ingredients given but product doesn't allow", () => {
    const p = makeProduct({ allowsIngredients: false });
    expect(validateIngredientSelection(p, ["Frango"])).toContain("não aceita");
  });

  it("returns null when product disallows and no ingredients", () => {
    const p = makeProduct({ allowsIngredients: false });
    expect(validateIngredientSelection(p, [])).toBeNull();
  });

  it("enforces minIngredients", () => {
    const p = makeProduct({ minIngredients: 2 });
    expect(validateIngredientSelection(p, ["Frango"])).toContain(
      "pelo menos 2",
    );
    expect(validateIngredientSelection(p, ["Frango", "Bacon"])).toBeNull();
  });

  it("enforces maxIngredients", () => {
    const p = makeProduct({ maxIngredients: 2 });
    expect(validateIngredientSelection(p, ["A", "B"])).toBeNull();
    expect(validateIngredientSelection(p, ["A", "B", "C"])).toContain(
      "no máximo 2",
    );
  });

  it("combo: min=max=4 forces exact count", () => {
    const p = makeProduct({
      type: "combo",
      minIngredients: 4,
      maxIngredients: 4,
    });
    expect(validateIngredientSelection(p, ["A", "B", "C"])).toContain(
      "pelo menos 4",
    );
    expect(validateIngredientSelection(p, ["A", "B", "C", "D"])).toBeNull();
    expect(validateIngredientSelection(p, ["A", "B", "C", "D", "E"])).toContain(
      "no máximo 4",
    );
  });

  it("singular vs plural in messages", () => {
    const p1 = makeProduct({ minIngredients: 1 });
    expect(validateIngredientSelection(p1, [])).toContain("1 ingrediente.");
    const p2 = makeProduct({ minIngredients: 2 });
    expect(validateIngredientSelection(p2, [])).toContain("2 ingredientes.");
  });
});
