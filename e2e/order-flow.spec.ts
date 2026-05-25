import { test, expect, type APIRequestContext } from "@playwright/test";

const GIL_PASSWORD = "2699";
const TEAM_PASSWORD = "1234";

/**
 * Cria Maria (atendente) e José (cozinha) se ainda não existirem.
 * 409 = já existe — seguro ignorar (idempotente).
 * Assume que request já tem sessão de Gil (admin).
 */
async function ensureTestUsers(request: APIRequestContext) {
  await request.post("/api/users", {
    data: { name: "Maria", role: "atendente", password: TEAM_PASSWORD },
  });
  await request.post("/api/users", {
    data: { name: "José", role: "cozinha", password: TEAM_PASSWORD },
  });
}

/**
 * Retorna o produto salgado e seu tamanho "Grande" do catálogo.
 * Pedidos com pastel salgado iniciam em PEDIDO_FEITO (precisam de cozinha).
 * Pedidos 100% bebida pulam a cozinha e iniciam em PRONTO — por isso os
 * testes de máquina de estado usam pastel, não bebida.
 */
async function getSalgadoGrande(request: APIRequestContext) {
  const res = await request.get("/api/products");
  const products = await res.json();
  const salgado = products.find((p: { type: string }) => p.type === "salgado");
  const tamanhoGrande = salgado?.sizes?.find((s: { name: string }) => s.name === "Grande");
  return { salgado, tamanhoGrande };
}

/**
 * Fluxo completo de pedido via API:
 *   Gil (admin) abre caixa
 *   → Maria (atendente) cria pedido com 2 itens (pastel salgado + bebida)
 *   → José (cozinha) marca EM_PREPARO → PRONTO
 *   → Maria entrega → valida row final no DB
 *
 * Captura regressões em auth, session, schema e transições de status
 * antes de chegar em produção na barraca.
 *
 * Nota: pedidos 100% bebida iniciam em PRONTO (bypass de cozinha).
 * Os testes de máquina de estado usam pastel (que inicia em PEDIDO_FEITO).
 */
