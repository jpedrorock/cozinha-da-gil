import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";

// Garante store limpo entre testes — o módulo usa globalThis, então
// nomes únicos por teste evitam colisão.
function uniqueKey(name: string): string {
  return `test:${name}:${Math.random()}`;
}

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("permite até max tentativas dentro da janela", () => {
    const key = uniqueKey("under-limit");
    const opts = { max: 3, windowMs: 60_000 };
    expect(checkRateLimit(key, opts).allowed).toBe(true);
    expect(checkRateLimit(key, opts).allowed).toBe(true);
    expect(checkRateLimit(key, opts).allowed).toBe(true);
  });

  it("bloqueia na (max+1)-ésima tentativa", () => {
    const key = uniqueKey("over-limit");
    const opts = { max: 3, windowMs: 60_000 };
    checkRateLimit(key, opts);
    checkRateLimit(key, opts);
    checkRateLimit(key, opts);
    const r = checkRateLimit(key, opts);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.retryAfterSec).toBeGreaterThan(0);
  });

  it("remaining decresce a cada tentativa", () => {
    const key = uniqueKey("remaining");
    const opts = { max: 5, windowMs: 60_000 };
    expect(checkRateLimit(key, opts).remaining).toBe(4);
    expect(checkRateLimit(key, opts).remaining).toBe(3);
    expect(checkRateLimit(key, opts).remaining).toBe(2);
  });

  it("reseta após janela expirar", () => {
    vi.useFakeTimers();
    const key = uniqueKey("expire");
    const opts = { max: 2, windowMs: 1000 };
    checkRateLimit(key, opts);
    checkRateLimit(key, opts);
    expect(checkRateLimit(key, opts).allowed).toBe(false);
    // avança 1.1s — janela expira
    vi.setSystemTime(new Date(Date.now() + 1100));
    expect(checkRateLimit(key, opts).allowed).toBe(true);
    vi.useRealTimers();
  });

  it("resetRateLimit zera o contador imediatamente", () => {
    const key = uniqueKey("manual-reset");
    const opts = { max: 2, windowMs: 60_000 };
    checkRateLimit(key, opts);
    checkRateLimit(key, opts);
    expect(checkRateLimit(key, opts).allowed).toBe(false);
    resetRateLimit(key);
    expect(checkRateLimit(key, opts).allowed).toBe(true);
  });

  it("retryAfterSec calcula corretamente", () => {
    vi.useFakeTimers();
    const key = uniqueKey("retry-after");
    const opts = { max: 1, windowMs: 5000 };
    checkRateLimit(key, opts); // primeira ok
    const r = checkRateLimit(key, opts); // bloqueia
    expect(r.retryAfterSec).toBeGreaterThanOrEqual(4);
    expect(r.retryAfterSec).toBeLessThanOrEqual(5);
    vi.useRealTimers();
  });
});
