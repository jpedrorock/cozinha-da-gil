"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Delete } from "lucide-react";

/**
 * Input de PIN estilo desbloqueio de celular — quadradinhos com bolinha quando preenchido.
 *
 * Dois modos:
 *  - Default: `<input inputMode="numeric">` invisível por cima. Força teclado numérico
 *    do mobile e aceita digitação rápida. Bom pro admin (notebook).
 *  - `keypad: true`: numpad virtual 3×4 estilo POS embaixo dos dots. NÃO abre teclado
 *    nativo (sem input). Ideal pro login em tablet/celular na barraca. Mantém suporte
 *    a teclado físico via keydown listener pra quem usar notebook.
 */
export function PinInput({
  value,
  onChange,
  length = 4,
  autoFocus = false,
  onComplete,
  submitOnComplete = true,
  size = "lg",
  keypad = false,
  renderDots = "box",
}: {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  autoFocus?: boolean;
  onComplete?: (value: string) => void;
  /** Se true (default), `onComplete` dispara assim que o último dígito é
   *  inserido — comportamento de "auto-submit". Se false, `onComplete` NÃO
   *  é chamado: o caller é responsável por confirmar manualmente (botão
   *  "Entrar"). Use false em logins onde queremos dar 1 segundo de respiro
   *  pra usuário revisar antes de mandar (PIN compartilhado em barraca). */
  submitOnComplete?: boolean;
  size?: "md" | "lg";
  keypad?: boolean;
  /** Estilo visual dos campos do PIN:
   *  - `box` (default): quadradinhos com borda + dot interno quando preenchido
   *  - `asterisk`: asteriscos discretos centralizados, sem moldura. Mais
   *    leve visualmente, brand fica em destaque. */
  renderDots?: "box" | "asterisk";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  // Mantém referência mais recente do value/onComplete pro listener global do keypad
  // não capturar stale closures (re-bind toda vez seria muito caro com 1 char por dispatch).
  const stateRef = useRef({ value, length, onChange, onComplete, submitOnComplete });
  stateRef.current = { value, length, onChange, onComplete, submitOnComplete };

  const appendDigit = useCallback((d: string) => {
    const s = stateRef.current;
    if (s.value.length >= s.length) return;
    const next = (s.value + d).slice(0, s.length);
    s.onChange(next);
    if (next.length === s.length && s.submitOnComplete && s.onComplete) {
      s.onComplete(next);
    }
  }, []);

  const backspace = useCallback(() => {
    const s = stateRef.current;
    s.onChange(s.value.slice(0, -1));
  }, []);

  const clear = useCallback(() => {
    stateRef.current.onChange("");
  }, []);

  // Modo input nativo: foco automático quando autoFocus
  useEffect(() => {
    if (keypad) return;
    if (autoFocus) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [autoFocus, keypad]);

  // Modo keypad: escuta teclado físico globalmente (pra desktop)
  useEffect(() => {
    if (!keypad) return;
    function onKey(e: KeyboardEvent) {
      // Ignora se o foco está num input/textarea/contenteditable (não roubar digitação)
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;

      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        appendDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        backspace();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [keypad, appendDigit, backspace]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, length);
    onChange(digits);
    if (digits.length === length && submitOnComplete && onComplete) {
      onComplete(digits);
    }
  }

  const box = size === "lg" ? "h-16 md:h-20" : "h-12";
  const dot = size === "lg" ? "w-3.5 h-3.5 md:w-4 md:h-4" : "w-2.5 h-2.5";

  // === Variante `asterisk` — visual discreto sem moldura ===
  // Asterisco em fonte grande no lugar do dot. Apenas em modo keypad
  // (modo input nativo mantém box pra reforçar área clicável).
  if (renderDots === "asterisk" && keypad) {
    return (
      <div className="flex flex-col gap-4 w-full">
        <div className="grid grid-cols-4 w-full pointer-events-none">
          {Array.from({ length }).map((_, i) => {
            const filled = i < value.length;
            return (
              <div
                key={i}
                className="h-12 flex items-center justify-center"
              >
                {filled ? (
                  <span className="text-3xl font-bold leading-none text-ink-2" aria-hidden>
                    ∗
                  </span>
                ) : (
                  <span className="text-2xl font-light text-ink-3/40 leading-none" aria-hidden>
                    ∗
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div
          role="group"
          aria-label="Teclado numérico"
          className="grid grid-cols-3 gap-2 w-full"
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <NumpadButton key={n} onClick={() => appendDigit(String(n))}>
              {n}
            </NumpadButton>
          ))}
          <NumpadButton onClick={clear} muted aria-label="Limpar">
            <span className="text-sm font-semibold">Limpar</span>
          </NumpadButton>
          <NumpadButton onClick={() => appendDigit("0")}>0</NumpadButton>
          <NumpadButton onClick={backspace} muted aria-label="Apagar último dígito">
            <Delete size={22} strokeWidth={2} />
          </NumpadButton>
        </div>
      </div>
    );
  }

  // No modo keypad ocupamos a largura do parent (grid 4 colunas iguais).
  // No modo input nativo mantemos largura fixa pra centralizar bem.
  const dotsRow = keypad ? (
    <div className="grid grid-cols-4 gap-2 md:gap-3 w-full pointer-events-none">
      {Array.from({ length }).map((_, i) => {
        const filled = i < value.length;
        const isCurrent = (focused || keypad) && i === value.length && !filled;
        return (
          <div
            key={i}
            className={`${box} rounded-lg border-2 flex items-center justify-center bg-surface-elevated transition-colors ${
              isCurrent
                ? "border-brand-yellow shadow-focus"
                : filled
                ? "border-ink"
                : "border-line-strong"
            }`}
          >
            {filled && <span className={`${dot} bg-ink rounded-full`} aria-hidden />}
          </div>
        );
      })}
    </div>
  ) : (
    <div className="flex gap-2 md:gap-3 justify-center pointer-events-none">
      {Array.from({ length }).map((_, i) => {
        const filled = i < value.length;
        const isCurrent = (focused || keypad) && i === value.length && !filled;
        const fixedW = size === "lg" ? "w-14 md:w-16" : "w-11";
        return (
          <div
            key={i}
            className={`${box} ${fixedW} rounded-lg border-2 flex items-center justify-center bg-surface-elevated transition-colors ${
              isCurrent
                ? "border-brand-yellow shadow-focus"
                : filled
                ? "border-ink"
                : "border-line-strong"
            }`}
          >
            {filled && <span className={`${dot} bg-ink rounded-full`} aria-hidden />}
          </div>
        );
      })}
    </div>
  );

  if (!keypad) {
    return (
      <div className="relative inline-block">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={length}
          autoComplete="one-time-code"
          value={value}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
          aria-label="Senha"
        />
        {dotsRow}
      </div>
    );
  }

  // === Modo numpad — ocupa toda a largura do parent ===
  return (
    <div className="flex flex-col gap-4 w-full">
      {dotsRow}
      <div
        role="group"
        aria-label="Teclado numérico"
        className="grid grid-cols-3 gap-2 w-full"
      >
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <NumpadButton key={n} onClick={() => appendDigit(String(n))}>
            {n}
          </NumpadButton>
        ))}
        <NumpadButton onClick={clear} muted aria-label="Limpar">
          <span className="text-sm font-semibold">Limpar</span>
        </NumpadButton>
        <NumpadButton onClick={() => appendDigit("0")}>0</NumpadButton>
        <NumpadButton onClick={backspace} muted aria-label="Apagar último dígito">
          <Delete size={22} strokeWidth={2} />
        </NumpadButton>
      </div>
    </div>
  );
}

function NumpadButton({
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
