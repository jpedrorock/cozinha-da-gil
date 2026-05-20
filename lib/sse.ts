type Controller = ReadableStreamDefaultController<Uint8Array>;
type Client = { id: string; controller: Controller; connectedAt: number };

const encoder = new TextEncoder();

const globalForSSE = globalThis as unknown as { __sseClients?: Set<Client> };
const clients = (globalForSSE.__sseClients ??= new Set<Client>());

// Limite máximo de idade de conexão. Mata clients zumbis que ficam
// pendurados por wifi flapping/sleep do tablet/etc.
const MAX_CLIENT_AGE_MS = 6 * 60 * 60 * 1000; // 6h

function frame(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function addClient(controller: Controller): Client {
  const client: Client = {
    id: crypto.randomUUID(),
    controller,
    connectedAt: Date.now(),
  };
  clients.add(client);
  return client;
}

export function removeClient(client: Client) {
  clients.delete(client);
}

/**
 * Remove clients antigos demais (defesa contra leaks de SSE).
 * Chamado dentro de broadcast + ping.
 */
function pruneStale(): number {
  const now = Date.now();
  let pruned = 0;
  for (const client of clients) {
    if (now - client.connectedAt > MAX_CLIENT_AGE_MS) {
      try {
        client.controller.close();
      } catch {}
      clients.delete(client);
      pruned++;
    }
  }
  return pruned;
}

export function broadcast(event: string, data: unknown) {
  // [LATÊNCIA] Mede tempo de enqueue + nº de clientes.
  const t0 = performance.now();
  const message = frame(event, data);
  let delivered = 0;
  let dropped = 0;
  const staleCount = pruneStale();
  for (const client of clients) {
    try {
      client.controller.enqueue(message);
      delivered++;
    } catch {
      clients.delete(client);
      dropped++;
    }
  }
  const dt = (performance.now() - t0).toFixed(1);
  const orderId =
    typeof data === "object" && data !== null && "id" in data
      ? (data as { id: number | string }).id
      : "?";
  console.log(
    `[SSE-LAT] broadcast event=${event} orderId=${orderId} clients=${clients.size} delivered=${delivered} dropped=${dropped} stale=${staleCount} enqueue=${dt}ms`,
  );
}

export function ping() {
  pruneStale();
  const message = encoder.encode(`: ping\n\n`);
  for (const client of clients) {
    try {
      client.controller.enqueue(message);
    } catch {
      clients.delete(client);
    }
  }
}

/**
 * Stats pra /api/health.
 */
export function sseStats() {
  const now = Date.now();
  let oldestAgeMs = 0;
  for (const c of clients) {
    const age = now - c.connectedAt;
    if (age > oldestAgeMs) oldestAgeMs = age;
  }
  return {
    count: clients.size,
    oldestAgeMs,
    maxAgeMs: MAX_CLIENT_AGE_MS,
  };
}
