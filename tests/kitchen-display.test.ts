import { describe, expect, it } from "vitest";
import { summarizeChecklist } from "@/lib/kitchen-display";

const TOPPINGS = [
  "Carne", "Calabresa", "Frango", "Bacon", "Presunto", "Queijo",
  "Catupiry", "Milho", "Cebola", "Cebola caramelizada", "Azeitona", "Batata palha",
];

describe("summarizeChecklist", () => {
  it("nenhum selecionado → empty", () => {
    expect(summarizeChecklist(TOPPINGS, [])).toEqual({ kind: "empty" });
  });

  it("todos selecionados → all com total", () => {
    expect(summarizeChecklist(TOPPINGS, [...TOPPINGS])).toEqual({
      kind: "all",
      total: 12,
    });
  });

  it("maioria vai (tudo menos cebola) → most-going lista só os que faltam", () => {
    const selected = TOPPINGS.filter((t) => t !== "Cebola");
    const r = summarizeChecklist(TOPPINGS, selected);
    expect(r).toEqual({ kind: "most-going", missing: ["Cebola"] });
  });

  it("maioria vai, faltam 2 → most-going com os 2", () => {
    const selected = TOPPINGS.filter((t) => t !== "Cebola" && t !== "Azeitona");
    const r = summarizeChecklist(TOPPINGS, selected);
    expect(r.kind).toBe("most-going");
    if (r.kind === "most-going") expect(r.missing).toEqual(["Cebola", "Azeitona"]);
  });

  it("minoria vai (só frango + queijo) → few-going lista os que vão", () => {
    const r = summarizeChecklist(TOPPINGS, ["Frango", "Queijo"]);
    expect(r).toEqual({ kind: "few-going", going: ["Frango", "Queijo"] });
  });

  it("empate (6 vão, 6 não) → most-going (formato 'menos' é mais compacto)", () => {
    const selected = TOPPINGS.slice(0, 6);
    const r = summarizeChecklist(TOPPINGS, selected);
    expect(r.kind).toBe("most-going");
    if (r.kind === "most-going") expect(r.missing).toHaveLength(6);
  });

  it("1 a mais que metade → most-going", () => {
    const selected = TOPPINGS.slice(0, 7); // 7 vão, 5 não
    const r = summarizeChecklist(TOPPINGS, selected);
    expect(r.kind).toBe("most-going");
    if (r.kind === "most-going") expect(r.missing).toHaveLength(5);
  });

  it("1 a menos que metade → few-going", () => {
    const selected = TOPPINGS.slice(0, 5); // 5 vão, 7 não
    const r = summarizeChecklist(TOPPINGS, selected);
    expect(r.kind).toBe("few-going");
    if (r.kind === "few-going") expect(r.going).toHaveLength(5);
  });

  it("ignora selecionados que não estão no catálogo (stale)", () => {
    const r = summarizeChecklist(["Frango", "Queijo"], ["Frango", "Bacon-removido"]);
    // Bacon-removido não está em `all`, então conta só Frango como going.
    // going=1, missing=["Queijo"]=1 → empate → most-going
    expect(r.kind).toBe("most-going");
    if (r.kind === "most-going") expect(r.missing).toEqual(["Queijo"]);
  });

  it("preserva a ordem do catálogo (não a ordem de seleção)", () => {
    const r = summarizeChecklist(TOPPINGS, ["Queijo", "Frango"]);
    if (r.kind === "few-going") {
      // Frango (idx 2) vem antes de Queijo (idx 5) no catálogo
      expect(r.going).toEqual(["Frango", "Queijo"]);
    }
  });

  it("catálogo vazio → empty", () => {
    expect(summarizeChecklist([], [])).toEqual({ kind: "empty" });
  });
});
