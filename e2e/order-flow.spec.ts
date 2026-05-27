import { test, expect } from "@playwright/test";

const E2E_ATENDENTE = { name: "E2EAtendente", password: "9979", role: "atendente" };
const E2E_COZINHA = { name: "E2ECozinha", password: "9989", role: "cozinha" };

type ProductSize = { id: string; name: string; priceCents: number };
type Product = { id: string; name: string; sizes?: ProductSize[] };
type OrderItem = { id: string; productName: string; quantity: number; unitPrice: number };
type OrderRow = {
  id: number;
  status: string;
  clientName: string;
  totalCents: number;
  finalCents: number;
  readyBy: string | null;
  deliveredBy: string | null;
  items: OrderItem[];
};

test.describe("Fluxo completo de pedido", () => {
  // IDs dos usuários e2e criados no beforeAll — usados no afterAll pra cleanup.
  const e2eUserIds: string[] = [];

  test.beforeAll(async ({ request }) => {
    // Login Gil (admin)
    const login = await request.post("/api/auth/login", {
      data: { name: "Gil", password: "2699", role: "admin" },
    });
    expect(login.ok()).toBe(true);

    // Cleanup: remove usuários e2e de runs anteriores para evitar conflito de PIN.
    const usersRes = await request.get("/api/users");
    const userList: Array<{ id: string; name: string }> = await usersRes.json();
    for (const u of userList) {
      if (u.name === E2E_ATENDENTE.name || u.name === E2E_COZINHA.name) {
        await request.delete(`/api/users/${u.id}`);
      }
    }

    // Criar usuários temporários para o teste
    const atRes = await request.post("/api/users", { data: E2E_ATENDENTE });
    expect(atRes.status()).toBe(201);
    e2eUserIds.push((await atRes.json()).id);

    const cozRes = await request.post("/api/users", { data: E2E_COZINHA });
    expect(cozRes.status()).toBe(201);
    e2eUserIds.push((await cozRes.json()).id);

    // Abrir caixa — reusar se já houver um aberto (409 é OK)
    const open = await request.post("/api/events/open", {
      data: { operator: "Gil", name: "E2E order flow" },
    });
    expect([201, 409]).toContain(open.status());
  });

  test.afterAll(async ({ request }) => {
    // Relogar como Gil para ter permissão de deletar
    await request.post("/api/auth/login", {
      data: { name: "Gil", password: "2699", role: "admin" },
    });
    for (const id of e2eUserIds) {
      await request.delete(`/api/users/${id}`);
    }
  });

  test("atendente cria pedido → cozinha prepara → atendente entrega", async ({ request }) => {
    // --- ATENDENTE: login ---
    const loginAt = await request.post("/api/auth/login", {
      data: {
        name: E2E_ATENDENTE.name,
        password: E2E_ATENDENTE.password,
        role: "atendente",
      },
    });
    expect(loginAt.ok()).toBe(true);
    expect((await loginAt.json()).role).toBe("atendente");

    // Buscar catálogo de produtos para montar o pedido
    const productsRes = await request.get("/api/products");
    expect(productsRes.ok()).toBe(true);
    const products: Product[] = await productsRes.json();

    const salgado = products.find((p) => p.name === "Pastel Salgado");
    expect(salgado).toBeDefined();
    const grande = salgado!.sizes?.find((s) => s.name === "Grande");
    expect(grande).toBeDefined();

    const doce = products.find((p) => p.name === "Pastel Doce");
    expect(doce).toBeDefined();
    const normal = doce!.sizes?.find((s) => s.name === "Normal");
    expect(normal).toBeDefined();

    // Criar pedido com 2 itens distintos
    const orderRes = await request.post("/api/orders", {
      data: {
        clientName: "E2E Cliente",
        operator: E2E_ATENDENTE.name,
        items: [
          {
            productId: salgado!.id,
            productSizeId: grande!.id,
            ingredients: ["Frango", "Queijo"],
            quantity: 1,
          },
          {
            productId: doce!.id,
            productSizeId: normal!.id,
            ingredients: ["Banana com chocolate"],
            quantity: 1,
          },
        ],
      },
    });
    expect(orderRes.status()).toBe(201);
    const order: OrderRow = await orderRes.json();
    expect(order.status).toBe("PEDIDO_FEITO");
    expect(order.clientName).toBe("E2E Cliente");
    expect(order.items).toHaveLength(2);
    expect(order.totalCents).toBe(grande!.priceCents + normal!.priceCents);
    expect(order.finalCents).toBe(order.totalCents); // sem promoção

    const orderId = order.id;

    // --- COZINHA: login e preparo ---
    const loginCoz = await request.post("/api/auth/login", {
      data: {
        name: E2E_COZINHA.name,
        password: E2E_COZINHA.password,
        role: "cozinha",
      },
    });
    expect(loginCoz.ok()).toBe(true);

    const emPreparoRes = await request.patch(`/api/orders/${orderId}`, {
      data: { status: "EM_PREPARO", operator: E2E_COZINHA.name },
    });
    expect(emPreparoRes.ok()).toBe(true);
    expect((await emPreparoRes.json()).status).toBe("EM_PREPARO");

    const prontoRes = await request.patch(`/api/orders/${orderId}`, {
      data: { status: "PRONTO", operator: E2E_COZINHA.name },
    });
    expect(prontoRes.ok()).toBe(true);
    const pronto: OrderRow = await prontoRes.json();
    expect(pronto.status).toBe("PRONTO");
    expect(pronto.readyBy).toBe(E2E_COZINHA.name);

    // --- ATENDENTE: volta e marca entregue ---
    await request.post("/api/auth/login", {
      data: {
        name: E2E_ATENDENTE.name,
        password: E2E_ATENDENTE.password,
        role: "atendente",
      },
    });

    const entreguRes = await request.patch(`/api/orders/${orderId}`, {
      data: { status: "ENTREGUE", operator: E2E_ATENDENTE.name },
    });
    expect(entreguRes.ok()).toBe(true);
    const entregue: OrderRow = await entreguRes.json();
    expect(entregue.status).toBe("ENTREGUE");
    expect(entregue.deliveredBy).toBe(E2E_ATENDENTE.name);

    // --- VALIDAR ROW FINAL: Gil confirma no histórico ---
    await request.post("/api/auth/login", {
      data: { name: "Gil", password: "2699", role: "admin" },
    });
    const allOrdersRes = await request.get("/api/orders");
    expect(allOrdersRes.ok()).toBe(true);
    const allOrders: OrderRow[] = await allOrdersRes.json();
    const finalOrder = allOrders.find((o) => o.id === orderId);
    expect(finalOrder).toBeDefined();
    expect(finalOrder!.status).toBe("ENTREGUE");
    expect(finalOrder!.deliveredBy).toBe(E2E_ATENDENTE.name);
    expect(finalOrder!.items).toHaveLength(2);
  });
});
