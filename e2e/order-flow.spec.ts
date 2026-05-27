import { expect, test } from "@playwright/test";

/**
 * E2E do fluxo completo de 1 pedido — ponta a ponta via API direta:
 *
 * 1. Gil admin → login → abre caixa do evento
 * 2. Maria atendente → login → cria pedido (pastel salgado, qty=2)
 * 3. José cozinha → login → marca EM_PREPARO → marca PRONTO
 * 4. Maria atendente → marca ENTREGUE
 * 5. Assert: ordem final tem status ENTREGUE
 *
 * UI tem coverage indireto via SSE (cada transição deveria notificar a
 * cozinha, mas testar UI direto é flaky por splash/SW). Esse teste foca
 * em validar que a CADEIA de PATCHs respeita as regras de transição
 * (PEDIDO_FEITO → EM_PREPARO → PRONTO → ENTREGUE) e auth por role.
 *
 * Pré-requisitos (globalSetup cuida):
 *  - Gil admin com PIN 2699 (seed normal)
 *  - Maria atendente com PIN 1111 (e2e/global-setup.ts)
 *  - José cozinha com PIN 2222 (e2e/global-setup.ts)
 *
 * Servidor: roda `npm run dev` antes; exporta
 * `PLAYWRIGHT_BASE_URL=http://localhost:3000`.
 */

const GIL_PIN = "2699";
const MARIA_PIN = "1111";
const JOSE_PIN = "2222";

test.describe("Order flow E2E", () => {
  test.setTimeout(30_000);

  test("ciclo completo: novo pedido → preparo → pronto → entregue", async ({
    playwright,
  }) => {
    const eventName = `E2E ${Date.now()}`;
    const clientName = `Cliente E2E ${Date.now()}`;

    // === ETAPA 1: Gil admin abre caixa ===
    const gilCtx = await playwright.request.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    });
    const gilLogin = await gilCtx.post("/api/auth/login", {
      data: { name: "Gil", password: GIL_PIN, role: "admin" },
    });
    expect(gilLogin.ok()).toBe(true);

    const openRes = await gilCtx.post("/api/events/open", {
      data: { operator: "Gil", name: eventName },
    });
    expect([201, 409]).toContain(openRes.status());

    // === ETAPA 2: Maria atendente cria pedido (pastel salgado, qty=2) ===
    const mariaCtx = await playwright.request.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    });
    const mariaLogin = await mariaCtx.post("/api/auth/login", {
      data: { name: "Maria", password: MARIA_PIN, role: "atendente" },
    });
    expect(mariaLogin.ok()).toBe(true);

    // Busca produto salgado (não bebida, pra cair na cozinha)
    const productsRes = await mariaCtx.get("/api/products");
    const products = (await productsRes.json()) as Array<{
      id: string;
      name: string;
      type: string;
      sizes: Array<{ id: string; name: string }>;
    }>;
    const pastel = products.find((p) => p.type === "salgado");
    if (!pastel || pastel.sizes.length === 0) {
      throw new Error("Pastel salgado não encontrado no seed");
    }
    const sizePequeno =
      pastel.sizes.find((s) => /pequeno/i.test(s.name)) ?? pastel.sizes[0];

    const orderRes = await mariaCtx.post("/api/orders", {
      data: {
        clientName,
        operator: "Maria",
        items: [
          {
            productId: pastel.id,
            productSizeId: sizePequeno.id,
            ingredients: ["Frango"],
            sauces: [],
            quantity: 2,
          },
        ],
      },
    });
    expect(orderRes.status()).toBe(201);
    const order = await orderRes.json();
    expect(order.status).toBe("PEDIDO_FEITO");
    expect(order.clientName).toBe(clientName);
    expect(order.items).toHaveLength(1);
    expect(order.items[0].quantity).toBe(2);

    // === ETAPA 3: José cozinha avança status ===
    const joseCtx = await playwright.request.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    });
    const joseLogin = await joseCtx.post("/api/auth/login", {
      data: { name: "José", password: JOSE_PIN, role: "cozinha" },
    });
    expect(joseLogin.ok()).toBe(true);

    // PEDIDO_FEITO → EM_PREPARO
    const startRes = await joseCtx.patch(`/api/orders/${order.id}`, {
      data: { status: "EM_PREPARO", operator: "José" },
    });
    expect(startRes.ok()).toBe(true);
    expect((await startRes.json()).status).toBe("EM_PREPARO");

    // EM_PREPARO → PRONTO
    const readyRes = await joseCtx.patch(`/api/orders/${order.id}`, {
      data: { status: "PRONTO", operator: "José" },
    });
    expect(readyRes.ok()).toBe(true);
    expect((await readyRes.json()).status).toBe("PRONTO");

    // === ETAPA 4: Maria entrega + valida estado final ===
    const deliverRes = await mariaCtx.patch(`/api/orders/${order.id}`, {
      data: { status: "ENTREGUE", operator: "Maria" },
    });
    expect(deliverRes.ok()).toBe(true);
    const final = await deliverRes.json();
    expect(final.status).toBe("ENTREGUE");
    expect(final.clientName).toBe(clientName);
    expect(final.items[0].quantity).toBe(2);
    // (Não tem GET /api/orders/[id] único hoje — listagem é por scope/
    // eventSessionId. A response do PATCH final já reflete o estado.)

    // Cleanup
    await gilCtx.dispose();
    await mariaCtx.dispose();
    await joseCtx.dispose();
  });

  test("cozinha NÃO pode marcar como ENTREGUE", async ({ playwright }) => {
    // Regra: requireRole "atendente" pra transição ENTREGUE.
    // Cozinha tentar isso deve dar 403.
    const eventName = `E2E auth ${Date.now()}`;
    const clientName = `Auth E2E ${Date.now()}`;
    const ctx = await playwright.request.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    });

    // Setup como Gil + atendente
    await ctx.post("/api/auth/login", {
      data: { name: "Gil", password: GIL_PIN, role: "admin" },
    });
    await ctx.post("/api/events/open", {
      data: { operator: "Gil", name: eventName },
    });

    const mariaCtx = await playwright.request.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    });
    await mariaCtx.post("/api/auth/login", {
      data: { name: "Maria", password: MARIA_PIN, role: "atendente" },
    });
    const productsRes = await mariaCtx.get("/api/products");
    const products = (await productsRes.json()) as Array<{
      id: string;
      type: string;
      sizes: Array<{ id: string }>;
    }>;
    const pastel = products.find((p) => p.type === "salgado");
    if (!pastel) throw new Error("pastel não encontrado");
    const orderRes = await mariaCtx.post("/api/orders", {
      data: {
        clientName,
        operator: "Maria",
        items: [
          {
            productId: pastel.id,
            productSizeId: pastel.sizes[0].id,
            ingredients: ["Frango"],
            sauces: [],
            quantity: 1,
          },
        ],
      },
    });
    const order = await orderRes.json();

    // José cozinha tenta marcar ENTREGUE direto — deve falhar
    const joseCtx = await playwright.request.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    });
    await joseCtx.post("/api/auth/login", {
      data: { name: "José", password: JOSE_PIN, role: "cozinha" },
    });
    const badRes = await joseCtx.patch(`/api/orders/${order.id}`, {
      data: { status: "ENTREGUE", operator: "José" },
    });
    expect(badRes.status()).toBeGreaterThanOrEqual(400);
    expect(badRes.status()).toBeLessThan(500);

    await ctx.dispose();
    await mariaCtx.dispose();
    await joseCtx.dispose();
  });
});
