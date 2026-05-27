import { describe, expect, it } from "vitest";
import {
  ALLOWED_CATEGORIES,
  isAllowedCategory,
  validateIngredientName,
  parseIconValue,
} from "@/lib/ingredients";
import { isUploadedIngredientIcon } from "@/lib/uploads";

// ──────────────────────────────────────────────
// isAllowedCategory
// ──────────────────────────────────────────────

describe("isAllowedCategory", () => {
  it("accepts all ALLOWED_CATEGORIES", () => {
    for (const cat of ALLOWED_CATEGORIES) {
      expect(isAllowedCategory(cat)).toBe(true);
    }
  });

  it("rejects unknown categories", () => {
    expect(isAllowedCategory("fruta")).toBe(false);
    expect(isAllowedCategory("")).toBe(false);
    expect(isAllowedCategory(null)).toBe(false);
    expect(isAllowedCategory(undefined)).toBe(false);
    expect(isAllowedCategory(42)).toBe(false);
  });

  it("rejects near-matches", () => {
    expect(isAllowedCategory("Topping")).toBe(false);
    expect(isAllowedCategory(" topping")).toBe(false);
    expect(isAllowedCategory("topping ")).toBe(false);
  });
});

// ──────────────────────────────────────────────
// validateIngredientName
// ──────────────────────────────────────────────

describe("validateIngredientName", () => {
  it("accepts a valid name", () => {
    const result = validateIngredientName("Frango");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.name).toBe("Frango");
  });

  it("trims whitespace", () => {
    const result = validateIngredientName("  Bacon  ");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.name).toBe("Bacon");
  });

  it("rejects empty string", () => {
    expect(validateIngredientName("").ok).toBe(false);
    expect(validateIngredientName("   ").ok).toBe(false);
  });

  it("rejects non-string", () => {
    expect(validateIngredientName(null).ok).toBe(false);
    expect(validateIngredientName(undefined).ok).toBe(false);
    expect(validateIngredientName(42).ok).toBe(false);
  });

  it("rejects name > 60 chars", () => {
    const long = "A".repeat(61);
    expect(validateIngredientName(long).ok).toBe(false);
  });

  it("accepts name of exactly 60 chars", () => {
    const max = "B".repeat(60);
    const result = validateIngredientName(max);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.name).toBe(max);
  });

  it("accepts name of exactly 1 char", () => {
    const result = validateIngredientName("X");
    expect(result.ok).toBe(true);
  });
});

// ──────────────────────────────────────────────
// parseIconValue
// ──────────────────────────────────────────────

describe("parseIconValue", () => {
  it("null → none", () => {
    expect(parseIconValue(null).kind).toBe("none");
  });

  it("undefined → none", () => {
    expect(parseIconValue(undefined).kind).toBe("none");
  });

  it("empty string → none", () => {
    expect(parseIconValue("").kind).toBe("none");
    expect(parseIconValue("   ").kind).toBe("none");
  });

  it("Iconify ID → iconify", () => {
    const r = parseIconValue("mdi:hamburger");
    expect(r.kind).toBe("iconify");
    if (r.kind === "iconify") expect(r.value).toBe("mdi:hamburger");
  });

  it("Iconify ID with uppercase → iconify", () => {
    const r = parseIconValue("ph:ChickenFill");
    expect(r.kind).toBe("iconify");
  });

  it("Iconify ID > 80 chars → invalid", () => {
    const long = "mdi:" + "a".repeat(77); // total > 80
    expect(parseIconValue(long).kind).toBe("invalid");
  });

  it("SVG data URI → data-uri", () => {
    const svg = "data:image/svg+xml;base64,PHN2Zy8+";
    const r = parseIconValue(svg);
    expect(r.kind).toBe("data-uri");
    if (r.kind === "data-uri") expect(r.value).toBe(svg);
  });

  it("PNG data URI → data-uri", () => {
    const png = "data:image/png;base64,iVBORw0KGgo=";
    expect(parseIconValue(png).kind).toBe("data-uri");
  });

  it("upload path → upload-path", () => {
    const path = "/api/uploads/ingredients/abc123.svg";
    const r = parseIconValue(path);
    expect(r.kind).toBe("upload-path");
    if (r.kind === "upload-path") expect(r.value).toBe(path);
  });

  it("arbitrary string → invalid", () => {
    expect(parseIconValue("https://external.com/img.png").kind).toBe("invalid");
    expect(parseIconValue("just-a-string").kind).toBe("invalid");
    expect(parseIconValue("/api/uploads/products/x.svg").kind).toBe("invalid");
  });

  it("non-string non-null → invalid", () => {
    expect(parseIconValue(42).kind).toBe("invalid");
    expect(parseIconValue({}).kind).toBe("invalid");
  });
});

// ──────────────────────────────────────────────
// isUploadedIngredientIcon (from lib/uploads)
// ──────────────────────────────────────────────

describe("isUploadedIngredientIcon", () => {
  it("returns true for /api/uploads/ingredients/ paths", () => {
    expect(isUploadedIngredientIcon("/api/uploads/ingredients/abc.svg")).toBe(true);
    expect(isUploadedIngredientIcon("/api/uploads/ingredients/hash12.png")).toBe(true);
  });

  it("returns false for product upload paths", () => {
    expect(isUploadedIngredientIcon("/api/uploads/products/abc.svg")).toBe(false);
  });

  it("returns false for Iconify IDs", () => {
    expect(isUploadedIngredientIcon("mdi:hamburger")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isUploadedIngredientIcon(null)).toBe(false);
  });
});
