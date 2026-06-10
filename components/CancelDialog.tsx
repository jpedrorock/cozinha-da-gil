"use client";
import { useRef, useState } from "react";
import { X } from "lucide-react";
import { useEscapeKey } from "@/lib/use-escape-key";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { useFocusTrap } from "@/lib/use-focus-trap";

const PRESET_REASONS = [
  "Cliente foi embora",
  "Ingrediente acabou",
  "Erro no pedido",
  "Cliente desistiu",
];

export function CancelDialog({
  open,
  orderLabel,
  onConfirm,
  onClose,
}: {
  open: boolean;
  orderLabel: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);

  useEscapeKey(() => {
    setSelected(null);
    setCustomText("");
    onClose();
  }, open);

  useBodyScrollLock(open);
  useFocusTrap(open, dialogRef);

  if (!open) return null;

  const isCustom = selected === "Outro";
  const canConfirm = selected !== null && (!isCustom || customText.trim().length > 0);

  function handleConfirm() {
    if (!canConfirm) return;
    const reason = isCustom ? customText.trim() : (selected as string);
    onConfirm(reason);
    setSelected(null);
    setCustomText("");
  }

  function handleClose() {
    setSelected(null);
    setCustomText("");
    onClose();
  }

  return (
    <div
      onClick={handleClose}
      // z-[100] e items-center: mesmo pattern do ConfirmDialog pra ficar
      // acima de bottom-nav e centralizado em qualquer viewport.
      className="fixed inset-0 z-[100] bg-ink/50 backdrop-blur-[3px] flex items-center justify-center p-4 animate-fade-in"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-surface-elevated rounded-xl shadow-2xl p-5 md:p-6 animate-sheet-up"
      >
        <div className="flex items-start justify-between mb-1">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3">Cancelar pedido</div>
            <h2 id="cancel-dialog-title" className="text-xl font-extrabold -tracking-[0.01em]">{orderLabel}</h2>
          </div>
          <button
            onClick={handleClose}
            className="shrink-0 inline-flex items-center justify-center w-11 h-11 -mr-2 -mt-2 rounded-md text-ink-3 hover:text-ink hover:bg-surface-sunken"
            aria-label="Fechar"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        <p className="t-body-sm mb-4">Por que está cancelando?</p>

        <div className="flex flex-col gap-2 mb-4">
          {PRESET_REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setSelected(r)}
              className={`h-11 px-4 rounded-md border-2 text-left font-semibold text-[13px] transition-colors ${
                selected === r
                  ? "border-brand-yellow bg-[#FFFCE5]"
                  : "border-line bg-surface-elevated hover:border-ink-3"
              }`}
            >
              {r}
            </button>
          ))}
          <button
            onClick={() => setSelected("Outro")}
            className={`h-11 px-4 rounded-md border-2 text-left font-semibold text-[13px] transition-colors ${
              isCustom
                ? "border-brand-yellow bg-[#FFFCE5]"
                : "border-line bg-surface-elevated hover:border-ink-3"
            }`}
          >
            Outro motivo…
          </button>
          {isCustom && (
            <textarea
              autoFocus
              placeholder="Descreva o motivo (cliente reclamou de atraso, errou o pedido, etc)"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              // Audit P2 #21: 80px era apertado pra contexto real (cancelamento
              // em stress costuma ter mais detalhes). 112px = 4 linhas confortáveis.
              className="textarea min-h-[112px] text-sm"
            />
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={handleClose} className="btn btn-ghost flex-1">
            Voltar
          </button>
          <button
            disabled={!canConfirm}
            onClick={handleConfirm}
            className="btn btn-danger flex-1"
          >
            Cancelar pedido
          </button>
        </div>
      </div>
    </div>
  );
}
