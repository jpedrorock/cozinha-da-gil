import { describe, expect, it } from "vitest";
import { formatBRL, SIZE_LABEL, PRICE, MAX_TOPPINGS_PEQUENO } from "@/lib/pricing";

// O Intl insere espaço não-quebrável (NBSP/NNBSP) entre "R$" e o número,
// e o caractere varia entre versões de Node/ICU. Normaliza pra espaço comum
// pra o toBe não ficar frágil.
const brl = (cents: number) => formatBRL(cents).replace(/\s/g, " ");

describe("formatBRL", () => {
  it("formata centavos → reais pt-BR", () => {
    expect(brl(1500)).toBe("R$ 15,00");
    expect(brl(150)).toBe("R$ 1,50");
    expect(brl(1)).toBe("R$ 0,01");
    expect(brl(0)).toBe("R$ 0,00");
  });

  it("usa ponto como separador de milhar (pt-BR)", () => {
    expect(brl(123456)).toBe("R$ 1.234,56");
  });

  it("lida com valor negativo (linha de desconto no comprovante)", () => {
    const out = brl(-500);
    expect(out.startsWith("-")).toBe(true);
    expect(out).toContain("5,00");
  });
});

describe("constantes de pricing", () => {
  it("SIZE_LABEL cobre os 4 tamanhos legacy", () => {
    expect(SIZE_LABEL.pequeno).toBe("2 ingredientes");
    expect(SIZE_LABEL.grande).toBe("Monte o seu");
    expect(SIZE_LABEL.normal).toBe("Normal");
    expect(SIZE_LABEL.mini).toBe("Mini Pack");
  });

  it("PRICE.sauce e MAX_TOPPINGS_PEQUENO são estáveis", () => {
    expect(PRICE.sauce).toBe(150);
    expect(MAX_TOPPINGS_PEQUENO).toBe(2);
  });
});
