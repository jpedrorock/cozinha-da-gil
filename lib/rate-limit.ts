/**
 * Rate limiter em memória — simples, sem Redis, suficiente pra uma instância.
 *
 * Janela rolante por key (geralmente username + IP). Conta tentativas;
 * se ultrapassar `max` em `windowMs`, bloqueia até a janela expirar.
 */

type Entry = { count: number; firstAt: number };

const globalForRL = globalThis as unknown as {
  __rateLimitMap?: Map<string, Entry>;
};
const store = (globalForRL.__rateLimitMap ??= new Map());

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

export function checkRateLimit(
  key: string,
  options: { max: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.firstAt > options.windowMs) {
    // Janela nova
    store.set(key, { count: 1, firstAt: now });
    return { allowed: true, remaining: options.max - 1, retryAfterSec: 0 };
  }

  if (entry.count >= options.max) {
    const retryAfterSec = Math.ceil((entry.firstAt + options.windowMs - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: options.max - entry.count,
    retryAfterSec: 0,
  };
}

/**
 * Reset manual — chama após login bem-sucedido pra zerar contador.
 */
export function resetRateLimit(key: string) {
  store.delete(key);
}
