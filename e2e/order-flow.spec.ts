import { test, expect, type APIRequestContext } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:59574";

/**
 * Fluxo completo de pedido: atendente cria → cozinha prepara → atendente entrega.
 * Usa contextos de request isolados por papel pra simular sessões concorrentes
 * sem compartilhar cookies entre Admin/Atendente/Cozinha.
 */
test.describe("Fluxo completo de pedido", () => {
  let adminCtx: APIRequestContext;
  let atendenteCtx: APIRequestContext;
  let cozinhaCtx: APIRequestContext;

  test.beforeAll(async ({ playwright }) => {
    adminCtx = await playwright.request.newContext({ baseURL: BASE });
    atendenteCtx = await playwright.request.newContext({ baseURL: BASE });
    cozinhaCtx = await playwright.request.newContext({ baseURL: BASE });
  });

  test.afterAll(async () => {
    await adminCtx?.dispose();
    await atendenteCtx?.dispose();
    await cozinhaCtx?.dispose();
  });

  test("atendente cria pedido com 2 itens, cozinha prepara e entrega", async () => {
    // 1. Login admin (Gil)
    const loginGil = await adminCtx.post("/api/auth/login", {
      data: { name: "Gil", password: "2699", role: "admin" },
    });
    expect(loginGil.ok()).toBe(true);

    // 2. Abrir caixa (201 = novo; 409 = já aberto — ambos OK pro fluxo)
    const open = await adminCtx.post("/api/events/open", {
      data: { operator: "Gil", name: "E2E Fluxo Completo" },
    });
    expect([201, 409]).toContain(open.status());

    // 3. Criar usuários de teste (409 = já existe de run anterior — OK)
    await adminCtx.post("/api/users", {
      data: { name: "E2EAtendente", role: "atendente", password: "7777" },
    });
    await adminCtx.post("/api/users", {
      data: { name: "E2ECozinha", role: "cozinha", password: "8888" },
    });

    // 4. Login atendente
    const loginAtend = await atendenteCtx.post("/api/auth/login", {
      data: { name: "E2EAtendente", password: "7777", role: "atendente" },
    });
    expect(loginAtend.ok()).toBe(true);

    // 5. Login cozinha
    const loginCoz = await cozinhaCtx.post("/api/auth/login", {
      data: { name: "E2ECozinha", password: "8888", role: "cozinha" },
    });
    expect(loginCoz.ok()).toBe(true);

    // 6. Buscar produtos disponíveis
    const productsRes = await atendenteCtx.get("/api/products");
    expect(productsRes.ok()).toBe(true);
    const products: Array<{
      id: string;
      type: string;
      available: boolean;
      sizes: Array<{ id: string; name: string }>;
    }> = await productsRes.json();

    const salgado = products.find((p) => p.type === "salgado" && p.available);
    expect(salgado, "Pastel Salgado deve estar disponível (seed)").toBeDefined();
    const grandeSize = salgado!.sizes.find((s) => s.name === "Grande");
    expect(grandeSize, "Tamanho Grande deve existir no Pastel Salgado").toBeDefined();

    const bebida = products.find((p) => p.type === "bebida" && p.available);
    expect(bebida, "Pelo menos 1 bebida deve estar disponível (seed)").toBeDefined();

    // 7. Buscar ingredientes para pastel salgado (mínimo 1 topping obrigatório)
    // /api/ingredients retorna { topping: [...], doce: [...], molho: [...], ... }
    const ingsRes = await atendenteCtx.get("/api/ingredients");
    expect(ingsRes.ok()).toBe(true);
    const ingsByCategory: Record<
      string,
      Array<{ name: string; category: string; available: boolean }>
    > = await ingsRes.json();
    const topping = (ingsByCategory.topping ?? []).find((i) => i.available);
    expect(topping, "Pelo menos 1 topping disponível (seed)").toBeDefined();

    // 8. Atendente cria pedido com 2 itens: 1 pastel salgado + 1 bebida
    const orderRes = await atendenteCtx.post("/api/orders", {
      data: {
        clientName: "E2ECliente",
        operator: "E2EAtendente",
        items: [
          {
            productId: salgado!.id,
            productSizeId: grandeSize!.id,
            ingredients: [topping!.name],
            quantity: 1,
          },
          {
            productId: bebida!.id,
            quantity: 1,
          },
        ],
      },
    });
    expect(orderRes.status()).toBe(201);
    const order: {
      id: number;
      status: string;
      clientName: string;
      items: unknown[];
    } = await orderRes.json();
    expect(order.status).toBe("PEDIDO_FEITO");
    expect(order.clientName).toBe("E2ECliente");
    expect(order.items).toHaveLength(2);

    // 9. Cozinha: PEDIDO_FEITO → EM_PREPARO
    const prepRes = await cozinhaCtx.patch(`/api/orders/${order.id}`, {
      data: { status: "EM_PREPARO", operator: "E2ECozinha" },
    });
    expect(prepRes.ok()).toBe(true);
    const preparing = await prepRes.json();
    expect(preparing.status).toBe("EM_PREPARO");

    // 10. Cozinha: EM_PREPARO → PRONTO
    const readyRes = await cozinhaCtx.patch(`/api/orders/${order.id}`, {
      data: { status: "PRONTO", operator: "E2ECozinha" },
    });
    expect(readyRes.ok()).toBe(true);
    const ready = await readyRes.json();
    expect(ready.status).toBe("PRONTO");

    // 11. Atendente: PRONTO → ENTREGUE
    const deliverRes = await atendenteCtx.patch(`/api/orders/${order.id}`, {
      data: { status: "ENTREGUE", operator: "E2EAtendente" },
    });
    expect(deliverRes.ok()).toBe(true);
    const delivered = await deliverRes.json();

    // Valida row final
    expect(delivered.status).toBe("ENTREGUE");
    expect(delivered.clientName).toBe("E2ECliente");
    expect(delivered.items).toHaveLength(2);
  });
});
