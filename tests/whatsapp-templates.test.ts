import { describe, expect, it } from "vitest";
import { buildWaUrl, buildWaNativeUrl } from "@/lib/whatsapp-templates";

describe("buildWaUrl", () => {
  it("com telefone normalizado (+55) → abre conversa direto", () => {
    const url = buildWaUrl("+5511999998888", "oi");
    expect(url).toBe("https://wa.me/5511999998888?text=oi");
  });

  it("encoda o texto (espaços, quebras, acentos)", () => {
    const url = buildWaUrl("+5511999998888", "Pedido #042\nPronto!");
    expect(url).toContain("https://wa.me/5511999998888?text=");
    expect(url).toContain(encodeURIComponent("Pedido #042\nPronto!"));
  });

  it("sem telefone → abre seletor de contato (wa.me sem número)", () => {
    expect(buildWaUrl(null, "oi")).toBe("https://wa.me/?text=oi");
    expect(buildWaUrl(undefined, "oi")).toBe("https://wa.me/?text=oi");
    expect(buildWaUrl("", "oi")).toBe("https://wa.me/?text=oi");
  });

  it("tira não-dígitos do telefone (parênteses, traços, espaços)", () => {
    const url = buildWaUrl("(11) 99999-8888", "oi");
    // sem +55 vira só os dígitos digitados — caso de telefone não-normalizado
    expect(url).toBe("https://wa.me/11999998888?text=oi");
  });
});

describe("buildWaNativeUrl", () => {
  it("com telefone → deep link whatsapp://send", () => {
    const url = buildWaNativeUrl("+5511999998888", "oi");
    expect(url).toBe("whatsapp://send?phone=5511999998888&text=oi");
  });

  it("sem telefone → cai pro wa.me web (sem destino nativo)", () => {
    expect(buildWaNativeUrl(null, "oi")).toBe("https://wa.me/?text=oi");
  });

  it("encoda o texto", () => {
    const url = buildWaNativeUrl("+5511999998888", "Olá, tá pronto 🍔");
    expect(url).toContain(encodeURIComponent("Olá, tá pronto 🍔"));
  });
});
