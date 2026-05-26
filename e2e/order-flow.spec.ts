import { test, expect, type Page } from "@playwright/test";

/**
 * Fluxo completo de 1 pedido: atendente cria → cozinha prepara → atendente entrega.
 *
 * Setup: login como admin (Gil), cria usuários de teste (atendente + cozinha),
 * abre caixa. Flow principal usa PIN no keypad virtual.
 *
 * Cobertura:
 *   - Login por papel + PIN via keypad
 *   - Criação de pedido com 2 itens (pastel salgado grande + bebida express)
 *   - Transição PEDIDO_FEITO → EM_PREPARO → PRONTO na cozinha
 *   - Entrega (PRONTO → ENTREGUE) no atendente
 *   - Validação do status final via API
 */

const ATENDENTE_NAME = "E2E Atendente";
const COZINHA_NAME = "E2E Cozinheiro";
const ATENDENTE_PIN = "7391";
const COZINHA_PIN = "8402";

async function enterPin(page: Page, pin: string) {
  const numpad = page.getByRole("group", { name: "Teclado numérico" });
  for (const digit of pin) {
    await numpad.getByRole("button", { name: digit, exact: true }).click();
  }
}

async function clearOperatorSession(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem("pdg:operator");
    localStorage.removeItem("pdg:operator-persistent");
    localStorage.removeItem("pdg:operator-session");
  });
}

async function disableAnimations(page: Page) {
  await page.addStyleTag({
    content:
      "*, *::before, *::after { animation-duration: 0ms !important; animation-delay: 0ms !important; transition-duration: 0ms !important; }",
  });
}

