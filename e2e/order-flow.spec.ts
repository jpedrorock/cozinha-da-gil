import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

/**
 * Fluxo completo de pedido: atendente → cozinha → entregue.
 *
 * Pré-condição: dev server rodando (npm run dev ou npm start).
 * Usar: PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e
 *
 * Cria 2 usuários de teste (E2E-Atendente / E2E-Cozinha) se não existirem.
 * O caixa precisa estar aberto — o teste abre se não tiver.
 *
 * Por que API + UI híbrido:
 *  - Criar pedido via UI (stepper completo) é muito frágil em CI sem servidor real.
 *    A lógica de negócio já é testada pelo stepper; o que queremos aqui é o
 *    fluxo de status (atendente cria → cozinha processa → atendente entrega).
 *  - Login via UI (PIN numpad) está coberto — é o ponto crítico de auth.
 *  - Cozinha e entrega precisam de UI real para validar SSE + botões.
 */

const GIL_PIN = "2699";
const ATENDENTE_PIN = "9981";
const COZINHA_PIN = "9982";
const ATENDENTE_NAME = "E2E-Atendente";
const COZINHA_NAME = "E2E-Cozinha";

// Compartilhado entre os testes do describe
let orderId: number;
let atendenteUser: { id: string; role: string; name: string };
let cozinhaUser: { id: string; role: string; name: string };

/** Digita PIN no teclado numérico virtual da tela de login. */
async function enterPin(page: Page, pin: string) {
  const numpad = page.getByRole("group", { name: "Teclado numérico" });
  for (const digit of pin) {
    await numpad.getByRole("button", { name: digit, exact: true }).click();
  }
}

/** Injeta operador no localStorage + iron-session já deve estar como cookie
 *  (request.post("/api/auth/login") executa antes). */
async function setOperatorState(page: Page, user: { id: string; role: string; name: string }) {
  await page.evaluate((op) => {
    localStorage.setItem("pdg:operator", JSON.stringify(op));
    localStorage.setItem("pdg:operator-persistent", "persistent");
  }, user);
}

/** Cria usuário via API (ignora 409 se já existir). Retorna o usuário. */
async function ensureUser(
  request: APIRequestContext,
  name: string,
  role: string,
  password: string,
): Promise<{ id: string; role: string; name: string }> {
  const create = await request.post("/api/users", {
    data: { name, role, password },
  });
  if (create.status() !== 201 && create.status() !== 409) {
    throw new Error(`Falha ao criar usuário ${name}: ${create.status()}`);
  }
  // Busca o usuário pelo nome
  const list = await request.get(`/api/users?role=${role}`);
  const users: Array<{ id: string; role: string; name: string }> = await list.json();
  const user = users.find((u) => u.name === name);
  if (!user) throw new Error(`Usuário ${name} não encontrado após criação`);
  return user;
}

