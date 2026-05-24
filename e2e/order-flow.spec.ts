import { test, expect, type Page } from "@playwright/test";

/**
 * Fluxo completo de pedido: atendente cria → cozinha prepara → atendente entrega.
 *
 * Estratégia de auth:
 *  - `page.request` compartilha cookies com o contexto da página (iron-session).
 *  - Login via API seta o cookie de sessão; `page.evaluate` seta o operador no
 *    sessionStorage (lido por `useOperator`). Combinados, a próxima
 *    `page.goto()` carrega a rota protegida corretamente.
 *
 * Pré-requisito: servidor rodando em PLAYWRIGHT_BASE_URL (default: localhost:59574).
 *   npm run dev  (ou npm run build && npm start)
 *   npm run test:e2e
 */

const GIL_PIN = "2699";
const TEST_ATENDENTE_NAME = "E2EFlow_Atendente";
const TEST_COZINHA_NAME = "E2EFlow_Cozinha";
const TEST_ATENDENTE_PIN = "7771";
const TEST_COZINHA_PIN = "7772";

type UserRef = { id: string; name: string; role: string };

/** Login via API e injeta operador no sessionStorage da página. */
async function loginAs(page: Page, pin: string, role: string): Promise<UserRef> {
  const res = await page.request.post("/api/auth/login", {
    data: { password: pin, role },
  });
  if (!res.ok()) {
    throw new Error(`Login como ${role} falhou: ${res.status()} ${await res.text()}`);
  }
  const data = (await res.json()) as UserRef;
  await page.evaluate(
    ({ key, persistKey, op }) => {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
      sessionStorage.setItem(key, JSON.stringify(op));
      localStorage.setItem(persistKey, "session");
    },
    {
      key: "pdg:operator",
      persistKey: "pdg:operator-persistent",
      op: { id: data.id, role: data.role, name: data.name },
    },
  );
  return data;
}

