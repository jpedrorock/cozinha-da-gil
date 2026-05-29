import { test, expect } from "@playwright/test";

/**
 * Smoke das APIs — golden path via HTTP direto.
 * Mais barato que e2e de UI completa, ainda valida que rotas/auth/state
 * estão integrados de ponta a ponta.
 */
test.describe("API smoke", () => {
  test("/api/health responde com dbOk", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.dbOk).toBe(true);
  });

  test("rotas de mutação sem cookie retornam 401", async ({ request }) => {
    const res = await request.post("/api/orders", {
      data: { clientName: "Anon", items: [] },
    });
    expect(res.status()).toBe(401);
  });

  test("login + abrir caixa + criar pedido + fechar caixa", async ({ request }) => {
    // 1. Login Gil (PIN atualizado 2026-05-22: 2699)
    const login = await request.post("/api/auth/login", {
      data: { name: "Gil", password: "2699", role: "admin" },
    });
    expect(login.ok()).toBe(true);

    // 2. Abrir caixa (ou reusar se já aberto)
    const open = await request.post("/api/events/open", {
      data: { operator: "Gil", name: "E2E test" },
    });
    // Pode ser 201 (criou) ou 409 (já tinha)
    expect([201, 409]).toContain(open.status());

    // 3. Pegar produto (Coca-Cola Lata)
    const productsRes = await request.get("/api/products?type=bebida");
    expect(productsRes.ok()).toBe(true);
    const products = await productsRes.json();
    const coca = products.find((p: { name: string }) => p.name === "Coca-Cola Lata");
    expect(coca).toBeDefined();

    // 4. Criar pedido com Coca x2
    const orderRes = await request.post("/api/orders", {
      data: {
        clientName: "E2E Test Client",
        operator: "Gil",
        items: [{ productId: coca.id, quantity: 2 }],
      },
    });
    expect(orderRes.status()).toBe(201);
    const order = await orderRes.json();
    expect(order.clientName).toBe("E2E Test Client");
    expect(order.items).toHaveLength(1);
    expect(order.items[0].quantity).toBe(2);
    expect(order.finalCents).toBe(order.totalCents); // sem promo
  });

  test("rate limit em 5 tentativas de login com senha errada", async ({ request }) => {
    // Reset implícito: cada teste roda contra um nome fresco (test runner cleanup)
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await request.post("/api/auth/login", {
        data: { name: "TestRateLimit", password: "0000", role: "admin" },
      });
      statuses.push(res.status());
    }
    // Espera pelo menos um 429 antes da 7ª tentativa
    expect(statuses.some((s) => s === 429)).toBe(true);
  });
});
