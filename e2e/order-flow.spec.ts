import { test, expect } from "@playwright/test";

/**
 * Fluxo completo de pedido: atendente cria → cozinha prepara → atendente entrega.
 * Testa a integração auth + orders + transições de status de ponta a ponta.
 *
 * Estratégia: API-only (usa `request`), sem browser UI.
 * Isso cobre SSE indiretamente (broadcast não quebra o handler) e valida
 * auth, schema e máquina de estados sem a fragilidade de seletores CSS.
 *
 * Setup: cria usuários de teste com PINs únicos (9991/9992) e abre caixa.
 * Teardown: fecha caixa e deleta usuários de teste.
 */

const GIL_PIN = "2699";
const TEST_ATENDENTE = { name: "E2EAtendente", role: "atendente", password: "9991" };
const TEST_COZINHA = { name: "E2ECozinha", role: "cozinha", password: "9992" };

type UserRef = { id: string; name: string };
type ProductWithSizes = { id: string; name: string; sizes: Array<{ id: string; name: string; priceCents: number }> };
type OrderItem = { id: number; quantity: number; productName: string };
type OrderRow = { id: number; status: string; clientName: string; items: OrderItem[]; totalCents: number; finalCents: number };

const state: {
  atendenteUser: UserRef | null;
  cozinhaUser: UserRef | null;
  eventOpen: boolean;
  orderId: number | null;
} = { atendenteUser: null, cozinhaUser: null, eventOpen: false, orderId: null };

