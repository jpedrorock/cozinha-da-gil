import { describe, expect, it } from "vitest";
import { computeEventStats, type EventStatOrder } from "@/lib/event-stats";

// Datetime SEM timezone → interpretado como hora LOCAL pelo JS, então
// getHours() é determinístico independente da máquina. Útil pro peakHour.
function order(
  hour: number,
  items: Array<{ kind: string; toppings?: string[]; flavor?: string; price: number; qty?: number }>,
  status = "ENTREGUE",
): EventStatOrder {
  const hh = String(hour).padStart(2, "0");
  return {
    createdAt: `2026-05-28T${hh}:30:00`,
    status,
    items: items.map((i) => ({
      kind: i.kind,
      toppings: JSON.stringify(i.toppings ?? []),
      flavor: i.flavor ?? null,
      unitPrice: i.price,
      quantity: i.qty ?? 1,
    })),
  };
}

describe("computeEventStats", () => {
  it("evento vazio → tudo zero/null", () => {
    expect(computeEventStats([])).toEqual({
      orderCount: 0,
      revenueCents: 0,
      avgTicketCents: 0,
      peakHour: null,
      topItem: null,
    });
  });

  it("faturamento e ticket médio (× quantity), ignorando CANCELADO", () => {
    const orders = [
      order(19, [{ kind: "salgado", toppings: ["Frango"], price: 2000, qty: 2 }]), // 4000
      order(20, [{ kind: "bebida", price: 600, qty: 1 }]), // 600
      order(20, [{ kind: "salgado", toppings: ["Carne"], price: 2000 }], "CANCELADO"), // ignora
    ];
    const r = computeEventStats(orders);
    expect(r.orderCount).toBe(2);
    expect(r.revenueCents).toBe(4600);
    expect(r.avgTicketCents).toBe(2300);
  });

  it("hora de pico = hora com mais pedidos", () => {
    const orders = [
      order(18, [{ kind: "bebida", price: 600 }]),
      order(19, [{ kind: "bebida", price: 600 }]),
      order(19, [{ kind: "bebida", price: 600 }]),
      order(21, [{ kind: "bebida", price: 600 }]),
    ];
    expect(computeEventStats(orders).peakHour).toBe(19);
  });

  it("empate de hora → hora mais cedo", () => {
    const orders = [
      order(12, [{ kind: "bebida", price: 600 }]),
      order(20, [{ kind: "bebida", price: 600 }]),
    ];
    expect(computeEventStats(orders).peakHour).toBe(12);
  });

  it("item campeão soma toppings + sabores por quantidade", () => {
    const orders = [
      order(19, [{ kind: "salgado", toppings: ["Catupiry", "Frango"], price: 2000, qty: 2 }]), // Catupiry+2, Frango+2
      order(19, [{ kind: "salgado", toppings: ["Catupiry"], price: 2000 }]), // Catupiry+1 → 3
      order(20, [{ kind: "doce", flavor: "Chocolate", price: 1500 }]), // Chocolate+1
    ];
    expect(computeEventStats(orders).topItem).toEqual({ name: "Catupiry", count: 3 });
  });

  it("CANCELADO não conta no item campeão nem no faturamento", () => {
    const orders = [
      order(19, [{ kind: "salgado", toppings: ["Frango"], price: 2000 }]),
      order(19, [{ kind: "salgado", toppings: ["Bacon"], price: 2000, qty: 9 }], "CANCELADO"),
    ];
    const r = computeEventStats(orders);
    expect(r.revenueCents).toBe(2000);
    expect(r.topItem).toEqual({ name: "Frango", count: 1 });
  });

  it("evento só de bebida → sem item campeão", () => {
    const orders = [order(19, [{ kind: "bebida", price: 600, qty: 3 }])];
    const r = computeEventStats(orders);
    expect(r.topItem).toBeNull();
    expect(r.revenueCents).toBe(1800);
  });
});