test.describe("Fluxo completo de pedido", () => {
  let atendenteId: string | null = null;
  let cozinhaId: string | null = null;

  test.beforeAll(async ({ request }) => {
    // Login como Gil (admin) pelo nome — back-compat pra casos onde PIN mudou
    const loginRes = await request.post("/api/auth/login", {
      data: { name: "Gil", password: GIL_PIN, role: "admin" },
    });
    expect(loginRes.ok(), "Login Gil deve funcionar").toBe(true);

    // Criar usuário atendente de teste (201 = novo, 409 = já existe)
    const atRes = await request.post("/api/users", {
      data: { name: TEST_ATENDENTE_NAME, role: "atendente", password: TEST_ATENDENTE_PIN },
    });
    expect(
      [201, 409].includes(atRes.status()),
      `Criar atendente: esperado 201/409, got ${atRes.status()}`,
    ).toBe(true);
    if (atRes.status() === 201) {
      const body = (await atRes.json()) as UserRef;
      atendenteId = body.id;
    } else {
      // Já existia — buscar o ID pra cleanup
      const listRes = await request.get(`/api/users?role=atendente`);
      const list = (await listRes.json()) as UserRef[];
      const found = list.find((u) => u.name === TEST_ATENDENTE_NAME);
      if (found) atendenteId = found.id;
    }

    // Criar usuário cozinha de teste
    const czRes = await request.post("/api/users", {
      data: { name: TEST_COZINHA_NAME, role: "cozinha", password: TEST_COZINHA_PIN },
    });
    expect(
      [201, 409].includes(czRes.status()),
      `Criar cozinha: esperado 201/409, got ${czRes.status()}`,
    ).toBe(true);
    if (czRes.status() === 201) {
      const body = (await czRes.json()) as UserRef;
      cozinhaId = body.id;
    } else {
      const listRes = await request.get(`/api/users?role=cozinha`);
      const list = (await listRes.json()) as UserRef[];
      const found = list.find((u) => u.name === TEST_COZINHA_NAME);
      if (found) cozinhaId = found.id;
    }

    // Abrir caixa (ou reusar se já aberto)
    const openRes = await request.post("/api/events/open", {
      data: { operator: "Gil", name: `E2E Order Flow` },
    });
    expect(
      [201, 409].includes(openRes.status()),
      `Abrir caixa: esperado 201/409, got ${openRes.status()}`,
    ).toBe(true);
  });

  test.afterAll(async ({ request }) => {
    // Re-login como Gil no context de cleanup
    await request.post("/api/auth/login", {
      data: { name: "Gil", password: GIL_PIN, role: "admin" },
    });
    if (atendenteId) {
      await request.delete(`/api/users/${atendenteId}`);
    }
    if (cozinhaId) {
      await request.delete(`/api/users/${cozinhaId}`);
    }
  });

  test("atendente cria pedido → cozinha inicia e finaliza → atendente entrega", async ({ page }) => {
    // Inicializar origem da página (necessário antes de page.evaluate)
    await page.goto("/");

    // ── PASSO 1: Login como Gil (admin) para acessar a API no contexto da página ──
    await page.request.post("/api/auth/login", {
      data: { name: "Gil", password: GIL_PIN, role: "admin" },
    });

    // ── PASSO 2: Buscar produto e criar pedido via API ──
    const productsRes = await page.request.get("/api/products?type=bebida");
    expect(productsRes.ok()).toBe(true);
    const products = (await productsRes.json()) as Array<{ id: string; name: string }>;
    const coca = products.find((p) => p.name === "Coca-Cola Lata");
    expect(coca, "Coca-Cola Lata deve existir no seed").toBeDefined();

    // Login como atendente pra criar o pedido com a sessão correta
    await loginAs(page, TEST_ATENDENTE_PIN, "atendente");

    const orderRes = await page.request.post("/api/orders", {
      data: {
        clientName: "E2E Teste",
        items: [
          { productId: coca!.id, quantity: 1 },
          { productId: coca!.id, quantity: 1 },
        ],
      },
    });
    expect(orderRes.status(), "Criar pedido deve retornar 201").toBe(201);
    const order = (await orderRes.json()) as {
      id: number;
      status: string;
      items: Array<{ quantity: number }>;
    };
    expect(order.status).toBe("PEDIDO_FEITO");
    // 2 itens criados (ou 1 com qty=2 — depende da dedup; ambos ok)
    const totalQty = order.items.reduce((s: number, i: { quantity: number }) => s + i.quantity, 0);
    expect(totalQty).toBe(2);

    const orderId = order.id;
    const orderLabel = `#${String(orderId).padStart(3, "0")}`;

    // ── PASSO 3: Cozinha — iniciar preparo ──
    await loginAs(page, TEST_COZINHA_PIN, "cozinha");
    await page.goto("/cozinha");

    // Aguarda o card do pedido aparecer na fila
    await expect(page.getByText(orderLabel).first()).toBeVisible({ timeout: 10_000 });

    // Clicar "Iniciar preparo" (PEDIDO_FEITO → EM_PREPARO)
    await page.getByRole("button", { name: "Iniciar preparo" }).first().click();
    await page.waitForTimeout(500);

    // ── PASSO 4: Cozinha — finalizar (EM_PREPARO → PRONTO) ──
    await expect(
      page.getByRole("button", { name: "Finalizar" }).first(),
    ).toBeVisible({ timeout: 5_000 });
    await page.getByRole("button", { name: "Finalizar" }).first().click();
    // Aguarda animação de saída do card (200ms) + buffer de rede
    await page.waitForTimeout(800);

    // ── PASSO 5: Atendente — entregar pedido ──
    await loginAs(page, TEST_ATENDENTE_PIN, "atendente");
    await page.goto("/atendente");

    // Filtro padrão da atendente é PRONTO — pedido deve aparecer
    await expect(page.getByText(orderLabel).first()).toBeVisible({ timeout: 10_000 });

    // Clicar "Retirada" (PRONTO → ENTREGUE)
    await page.getByRole("button", { name: /Retirada/i }).first().click();
    await page.waitForTimeout(500);

    // ── PASSO 6: Validar estado final via API ──
    // Lista pedidos de hoje e localiza o pedido por ID
    const finalListRes = await page.request.get("/api/orders?scope=today");
    expect(finalListRes.ok()).toBe(true);
    const finalList = (await finalListRes.json()) as Array<{ id: number; status: string }>;
    const finalOrder = finalList.find((o) => o.id === orderId);
    expect(finalOrder, `Pedido #${orderId} deve existir na lista`).toBeDefined();
    expect(finalOrder!.status).toBe("ENTREGUE");
  });
});
