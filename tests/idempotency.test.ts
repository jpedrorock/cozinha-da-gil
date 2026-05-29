import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getCachedIdempotency,
  setCachedIdempotency,
  isValidIdempotencyKey,
} from "@/lib/idempotency";

// Protege contra pedido duplicado: atendente toca "Confirmar" 2x em 3G lento,
// a 2ª chamada deve devolver o mesmo resultado da 1ª (não criar 2 pedidos).
describe("cache de idempotency", () => {
  afterEach(() => vi.useRealTimers());

  it("set → get devolve o mesmo payload e status", () => {
    setCachedIdempotency("roundtrip-aaaaaaaaaa", 201, { orderId: 42 });
    expect(getCachedIdempotency("roundtrip-aaaaaaaaaa")).toEqual({
      payload: { orderId: 42 },
      status: 201,
    });
  });

  it("get em key nunca setada → null", () => {
    expect(getCachedIdempotency("nunca-setada-xxxxxxx")).toBeNull();
  });

  it("keys diferentes não colidem", () => {
    setCachedIdempotency("key-A-bbbbbbbbbbbb", 200, { v: "a" });
    expect(getCachedIdempotency("key-B-cccccccccccc")).toBeNull();
  });

  it("expira após o TTL de 10min → null (request nova é tratada como nova)", () => {
    vi.useFakeTimers();
    const t0 = new Date("2026-05-28T12:00:00Z");
    vi.setSystemTime(t0);
    setCachedIdempotency("ttl-dddddddddddddd", 200, { v: 1 });
    // 10min + 1ms depois
    vi.setSystemTime(new Date(t0.getTime() + 10 * 60 * 1000 + 1));
    expect(getCachedIdempotency("ttl-dddddddddddddd")).toBeNull();
  });

  it("dentro do TTL ainda devolve o cache", () => {
    vi.useFakeTimers();
    const t0 = new Date("2026-05-28T12:00:00Z");
    vi.setSystemTime(t0);
    setCachedIdempotency("fresh-eeeeeeeeeeeee", 200, { v: 2 });
    // 9min depois — ainda válido
    vi.setSystemTime(new Date(t0.getTime() + 9 * 60 * 1000));
    expect(getCachedIdempotency("fresh-eeeeeeeeeeeee")).toEqual({
      payload: { v: 2 },
      status: 200,
    });
  });

  it("preserva status de erro (ex: 409) tanto quanto sucesso", () => {
    setCachedIdempotency("erro-ffffffffffffff", 409, { code: "DUPLICATE" });
    expect(getCachedIdempotency("erro-ffffffffffffff")).toEqual({
      payload: { code: "DUPLICATE" },
      status: 409,
    });
  });
});

describe("isValidIdempotencyKey", () => {
  it("null/undefined/'' → false", () => {
    expect(isValidIdempotencyKey(null)).toBe(false);
    expect(isValidIdempotencyKey(undefined)).toBe(false);
    expect(isValidIdempotencyKey("")).toBe(false);
  });

  it("curto demais (< 16) → false", () => {
    expect(isValidIdempotencyKey("short")).toBe(false);
    expect(isValidIdempotencyKey("123456789012345")).toBe(false); // 15 chars
  });

  it("exatamente 16 chars → true", () => {
    expect(isValidIdempotencyKey("1234567890123456")).toBe(true);
  });

  it("longo demais (> 64) → false; exatamente 64 → true", () => {
    expect(isValidIdempotencyKey("a".repeat(65))).toBe(false);
    expect(isValidIdempotencyKey("a".repeat(64))).toBe(true);
  });

  it("UUID v4 é válido", () => {
    expect(isValidIdempotencyKey("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("caractere fora de [A-Za-z0-9-] → false", () => {
    expect(isValidIdempotencyKey("invalid key with spaces!!")).toBe(false);
    expect(isValidIdempotencyKey("under_score_not_allowed_x")).toBe(false);
    expect(isValidIdempotencyKey("slash/not/allowed/in/key/x")).toBe(false);
  });
});
