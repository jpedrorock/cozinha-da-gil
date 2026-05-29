/**
 * Lógica pura da calculadora de troco — separada do componente pra ser
 * testável sem React.
 *
 * Modelo de entrada estilo "digita centavos" (igual maquininha/caixa):
 * cada dígito empurra pra direita. 1 → 5 → 0 → 0 vira R$ 15,00. Sem ponto
 * decimal pra digitar — o operador só martela número, uma mão só.
 * Valores sempre em centavos (inteiro).
 */

const MAX_CENTS = 100_000_000; // teto defensivo: R$ 1.000.000,00

/** Empurra um dígito ('0'–'9') no valor em centavos. Ignora não-dígito e respeita o teto. */
export function pushDigit(cents: number, digit: string): number {
  if (digit < "0" || digit > "9") return cents;
  const next = cents * 10 + (digit.charCodeAt(0) - 48);
  return next > MAX_CENTS ? cents : next;
}

/** Apaga o último dígito (backspace). */
export function popDigit(cents: number): number {
  return Math.floor(cents / 10);
}

export type ChangeResult =
  | { kind: "exato" }
  | { kind: "troco"; cents: number }
  | { kind: "falta"; cents: number };

/**
 * Compara o recebido com o total:
 *  - recebido > total → troco a devolver
 *  - recebido < total → falta receber
 *  - igual            → troco exato (nada a devolver)
 */
export function computeChange(totalCents: number, recebidoCents: number): ChangeResult {
  const diff = recebidoCents - totalCents;
  if (diff > 0) return { kind: "troco", cents: diff };
  if (diff < 0) return { kind: "falta", cents: -diff };
  return { kind: "exato" };
}
