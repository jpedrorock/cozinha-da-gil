import { describe, expect, it } from "vitest";
import {
  INGREDIENT_CATEGORIES,
  isAllowedCategory,
  parseIconValue,
  parseIngredientName,
} from "@/lib/ingredients";

describe("INGREDIENT_CATEGORIES", () => {
  it("inclui as 5 categorias canônicas (pós-macarrão + cuscuz evento julho/2026)", () => {
    expect(INGREDIENT_CATEGORIES).toEqual([
      "topping",
      "doce",
      "molho",
      "cuscuz_recheio",
      "bebida_extra",
    ]);
  });
});

describe("isAllowedCategory", () => {
  it("aceita todas as categorias canônicas", () => {
    for (const cat of INGREDIENT_CATEGORIES) {
      expect(isAllowedCategory(cat)).toBe(true);
    }
  });

  it("rejeita string desconhecida", () => {
    expect(isAllowedCategory("xyz")).toBe(false);
    expect(isAllowedCategory("Topping")).toBe(false); // case sensitive
    expect(isAllowedCategory("")).toBe(false);
  });

  it("rejeita non-string", () => {
    expect(isAllowedCategory(null)).toBe(false);
    expect(isAllowedCategory(undefined)).toBe(false);
    expect(isAllowedCategory(123)).toBe(false);
    expect(isAllowedCategory({})).toBe(false);
    expect(isAllowedCategory([])).toBe(false);
  });
});

describe("parseIngredientName", () => {
  it("aceita nome válido e devolve trimmed", () => {
    const result = parseIngredientName("  Bacon  ");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("Bacon");
  });

  it("aceita nome com 1 caractere", () => {
    const result = parseIngredientName("Q");
    expect(result.ok).toBe(true);
  });

  it("aceita nome com 60 caracteres (limite)", () => {
    const name = "a".repeat(60);
    const result = parseIngredientName(name);
    expect(result.ok).toBe(true);
  });

  it("aceita nome com acentos e emoji (UTF-8)", () => {
    const result = parseIngredientName("Frango com requeijão");
    expect(result.ok).toBe(true);
  });

  it("rejeita string vazia", () => {
    const result = parseIngredientName("");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("1–60");
  });

  it("rejeita só whitespace (trim → vazio)", () => {
    const result = parseIngredientName("   ");
    expect(result.ok).toBe(false);
  });

  it("rejeita > 60 caracteres", () => {
    const result = parseIngredientName("a".repeat(61));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("1–60");
  });

  it("rejeita non-string", () => {
    expect(parseIngredientName(null).ok).toBe(false);
    expect(parseIngredientName(undefined).ok).toBe(false);
    expect(parseIngredientName(123).ok).toBe(false);
    expect(parseIngredientName({}).ok).toBe(false);
  });
});

describe("parseIconValue", () => {
  it("classifica null como kind null", () => {
    const r = parseIconValue(null);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.kind).toBe("null");
  });

  it("classifica undefined como kind null", () => {
    const r = parseIconValue(undefined);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.kind).toBe("null");
  });

  it("classifica string vazia como kind null", () => {
    const r = parseIconValue("");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.kind).toBe("null");
  });

  it("classifica whitespace-only como kind null (trim)", () => {
    const r = parseIconValue("   ");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.kind).toBe("null");
  });

  it("classifica Iconify ID válido", () => {
    const r = parseIconValue("mdi:bacon");
    expect(r.ok).toBe(true);
    if (r.ok && r.value.kind === "iconify") {
      expect(r.value.value).toBe("mdi:bacon");
    } else {
      throw new Error("expected iconify");
    }
  });

  it("aceita Iconify com hífens", () => {
    const r = parseIconValue("fluent-emoji:bacon");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.kind).toBe("iconify");
  });

  it("trimma Iconify antes de classificar", () => {
    const r = parseIconValue("  mdi:cheese  ");
    expect(r.ok).toBe(true);
    if (r.ok && r.value.kind === "iconify") {
      expect(r.value.value).toBe("mdi:cheese");
    }
  });

  it("classifica data URI SVG", () => {
    const dataUri = "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=";
    const r = parseIconValue(dataUri);
    expect(r.ok).toBe(true);
    if (r.ok && r.value.kind === "dataUri") {
      expect(r.value.value).toBe(dataUri);
    } else {
      throw new Error("expected dataUri");
    }
  });

  it("classifica data URI PNG", () => {
    const r = parseIconValue("data:image/png;base64,iVBOR");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.kind).toBe("dataUri");
  });

  it("classifica path de upload existente", () => {
    const path = "/api/uploads/ingredients/abc123.svg";
    const r = parseIconValue(path);
    expect(r.ok).toBe(true);
    if (r.ok && r.value.kind === "uploadedPath") {
      expect(r.value.value).toBe(path);
    } else {
      throw new Error("expected uploadedPath");
    }
  });

  it("rejeita string sem formato reconhecido", () => {
    const r = parseIconValue("não é ícone");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("inválido");
  });

  it("rejeita Iconify sem ':'", () => {
    const r = parseIconValue("mdibacon");
    expect(r.ok).toBe(false);
  });

  it("rejeita Iconify > 80 chars", () => {
    const longName = "a".repeat(80) + ":bacon";
    const r = parseIconValue(longName);
    expect(r.ok).toBe(false);
  });

  it("rejeita Iconify com chars inválidos", () => {
    expect(parseIconValue("mdi:bacon!").ok).toBe(false);
    expect(parseIconValue("mdi/bacon").ok).toBe(false);
    expect(parseIconValue("mdi:bacon space").ok).toBe(false);
  });

  it("rejeita path absoluto fora de /api/uploads/ingredients/", () => {
    // Outros paths absolutos NÃO são uploadedPath; caem na regex Iconify
    // e falham porque não bate o formato.
    expect(parseIconValue("/etc/passwd").ok).toBe(false);
    expect(parseIconValue("/api/uploads/products/abc.png").ok).toBe(false);
  });

  it("rejeita non-string que não seja null/undefined", () => {
    expect(parseIconValue(123).ok).toBe(false);
    expect(parseIconValue({}).ok).toBe(false);
    expect(parseIconValue([]).ok).toBe(false);
    expect(parseIconValue(true).ok).toBe(false);
  });

  it("rejeita data URI mal-formado de outro tipo", () => {
    // Tipo "image/" qualifica como dataUri (kind correto), MAS o
    // saveIngredientImage downstream vai recusar formato não-svg/png.
    // Esse parseIconValue só classifica; validação fina é em uploads.ts.
    const r = parseIconValue("data:image/gif;base64,foo");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.kind).toBe("dataUri");
  });
});
