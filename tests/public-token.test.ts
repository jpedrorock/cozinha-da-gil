import { describe, expect, it } from "vitest";
import { generatePublicToken, isValidPublicTokenFormat } from "../lib/public-token";

describe("generatePublicToken", () => {
  it("retorna 10 caracteres", () => {
    const token = generatePublicToken();
    expect(token).toHaveLength(10);
  });

  it("retorna só base62 (0-9, a-z, A-Z)", () => {
    for (let i = 0; i < 100; i++) {
      const token = generatePublicToken();
      expect(token).toMatch(/^[0-9a-zA-Z]{10}$/);
    }
  });

  it("gera valores diferentes a cada chamada (entropia)", () => {
    // 100 amostras devem ser todas únicas — com 59 bits de entropia,
    // colisão em 100 amostras tem prob ~10^-15. Se isso falhar, algo
    // tá MUITO errado (PRNG quebrado, modulo bias severo, etc).
    const samples = new Set<string>();
    for (let i = 0; i < 100; i++) {
      samples.add(generatePublicToken());
    }
    expect(samples.size).toBe(100);
  });
});

describe("isValidPublicTokenFormat", () => {
  it("aceita 10 chars base62 válidos", () => {
    expect(isValidPublicTokenFormat("abc7x9k2Pq")).toBe(true);
    expect(isValidPublicTokenFormat("0000000000")).toBe(true);
    expect(isValidPublicTokenFormat("ZZZZZZZZZZ")).toBe(true);
  });

  it("rejeita tamanho errado", () => {
    expect(isValidPublicTokenFormat("")).toBe(false);
    expect(isValidPublicTokenFormat("abc")).toBe(false);
    expect(isValidPublicTokenFormat("abc7x9k2Pq1")).toBe(false); // 11 chars
    expect(isValidPublicTokenFormat("abc7x9k2P")).toBe(false); // 9 chars
  });

  it("rejeita caracteres não-alfanuméricos", () => {
    expect(isValidPublicTokenFormat("abc-7x9k2P")).toBe(false);
    expect(isValidPublicTokenFormat("abc 7x9k2P")).toBe(false);
    expect(isValidPublicTokenFormat("abc/7x9k2P")).toBe(false);
    expect(isValidPublicTokenFormat("abc.7x9k2P")).toBe(false);
  });

  it("valida tokens reais gerados", () => {
    for (let i = 0; i < 20; i++) {
      const token = generatePublicToken();
      expect(isValidPublicTokenFormat(token)).toBe(true);
    }
  });
});
