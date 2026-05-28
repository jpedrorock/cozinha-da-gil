import { describe, expect, it } from "vitest";
import { translateForIconSearch, ICON_CATEGORIES } from "@/lib/ingredient-i18n";

// A Iconify só busca em inglês. Esse mapping traduz o que a Gil digita
// (PT, com acento, qualquer caixa) pro termo de busca em inglês.
describe("translateForIconSearch", () => {
  it("termo no dicionário → traduz (source dict)", () => {
    expect(translateForIconSearch("frango")).toEqual({
      translated: "chicken",
      source: "dict",
    });
  });

  it("case-insensitive", () => {
    expect(translateForIconSearch("FRANGO")).toEqual({
      translated: "chicken",
      source: "dict",
    });
    expect(translateForIconSearch("Calabresa")).toEqual({
      translated: "sausage",
      source: "dict",
    });
  });

  it("acent-insensitive (pimentão, limão)", () => {
    expect(translateForIconSearch("pimentão")).toEqual({
      translated: "bell pepper",
      source: "dict",
    });
    expect(translateForIconSearch("limão")).toEqual({
      translated: "lemon",
      source: "dict",
    });
  });

  it("frase inteira mapeada (multi-palavra) tem prioridade", () => {
    expect(translateForIconSearch("molho de tomate")).toEqual({
      translated: "tomato sauce",
      source: "dict",
    });
    expect(translateForIconSearch("cebola caramelizada")).toEqual({
      translated: "onion",
      source: "dict",
    });
  });

  it("frase parcial: traduz o que conhece, mantém o resto (source dict)", () => {
    expect(translateForIconSearch("frango com queijo")).toEqual({
      translated: "chicken com cheese",
      source: "dict",
    });
  });

  it("termo desconhecido → devolve o original (source original)", () => {
    expect(translateForIconSearch("xptozzz")).toEqual({
      translated: "xptozzz",
      source: "original",
    });
  });

  it("termo já em inglês não está no DICT → original", () => {
    expect(translateForIconSearch("chicken")).toEqual({
      translated: "chicken",
      source: "original",
    });
  });

  it("string vazia → original", () => {
    expect(translateForIconSearch("")).toEqual({
      translated: "",
      source: "original",
    });
  });

  it("só espaços → original preservando o raw", () => {
    expect(translateForIconSearch("   ")).toEqual({
      translated: "   ",
      source: "original",
    });
  });

  it("quando NÃO traduz, devolve o raw exato (com acento/maiúscula, não o normalizado)", () => {
    // "Xís" não existe no DICT → volta exatamente como veio
    expect(translateForIconSearch("Xís")).toEqual({
      translated: "Xís",
      source: "original",
    });
  });
});

describe("ICON_CATEGORIES", () => {
  it("toda categoria tem label PT e query EN não-vazios", () => {
    expect(ICON_CATEGORIES.length).toBeGreaterThan(0);
    for (const c of ICON_CATEGORIES) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.query.length).toBeGreaterThan(0);
    }
  });

  it("inclui Carnes → meat", () => {
    expect(ICON_CATEGORIES).toContainEqual({ label: "Carnes", query: "meat" });
  });
});
