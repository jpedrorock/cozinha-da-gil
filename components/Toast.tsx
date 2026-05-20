"use client";
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

export type ToastTone = "info" | "success" | "error";

/**
 * Toast inline bottom-center. Substitui `alert()` nativo, que congela
 * a UI, não respeita safe-area e quebra o brand. Pattern padrão Material:
 * surge embaixo, auto-dismiss em ~3s, tom semântico colorido.
 *
 * O componente é só visual — gerencia próprio state local de visibilidade
 * com transição. Quem dispara é o hook `useToast()` (state higher up).
 */
export function Toast({
  message,
  tone = "info",
  onClose,
}: {
  message: string | null;
  tone?: ToastTone;
  onClose: () => void;
}) {
  // local "visible" state pra animar saída sem unmount imediato
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (message) {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 2800);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [message]);

  if (!message) return null;

  const bg = tone === "error" ? "bg-danger" : tone === "success" ? "bg-status-ready" : "bg-ink";
  const Icon = tone === "error" ? AlertCircle : tone === "success" ? CheckCircle2 : null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-1/2 -translate-x-1/2 z-[60] pointer-events-none transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{ bottom: "max(env(safe-area-inset-bottom), 24px)" }}
      onTransitionEnd={() => {
        if (!visible) onClose();
      }}
    >
      <div
        className={`pointer-events-auto inline-flex items-center gap-2 ${bg} text-white px-4 py-2.5 rounded-md shadow-lg font-semibold text-sm max-w-[90vw]`}
      >
        {Icon && <Icon size={18} strokeWidth={2.5} aria-hidden />}
        <span className="leading-tight">{message}</span>
        <button
          onClick={() => setVisible(false)}
          aria-label="Fechar aviso"
          className="ml-1 -mr-1 inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-white/15"
        >
          <X size={16} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

/**
 * Hook helper pra disparar toasts imperativamente.
 *
 *   const { node, showToast } = useToast();
 *   showToast("Pedido confirmado", "success");
 *   return <>{node}{...}</>
 */
export function useToast() {
  const [msg, setMsg] = useState<{ text: string; tone: ToastTone } | null>(null);

  function showToast(text: string, tone: ToastTone = "info") {
    setMsg({ text, tone });
  }

  const node = (
    <Toast
      message={msg?.text ?? null}
      tone={msg?.tone}
      onClose={() => setMsg(null)}
    />
  );

  return { showToast, node };
}
