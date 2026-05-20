/**
 * Cache em memória pra idempotency keys em endpoints de mutação.
 *
 * Cenário protegido: atendente toca "Confirmar pedido" em slow 3G,
 * o fetch fica pending, ela acha que travou, toca de novo. Sem isso,
 * o servidor processaria 2x e criaria 2 pedidos idênticos. Com isso,
 * a 2ª chamada retorna o mesmo body do 1º request — UI fica feliz e
 * banco fica consistente.
 *
 * Trade-offs:
 * - Memória local ao processo. Se reiniciar o server, perde — aceitável
 *   pra app pequeno. Em produção com múltiplas instâncias precisaria
 *   Redis, mas por hora SQLite single-process é suficiente.
 * - TTL de 10min suficiente pra cobrir retries naturais do client +
 *   network blips. Depois disso o key expira e nova request é tratada
 *   como nova.
 * - Cleanup é lazy (no `set`) pra não ter timer pendurado.
 */

type Entry = {
  payload: unknown;
  status: number;
  expiresAt: number;
};

const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, Entry>();

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
}

export function getCachedIdempotency(key: string): { payload: unknown; status: number } | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return { payload: entry.payload, status: entry.status };
}

export function setCachedIdempotency(key: string, status: number, payload: unknown) {
  // Cleanup oportunístico em cada set — evita Map crescer sem fim
  if (cache.size > 200) cleanup();
  cache.set(key, {
    payload,
    status,
    expiresAt: Date.now() + TTL_MS,
  });
}

/**
 * Valida formato do key. Aceita UUID v4 ou string ULID-like 16-64 chars
 * pra não ter cliente bobo enviando keys minúsculos colidindo entre si.
 */
export function isValidIdempotencyKey(key: string | null | undefined): key is string {
  if (!key) return false;
  if (key.length < 16 || key.length > 64) return false;
  return /^[A-Za-z0-9-]+$/.test(key);
}
