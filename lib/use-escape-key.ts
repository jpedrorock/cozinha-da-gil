"use client";
import { useEffect } from "react";

/**
 * Adiciona handler global pra tecla Escape enquanto o componente
 * estiver montado. Usado em modais — ESC fecha (a11y básica).
 */
export function useEscapeKey(handler: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handler();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handler, enabled]);
}