test.describe("Fluxo completo de pedido", () => {
  // Setup via API: login admin → criar usuários de teste → abrir caixa.
  // `request` fixture mantém cookies entre chamadas dentro do mesmo test.
  test.beforeAll(async ({ request }) => {
    // Login como Gil (admin)
    const loginRes = await request.post("/api/auth/login", {
      data: { name: "Gil", password: "2699", role: "admin" },
    });
    expect(loginRes.ok()).toBeTruthy();

    // Criar atendente de teste (ignora 409 se já existir de run anterior)
    const atendenteRes = await request.post("/api/users", {
      data: { name: ATENDENTE_NAME, role: "atendente", password: ATENDENTE_PIN },
    });
    expect([201, 409]).toContain(atendenteRes.status());

    // Criar cozinheiro de teste (ignora 409 se já existir)
    const cozinhaRes = await request.post("/api/users", {
      data: { name: COZINHA_NAME, role: "cozinha", password: COZINHA_PIN },
    });
    expect([201, 409]).toContain(cozinhaRes.status());

    // Abrir caixa (ignora 409 se já tiver um aberto)
    const caixaRes = await request.post("/api/events/open", {
      data: { operator: "Gil", name: "E2E Test" },
    });
    expect([201, 409]).toContain(caixaRes.status());
  });

  test("atendente cria pedido → cozinha prepara → atendente entrega", async ({
    page,
  }) => {
    // Nome único por run pra não misturar com pedidos de outras execuções
    const clientName = `E2E-${Date.now()}`;

    // ── ATENDENTE: login via PIN ─────────────────────────────────────────

    await page.goto("/");
    await clearOperatorSession(page);
    await page.reload();
    await disableAnimations(page);

    await page.getByRole("button", { name: /Atendente/i }).click();
    await enterPin(page, ATENDENTE_PIN);
    await page.waitForURL("/atendente", { timeout: 10000 });
    await disableAnimations(page);

    // ── ATENDENTE: criar pedido com 2 itens ─────────────────────────────

    // Abre novo pedido (force=true: FAB tem animate-fab-pulse quando fila vazia)
    await page
      .getByRole("button", { name: /Novo pedido/i })
      .click({ force: true });

    // Fase "client" — preenche nome do cliente
    await page.getByPlaceholder(/Ex: Mesa|João/i).fill(clientName);
    await page.getByRole("button", { name: /Começar/i }).click();

    // Fase "product" — aguarda o texto da categoria
    await expect(page.getByText("O que vai pedir?")).toBeVisible({
      timeout: 8000,
    });

    // Clica na categoria "Pastel" via desc text (mais confiável que role)
    await page.getByText("Salgado, doce ou pack").click();

    // Subcategoria "Salgado"
    await page.getByRole("button", { name: /^Salgado/i }).first().click();

    // Fase "configure" (pastel salgado: tamanho + ingredientes na mesma tela)
    await expect(page.getByText("Pastel Salgado")).toBeVisible({
      timeout: 5000,
    });

    // Seleciona tamanho Grande
    await page.getByRole("button", { name: /Grande/i }).first().click();

    // Seleciona ingrediente Frango (aria-label="Frango")
    await page.getByRole("button", { name: "Frango" }).click();

    // Adiciona ao pedido (bottom bar)
    await page
      .getByRole("button", { name: /Adicionar ao pedido/i })
      .click({ force: true });

    // Fase "cart" — 1 item no resumo
    await expect(page.getByText(/1 item/i)).toBeVisible({ timeout: 5000 });

    // Adiciona segundo item via "+ Adicionar outro pastel"
    await page.getByRole("button", { name: /Adicionar outro pastel/i }).click();

    // De volta na fase "product" — express carousel com bebidas
    await expect(page.getByText("O que vai pedir?")).toBeVisible({
      timeout: 5000,
    });

    // Coca-Cola está no carrossel "⚡ Adicionar rápido"
    await page
      .getByRole("button", { name: /Coca-Cola Lata/i })
      .first()
      .click();

    // Fase "cart" — 2 itens agora
    await expect(page.getByText(/2 itens/i)).toBeVisible({ timeout: 5000 });

    // Confirma o pedido
    await page
      .getByRole("button", { name: /Confirmar pedido/i })
      .click({ force: true });

    // Toast com número do pedido
    const toast = page.locator(".animate-toast-drop");
    await expect(toast).toBeVisible({ timeout: 8000 });
    const toastText = (await toast.textContent()) ?? "";
    const idMatch = toastText.match(/#(\d+)/);
    expect(idMatch).not.toBeNull();
    const orderId = idMatch ? parseInt(idMatch[1]) : null;
    expect(orderId).toBeGreaterThan(0);

    // ── COZINHA: login via PIN ───────────────────────────────────────────

    await page.goto("/");
    await clearOperatorSession(page);
    await page.reload();
    await disableAnimations(page);

    await page.getByRole("button", { name: /Cozinha/i }).click();
    await enterPin(page, COZINHA_PIN);
    await page.waitForURL("/cozinha", { timeout: 10000 });
    await disableAnimations(page);

    // ── COZINHA: avançar pedido ──────────────────────────────────────────

    // O pedido aparece na fila (pastel salgado vai pra cozinha; bebida filtrada)
    const orderLabel = `#${String(orderId).padStart(3, "0")}`;
    await expect(page.getByText(orderLabel)).toBeVisible({ timeout: 10000 });

    // Clica "Iniciar preparo" no ticket
    await page.getByRole("button", { name: /Iniciar preparo/i }).click({
      force: true,
    });

    // Badge muda pra "Em preparo"
    await expect(page.getByText(/Em preparo/i).first()).toBeVisible({
      timeout: 8000,
    });

    // Clica "Finalizar" — ticket vai pra PRONTO e some da fila da cozinha
    await page
      .getByRole("button", { name: /Finalizar/i })
      .click({ force: true });

    // Ticket deve sumir da fila da cozinha
    await expect(page.getByText(orderLabel)).not.toBeVisible({
      timeout: 10000,
    });

    // ── ATENDENTE: login novamente + entregar ────────────────────────────

    await page.goto("/");
    await clearOperatorSession(page);
    await page.reload();
    await disableAnimations(page);

    await page.getByRole("button", { name: /Atendente/i }).click();
    await enterPin(page, ATENDENTE_PIN);
    await page.waitForURL("/atendente", { timeout: 10000 });
    await disableAnimations(page);

    // Filtro padrão é "PRONTO" — o pedido deve estar visível
    await expect(page.getByText(orderLabel)).toBeVisible({ timeout: 10000 });

    // Clica "Retirada" (botão de entrega no OrderCard)
    await page
      .getByRole("button", { name: /Retirada/i })
      .first()
      .click({ force: true });

    // Pedido some do filtro PRONTO
    await expect(page.getByText(orderLabel)).not.toBeVisible({
      timeout: 8000,
    });

    // ── VALIDAÇÃO: status final via API ────────────────────────────────

    await page.request.post("/api/auth/login", {
      data: { name: "Gil", password: "2699", role: "admin" },
    });
    const ordersRes = await page.request.get("/api/orders");
    expect(ordersRes.ok()).toBe(true);
    const orders = await ordersRes.json();
    const targetOrder = orders.find((o: { id: number }) => o.id === orderId);
    expect(targetOrder).toBeDefined();
    expect(targetOrder.status).toBe("ENTREGUE");
    expect(targetOrder.clientName).toBe(clientName);
    // 2 itens: pastel salgado + coca-cola
    expect(targetOrder.items).toHaveLength(2);
  }, 90_000); // timeout maior pra cobrir login×3 + fluxo completo
});
