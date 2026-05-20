"use client";
import { useEffect, useRef, useState } from "react";

type Handlers = Record<string, (data: unknown) => void>;
type Status = "connecting" | "open" | "closed";

/**
 * Hook SSE robusto pra uso em mobile com rede instável.
 *
 * - Reconnect com **backoff exponencial + jitter** em vez do retry naive
 *   do browser (~3s fixo). Sequência: 1s → 2s → 4s → 8s → 16s, cap em
 *   30s, com ±20% de jitter pra evitar thundering herd quando vários
 *   clientes voltam ao mesmo tempo.
 * - Conta de attempts zera quando `onopen` confirma conexão saudável.
 * - **Pausa em visibilitychange**: quando aba fica oculta, fecha a
 *   conexão pra economizar bateria/data. Reabre instantaneamente quando
 *   volta ao primeiro plano (sem esperar backoff).
 *
 * Critério pro uso real na barraca: tablet da Maria com WiFi flutuando,
 * sem isso o EventSource nativo reconecta a cada ~3s indefinidamente —
 * em 1h queima notavelmente mais bateria.
 */
export function useSSE(url: string, handlers: Handlers): Status {
  const [status, setStatus] = useState<Status>("connecting");
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    let cancelled = false;
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    function clearRetry() {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    }

    function closeES() {
      if (es) {
        es.close();
        es = null;
      }
    }

    function scheduleReconnect() {
      if (cancelled) return;
      if (document.visibilityState === "hidden") {
        // Aba oculta: não reconecta agora. O listener de visibilitychange
        // vai disparar connect() quando ela voltar.
        setStatus("closed");
        return;
      }
      // Backoff exponencial: 1s, 2s, 4s, 8s, 16s, depois cap em 30s
      const base = Math.min(30_000, 1_000 * Math.pow(2, attempt));
      // Jitter ±20% pra evitar todos os clientes reconectarem em sync
      const jitter = base * (0.8 + Math.random() * 0.4);
      attempt += 1;
      retryTimer = setTimeout(() => {
        connect();
      }, jitter);
    }

    function connect() {
      clearRetry();
      closeES();
      if (cancelled) return;
      setStatus("connecting");
      const source = new EventSource(url);
      es = source;

      source.onopen = () => {
        if (cancelled) return;
        attempt = 0;
        setStatus("open");
      };

      source.onerror = () => {
        // Browser tentaria reconectar sozinho — não queremos isso, pois
        // o intervalo é fixo e ignora visibility. Fechamos e agendamos.
        closeES();
        if (cancelled) return;
        setStatus("closed");
        scheduleReconnect();
      };

      const events = Object.keys(handlersRef.current);
      for (const event of events) {
        source.addEventListener(event, (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            handlersRef.current[event]?.(data);
          } catch {}
        });
      }
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        // Voltou ao primeiro plano — reconecta imediato (sem esperar backoff)
        if (!es || es.readyState !== EventSource.OPEN) {
          attempt = 0;
          clearRetry();
          connect();
        }
      } else {
        // Foi pra background — fecha conexão (economia bateria/data)
        clearRetry();
        closeES();
        setStatus("closed");
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);
    connect();

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      clearRetry();
      closeES();
      setStatus("closed");
    };
  }, [url]);

  return status;
}
