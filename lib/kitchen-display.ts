/**
 * Regras puras de exibição pra cozinha — extraídas pra serem testáveis
 * sem montar o componente React.
 */

/**
 * Decide como mostrar a lista de toppings de um pastel grande na cozinha
 * pra NÃO inflar o ticket (feedback Gil 2026-05-27).
 *
 * Dado o catálogo completo (`all`) e o que o cliente escolheu (`selected`):
 *   - "empty"      → nada selecionado (mostra "Sem toppings")
 *   - "all"        → todos selecionados (mostra "Tudo (N)" em vez de listar 12)
 *   - "most-going" → maioria vai, faltam poucos → mostra só os que NÃO vão
 *                    ("Vai tudo, menos: X, Y"). "Esquecer de NÃO pôr" é o
 *                    erro caro na cozinha, então destaca o que omitir.
 *   - "few-going"  → minoria vai → mostra só os que vão (✓ X)
 *
 * Empate (in === out) cai em "most-going" — geralmente são poucos pra omitir
 * e o formato "menos X" é mais compacto que listar metade com ✓.
 */
export type ChecklistDisplay =
  | { kind: "empty" }
  | { kind: "all"; total: number }
  | { kind: "most-going"; missing: string[] }
  | { kind: "few-going"; going: string[] };

export function summarizeChecklist(
  all: string[],
  selected: string[],
): ChecklistDisplay {
  const selectedSet = new Set(selected);
  const going = all.filter((n) => selectedSet.has(n));
  const missing = all.filter((n) => !selectedSet.has(n));

  if (going.length === 0) return { kind: "empty" };
  if (missing.length === 0) return { kind: "all", total: all.length };
  if (going.length >= missing.length) return { kind: "most-going", missing };
  return { kind: "few-going", going };
}
