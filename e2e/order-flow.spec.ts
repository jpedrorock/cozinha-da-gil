import { test, expect, type Page } from "@playwright/test";

/**
 * Fluxo completo de pedido: PEDIDO_FEITO → EM_PREPARO → PRONTO → ENTREGUE.
 *
 * Abordagem híbrida:
 *  - page.context().request: chamadas API que compartilham cookie com a page
 *  - page: navegação UI e login via PIN (testa auth real)
 *  - API para criação do pedido e transições (atendente stepper é coberto em
 *    testes unitários; aqui o foco é a máquina de estados e auth end-to-end)
 *
 * Dependências de seed:
 *  - Gil (admin) com PIN 2699 (criado pelo seed.ts)
 *  - Coca-Cola Lata e Água (bebidas, preço fixo) disponíveis
 *
 * Usuários de teste (atendente/cozinha) são criados no beforeAll e limpos
 * no afterAll — PINs 8877/8878 escolhidos pra não colidir com seed.
 */

const TEST_ATENDENTE = { name: "TestAtendente", password: "8877", role: "atendente" as const };
const TEST_COZINHA   = { name: "TestCozinha",   password: "8878", role: "cozinha" as const };

type Role = "atendente" | "cozinha" | "admin";

async function loginViaUI(page: Page, role: Role, pin: string) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto("/", { waitUntil: "networkidle" });

  if (role === "admin") {
    // "Admin" é um link no rodapé da página de login
    await page.getByRole("button", { name: "Admin" }).click();
  } else {
    const label = role === "atendente" ? "Atendente" : "Cozinha";
    await page.getByRole("button", { name: label }).first().click();
  }

  // Digita PIN clicando nos botões do numpad (keypad mode)
  for (const digit of pin.split("")) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }

  // Auto-submit dispara após 350ms — aguarda redirect
  await page.waitForURL(`/${role}`, { timeout: 10000 });
}

test.describe("Fluxo completo de pedido", () => {
  let atendenteUserId = "";
  let cozinhaUserId = "";
  let orderId = 0;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    const req = ctx.request;

    // Login Gil (admin) pra criar usuários e abrir caixa
    const loginRes = await req.post("/api/auth/login", {
      data: { name: "Gil", password: "2699", role: "admin" },
    });
    expect(loginRes.ok(), "login Gil falhou").toBe(true);

    // Criar atendente de teste (idempotente)
    const createAtendente = await req.post("/api/users", { data: TEST_ATENDENTE });
    if (createAtendente.status() === 201) {
      atendenteUserId = (await createAtendente.json()).id;
    } else {
      const users: { id: string; name: string }[] = await (await req.get("/api/users")).json();
      atendenteUserId = users.find((u) => u.name === TEST_ATENDENTE.name)?.id ?? "";
      expect(atendenteUserId, "atendente de teste não encontrado").toBeTruthy();
    }

    // Criar cozinheiro de teste (idempotente)
    const createCozinha = await req.post("/api/users", { data: TEST_COZINHA });
    if (createCozinha.status() === 201) {
      cozinhaUserId = (await createCozinha.json()).id;
    } else {
      const users: { id: string; name: string }[] = await (await req.get("/api/users")).json();
      cozinhaUserId = users.find((u) => u.name === TEST_COZINHA.name)?.id ?? "";
      expect(cozinhaUserId, "cozinha de teste não encontrado").toBeTruthy();
    }

    // Abrir caixa (201 = criou, 409 = já estava aberto — ambos OK)
    const openRes = await req.post("/api/events/open", {
      data: { operator: "Gil", name: "E2E order-flow" },
    });
    expect([201, 409], "status inesperado ao abrir caixa").toContain(openRes.status());

    await ctx.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!atendenteUserId && !cozinhaUserId) return;
    const ctx = await browser.newContext();
    const req = ctx.request;

    await req.post("/api/auth/login", {
      data: { name: "Gil", password: "2699", role: "admin" },
    });
    if (atendenteUserId) await req.delete(`/api/users/${atendenteUserId}`);
    if (cozinhaUserId)   await req.delete(`/api/users/${cozinhaUserId}`);

    await ctx.close();
  });

  test("PEDIDO_FEITO → EM_PREPARO → PRONTO → ENTREGUE", async ({ page }) => {
    const req = page.context().request;

    // ── 1. Login como atendente (UI real) ──────────────────────────────────
    await loginViaUI(page, "atendente", TEST_ATENDENTE.password);
    await expect(page).toHaveURL("/atendente", { timeout: 8000 });

    // ── 2. Criar pedido com 2 itens (API com cookie de atendente) ──────────
    const productsRes = await req.get("/api/products?type=bebida");
    expect(productsRes.ok(), "busca produtos falhou").toBe(true);
    const products: { id: string; name: string }[] = await productsRes.json();
    const coca = products.find((p) => p.name === "Coca-Cola Lata");
    const agua = products.find((p) => p.name === "Água");
    expect(coca, "Coca-Cola Lata não encontrada no seed").toBeDefined();
    expect(agua, "Água não encontrada no seed").toBeDefined();

    const orderRes = await req.post("/api/orders", {
      data: {
        clientName: "E2E Cliente",
        operator: TEST_ATENDENTE.name,
        items: [
          { productId: coca!.id, quantity: 1 },
          { productId: agua!.id, quantity: 1 },
        ],
      },
    });
    expect(orderRes.status(), "criar pedido falhou — esperava 201").toBe(201);
    const order = await orderRes.json();
    orderId = order.id;
    expect(order.status).toBe("PEDIDO_FEITO");
    expect(order.items).toHaveLength(2);

    // ── 3. Login como cozinha (UI real) ────────────────────────────────────
    await loginViaUI(page, "cozinha", TEST_COZINHA.password);
    await expect(page).toHaveURL("/cozinha", { timeout: 8000 });

    // Avança: PEDIDO_FEITO → EM_PREPARO
    const prepRes = await req.patch(`/api/orders/${orderId}`, {
      data: { status: "EM_PREPARO", operator: TEST_COZINHA.name },
    });
    expect(prepRes.ok(), "EM_PREPARO falhou").toBe(true);
    expect((await prepRes.json()).status).toBe("EM_PREPARO");

    // Avança: EM_PREPARO → PRONTO
    const prontoRes = await req.patch(`/api/orders/${orderId}`, {
      data: { status: "PRONTO", operator: TEST_COZINHA.name },
    });
    expect(prontoRes.ok(), "PRONTO falhou").toBe(true);
    expect((await prontoRes.json()).status).toBe("PRONTO");

    // ── 4. Volta pro atendente (UI real) e marca ENTREGUE ──────────────────
    await loginViaUI(page, "atendente", TEST_ATENDENTE.password);
    await expect(page).toHaveURL("/atendente", { timeout: 8000 });

    const entregueRes = await req.patch(`/api/orders/${orderId}`, {
      data: { status: "ENTREGUE", operator: TEST_ATENDENTE.name },
    });
    expect(entregueRes.ok(), "ENTREGUE falhou").toBe(true);
    const finalOrder = await entregueRes.json();

    // ── 5. Valida row final ────────────────────────────────────────────────
    expect(finalOrder.status).toBe("ENTREGUE");
    expect(finalOrder.clientName).toBe("E2E Cliente");
    expect(finalOrder.items).toHaveLength(2);
    // Timestamps de transição preenchidos
    expect(finalOrder.preparedAt).not.toBeNull();
    expect(finalOrder.readyAt).not.toBeNull();
    expect(finalOrder.deliveredAt).not.toBeNull();
  });
});
