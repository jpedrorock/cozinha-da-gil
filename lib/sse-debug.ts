/**
 * Flag de debug pros logs de latência SSE (`[SSE-LAT]`) no client.
 *
 * Por padrão **off** — senão o console do navegador enche de logs a cada
 * pedido em produção. A instrumentação continua no código (mede o lag
 * createdAt→recebido na cozinha e o tempo de fetch no atendente); só fica
 * a um flag de distância.
 *
 * Ligar (no devtools, sem precisar rebuild):
 *   localStorage.setItem("pdg:sse-debug", "1")
 * Desligar:
 *   localStorage.removeItem("pdg:sse-debug")
 *
 * Lido a cada evento (barato) pra permitir toggle em runtime.
 * Os logs `[SSE-LAT]` do server (POST /api/orders, broadcast) ficam sempre
 * ligados — vão pro stdout, são telemetria de ops, não poluem o usuário.
 */
export function sseDebugEnabled(): boolean {
  return (
    typeof window !== "undefined" &&
    window.localStorage?.getItem("pdg:sse-debug") === "1"
  );
}
