import { describe, expect, it } from "vitest";
import { pushDigit, popDigit, computeChange } from "@/lib/troco";

describe("pushDigit (entrada estilo centavos)", () => {
  it("empurra dígitos da direita pra esquerda: 1,5,0,0 → R$ 15,00 (1500c)", () => {
    let c = 0;
    c = pushDigit(c, "1"); // 1
    c = pushDigit(c, "5"); // 15
    c = pushDigit(c, "0"); // 150
    c = pushDigit(c, "0"); // 1500
    expect(c).toBe(1500);
  });

  it("ignora caractere não-dígito", () => {
    expect(pushDigit(15, "a")).toBe(15);
    expect(pushDigit(15, ".")).toBe(15);
    expect(pushDigit(15, "")).toBe(15);
  });

  it("respeita o teto (R$ 1.000.000,00) — não estoura", () => {
    expect(pushDigit(100_000_000, "0")).toBe(100_000_000);
    expect(pushDigit(100_000_000, "9")).toBe(100_000_000);
  });

  it("primeiro dígito a partir de 0", () => {
    expect(pushDigit(0, "7")).toBe(7);
  });
});

describe("popDigit (backspace)", () => {
  it("apaga o último dígito", () => {
    expect(popDigit(1500)).toBe(150);
    expect(popDigit(150)).toBe(15);
    expect(popDigit(15)).toBe(1);
    expect(popDigit(1)).toBe(0);
  });

  it("0 continua 0", () => {
    expect(popDigit(0)).toBe(0);
  });
});

describe("computeChange", () => {
  it("recebido > total → troco", () => {
    expect(computeChange(1500, 2000)).toEqual({ kind: "troco", cents: 500 });
    expect(computeChange(4250, 5000)).toEqual({ kind: "troco", cents: 750 });
  });

  it("recebido < total → falta", () => {
    expect(computeChange(2000, 1500)).toEqual({ kind: "falta", cents: 500 });
  });

  it("igual → exato", () => {
    expect(computeChange(1500, 1500)).toEqual({ kind: "exato" });
    expect(computeChange(0, 0)).toEqual({ kind: "exato" });
  });
});
