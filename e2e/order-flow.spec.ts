import { test, expect } from "@playwright/test";

/**
 * Fluxo completo de pedido: atendente cria → cozinha prepara → atendente entrega.
 * Usa a API diretamente (sem UI) pra ser rápido e estável.
 *
 * Pré-requisito: servidor rodando em PLAYWRIGHT_BASE_URL (padrão: localhost:59574).
 *
 * Usuários de teste criados em beforeAll (idempotente — 409 = já existe).
 */

type ProductShape = {
  id: string;
  name: string;
  type: string;
  available: boolean;
  pricingMode: string;
  sizes: { id: string }[];
};

type OrderShape = {
  id: number;
  clientName: string;
  status: string;
  items: unknown[];
  preparedAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
};

const E2E_ATENDENTE = { name: "E2E-Atendente", role: "atendente", pin: "7531" };
const E2E_COZINHA = { name: "E2E-Cozinha", role: "cozinha", pin: "8642" };

test.describe("Fluxo completo de pedido", () => {
  test.beforeAll(async ({ request }) => {
    // Login Gil (admin) pra poder criar usuários e abrir caixa
    const login = await request.post("/api/auth/login", {
      data: { name: "Gil", password: "2699", role: "admin" },
    });
    expect(login.ok(), "login Gil (admin)").toBe(true);

    // Criar usuários de teste — aceita 409 se já existem de uma rodada anterior
    for (const u of [E2E_ATENDENTE, E2E_COZINHA]) {
      const res = await request.post("/api/users", {
        data: { name: u.name, role: u.role, password: u.pin },
      });
      expect(
        [201, 409],
        `criar usuário ${u.role} (${u.name})`,
      ).toContain(res.status());
    }

    // Abrir caixa — aceita 409 se já está aberto (ex: smoke test abriu antes)
    const open = await request.post("/api/events/open", {
      data: { operator: "Gil", name: "E2E order-flow" },
    });
    expect([201, 409], "abrir caixa").toContain(open.status());
  });

  test("atendente → cozinha (EM_PREPARO → PRONTO) → atendente (ENTREGUE)", async ({
    request,
  }) => {
    // ── 1. Login como atendente ──────────────────────────────────────────────
    const loginAtendente = await request.post("/api/auth/login", {
      data: { role: "atendente", password: E2E_ATENDENTE.pin },
    });
    expect(loginAtendente.ok(), "login atendente").toBe(true);

    // ── 2. Buscar produtos não-bebida (pedido de bebida pula cozinha) ────────
    const productsRes = await request.get("/api/products");
    expect(productsRes.ok(), "GET /api/products").toBe(true);
    const products: ProductShape[] = await productsRes.json();
    const nonBev = products.filter((p) => p.type !== "bebida" && p.available);
    expect(
      nonBev.length,
      "precisa de ≥ 2 produtos não-bebida disponíveis (Pastel Salgado + Pastel Doce ou Macarrão)",
    ).toBeGreaterThanOrEqual(2);

    // Monta payload de item: inclui productSizeId se pricingMode === "by_size"
    const buildItem = (p: ProductShape) => ({
      productId: p.id,
      ...(p.pricingMode === "by_size" && p.sizes[0]
        ? { productSizeId: p.sizes[0].id }
        : {}),
      quantity: 1,
    });

    // ── 3. Criar pedido com 2 itens ──────────────────────────────────────────
    // Timestamp no nome evita hit do duplicate-detection (90s window)
    const clientName = `E2E-${Date.now()}`;
    const orderRes = await request.post("/api/orders", {
      data: {
        clientName,
        items: [buildItem(nonBev[0]), buildItem(nonBev[1])],
      },
    });
    expect(orderRes.status(), "POST /api/orders").toBe(201);
    const order: OrderShape = await orderRes.json();
    expect(order.clientName).toBe(clientName);
    expect(order.items).toHaveLength(2);
    expect(order.status).toBe("PEDIDO_FEITO");
    const orderId = order.id;

    // ── 4. Login como cozinha ────────────────────────────────────────────────
    const loginCozinha = await request.post("/api/auth/login", {
      data: { role: "cozinha", password: E2E_COZINHA.pin },
    });
    expect(loginCozinha.ok(), "login cozinha").toBe(true);

    // ── 5. PEDIDO_FEITO → EM_PREPARO ────────────────────────────────────────
    const emPreparoRes = await request.patch(`/api/orders/${orderId}`, {
      data: { status: "EM_PREPARO" },
    });
    expect(emPreparoRes.ok(), "→ EM_PREPARO").toBe(true);
    const emPreparo: OrderShape = await emPreparoRes.json();
    expect(emPreparo.status).toBe("EM_PREPARO");
    expect(emPreparo.preparedAt).toBeTruthy();

    // ── 6. EM_PREPARO → PRONTO ───────────────────────────────────────────────
    const prontoRes = await request.patch(`/api/orders/${orderId}`, {
      data: { status: "PRONTO" },
    });
    expect(prontoRes.ok(), "→ PRONTO").toBe(true);
    const pronto: OrderShape = await prontoRes.json();
    expect(pronto.status).toBe("PRONTO");
    expect(pronto.readyAt).toBeTruthy();

    // ── 7. Trocar de volta pra atendente ────────────────────────────────────
    const loginAtendente2 = await request.post("/api/auth/login", {
      data: { role: "atendente", password: E2E_ATENDENTE.pin },
    });
    expect(loginAtendente2.ok(), "login atendente (volta)").toBe(true);

    // ── 8. PRONTO → ENTREGUE ─────────────────────────────────────────────────
    const entregueRes = await request.patch(`/api/orders/${orderId}`, {
      data: { status: "ENTREGUE" },
    });
    expect(entregueRes.ok(), "→ ENTREGUE").toBe(true);
    const entregue: OrderShape = await entregueRes.json();
    expect(entregue.status).toBe("ENTREGUE");
    expect(entregue.deliveredAt).toBeTruthy();

    // ── 9. Validar row final via GET /api/orders ─────────────────────────────
    const allOrdersRes = await request.get("/api/orders?scope=today");
    expect(allOrdersRes.ok(), "GET /api/orders").toBe(true);
    const allOrders: OrderShape[] = await allOrdersRes.json();
    const finalOrder = allOrders.find((o) => o.id === orderId);
    expect(finalOrder, `pedido #${orderId} na lista de hoje`).toBeDefined();
    expect(finalOrder!.status).toBe("ENTREGUE");
    expect(finalOrder!.items).toHaveLength(2);
    expect(finalOrder!.preparedAt).toBeTruthy();
    expect(finalOrder!.readyAt).toBeTruthy();
    expect(finalOrder!.deliveredAt).toBeTruthy();
  });
});
