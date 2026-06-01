"use client";
import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useEscapeKey } from "@/lib/use-escape-key";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { useFocusTrap } from "@/lib/use-focus-trap";

/**
 * Dialog de confirmação genérico — substitui `window.confirm()` nativo.
 *
 * Por quê: confirm() nativo do iOS/Android tem visual fora do brand,
 * não respeita safe area, não dá pra fechar com gesto, e congela toda
 * a UI. Esse componente segue o pattern do `CancelDialog` (já provado).
 *
 * Uso controlado por state:
 *   const [confirming, setConfirming] = useState(false);
 *   <ConfirmDialog
 *     open={confirming}
 *     title="Fechar caixa?"
 *     message="Não dá pra desfazer."
 *     confirmLabel="Fechar caixa"
 *     destructive
 *     onConfirm={() => { doIt(); setConfirming(false); }}
 *     onClose={() => setConfirming(false)}
 *   />
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEscapeKey(onClose, open);
  useBodyScrollLock(open);
  const dialogRef = useFocusTrap(open);

  if (!open) return null;

  return (
    <div
      // z-[100]: acima do bottom-nav admin (z-30), MoreSheet (z-40), header
      // sticky (z-30), banners (z-40). Reserva 100+ pra modais críticos
      // (confirmação de ações destrutivas) — não pode ser coberto por nada.
      // items-center sempre: vira modal centralizado em mobile também (em
      // vez de bottom-sheet, que batia visualmente com bottom-nav).
      className="fixed inset-0 z-[100] bg-ink/50 backdrop-blur-[3px] flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-surface-elevated rounded-xl shadow-2xl p-5 animate-sheet-up flex flex-col gap-4"
      >
        <header className="flex items-start gap-3">
          {destructive && (
            <div className="shrink-0 w-10 h-10 rounded-full bg-danger-bg text-danger inline-flex items-center justify-center">
              <AlertTriangle size={20} strokeWidth={2.5} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 id="confirm-title" className="t-h2 mb-1">
              {title}
            </h2>
            {message && <p className="t-body-sm">{message}</p>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 inline-flex items-center justify-center w-11 h-11 -mr-2 -mt-2 rounded-md text-ink-3 hover:text-ink hover:bg-surface-sunken"
            aria-label="Fechar"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </header>

        <footer className="flex gap-2 mt-2">
          <button onClick={onClose} className="btn btn-ghost flex-1">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 ${destructive ? "btn btn-danger" : "btn btn-primary"}`}
          >
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}

/**
 * Hook helper pra fluxos imperativos. Retorna função `confirm(opts)` que
 * resolve quando user clica botão. Substitui `window.confirm()`.
 *
 *   const confirm = useConfirmDialog();
 *   // ...
 *   if (await confirm({ title: "Apagar?", destructive: true })) { ... }
 */
export function useConfirmDialog() {
  const [state, setState] = useState<{
    open: boolean;
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    resolve?: (ok: boolean) => void;
  }>({ open: false, title: "" });

  const confirm = (opts: {
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
  }) =>
    new Promise<boolean>((resolve) => {
      setState({ ...opts, open: true, resolve });
    });

  const node = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      destructive={state.destructive}
      onConfirm={() => {
        state.resolve?.(true);
        setState({ open: false, title: "" });
      }}
      onClose={() => {
        state.resolve?.(false);
        setState({ open: false, title: "" });
      }}
    />
  );

  return { confirm, node };
}
