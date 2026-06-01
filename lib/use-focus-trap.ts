"use client";
import { useEffect, useRef } from "react";

const FOCUSABLE = [
  'a[href]:not([disabled])',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * Trapeia Tab focus dentro de um elemento container enquanto `active` é true.
 * Retorna um ref a ser colocado no elemento que deve conter o foco (ex: div[role="dialog"]).
 *
 * WCAG 2.4.3 (Focus Order) — impede que Tab escape do modal pra elementos atrás.
 */
export function useFocusTrap(active: boolean) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || !ref.current) return;

    const container = ref.current;

    function getFocusables() {
      return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
    }

    // Mover foco pro primeiro elemento focável ao abrir
    const focusables = getFocusables();
    if (focusables.length > 0) focusables[0].focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;

      const els = getFocusables();
      if (els.length === 0) return;

      const first = els[0];
      const last = els[els.length - 1];
      const focused = document.activeElement as HTMLElement;

      if (e.shiftKey) {
        if (focused === first || !container.contains(focused)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (focused === last || !container.contains(focused)) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [active]);

  return ref;
}
