"use client";
import { useEffect, useRef } from "react";

/**
 * Auto-logout por inatividade.
 *
 * Reseta o timer em interações do usuário (mouse/touch/keyboard).
 * Após `timeoutMs` sem nada, chama `onTimeout`.
 *
 * Default: 30 minutos. Configurável por role se quiser.
 *
 * Casos típicos:
 * - Atendente esquece o tablet aberto na contramão da festa
 * - Admin saiu pra pegar café e tablet ficou desbloqueado
 * - Tablet emprestado pra outra pessoa sem fazer logout
 *
 * Não dispara enquanto a aba estiver hidden (visibility API).
 *
 * **`disabled` (audit P0 #01):** quando true, suspende o timer. Use em fluxos
 * onde o usuário está fisicamente engajado mas não toca a tela (atendente
 * conversando com cliente em pé com stepper aberto). Sem isso, draft do
 * pedido morria depois de 30min de conversa.
 */
export function useIdleLogout(
  onTimeout: () => void,
  timeoutMs = 30 * 60 * 1000,
  disabled = false,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    if (disabled) {
      // Limpa qualquer timer pendente quando entra em modo disabled
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    function reset() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        // só desloga se a aba estiver visível — não interromper Gil
        // se o tablet só foi pra background
        if (document.visibilityState === "visible") {
          onTimeoutRef.current();
        } else {
          // re-arma quando voltar
          const onVisible = () => {
            if (document.visibilityState === "visible") {
              document.removeEventListener("visibilitychange", onVisible);
              reset();
            }
          };
          document.addEventListener("visibilitychange", onVisible);
        }
      }, timeoutMs);
    }

    // Eventos que contam como "atividade"
    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [timeoutMs, disabled]);
}
