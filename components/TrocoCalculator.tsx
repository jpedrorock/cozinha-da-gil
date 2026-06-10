"use client";
import { useRef, useState } from "react";
import { Delete, X } from "lucide-react";
import { formatBRL } from "@/lib/pricing";
import { pushDigit, popDigit, computeChange } from "@/lib/troco";
import { useEscapeKey } from "@/lib/use-escape-key";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { useFocusTrap } from "@/lib/use-focus-trap";

/**
 * Calculadora de troco — bottom-sheet de UMA MÃO pro atendente.
 *
 * Pedido do João: discreta (abre só quando precisa, não fica em evidência)
 * e usável com uma mão só sob pressão. Por isso: sheet ancorado embaixo,
 * resultado no topo (sempre visível), numpad grande na base (alcance do
 * polegar). Standalone — digita total + recebido, não depende de pedido
 * aberto. Entrada estilo maquininha (martela dígito, vira centavos).
 */
export function TrocoCalculator({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [total, setTotal] = useState(0);
  const [recebido, setRecebido] = useState(0);
  const [active, setActive] = useState<"total" | "recebido">("total");
  const dialogRef = useRef<HTMLDivElement>(null);

  useEscapeKey(onClose, open);
  useBodyScrollLock(open);
  useFocusTrap(open, dialogRef);

  if (!open) return null;

  function press(digit: string) {
    if (active === "total") setTotal((c) => pushDigit(c, digit));
    else setRecebido((c) => pushDigit(c, digit));
  }
  function back() {
    if (active === "total") setTotal(popDigit);
    else setRecebido(popDigit);
  }
  function resetAll() {
    setTotal(0);
    setRecebido(0);
    setActive("total");
  }

  const result = computeChange(total, recebido);
  const nothingYet = total === 0 && recebido === 0;

  return (
    <div
      className="fixed inset-0 z-[100] bg-ink/50 backdrop-blur-[3px] flex items-end justify-center animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Calculadora de troco"
        className="w-full max-w-md bg-surface-elevated rounded-t-2xl shadow-lg flex flex-col"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-lg font-extrabold">Troco</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="inline-flex items-center justify-center h-9 w-9 rounded-full text-ink-3 hover:text-ink hover:bg-surface-sunken"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* Resultado — sempre visível no topo */}
        <div className="px-4">
          {nothingYet ? (
            <div className="rounded-xl bg-surface-sunken text-ink-3 text-sm font-medium px-4 py-3 text-center">
              Digite o total e o quanto o cliente deu
            </div>
          ) : result.kind === "troco" ? (
            <div className="rounded-xl bg-status-ready-bg text-status-ready-ink px-4 py-3 flex items-baseline justify-between">
              <span className="text-sm font-bold uppercase tracking-wide">Troco</span>
              <span className="text-3xl font-extrabold tabular-nums">{formatBRL(result.cents)}</span>
            </div>
          ) : result.kind === "falta" ? (
            <div className="rounded-xl bg-danger-bg text-danger px-4 py-3 flex items-baseline justify-between">
              <span className="text-sm font-bold uppercase tracking-wide">Falta</span>
              <span className="text-3xl font-extrabold tabular-nums">{formatBRL(result.cents)}</span>
            </div>
          ) : (
            <div className="rounded-xl bg-surface-sunken text-ink-2 px-4 py-3 text-center text-base font-bold">
              Troco exato — nada a devolver
            </div>
          )}
        </div>

        {/* Campos: Total / Recebido (tap pra escolher qual editar) */}
        <div className="grid grid-cols-2 gap-3 px-4 pt-3">
          <FieldButton
            label="Total"
            value={formatBRL(total)}
            active={active === "total"}
            onClick={() => setActive("total")}
          />
          <FieldButton
            label="Recebido"
            value={formatBRL(recebido)}
            active={active === "recebido"}
            onClick={() => setActive("recebido")}
          />
        </div>

        {/* Numpad — base, alcance do polegar */}
        <div className="grid grid-cols-3 gap-2 p-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <NumKey key={n} onClick={() => press(String(n))}>
              {n}
            </NumKey>
          ))}
          <NumKey onClick={resetAll} muted aria-label="Limpar tudo">
            <span className="text-sm font-semibold">Limpar</span>
          </NumKey>
          <NumKey onClick={() => press("0")}>0</NumKey>
          <NumKey onClick={back} muted aria-label="Apagar último dígito">
            <Delete size={22} strokeWidth={2} />
          </NumKey>
        </div>
      </div>
    </div>
  );
}

function FieldButton({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border-2 px-3 py-2 text-left transition-colors ${
        active
          ? "border-brand-yellow bg-surface-elevated shadow-focus"
          : "border-line-strong bg-surface-sunken"
      }`}
    >
      <span className="block text-xs font-bold uppercase tracking-wide text-ink-3">{label}</span>
      <span className="block text-xl font-extrabold tabular-nums text-ink">{value}</span>
    </button>
  );
}

function NumKey({
  children,
  onClick,
  muted = false,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  muted?: boolean;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`h-14 rounded-lg text-2xl font-bold tabular-nums inline-flex items-center justify-center transition-[transform,background] active:scale-[0.94] ${
        muted
          ? "bg-surface-sunken text-ink-2 hover:bg-surface-elevated border border-line"
          : "bg-surface-elevated text-ink shadow-sm hover:shadow-md border border-line"
      }`}
    >
      {children}
    </button>
  );
}
