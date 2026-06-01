"use client";
import { useEffect, type RefObject } from "react";

/**
 * Focus trap em modal — WCAG 2.4.3 (Focus Order).
 *
 * Quando ativo, Tab e Shift+Tab cyclam entre os elementos focáveis DENTRO
 * do `containerRef` em vez de sair pro fundo da página. Também move o foco
 * pro primeiro elemento focável quando o modal abre.
 *
 * Decisão de design: `inert` na página de fora seria mais limpo, mas os
 * modais aqui são fixed/portal-style sem um ancestral único — setar `inert`
 * no `<body>` exceto o modal é frágil em React. Cycle manual via Tab handler
 * é robusto e suficiente.
 *
 * Uso:
 *   const ref = useRef<HTMLDivElement>(null);
 *   useFocusTrap(open, ref);
 *   return open ? <div ref={ref}>{...}</div> : null;
 */
export function useFocusTrap<T extends HTMLElement>(
  enabled: boolean,
  containerRef: RefObject<T | null>,
) {
  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;

    // Foco inicial — primeiro focusable do modal (depois de raf pra esperar render)
    const raf = requestAnimationFrame(() => {
      const list = getFocusables(el);
      list[0]?.focus();
    });

    function onKey(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const list = getFocusables(el!);
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = active && el!.contains(active);

      if (e.shiftKey) {
        if (!inside || active === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (!inside || active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
    };
  }, [enabled, containerRef]);
}

function getFocusables(root: HTMLElement): HTMLElement[] {
  const selector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
  );
}
