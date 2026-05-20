"use client";
import { useEffect } from "react";

/**
 * Trava o scroll do body quando modal/sheet abre. Sem isso, o conteúdo
 * atrás do modal continua rolando junto — confuso especialmente no iOS
 * Safari onde a camada vaza visualmente.
 *
 * Truque: trocar body pra `position: fixed` preserva a posição de scroll
 * (precisa restaurar manualmente no cleanup). Funciona em iOS/Android/desktop.
 *
 * Uso:
 *   useBodyScrollLock(modalOpen);
 */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const scrollY = window.scrollY;
    const prev = document.body.style.cssText;
    // position:fixed + top negativo "congela" a página visualmente
    // mantendo a posição que o user estava antes do modal abrir.
    document.body.style.cssText = `position:fixed;top:-${scrollY}px;left:0;right:0;width:100%;overflow:hidden;`;
    return () => {
      document.body.style.cssText = prev;
      // Restaurar scroll — sem isso o body fica voltado pro topo
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}
