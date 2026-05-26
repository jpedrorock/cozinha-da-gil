import { test, expect } from "@playwright/test";

/**
 * Fluxo completo de pedido — golden path + edge cases críticos.
 *
 * Testa a integração ponta-a-ponta: auth → caixa → criação → transições de
 * status (cozinha) → entrega (atendente) → validação da row final.
 *
 * Usuários de teste (PINs fora do range real da barraca):
 *   E2E Atendente  PIN 7001  role: atendente
 *   E2E Cozinha    PIN 7002  role: cozinha
 *
 * Pré-condição: servidor rodando (PLAYWRIGHT_BASE_URL ou localhost:59574).
 * Idempotente: usuários criados com 409-allow; caixa com 201/409-allow.
 */

test.describe("Fluxo completo de pedido", () => {
  // Garante usuários de teste no banco antes de rodar os specs.
  // Usa Gil (admin) que sempre existe pelo seed.
  test.beforeAll(async ({ request }) => {
    const login = await request.post("/api/auth/login", {
      data: { name: "Gil", password: "2699", role: "admin" },
    });
    expect(login.ok()).toBe(true);

    // Cria atendente de teste — ignora 409 se já existe
    const atendenteRes = await request.post("/api/users", {
      data: { name: "E2E Atendente", role: "atendente", password: "7001" },
    });
    expect([201, 409]).toContain(atendenteRes.status());

    // Cria cozinha de teste — ignora 409 se já existe
    const cozinhaRes = await request.post("/api/users", {
      data: { name: "E2E Cozinha", role: "cozinha", password: "7002" },
    });
    expect([201, 409]).toContain(cozinhaRes.status());
  });

  test("atendente cria pedido com 2 itens → cozinha prepara → atendente entrega", async ({
    request,
  }) => {
    // ── 1. Login como Gil (admin) para abrir caixa ──────────────────────────
    const loginGil = await request.post("/api/auth/login", {
      data: { name: "Gil", password: "2699", role: "admin" },
    });
    expect(loginGil.ok()).toBe(true);

    // ── 2. Abrir caixa (ou reusar aberto — 201 ou 409 ambos ok) ─────────────
    const openCaixa = await request.post("/api/events/open", {
      data: { operator: "Gil", name: "E2E order-flow" },
    });
    expect([201, 409]).toContain(openCaixa.status());

    // ── 3. Buscar produtos disponíveis ───────────────────────────────────────
    const productsRes = await request.get("/api/products?available=true");
    expect(productsRes.ok()).toBe(true);
    const products = await productsRes.json();

    const pastelSalgado = products.find(
      (p: { name: string }) => p.name === "Pastel Salgado",
    );
    expect(pastelSalgado).toBeDefined();
    const sizeGrande = pastelSalgado.sizes.find(
      (s: { name: string }) => s.name === "Grande",
    );
    expect(sizeGrande).toBeDefined();

    const pastelDoce = products.find(
      (p: { name: string }) => p.name === "Pastel Doce",
    );
    expect(pastelDoce).toBeDefined();
    const sizeNormal = pastelDoce.sizes.find(
      (s: { name: string }) => s.name === "Normal",
    );
    expect(sizeNormal).toBeDefined();

    // ── 4. Login como Atendente ──────────────────────────────────────────────
    const loginAtendente = await request.post("/api/auth/login", {
      data: { name: "E2E Atendente", password: "7001", role: "atendente" },
    });
    expect(loginAtendente.ok()).toBe(true);

    // ── 5. Criar pedido com 2 itens ──────────────────────────────────────────
    const orderRes = await request.post("/api/orders", {
      data: {
        clientName: "Cliente E2E",
        operator: "E2E Atendente",
        items: [
          {
            productId: pastelSalgado.id,
            productSizeId: sizeGrande.id,
            ingredients: ["Frango", "Queijo"],
          },
          {
            productId: pastelDoce.id,
            productSizeId: sizeNormal.id,
            ingredients: ["Banana com chocolate"],
          },
        ],
      },
    });
    expect(orderRes.status()).toBe(201);
    const order = await orderRes.json();
    expect(order.clientName).toBe("Cliente E2E");
    expect(order.items).toHaveLength(2);
    expect(order.status).toBe("PEDIDO_FEITO");
    // Pedido com pastel deve entrar em PEDIDO_FEITO (não vai direto pra PRONTO)
    expect(order.totalCents).toBeGreaterThan(0);
    expect(order.finalCents).toBe(order.totalCents); // sem promoção

    const orderId: number = order.id;

    // ── 6. Login como Cozinha ────────────────────────────────────────────────
    const loginCozinha = await request.post("/api/auth/login", {
      data: { name: "E2E Cozinha", password: "7002", role: "cozinha" },
    });
    expect(loginCozinha.ok()).toBe(true);

    // ── 7. Cozinha: PEDIDO_FEITO → EM_PREPARO ───────────────────────────────
    const prepRes = await request.patch(`/api/orders/${orderId}`, {
      data: { status: "EM_PREPARO", operator: "E2E Cozinha" },
    });
    expect(prepRes.ok()).toBe(true);
    const prepOrder = await prepRes.json();
    expect(prepOrder.status).toBe("EM_PREPARO");
    expect(prepOrder.preparedBy).toBe("E2E Cozinha");
    expect(prepOrder.preparedAt).toBeTruthy();

    // ── 8. Cozinha: EM_PREPARO → PRONTO ─────────────────────────────────────
    const prontoRes = await request.patch(`/api/orders/${orderId}`, {
      data: { status: "PRONTO", operator: "E2E Cozinha" },
    });
    expect(prontoRes.ok()).toBe(true);
    const prontoOrder = await prontoRes.json();
    expect(prontoOrder.status).toBe("PRONTO");
    expect(prontoOrder.readyBy).toBe("E2E Cozinha");
    expect(prontoOrder.readyAt).toBeTruthy();

    // ── 9. Login como Atendente novamente ────────────────────────────────────
    const loginAtendente2 = await request.post("/api/auth/login", {
      data: { name: "E2E Atendente", password: "7001", role: "atendente" },
    });
    expect(loginAtendente2.ok()).toBe(true);

    // ── 10. Atendente: PRONTO → ENTREGUE ─────────────────────────────────────
    const entregueRes = await request.patch(`/api/orders/${orderId}`, {
      data: { status: "ENTREGUE", operator: "E2E Atendente" },
    });
    expect(entregueRes.ok()).toBe(true);
    const entregueOrder = await entregueRes.json();
    expect(entregueOrder.status).toBe("ENTREGUE");
    expect(entregueOrder.deliveredBy).toBe("E2E Atendente");
    expect(entregueOrder.deliveredAt).toBeTruthy();

    // ── 11. Valida row final via GET lista ────────────────────────────────────
    // Loga como Gil pra ter sessão válida no GET (atendente session expira com re-login)
    await request.post("/api/auth/login", {
      data: { name: "Gil", password: "2699", role: "admin" },
    });
    const ordersRes = await request.get("/api/orders?scope=today");
    expect(ordersRes.ok()).toBe(true);
    const orders = await ordersRes.json();

    const finalOrder = orders.find((o: { id: number }) => o.id === orderId);
    expect(finalOrder).toBeDefined();
    expect(finalOrder.status).toBe("ENTREGUE");
    expect(finalOrder.items).toHaveLength(2);
    expect(finalOrder.preparedBy).toBe("E2E Cozinha");
    expect(finalOrder.readyBy).toBe("E2E Cozinha");
    expect(finalOrder.deliveredBy).toBe("E2E Atendente");
    // Timestamps de ciclo completo todos preenchidos
    expect(finalOrder.preparedAt).toBeTruthy();
    expect(finalOrder.readyAt).toBeTruthy();
    expect(finalOrder.deliveredAt).toBeTruthy();
  });

  test("pedido só de bebida vai direto pra PRONTO sem passar pela cozinha", async ({
    request,
  }) => {
    // Login como Gil (admin tem permissão pra criar pedidos)
    const login = await request.post("/api/auth/login", {
      data: { name: "Gil", password: "2699", role: "admin" },
    });
    expect(login.ok()).toBe(true);

    // Garante caixa aberto
    await request.post("/api/events/open", {
      data: { operator: "Gil", name: "E2E beverage" },
    });

    const productsRes = await request.get("/api/products?type=bebida");
    expect(productsRes.ok()).toBe(true);
    const products = await productsRes.json();
    const coca = products.find((p: { name: string }) => p.name === "Coca-Cola Lata");
    expect(coca).toBeDefined();

    const orderRes = await request.post("/api/orders", {
      data: {
        clientName: "Cliente Bebida E2E",
        operator: "Gil",
        items: [{ productId: coca.id, quantity: 2 }],
      },
    });
    expect(orderRes.status()).toBe(201);
    const order = await orderRes.json();
    // Bebida bypass: vai direto pra PRONTO (atendente entrega no balcão)
    expect(order.status).toBe("PRONTO");
    expect(order.items[0].quantity).toBe(2);
    // Preço: 2 × R$6,00 = R$12,00
    expect(order.totalCents).toBe(1200);
    expect(order.finalCents).toBe(1200);
  });

  test("transição inválida retorna 409 com code INVALID_TRANSITION", async ({
    request,
  }) => {
    const login = await request.post("/api/auth/login", {
      data: { name: "Gil", password: "2699", role: "admin" },
    });
    expect(login.ok()).toBe(true);

    await request.post("/api/events/open", {
      data: { operator: "Gil", name: "E2E invalid-transition" },
    });

    // Cria pedido de pastel (fica em PEDIDO_FEITO)
    const productsRes = await request.get("/api/products?type=salgado");
    expect(productsRes.ok()).toBe(true);
    const products = await productsRes.json();
    const pastel = products.find((p: { name: string }) => p.name === "Pastel Salgado");
    expect(pastel).toBeDefined();
    const sizeGrande = pastel.sizes.find((s: { name: string }) => s.name === "Grande");
    expect(sizeGrande).toBeDefined();

    const orderRes = await request.post("/api/orders", {
      data: {
        clientName: "Cliente Transição E2E",
        operator: "Gil",
        items: [
          {
            productId: pastel.id,
            productSizeId: sizeGrande.id,
            ingredients: ["Carne"],
          },
        ],
      },
    });
    expect(orderRes.status()).toBe(201);
    const order = await orderRes.json();
    expect(order.status).toBe("PEDIDO_FEITO");

    // Tentar pular direto PEDIDO_FEITO → ENTREGUE (inválido)
    const invalidRes = await request.patch(`/api/orders/${order.id}`, {
      data: { status: "ENTREGUE", operator: "Gil" },
    });
    expect(invalidRes.status()).toBe(409);
    const errBody = await invalidRes.json();
    expect(errBody.code).toBe("INVALID_TRANSITION");
    expect(errBody.currentStatus).toBe("PEDIDO_FEITO");
    expect(errBody.attemptedStatus).toBe("ENTREGUE");
  });

  test("pedido terminal (ENTREGUE) não aceita mais transições", async ({
    request,
  }) => {
    const login = await request.post("/api/auth/login", {
      data: { name: "Gil", password: "2699", role: "admin" },
    });
    expect(login.ok()).toBe(true);

    await request.post("/api/events/open", {
      data: { operator: "Gil", name: "E2E terminal" },
    });

    // Cria e leva pedido até ENTREGUE
    const productsRes = await request.get("/api/products?type=salgado");
    const products = await productsRes.json();
    const pastel = products.find((p: { name: string }) => p.name === "Pastel Salgado");
    const sizeGrande = pastel.sizes.find((s: { name: string }) => s.name === "Grande");

    const orderRes = await request.post("/api/orders", {
      data: {
        clientName: "Cliente Terminal E2E",
        operator: "Gil",
        items: [
          {
            productId: pastel.id,
            productSizeId: sizeGrande.id,
            ingredients: ["Calabresa"],
          },
        ],
      },
    });
    const order = await orderRes.json();
    const orderId: number = order.id;

    await request.patch(`/api/orders/${orderId}`, {
      data: { status: "EM_PREPARO", operator: "Gil" },
    });
    await request.patch(`/api/orders/${orderId}`, {
      data: { status: "PRONTO", operator: "Gil" },
    });
    await request.patch(`/api/orders/${orderId}`, {
      data: { status: "ENTREGUE", operator: "Gil" },
    });

    // Tentar mover pedido já ENTREGUE para qualquer outro status
    const revertRes = await request.patch(`/api/orders/${orderId}`, {
      data: { status: "PRONTO", operator: "Gil" },
    });
    expect(revertRes.status()).toBe(409);
    const errBody = await revertRes.json();
    expect(errBody.code).toBe("INVALID_TRANSITION");
    expect(errBody.currentStatus).toBe("ENTREGUE");
  });
});
