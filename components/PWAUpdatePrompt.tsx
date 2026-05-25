"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

/**
 * Mostra um toast persistente quando há nova versão do Service Worker
 * aguardando ativação. PWA audit #5.
 *
 * Fluxo:
 *   1. Browser baixa novo sw.js em background (next-pwa register: true)
 *   2. Novo SW entra em estado `waiting` (skipWaiting: false agora)
 *   3. Este componente escuta `updatefound` + `statechange` e detecta
 *   4. Renderiza toast "Nova versão pronta — atualizar?"
 *   5. User click → postMessage SKIP_WAITING → SW assume → reload
 *
 * UX: NÃO força reload, NÃO bloqueia o user. Toast persiste até user
 * clicar OU dispensar (com X). Dispensa não impede que próxima nav
 * pegue o novo SW automaticamente.
 *
 * Cenário evitado: atendente com pedido half-built no stepper, deploy
 * acontece, antes assumia na hora e perdia tudo. Agora user controla.
 */
export function PWAUpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let reg: ServiceWorkerRegistration | undefined;

    function trackWaiting(registration: ServiceWorkerRegistration) {
      // Já tem um waiting quando o componente monta?
      if (registration.waiting && navigator.serviceWorker.controller) {
        setWaitingWorker(registration.waiting);
      }

      // Novo SW aparece — observa transição pra installed
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          // installed + controller existente = update disponível
          // (sem controller é first install — não conta como update)
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            setWaitingWorker(newWorker);
          }
        });
      });
    }

    navigator.serviceWorker
      .getRegistration()
      .then((r) => {
        if (!r) return;
        reg = r;
        trackWaiting(r);
      })
      .catch(() => {});

    // Quando o novo SW assume controle, recarrega a página pra pegar
    // os assets/HTML novos. Só dispara DEPOIS do user aceitar (porque
    // o SKIP_WAITING é triggered por click).
    let reloaded = false;
    function onControllerChange() {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    }
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
      // reg não precisa cleanup explícito — listeners ficam scoped ao SW
      void reg;
    };
  }, []);

  if (!waitingWorker || dismissed) return null;

  function update() {
    waitingWorker?.postMessage({ type: "SKIP_WAITING" });
    // controllerchange handler vai recarregar a página
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 -translate-x-1/2 z-[80] bg-brand-yellow text-ink shadow-2xl rounded-xl border border-brand-orange/40 px-4 py-3 max-w-[92vw] flex items-center gap-3 animate-toast-drop"
      style={{
        // Acima da bottom-nav do admin (z-30) + do FAB do atendente (~120px).
        // Posicionado mais alto que o toast comum pra não competir.
        bottom: "max(env(safe-area-inset-bottom), 180px)",
      }}
    >
      <Sparkles size={20} strokeWidth={2.5} className="shrink-0 text-brand-orange" aria-hidden />
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm leading-tight">Nova versão pronta</div>
        <div className="text-xs text-ink-2 leading-tight mt-0.5">
          Recarregue pra usar as últimas mudanças.
        </div>
      </div>
      <button
        onClick={update}
        className="shrink-0 inline-flex items-center justify-center h-9 px-3 rounded-md bg-ink text-brand-yellow font-bold text-sm hover:brightness-110 active:scale-95 transition"
      >
        Atualizar
      </button>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dispensar aviso"
        className="shrink-0 inline-flex items-center justify-center w-8 h-8 -mr-1 rounded-md text-ink-3 hover:text-ink hover:bg-black/5"
      >
        <X size={16} strokeWidth={2.5} />
      </button>
    </div>
  );
}