test.describe("Fluxo completo de pedido", () => {
  test.beforeAll(async ({ request }) => {
    // 1. Login como Gil (admin)
    const gilLogin = await request.post("/api/auth/login", {
      data: { password: GIL_PIN, role: "admin" },
    });
    expect(gilLogin.ok(), `Login Gil falhou: ${await gilLogin.text()}`).toBe(true);

    // 2. Criar usuários de teste (idempotente)
    atendenteUser = await ensureUser(request, ATENDENTE_NAME, "atendente", ATENDENTE_PIN);
    cozinhaUser = await ensureUser(request, COZINHA_NAME, "cozinha", COZINHA_PIN);

    // 3. Abrir caixa (409 = já aberto, ok)
    const openCaixa = await request.post("/api/events/open", {
      data: { operator: "Gil", name: "E2E Flow Test" },
    });
    expect(
      [201, 409].includes(openCaixa.status()),
      `Abrir caixa retornou ${openCaixa.status()}`,
    ).toBe(true);

    // 4. Login como atendente para criar pedido
    const atendenteLogin = await request.post("/api/auth/login", {
      data: { password: ATENDENTE_PIN, role: "atendente" },
    });
    expect(atendenteLogin.ok(), `Login atendente falhou: ${await atendenteLogin.text()}`).toBe(true);

    // 5. Buscar produtos.
    //    Precisamos de 1 pastel (que vai pela cozinha) + 1 bebida (express).
    //    Pedido só-bebidas pula a cozinha (status inicial = PRONTO) — isso
    //    quebraria o teste de cozinha. Mix pastel+bebida segue o fluxo normal.
    const productsRes = await request.get("/api/products");
    expect(productsRes.ok()).toBe(true);
    const products: Array<{
      id: string;
      name: string;
      type: string;
      available: boolean;
      sizes: Array<{ id: string; name: string }>;
    }> = await productsRes.json();

    const salgado = products.find((p) => p.type === "salgado" && p.available);
    const suco = products.find((p) => p.name === "Suco" && p.available);
    expect(salgado, "Pastel Salgado não encontrado no seed — rodar npm run db:seed").toBeDefined();
    expect(suco, "Suco não encontrado no seed — rodar npm run db:seed").toBeDefined();

    const grandeSize = salgado!.sizes.find((s) => s.name === "Grande");
    expect(grandeSize, "Size 'Grande' não encontrado no Pastel Salgado").toBeDefined();

    // 6. Criar pedido com 2 itens: pastel salgado (via cozinha) + suco (express)
    //    Mix garante initialStatus = PEDIDO_FEITO (não bypass bebida).
    const orderRes = await request.post("/api/orders", {
      data: {
        clientName: "E2E-Cliente",
        operator: ATENDENTE_NAME,
        items: [
          {
            productId: salgado!.id,
            productSizeId: grandeSize!.id,
            ingredients: ["Carne"],
            quantity: 1,
          },
          { productId: suco!.id, quantity: 1 },
        ],
      },
    });
    expect(orderRes.status(), `Criar pedido falhou: ${await orderRes.text()}`).toBe(201);
    const order = await orderRes.json();
    orderId = order.id;
    expect(orderId).toBeTruthy();
    expect(order.items).toHaveLength(2);
  });

  test("UI: login do atendente via PIN numpad", async ({ page }) => {
    await page.goto("/");
    // "Atendente" já é o tab default — digitar PIN
    await enterPin(page, ATENDENTE_PIN);
    await page.waitForURL("**/atendente", { timeout: 6000 });
    await expect(page).toHaveURL(/\/atendente/);
  });

  test("UI: cozinha vê pedido, inicia preparo e finaliza", async ({ page, request }) => {
    // Configurar sessão de cozinha: cookie via API + localStorage via evaluate
    const loginRes = await request.post("/api/auth/login", {
      data: { password: COZINHA_PIN, role: "cozinha" },
    });
    expect(loginRes.ok()).toBe(true);

    await page.goto("/"); // Carrega a página para poder executar evaluate
    await setOperatorState(page, cozinhaUser);
    await page.goto("/cozinha");

    // Pedido deve aparecer (SSE ou initial load)
    await expect(page.getByText("E2E-Cliente")).toBeVisible({ timeout: 10000 });

    // Iniciar preparo (PEDIDO_FEITO → EM_PREPARO)
    await page.getByRole("button", { name: "Iniciar preparo" }).first().click();

    // Aguarda card transicionar pra "Em preparo" e botão muda
    await expect(page.getByRole("button", { name: "Finalizar" }).first()).toBeVisible({
      timeout: 5000,
    });

    // Finalizar (EM_PREPARO → PRONTO)
    await page.getByRole("button", { name: "Finalizar" }).first().click();

    // Pedido sai da fila da cozinha (PRONTO não aparece mais em EM_PREPARO/PEDIDO_FEITO)
    await expect(page.getByText("E2E-Cliente")).not.toBeVisible({ timeout: 8000 });
  });

  test("UI: atendente vê pedido PRONTO e marca como retirado", async ({ page, request }) => {
    // Configurar sessão de atendente
    const loginRes = await request.post("/api/auth/login", {
      data: { password: ATENDENTE_PIN, role: "atendente" },
    });
    expect(loginRes.ok()).toBe(true);

    await page.goto("/");
    await setOperatorState(page, atendenteUser);
    await page.goto("/atendente");

    // Filtro default é PRONTO — pedido deve aparecer
    await expect(page.getByText("E2E-Cliente")).toBeVisible({ timeout: 10000 });

    // Marcar como entregue (botão "Retirada" no OrderCard)
    await page.getByRole("button", { name: "Retirada" }).first().click();

    // Pedido sai do filtro PRONTO
    await expect(page.getByText("E2E-Cliente")).not.toBeVisible({ timeout: 8000 });
  });

  test("API: validar estado final do pedido", async ({ request }) => {
    // GET /api/orders não requer auth — retorna pedidos de hoje
    const ordersRes = await request.get("/api/orders?scope=today");
    expect(ordersRes.ok(), `Listar pedidos falhou`).toBe(true);
    const orders: Array<{ id: number; status: string; clientName: string; items: unknown[] }> =
      await ordersRes.json();

    const order = orders.find((o) => o.id === orderId);
    expect(order, `Pedido ${orderId} não encontrado na lista`).toBeDefined();
    expect(order!.status).toBe("ENTREGUE");
    expect(order!.items).toHaveLength(2);
    expect(order!.clientName).toBe("E2E-Cliente");
  });
});