test.describe("Fluxo completo de pedido", () => {
  test.beforeAll(async ({ request }) => {
    // Login Gil (admin)
    const login = await request.post("/api/auth/login", {
      data: { name: "Gil", password: GIL_PIN, role: "admin" },
    });
    expect(login.ok(), "Login Gil falhou").toBe(true);

    // Cria usuário atendente de teste (idempotente: ignora 409)
    const resA = await request.post("/api/users", { data: TEST_ATENDENTE });
    if (resA.status() === 201) {
      state.atendenteUser = (await resA.json()) as UserRef;
    } else {
      // Usuário já existe (rodou antes sem teardown) — busca o ID
      const list = await request.get("/api/users?role=atendente");
      const users = (await list.json()) as UserRef[];
      state.atendenteUser = users.find((u) => u.name === TEST_ATENDENTE.name) ?? null;
    }
    expect(state.atendenteUser, "Usuário atendente de teste não criado").not.toBeNull();

    // Cria usuário cozinha de teste
    const resC = await request.post("/api/users", { data: TEST_COZINHA });
    if (resC.status() === 201) {
      state.cozinhaUser = (await resC.json()) as UserRef;
    } else {
      const list = await request.get("/api/users?role=cozinha");
      const users = (await list.json()) as UserRef[];
      state.cozinhaUser = users.find((u) => u.name === TEST_COZINHA.name) ?? null;
    }
    expect(state.cozinhaUser, "Usuário cozinha de teste não criado").not.toBeNull();

    // Abre caixa (ou verifica se já está aberto)
    const open = await request.post("/api/events/open", {
      data: { operator: "Gil", name: "E2E Fluxo Pedido" },
    });
    if (open.status() === 201) {
      state.eventOpen = true;
    } else if (open.status() === 409) {
      // Já tinha caixa aberto — usa ele
      state.eventOpen = true;
    } else {
      throw new Error(`Falha ao abrir caixa: HTTP ${open.status()}`);
    }
  });

  test("cria pedido com 2 itens, cozinha prepara, atendente entrega", async ({ request }) => {
    // ── 1. Pegar produtos (público) ──────────────────────────────────────
    const productsRes = await request.get("/api/products");
    expect(productsRes.ok()).toBe(true);
    const products = (await productsRes.json()) as ProductWithSizes[];

    const salgado = products.find((p) => p.name === "Pastel Salgado");
    expect(salgado, "Produto 'Pastel Salgado' não encontrado (rode npm run db:seed)").toBeDefined();
    const salgadoGrande = salgado!.sizes.find((s) => s.name === "Grande");
    expect(salgadoGrande, "Size 'Grande' não encontrada em Pastel Salgado").toBeDefined();

    const doce = products.find((p) => p.name === "Pastel Doce");
    expect(doce, "Produto 'Pastel Doce' não encontrado (rode npm run db:seed)").toBeDefined();
    const doceNormal = doce!.sizes.find((s) => s.name === "Normal");
    expect(doceNormal, "Size 'Normal' não encontrada em Pastel Doce").toBeDefined();

    const expectedTotal = salgadoGrande!.priceCents + doceNormal!.priceCents; // 2000 + 1500 = 3500

    // ── 2. Login como atendente ──────────────────────────────────────────
    const loginA = await request.post("/api/auth/login", {
      data: { name: TEST_ATENDENTE.name, password: TEST_ATENDENTE.password, role: "atendente" },
    });
    expect(loginA.ok(), "Login atendente falhou").toBe(true);

    // ── 3. Criar pedido com 2 itens ──────────────────────────────────────
    const orderRes = await request.post("/api/orders", {
      data: {
        clientName: "E2E Cliente Teste",
        operator: TEST_ATENDENTE.name,
        items: [
          {
            productId: salgado!.id,
            productSizeId: salgadoGrande!.id,
            quantity: 1,
            ingredients: ["Frango"],
            sauces: [],
          },
          {
            productId: doce!.id,
            productSizeId: doceNormal!.id,
            quantity: 1,
            ingredients: [],
            sauces: [],
          },
        ],
      },
    });
    expect(orderRes.status(), "Criar pedido deve retornar 201").toBe(201);

    const order = (await orderRes.json()) as OrderRow;
    state.orderId = order.id;
    expect(order.status).toBe("PEDIDO_FEITO");
    expect(order.items).toHaveLength(2);
    expect(order.totalCents).toBe(expectedTotal);
    expect(order.finalCents).toBe(expectedTotal); // sem promoção

    // ── 4. Login como cozinha ─────────────────────────────────────────────
    const loginC = await request.post("/api/auth/login", {
      data: { name: TEST_COZINHA.name, password: TEST_COZINHA.password, role: "cozinha" },
    });
    expect(loginC.ok(), "Login cozinha falhou").toBe(true);

    // ── 5. Cozinha: PEDIDO_FEITO → EM_PREPARO ────────────────────────────
    const emPreparoRes = await request.patch(`/api/orders/${state.orderId}`, {
      data: { status: "EM_PREPARO", operator: TEST_COZINHA.name },
    });
    expect(emPreparoRes.ok(), "Transição pra EM_PREPARO falhou").toBe(true);
    expect((await emPreparoRes.json()).status).toBe("EM_PREPARO");

    // ── 6. Cozinha: EM_PREPARO → PRONTO ──────────────────────────────────
    const prontoRes = await request.patch(`/api/orders/${state.orderId}`, {
      data: { status: "PRONTO", operator: TEST_COZINHA.name },
    });
    expect(prontoRes.ok(), "Transição pra PRONTO falhou").toBe(true);
    expect((await prontoRes.json()).status).toBe("PRONTO");

    // ── 7. Login como atendente novamente ─────────────────────────────────
    const loginA2 = await request.post("/api/auth/login", {
      data: { name: TEST_ATENDENTE.name, password: TEST_ATENDENTE.password, role: "atendente" },
    });
    expect(loginA2.ok(), "Re-login atendente falhou").toBe(true);

    // ── 8. Atendente: PRONTO → ENTREGUE ──────────────────────────────────
    const entreguedRes = await request.patch(`/api/orders/${state.orderId}`, {
      data: { status: "ENTREGUE", operator: TEST_ATENDENTE.name },
    });
    expect(entreguedRes.ok(), "Transição pra ENTREGUE falhou").toBe(true);
    expect((await entreguedRes.json()).status).toBe("ENTREGUE");

    // ── 9. Valida row final via GET /api/orders (login admin) ─────────────
    await request.post("/api/auth/login", {
      data: { name: "Gil", password: GIL_PIN, role: "admin" },
    });
    const ordersRes = await request.get("/api/orders");
    expect(ordersRes.ok()).toBe(true);
    const orders = (await ordersRes.json()) as OrderRow[];
    const final = orders.find((o) => o.id === state.orderId);
    expect(final, "Pedido não encontrado na listagem final").toBeDefined();
    expect(final!.status).toBe("ENTREGUE");
    expect(final!.clientName).toBe("E2E Cliente Teste");
    expect(final!.items).toHaveLength(2);
    expect(final!.totalCents).toBe(expectedTotal);
  });

  test("transições inválidas são rejeitadas", async ({ request }) => {
    // ENTREGUE é estado terminal — tentar qualquer transição deve retornar 409
    if (!state.orderId) test.skip();

    await request.post("/api/auth/login", {
      data: { name: "Gil", password: GIL_PIN, role: "admin" },
    });
    const res = await request.patch(`/api/orders/${state.orderId}`, {
      data: { status: "PRONTO", operator: "Gil" },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("INVALID_TRANSITION");
  });

  test.afterAll(async ({ request }) => {
    // Relogar como Gil
    await request.post("/api/auth/login", {
      data: { name: "Gil", password: GIL_PIN, role: "admin" },
    });

    // Fecha caixa (se foi aberto por este teste — ignora erro se já fechado)
    if (state.eventOpen) {
      await request.post("/api/events/close", { data: { operator: "Gil" } });
    }

    // Deleta usuários de teste
    if (state.atendenteUser) {
      await request.delete(`/api/users/${state.atendenteUser.id}`);
    }
    if (state.cozinhaUser) {
      await request.delete(`/api/users/${state.cozinhaUser.id}`);
    }
  });
});