test.describe("Fluxo completo de pedido", () => {
  test("atendente cria pedido, cozinha prepara e finaliza, atendente entrega", async ({
    request,
  }) => {
    // --- Setup: Gil abre o caixa e garante usuários de teste ---
    const loginGil = await request.post("/api/auth/login", {
      data: { name: "Gil", password: GIL_PASSWORD, role: "admin" },
    });
    expect(loginGil.ok()).toBe(true);

    await ensureTestUsers(request);

    const caixaRes = await request.post("/api/events/open", {
      data: { operator: "Gil", name: "E2E Fluxo Completo" },
    });
    // 201 = caixa criado; 409 = já havia um caixa aberto (ambos aceitáveis)
    expect([201, 409]).toContain(caixaRes.status());

    // --- Busca produtos pra montar o pedido ---
    const prodsRes = await request.get("/api/products");
    expect(prodsRes.ok()).toBe(true);
    const products = await prodsRes.json();

    const salgado = products.find((p: { type: string }) => p.type === "salgado");
    expect(salgado).toBeDefined();
    const tamanhoGrande = salgado.sizes.find((s: { name: string }) => s.name === "Grande");
    expect(tamanhoGrande).toBeDefined();

    // Bebida express como segundo item (mix pastel+bebida ainda passa pela cozinha)
    const bebida = products.find(
      (p: { type: string; pricingMode: string }) =>
        p.type === "bebida" && p.pricingMode === "fixed",
    );
    expect(bebida).toBeDefined();

    // --- Maria (atendente) cria pedido com 2 itens ---
    const loginMaria = await request.post("/api/auth/login", {
      data: { name: "Maria", password: TEAM_PASSWORD, role: "atendente" },
    });
    expect(loginMaria.ok()).toBe(true);

    const orderRes = await request.post("/api/orders", {
      data: {
        clientName: "E2E Cliente",
        items: [
          {
            productId: salgado.id,
            productSizeId: tamanhoGrande.id,
            ingredients: ["Frango"],
            quantity: 1,
          },
          {
            productId: bebida.id,
            quantity: 1,
          },
        ],
        operator: "Maria",
      },
    });
    expect(orderRes.status()).toBe(201);
    const order = await orderRes.json();
    expect(order.clientName).toBe("E2E Cliente");
    expect(order.items).toHaveLength(2);
    expect(order.status).toBe("PEDIDO_FEITO");
    expect(order.totalCents).toBeGreaterThan(0);

    // --- José (cozinha) inicia preparo ---
    const loginJose = await request.post("/api/auth/login", {
      data: { name: "José", password: TEAM_PASSWORD, role: "cozinha" },
    });
    expect(loginJose.ok()).toBe(true);

    const prepRes = await request.patch(`/api/orders/${order.id}`, {
      data: { status: "EM_PREPARO", operator: "José" },
    });
    expect(prepRes.ok()).toBe(true);
    const prepOrder = await prepRes.json();
    expect(prepOrder.status).toBe("EM_PREPARO");
    expect(prepOrder.preparedBy).toBe("José");
    expect(prepOrder.preparedAt).toBeTruthy();

    // --- José finaliza o preparo ---
    const readyRes = await request.patch(`/api/orders/${order.id}`, {
      data: { status: "PRONTO", operator: "José" },
    });
    expect(readyRes.ok()).toBe(true);
    const readyOrder = await readyRes.json();
    expect(readyOrder.status).toBe("PRONTO");
    expect(readyOrder.readyBy).toBe("José");
    expect(readyOrder.readyAt).toBeTruthy();

    // --- Maria (atendente) entrega o pedido ---
    await request.post("/api/auth/login", {
      data: { name: "Maria", password: TEAM_PASSWORD, role: "atendente" },
    });

    const deliverRes = await request.patch(`/api/orders/${order.id}`, {
      data: { status: "ENTREGUE", operator: "Maria" },
    });
    expect(deliverRes.ok()).toBe(true);
    const delivered = await deliverRes.json();
    expect(delivered.status).toBe("ENTREGUE");
    expect(delivered.deliveredBy).toBe("Maria");
    expect(delivered.deliveredAt).toBeTruthy();

    // --- Valida row final via GET (confirma persistência no DB) ---
    const ordersRes = await request.get("/api/orders");
    expect(ordersRes.ok()).toBe(true);
    const allOrders = await ordersRes.json();
    const finalOrder = allOrders.find((o: { id: number }) => o.id === order.id);
    expect(finalOrder).toBeDefined();
    expect(finalOrder.status).toBe("ENTREGUE");
    expect(finalOrder.deliveredAt).toBeTruthy();
  });

  test("transição inválida PEDIDO_FEITO → PRONTO retorna 409 INVALID_TRANSITION", async ({
    request,
  }) => {
    const loginGil = await request.post("/api/auth/login", {
      data: { name: "Gil", password: GIL_PASSWORD, role: "admin" },
    });
    expect(loginGil.ok()).toBe(true);

    await ensureTestUsers(request);

    // Garante caixa aberto (pode já estar)
    await request.post("/api/events/open", {
      data: { operator: "Gil", name: "E2E Transições" },
    });

    // Usa pastel salgado: inicia em PEDIDO_FEITO (bebidas iniciam em PRONTO)
    const { salgado, tamanhoGrande } = await getSalgadoGrande(request);
    expect(salgado).toBeDefined();
    expect(tamanhoGrande).toBeDefined();

    const loginMaria = await request.post("/api/auth/login", {
      data: { name: "Maria", password: TEAM_PASSWORD, role: "atendente" },
    });
    expect(loginMaria.ok()).toBe(true);

    const orderRes = await request.post("/api/orders", {
      data: {
        clientName: "E2E Transição",
        items: [
          {
            productId: salgado.id,
            productSizeId: tamanhoGrande.id,
            ingredients: ["Frango"],
            quantity: 1,
          },
        ],
        operator: "Maria",
      },
    });
    expect(orderRes.status()).toBe(201);
    const order = await orderRes.json();
    expect(order.status).toBe("PEDIDO_FEITO");

    // Tenta pular EM_PREPARO e ir direto pra PRONTO — deve falhar
    const invalidRes = await request.patch(`/api/orders/${order.id}`, {
      data: { status: "PRONTO", operator: "Maria" },
    });
    expect(invalidRes.status()).toBe(409);
    const err = await invalidRes.json();
    expect(err.code).toBe("INVALID_TRANSITION");
    expect(err.currentStatus).toBe("PEDIDO_FEITO");
    expect(err.attemptedStatus).toBe("PRONTO");
  });

  test("atendente não pode cancelar pedido que já está EM_PREPARO", async ({
    request,
  }) => {
    const loginGil = await request.post("/api/auth/login", {
      data: { name: "Gil", password: GIL_PASSWORD, role: "admin" },
    });
    expect(loginGil.ok()).toBe(true);

    await ensureTestUsers(request);

    await request.post("/api/events/open", {
      data: { operator: "Gil", name: "E2E Cancel Guard" },
    });

    // Usa pastel salgado para que o pedido inicie em PEDIDO_FEITO
    const { salgado, tamanhoGrande } = await getSalgadoGrande(request);
    expect(salgado).toBeDefined();
    expect(tamanhoGrande).toBeDefined();

    // Maria cria pedido
    await request.post("/api/auth/login", {
      data: { name: "Maria", password: TEAM_PASSWORD, role: "atendente" },
    });
    const orderRes = await request.post("/api/orders", {
      data: {
        clientName: "E2E Cancel Guard",
        items: [
          {
            productId: salgado.id,
            productSizeId: tamanhoGrande.id,
            ingredients: ["Frango"],
            quantity: 1,
          },
        ],
        operator: "Maria",
      },
    });
    expect(orderRes.status()).toBe(201);
    const order = await orderRes.json();
    expect(order.status).toBe("PEDIDO_FEITO");

    // José move pra EM_PREPARO (PEDIDO_FEITO → EM_PREPARO é válido)
    await request.post("/api/auth/login", {
      data: { name: "José", password: TEAM_PASSWORD, role: "cozinha" },
    });
    const prepRes = await request.patch(`/api/orders/${order.id}`, {
      data: { status: "EM_PREPARO", operator: "José" },
    });
    expect(prepRes.ok()).toBe(true);

    // Maria tenta cancelar em EM_PREPARO — deve ser barrada (403)
    await request.post("/api/auth/login", {
      data: { name: "Maria", password: TEAM_PASSWORD, role: "atendente" },
    });
    const cancelRes = await request.patch(`/api/orders/${order.id}`, {
      data: { status: "CANCELADO", operator: "Maria" },
    });
    expect(cancelRes.status()).toBe(403);
  });
});
