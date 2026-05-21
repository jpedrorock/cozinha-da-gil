"use client";
import { useEffect, useState } from "react";
import { BrandIcon } from "@/components/icons";

const VISIBLE_MS = 1100; // tempo que fica visível antes de fade-out
const FADE_MS = 280;     // duração do fade-out

/**
 * Splash interno do app — mostrado nos primeiros ~1.1s ao abrir, antes do
 * login aparecer. Cobre o gap visual entre "tela em branco" e "app carregado",
 * dando sensação de inicialização de app nativo.
 *
 * Distinct do splash do iOS (apple-touch-startup-image): aquele só aparece
 * quando o app é aberto via Add to Home Screen. Esse aqui aparece em
 * QUALQUER abertura — Safari normal, PWA standalone, desktop.
 *
 * Aparece UMA vez por sessão (sessionStorage) — não chateia em navegações
 * dentro do app. Se quiser que apareça sempre (no full reload), remover
 * o check de sessionStorage.
 */
export function SplashScreen() {
  // Default true só no client após mount pra não causar mismatch hidration
  const [show, setShow] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Mostra splash apenas uma vez por sessão do browser. Em PWA standalone
    // (instalado na tela inicial), cada vez que abre o app é uma sessão nova
    // — então sempre aparece. Em Safari aberto, navega sem ver de novo.
    try {
      const seen = sessionStorage.getItem("pdg:splash-seen");
      if (seen) return;
      sessionStorage.setItem("pdg:splash-seen", "1");
    } catch {
      // sessionStorage indisponível (modo privado) — mostra de qualquer jeito
    }
    setShow(true);

    // Trava scroll do body durante o splash pra não vazar conteúdo do login
    document.body.style.overflow = "hidden";
    const fadeT = setTimeout(() => setFading(true), VISIBLE_MS);
    const hideT = setTimeout(() => {
      setShow(false);
      document.body.style.overflow = "";
    }, VISIBLE_MS + FADE_MS);

    return () => {
      clearTimeout(fadeT);
      clearTimeout(hideT);
      document.body.style.overflow = "";
    };
  }, []);

  if (!show) return null;

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-b from-brand-yellow to-brand-orange transition-opacity ease-out"
      style={{
        opacity: fading ? 0 : 1,
        transitionDuration: `${FADE_MS}ms`,
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex flex-col items-center gap-3 animate-splash-rise">
        <div className="animate-splash-pulse">
          <BrandIcon size={108} />
        </div>
        <div className="flex flex-col items-center leading-none mt-1">
          <span className="text-[12px] font-bold uppercase tracking-[0.22em] text-ink/70">
            Cozinha da
          </span>
          <span className="text-[42px] font-extrabold -tracking-[0.02em] text-ink mt-1">
            Gil
          </span>
        </div>
      </div>
    </div>
  );
}
