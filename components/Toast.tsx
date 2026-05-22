"use client";
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Undo2, X } from "lucide-react";

export type ToastTone = "info" | "success" | "error";
export type ToastAction = { label: string; onClick: () => void };

/**
 * Toast inline bottom-center. Substitui `alert()` nativo, que congela
 * a UI, não respeita safe-area e quebra o brand. Pattern padrão Material:
 * surge embaixo, auto-dismiss em ~3s, tom semântico colorido.
 *
 * Audit-Crit B #14: aceita action opcional pra Undo/visualizar etc.
 * Quando há action, duration sobe pra 6s (atendente precisa tempo
 * pra reagir). Click no action dispara handler + dispensa o toast.
 *
 * O componente é só visual — gerencia próprio state local de visibilidade
 * com transição. Quem dispara é o hook `useToast()` (state higher up).
 */
export function Toast({
  message,
  tone = "info",
  action,
  onClose,
}: {
  message: string | null;
  tone?: ToastTone;
  action?: ToastAction;
  onClose: () => void;
}) {
  // local "visible" state pra animar saída sem unmount imediato
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (message) {
      setVisible(true);
      // Toast com action fica mais tempo — user precisa reagir
      const duration = action ? 6000 : 2800;
      const t = setTimeout(() => setVisible(false), duration);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [message, action]);

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
        {action && (
          <button
            onClick={() => {
              action.onClick();
              setVisible(false);
            }}
            className="ml-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/20 hover:bg-white/30 active:scale-95 transition uppercase tracking-wide text-xs font-bold"
          >
            <Undo2 size={14} strokeWidth={3} />
            {action.label}
          </button>
        )}
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
 *   showToast("Item removido", { tone: "info", action: { label: "Desfazer", onClick: undo } });
 *   return <>{node}{...}</>
 */
export function useToast() {
  const [msg, setMsg] = useState<{ text: string; tone: ToastTone; action?: ToastAction } | null>(null);

  // Overload pra back-compat: aceita string tone OU options object.
  function showToast(
    text: string,
    toneOrOpts: ToastTone | { tone?: ToastTone; action?: ToastAction } = "info",
  ) {
    if (typeof toneOrOpts === "string") {
      setMsg({ text, tone: toneOrOpts });
    } else {
      setMsg({ text, tone: toneOrOpts.tone ?? "info", action: toneOrOpts.action });
    }
  }

  const node = (
    <Toast
      message={msg?.text ?? null}
      tone={msg?.tone}
      action={msg?.action}
      onClose={() => setMsg(null)}
    />
  );

  return { showToast, node };
}
