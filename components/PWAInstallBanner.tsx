"use client";
import { useEffect, useState } from "react";
import { Share, Smartphone, X } from "lucide-react";
import { usePwaInstall } from "@/lib/use-pwa-install";

const DISMISS_KEY = "pdg:pwa-install-dismissed-v1";
const REMIND_AFTER_DAYS = 7;

/**
 * Banner discreto pra incentivar PWA install.
 *
 * - **iOS Safari**: mostra instrução visual (ícone share + texto) porque
 *   Apple não expõe API de install programático. Aparece após 5s pra não
 *   atrapalhar primeiro impacto.
 * - **Android Chrome/Edge**: botão "Instalar app" que dispara prompt nativo.
 * - **Já instalado / desktop / outros browsers**: não renderiza nada.
 *
 * **Dismiss persistente**: depois que user fecha, espera 7 dias antes de
 * mostrar de novo. localStorage com timestamp.
 *
 * **Renderiza no Login (`app/page.tsx`)** — primeiro contato, momento natural
 * pra ofertar install antes do usuário se engajar.
 */
export function PWAInstallBanner() {
  const { state, promptInstall } = usePwaInstall();
  const [hidden, setHidden] = useState(true); // começa hidden enquanto checa storage
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (state.mode === "loading") return;
    if (state.mode === "installed" || state.mode === "desktop") {
      setHidden(true);
      return;
    }

    // Check dismiss timer
    try {
      const stored = localStorage.getItem(DISMISS_KEY);
      if (stored) {
        const dismissedAt = Number(stored);
        const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
        if (daysSince < REMIND_AFTER_DAYS) {
          setHidden(true);
          return;
        }
      }
    } catch {
      // localStorage indisponível (modo privado) — mostra sempre, sem dor
    }

    setHidden(false);
    // Delay de 4s pra não atrapalhar primeiro impacto da home
    const t = setTimeout(() => setVisible(true), 4000);
    return () => clearTimeout(t);
  }, [state.mode]);

  function dismiss() {
    setVisible(false);
    setTimeout(() => setHidden(true), 250); // espera animação de saída
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  }

  async function handleInstall() {
    if (state.mode === "android-installable") {
      await promptInstall();
      // Se instalou, hook sozinho vai mudar pra "installed" → componente desmonta
      // Se rejeitou, dismissamos por 7 dias pra não chatear
      dismiss();
    }
  }

  if (hidden) return null;
  if (state.mode === "loading" || state.mode === "installed" || state.mode === "desktop") return null;

  return (
    <div
      role="dialog"
      aria-label="Instalar app"
      className={`fixed z-40 left-1/2 -translate-x-1/2 transition-all duration-200 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
      }`}
      style={{
        bottom: "max(env(safe-area-inset-bottom), 16px)",
        // No iOS Safari não-instalado, navbar do Safari ocupa bottom — sobe um pouco mais
        maxWidth: "min(420px, calc(100vw - 16px))",
        width: "100%",
        paddingLeft: 8,
        paddingRight: 8,
      }}
    >
      <div className="bg-ink text-white rounded-md shadow-lg p-4 flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-md bg-brand-yellow text-ink inline-flex items-center justify-center">
          <Smartphone size={20} strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
          {state.mode === "ios-installable" ? (
            <>
              <div className="font-bold text-sm">Adicione à Tela de Início</div>
              <div className="text-xs text-white/75 mt-1 leading-relaxed">
                Toque em{" "}
                <Share size={13} strokeWidth={2.5} className="inline-block mx-0.5 -mt-0.5" />{" "}
                embaixo, depois <strong className="text-white">Adicionar à Tela de Início</strong>.
                Vira app mesmo, sem precisar do Safari.
              </div>
            </>
          ) : state.mode === "android-installable" ? (
            <>
              <div className="font-bold text-sm">Instalar Cozinha da Gil</div>
              <div className="text-xs text-white/75 mt-1 leading-relaxed">
                Acesso direto da tela inicial, sem barra do browser.
              </div>
              <button
                onClick={handleInstall}
                className="mt-3 inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-brand-yellow text-ink font-bold text-sm hover:brightness-110 active:scale-[0.97] transition"
              >
                Instalar
              </button>
            </>
          ) : null}
        </div>
        <button
          onClick={dismiss}
          aria-label="Dispensar"
          className="shrink-0 inline-flex items-center justify-center w-9 h-9 -mr-2 -mt-2 rounded-md text-white/60 hover:text-white hover:bg-white/10"
        >
          <X size={18} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
