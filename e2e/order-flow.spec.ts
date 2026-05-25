import { test, expect } from "@playwright/test";

/**
 * Fluxo completo de 1 pedido via API:
 *   Admin abre caixa → Atendente cria pedido → Cozinha prepara/finaliza
 *   → Atendente marca entregue → Valida DB final.
 *
 * Usa request API (HTTP) — mais confiável que UI automation pra testar a
 * máquina de estados do pedido. Auth.spec.ts cobre a UI de login.
 */

// Pins exclusivos pra usuários de e2e — não conflitam com seed de dev.
const ATENDENTE_PIN = "7741";
const COZINHA_PIN = "7742";

// Estado compartilhado entre testes no mesmo describe
let orderId: number;

test.describe("Fluxo completo de pedido (API)", () => {
  // Prepara usuários de teste e garante caixa aberto.
  // Re-login é necessário em cada test — cada fixture `request` tem
  // seu próprio cookie jar isolado.
  async function adminSetup(request: Parameters<Parameters<typeof test>[1]>[0]["request"]) {
    const login = await request.post("/api/auth/login", {
      data: { password: "2699", role: "admin" },
    });
    expect(login.ok()).toBe(true);

    // Usuários idempotentes — 409 (já existe) é OK
    await request.post("/api/users", {
      data: { name: "E2E Atendente", role: "atendente", password: ATENDENTE_PIN },
    });
    await request.post("/api/users", {
      data: { name: "E2E Cozinha", role: "cozinha", password: COZINHA_PIN },
    });

    // Abre caixa — 409 (já aberto) é OK
    const openRes = await request.post("/api/events/open", {
      data: { operator: "Gil", name: "E2E order-flow" },
    });
    expect([201, 409]).toContain(openRes.status());
  }

  test("pedido completo: PEDIDO_FEITO → EM_PREPARO → PRONTO → ENTREGUE", async ({
    request,
  }) => {
    // --- Admin: setup ---
    await adminSetup(request);

    // Busca Pastel Salgado (com sizes) e um ingrediente pra montar o item
    const productsRes = await request.get("/api/products?type=salgado");
    expect(productsRes.ok()).toBe(true);
    const products: Array<{
      id: string;
      name: string;
      pricingMode: string;
      sizes: Array<{ id: string; name: string }>;
    }> = await productsRes.json();

    const pastel = products.find((p) => p.name === "Pastel Salgado");
    expect(pastel).toBeDefined();
    const grandeSize = pastel!.sizes.find((s) => s.name === "Grande");
    const pequenoSize = pastel!.sizes.find((s) => s.name === "Pequeno");
    expect(grandeSize).toBeDefined();
    expect(pequenoSize).toBeDefined();

    const ingredientsRes = await request.get("/api/ingredients");
    expect(ingredientsRes.ok()).toBe(true);
    const ingredientsByCategory: Record<string, Array<{ name: string }>> =
      await ingredientsRes.json();
    const toppings = ingredientsByCategory["topping"] ?? [];
    expect(toppings.length).toBeGreaterThan(0);
    const firstTopping = toppings[0].name;

    // --- Atendente: cria pedido com 2 itens ---
    const loginAtendente = await request.post("/api/auth/login", {
      data: { password: ATENDENTE_PIN, role: "atendente" },
    });
    expect(loginAtendente.ok()).toBe(true);

    const orderRes = await request.post("/api/orders", {
      data: {
        clientName: "E2E Cliente Flow",
        operator: "E2E Atendente",
        items: [
          {
            productId: pastel!.id,
            productSizeId: grandeSize!.id,
            ingredients: [firstTopping],
            quantity: 1,
          },
          {
            productId: pastel!.id,
            productSizeId: pequenoSize!.id,
            ingredients: [firstTopping],
            quantity: 1,
          },
        ],
      },
    });
    expect(orderRes.status()).toBe(201);
    const order = await orderRes.json();
    orderId = order.id as number;
    expect(order.status).toBe("PEDIDO_FEITO");
    expect(order.items).toHaveLength(2);
    expect(order.clientName).toBe("E2E Cliente Flow");

    // --- Cozinha: inicia preparo → finaliza ---
    const loginCozinha = await request.post("/api/auth/login", {
      data: { password: COZINHA_PIN, role: "cozinha" },
    });
    expect(loginCozinha.ok()).toBe(true);

    const prepRes = await request.patch(`/api/orders/${orderId}`, {
      data: { status: "EM_PREPARO", operator: "E2E Cozinha" },
    });
    expect(prepRes.ok()).toBe(true);
    expect((await prepRes.json()).status).toBe("EM_PREPARO");

    const prontoRes = await request.patch(`/api/orders/${orderId}`, {
      data: { status: "PRONTO", operator: "E2E Cozinha" },
    });
    expect(prontoRes.ok()).toBe(true);
    expect((await prontoRes.json()).status).toBe("PRONTO");

    // --- Atendente: entrega ---
    await request.post("/api/auth/login", {
      data: { password: ATENDENTE_PIN, role: "atendente" },
    });
    const entregueRes = await request.patch(`/api/orders/${orderId}`, {
      data: { status: "ENTREGUE", operator: "E2E Atendente" },
    });
    expect(entregueRes.ok()).toBe(true);
    const entregue = await entregueRes.json();
    expect(entregue.status).toBe("ENTREGUE");
    expect(entregue.deliveredBy).toBe("E2E Atendente");

    // --- Admin: valida row final no DB via lista de pedidos ---
    const loginAdmin = await request.post("/api/auth/login", {
      data: { password: "2699", role: "admin" },
    });
    expect(loginAdmin.ok()).toBe(true);

    const listRes = await request.get("/api/orders?scope=today");
    expect(listRes.ok()).toBe(true);
    const allOrders: Array<{ id: number; status: string; clientName: string; items: unknown[] }> =
      await listRes.json();
    const verified = allOrders.find((o) => o.id === orderId);
    expect(verified).toBeDefined();
    expect(verified!.status).toBe("ENTREGUE");
    expect(verified!.clientName).toBe("E2E Cliente Flow");
    expect(verified!.items).toHaveLength(2);
  });

  test("transição inválida retorna 409 INVALID_TRANSITION em pedido encerrado", async ({
    request,
  }) => {
    // orderId foi gravado pelo teste anterior — mas como cada test tem request
    // isolado, precisamos de um orderId fresh. Se o primeiro test não rodou
    // ainda (ex: teste individual), cria um rápido.
    if (!orderId) {
      await adminSetup(request);
      const productsRes = await request.get("/api/products?type=salgado");
      const products: Array<{
        id: string;
        name: string;
        pricingMode: string;
        sizes: Array<{ id: string; name: string }>;
      }> = await productsRes.json();
      const pastel = products.find((p) => p.name === "Pastel Salgado");
      const grandeSize = pastel!.sizes.find((s) => s.name === "Grande");
      const ingredientsRes = await request.get("/api/ingredients");
      const byCategory: Record<string, Array<{ name: string }>> = await ingredientsRes.json();
      const topping = byCategory["topping"][0].name;

      await request.post("/api/auth/login", {
        data: { password: ATENDENTE_PIN, role: "atendente" },
      });
      const r = await request.post("/api/orders", {
        data: {
          clientName: "E2E Transition Test",
          operator: "E2E Atendente",
          items: [{ productId: pastel!.id, productSizeId: grandeSize!.id, ingredients: [topping] }],
        },
      });
      const o = await r.json();
      orderId = o.id;

      // Avança até ENTREGUE pra testar a transição inválida
      await request.post("/api/auth/login", { data: { password: COZINHA_PIN, role: "cozinha" } });
      await request.patch(`/api/orders/${orderId}`, { data: { status: "EM_PREPARO" } });
      await request.patch(`/api/orders/${orderId}`, { data: { status: "PRONTO" } });
      await request.post("/api/auth/login", {
        data: { password: ATENDENTE_PIN, role: "atendente" },
      });
      await request.patch(`/api/orders/${orderId}`, { data: { status: "ENTREGUE" } });
    }

    // Agora tenta transição inválida: ENTREGUE → CANCELADO
    await request.post("/api/auth/login", {
      data: { password: "2699", role: "admin" },
    });
    const badRes = await request.patch(`/api/orders/${orderId}`, {
      data: { status: "CANCELADO" },
    });
    expect(badRes.status()).toBe(409);
    const body = await badRes.json();
    expect(body.code).toBe("INVALID_TRANSITION");
    expect(body.currentStatus).toBe("ENTREGUE");
  });

  test("pedido sem caixa aberto retorna 423", async ({ request }) => {
    // Fecha caixa pra garantir o cenário — só faz isso se não tiver outro
    // teste dependendo do caixa aberto. Como este é o último teste do describe,
    // é seguro.
    const loginAdmin = await request.post("/api/auth/login", {
      data: { password: "2699", role: "admin" },
    });
    expect(loginAdmin.ok()).toBe(true);

    // Fecha caixa (pode já estar fechado — ignora 400/404)
    await request.post("/api/events/close", {
      data: { operator: "Gil" },
    });

    // Tenta criar pedido sem caixa → espera 423
    const loginAtendente = await request.post("/api/auth/login", {
      data: { password: ATENDENTE_PIN, role: "atendente" },
    });
    expect(loginAtendente.ok()).toBe(true);

    const productsRes = await request.get("/api/products?type=salgado");
    const products: Array<{
      id: string;
      name: string;
      sizes: Array<{ id: string; name: string }>;
    }> = await productsRes.json();
    const pastel = products.find((p) => p.name === "Pastel Salgado");
    const grandeSize = pastel!.sizes.find((s) => s.name === "Grande");
    const ingredientsRes = await request.get("/api/ingredients");
    const byCategory: Record<string, Array<{ name: string }>> = await ingredientsRes.json();
    const topping = byCategory["topping"][0].name;

    const res = await request.post("/api/orders", {
      data: {
        clientName: "E2E Sem Caixa",
        operator: "E2E Atendente",
        items: [{ productId: pastel!.id, productSizeId: grandeSize!.id, ingredients: [topping] }],
      },
    });
    expect(res.status()).toBe(423);
  });
});
