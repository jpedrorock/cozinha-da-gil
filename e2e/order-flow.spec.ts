import { test, expect, type Page } from "@playwright/test";

// Usuários de teste exclusivos do E2E — PINs 773x pra evitar conflito com seed
const GIL_PIN = "2699";
const E2E_ATENDENTE = { name: "E2E Atendente", pin: "7731" };
const E2E_COZINHA = { name: "E2E Cozinha", pin: "7732" };

// Faz logout da sessão HTTP + limpa storage e então loga via PIN na tela.
async function loginViaPIN(
  page: Page,
  role: "atendente" | "cozinha",
  pin: string,
) {
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.goto("/");
  if (role === "cozinha") {
    await page.getByRole("button", { name: /Cozinha/i }).click();
  }
  const numpad = page.getByRole("group", { name: "Teclado numérico" });
  for (const digit of pin) {
    await numpad.getByRole("button", { name: digit, exact: true }).click();
  }
  await page.waitForURL(`/${role}`, { timeout: 8000 });
}

test.describe("Fluxo completo de pedido", () => {
  test(
    "atendente cria pedido → cozinha finaliza → atendente entrega",
    async ({ page }) => {
      // ── 0. SETUP ADMIN ──────────────────────────────────────────────────
      const adminLogin = await page.request.post("/api/auth/login", {
        data: { name: "Gil", password: GIL_PIN },
      });
      expect(adminLogin.ok(), "Admin Gil deve conseguir logar").toBeTruthy();

      // Cria usuários de teste (201 = criado, 409 = já existe — ambos OK)
      for (const [user, role] of [
        [E2E_ATENDENTE, "atendente"],
        [E2E_COZINHA, "cozinha"],
      ] as const) {
        const r = await page.request.post("/api/users", {
          data: { name: user.name, role, password: user.pin },
        });
        expect(
          [201, 409],
          `Criar usuário ${user.name}`,
        ).toContain(r.status());
      }

      // Garante caixa aberto (201 = novo, 409 = já estava aberto)
      const caixaRes = await page.request.post("/api/events/open", {
        data: { operator: "Gil", name: "E2E Fluxo" },
      });
      expect([201, 409], "Abrir caixa").toContain(caixaRes.status());

      // Busca produtos do seed
      const prodRes = await page.request.get("/api/products");
      expect(prodRes.ok()).toBeTruthy();
      const produtos = (await prodRes.json()) as Array<{
        id: string;
        name: string;
      }>;
      const coca = produtos.find((p) => p.name === "Coca-Cola Lata");
      const agua = produtos.find((p) => p.name === "Água");
      expect(coca, "Coca-Cola Lata deve existir no seed").toBeDefined();
      expect(agua, "Água deve existir no seed").toBeDefined();

      await page.request.post("/api/auth/logout");

      // ── 1. ATENDENTE: login via PIN na tela ─────────────────────────────
      await loginViaPIN(page, "atendente", E2E_ATENDENTE.pin);

      // ── 2. ATENDENTE: cria pedido com 2 itens via API ───────────────────
      // A session iron-session agora é do atendente; API call compartilha o cookie.
      const orderRes = await page.request.post("/api/orders", {
        data: {
          clientName: "E2E Cliente",
          operator: E2E_ATENDENTE.name,
          items: [
            { productId: coca!.id, quantity: 1 },
            { productId: agua!.id, quantity: 1 },
          ],
        },
      });
      expect(orderRes.status(), "Criar pedido retorna 201").toBe(201);
      const order = await orderRes.json();
      const orderId: number = order.id;
      expect(orderId, "Pedido deve ter ID").toBeGreaterThan(0);
      expect(order.status).toBe("PEDIDO_FEITO");
      expect(order.items, "Pedido deve ter 2 itens").toHaveLength(2);

      await page.request.post("/api/auth/logout");

      // ── 3. COZINHA: login via PIN ────────────────────────────────────────
      await loginViaPIN(page, "cozinha", E2E_COZINHA.pin);

      // ── 4. COZINHA: PEDIDO_FEITO → EM_PREPARO → PRONTO ──────────────────
      const emPreparoRes = await page.request.patch(
        `/api/orders/${orderId}`,
        { data: { status: "EM_PREPARO", operator: E2E_COZINHA.name } },
      );
      expect(emPreparoRes.ok(), "Transição para EM_PREPARO").toBeTruthy();

      const prontoRes = await page.request.patch(`/api/orders/${orderId}`, {
        data: { status: "PRONTO", operator: E2E_COZINHA.name },
      });
      expect(prontoRes.ok(), "Transição para PRONTO").toBeTruthy();

      await page.request.post("/api/auth/logout");

      // ── 5. ATENDENTE: volta, login, marca ENTREGUE ──────────────────────
      await loginViaPIN(page, "atendente", E2E_ATENDENTE.pin);

      const entregueRes = await page.request.patch(
        `/api/orders/${orderId}`,
        { data: { status: "ENTREGUE", operator: E2E_ATENDENTE.name } },
      );
      expect(entregueRes.ok(), "Transição para ENTREGUE").toBeTruthy();

      // ── 6. VALIDAR ROW FINAL ─────────────────────────────────────────────
      // PATCH retorna o estado atualizado do DB — equivale a validar a row.
      const finalOrder = await entregueRes.json();
      expect(finalOrder.status, "Status final deve ser ENTREGUE").toBe(
        "ENTREGUE",
      );
      expect(finalOrder.clientName, "Nome do cliente").toBe("E2E Cliente");
      expect(finalOrder.items, "Pedido final deve ter 2 itens").toHaveLength(2);
      expect(finalOrder.deliveredBy, "Entregue pelo atendente correto").toBe(
        E2E_ATENDENTE.name,
      );
    },
  );
});
