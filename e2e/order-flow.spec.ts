/**
 * E2E: fluxo completo de 1 pedido
 *
 * Atendente cria pedido → cozinha recebe → marca pronto → atendente entrega.
 *
 * Usa a API diretamente (sem navegar o stepper completo) pra ser estável.
 * Os testes de UI focam em verificar que as páginas carregam com operador
 * logado — suficiente pra capturar quebras de SSE/auth/schema antes de prod.
 *
 * Pré-requisito: servidor rodando (npm run dev ou PLAYWRIGHT_BASE_URL env).
 * Pré-requisito: banco seedado (npm run db:seed) — Gil existe com PIN 2699.
 */
import { test, expect } from "@playwright/test";

const GIL_PIN = "2699";

// PINs de teste: escolhidos pra não colidir com usuários reais da barraca.
const TEST_ATENDENTE = { name: "TestAtendente_E2E", pin: "8001" };
const TEST_COZINHA = { name: "TestCozinha_E2E", pin: "8002" };

test.describe("Fluxo completo de pedido", () => {
  let orderId: number;

  test.beforeAll(async ({ request }) => {
    // Login como Gil (admin) para setup
    const login = await request.post("/api/auth/login", {
      data: { password: GIL_PIN, role: "admin" },
    });
    expect(login.ok(), `Login Gil falhou: ${await login.text()}`).toBe(true);

    // Criar usuários de teste (ignora 409 = já existem)
    await request.post("/api/users", {
      data: { name: TEST_ATENDENTE.name, role: "atendente", password: TEST_ATENDENTE.pin },
    });
    await request.post("/api/users", {
      data: { name: TEST_COZINHA.name, role: "cozinha", password: TEST_COZINHA.pin },
    });

    // Abrir caixa (ignora 409 = já aberto)
    const open = await request.post("/api/events/open", {
      data: { operator: "Gil", name: "E2E fluxo completo" },
    });
    expect([201, 409]).toContain(open.status());
  });

  test("1. Login atendente + criar pedido com 2 itens", async ({ request }) => {
    const login = await request.post("/api/auth/login", {
      data: { password: TEST_ATENDENTE.pin, role: "atendente" },
    });
    expect(login.ok(), `Login atendente falhou: ${await login.text()}`).toBe(true);
    const atendente = await login.json();
    expect(atendente.role).toBe("atendente");

    // Buscar produto disponível (Coca-Cola Lata — criada pelo seed)
    const prodsRes = await request.get("/api/products?type=bebida");
    expect(prodsRes.ok()).toBe(true);
    const products = await prodsRes.json();
    const coca = (products as Array<{ id: string; name: string }>).find(
      (p) => p.name === "Coca-Cola Lata",
    );
    expect(coca, "Produto Coca-Cola Lata não encontrado — rode npm run db:seed").toBeDefined();

    // Criar pedido com 2 unidades
    const orderRes = await request.post("/api/orders", {
      data: {
        clientName: "E2E Cliente",
        operator: atendente.name,
        items: [{ productId: coca!.id, quantity: 2 }],
      },
    });
    expect(orderRes.status(), `Criar pedido falhou: ${await orderRes.text()}`).toBe(201);
    const order = await orderRes.json();
    orderId = order.id;

    expect(order.status).toBe("PEDIDO_FEITO");
    expect(order.clientName).toBe("E2E Cliente");
    expect(order.items).toHaveLength(1);
    expect(order.items[0].quantity).toBe(2);

    // Guarda orderId para os testes seguintes via arquivo temporário em globals
    process.env.__E2E_ORDER_ID = String(orderId);
  });

  test("2. Cozinha: marcar EM_PREPARO e depois PRONTO", async ({ request }) => {
    const id = process.env.__E2E_ORDER_ID;
    expect(id, "orderId não disponível — rodar teste 1 antes").toBeTruthy();

    const login = await request.post("/api/auth/login", {
      data: { password: TEST_COZINHA.pin, role: "cozinha" },
    });
    expect(login.ok(), `Login cozinha falhou: ${await login.text()}`).toBe(true);
    const cozinha = await login.json();

    const prepRes = await request.patch(`/api/orders/${id}`, {
      data: { status: "EM_PREPARO", operator: cozinha.name },
    });
    expect(prepRes.ok(), `Transição para EM_PREPARO falhou: ${await prepRes.text()}`).toBe(true);
    const prepOrder = await prepRes.json();
    expect(prepOrder.status).toBe("EM_PREPARO");
    expect(prepOrder.startedAt).not.toBeNull();

    const prontoRes = await request.patch(`/api/orders/${id}`, {
      data: { status: "PRONTO", operator: cozinha.name },
    });
    expect(prontoRes.ok(), `Transição para PRONTO falhou: ${await prontoRes.text()}`).toBe(true);
    const prontoOrder = await prontoRes.json();
    expect(prontoOrder.status).toBe("PRONTO");
    expect(prontoOrder.preparedAt).not.toBeNull();
  });

  test("3. Atendente: marcar ENTREGUE e validar estado final", async ({ request }) => {
    const id = process.env.__E2E_ORDER_ID;
    expect(id, "orderId não disponível — rodar testes 1 e 2 antes").toBeTruthy();

    const login = await request.post("/api/auth/login", {
      data: { password: TEST_ATENDENTE.pin, role: "atendente" },
    });
    expect(login.ok(), `Login atendente falhou: ${await login.text()}`).toBe(true);
    const atendente = await login.json();

    const entregueRes = await request.patch(`/api/orders/${id}`, {
      data: { status: "ENTREGUE", operator: atendente.name },
    });
    expect(
      entregueRes.ok(),
      `Transição para ENTREGUE falhou: ${await entregueRes.text()}`,
    ).toBe(true);
    const entregueOrder = await entregueRes.json();

    // Validação final do "row no DB" via GET
    const getRes = await request.get(`/api/orders/${id}`);
    expect(getRes.ok()).toBe(true);
    const finalOrder = await getRes.json();

    expect(finalOrder.status).toBe("ENTREGUE");
    expect(finalOrder.deliveredAt).not.toBeNull();
    expect(finalOrder.id).toBe(Number(id));
    expect(entregueOrder.status).toBe("ENTREGUE");
  });
});

test.describe("Páginas UI carregam com operador logado", () => {
  test("página atendente renderiza sem redirecionar pro login", async ({ page }) => {
    // Injeta operador via localStorage antes de navegar (simula login persistente)
    await page.goto("/");
    await page.evaluate(
      ({ op }) => window.localStorage.setItem("pdg:operator", JSON.stringify(op)),
      { op: { id: "test-e2e", role: "atendente", name: TEST_ATENDENTE.name } },
    );
    await page.goto("/atendente");
    // Deve permanecer em /atendente (não redirecionar pro login)
    await page.waitForTimeout(1500); // aguarda hidratação + redirect useEffect
    expect(page.url()).toContain("/atendente");
  });

  test("página cozinha renderiza sem redirecionar pro login", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(
      ({ op }) => window.localStorage.setItem("pdg:operator", JSON.stringify(op)),
      { op: { id: "test-e2e", role: "cozinha", name: TEST_COZINHA.name } },
    );
    await page.goto("/cozinha");
    await page.waitForTimeout(1500);
    expect(page.url()).toContain("/cozinha");
  });
});
