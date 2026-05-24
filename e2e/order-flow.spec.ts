import { test, expect } from "@playwright/test";

// PINs exclusivos pra usuários de teste — não conflitam com PINs reais da família.
// Se já existirem (run anterior), POST /api/users retorna 409 e ignoramos.
const E2E_PIN_ATENDENTE = "7761";
const E2E_PIN_COZINHA = "7762";

/**
 * Fluxo completo de 1 pedido:
 * admin abre caixa → atendente cria pedido (2 itens) →
 * cozinha prepara e marca PRONTO → atendente marca ENTREGUE →
 * valida status final no DB.
 *
 * Usa 3 contextos de API separados (3 cookies independentes) pra simular
 * 3 devices diferentes. Se SSE, auth ou schema quebrarem, esse teste
 * captura antes de chegar em produção.
 */
test.describe("Fluxo completo de pedido", () => {
  test("atendente cria pedido → cozinha prepara → atendente entrega", async ({
    playwright,
  }) => {
    const baseURL =
      process.env.PLAYWRIGHT_BASE_URL || "http://localhost:59574";

    const adminCtx = await playwright.request.newContext({ baseURL });
    const atendenteCtx = await playwright.request.newContext({ baseURL });
    const cozinhaCtx = await playwright.request.newContext({ baseURL });

    try {
      // ── 1. Login admin (Gil) ────────────────────────────────────────────
      const loginAdmin = await adminCtx.post("/api/auth/login", {
        data: { name: "Gil", password: "2699", role: "admin" },
      });
      expect(loginAdmin.ok(), "Login Gil falhou").toBe(true);

      // ── 2. Garantir caixa aberto ────────────────────────────────────────
      // 201 = abriu agora; 409 = já tinha aberto (ambos ok)
      const openCaixa = await adminCtx.post("/api/events/open", {
        data: { operator: "Gil", name: "E2E order-flow" },
      });
      expect(
        [201, 409].includes(openCaixa.status()),
        `Abrir caixa retornou ${openCaixa.status()}`,
      ).toBe(true);

      // ── 3. Criar usuários de teste (idempotente — ignora 409) ───────────
      await adminCtx.post("/api/users", {
        data: {
          name: "E2E_Atendente",
          role: "atendente",
          password: E2E_PIN_ATENDENTE,
        },
      });
      await adminCtx.post("/api/users", {
        data: {
          name: "E2E_Cozinha",
          role: "cozinha",
          password: E2E_PIN_COZINHA,
        },
      });

      // ── 4. Login atendente ──────────────────────────────────────────────
      const loginAtendente = await atendenteCtx.post("/api/auth/login", {
        data: {
          name: "E2E_Atendente",
          password: E2E_PIN_ATENDENTE,
          role: "atendente",
        },
      });
      expect(loginAtendente.ok(), "Login E2E_Atendente falhou").toBe(true);

      // ── 5. Buscar produtos disponíveis ──────────────────────────────────
      const productsRes = await atendenteCtx.get(
        "/api/products?available=true",
      );
      expect(productsRes.ok()).toBe(true);
      const products = await productsRes.json();

      type ProductSize = { id: string; name: string; priceCents: number };
      type Product = { id: string; name: string; type: string; sizes: ProductSize[] };

      const pastelSalgado = (products as Product[]).find(
        (p) => p.name === "Pastel Salgado",
      );
      const pastelDoce = (products as Product[]).find(
        (p) => p.name === "Pastel Doce",
      );
      expect(pastelSalgado, "Pastel Salgado não encontrado no cardápio").toBeDefined();
      expect(pastelDoce, "Pastel Doce não encontrado no cardápio").toBeDefined();

      const sizeGrande = pastelSalgado!.sizes.find((s) => s.name === "Grande");
      const sizeNormal = pastelDoce!.sizes.find((s) => s.name === "Normal");
      expect(sizeGrande, "Size 'Grande' não encontrado em Pastel Salgado").toBeDefined();
      expect(sizeNormal, "Size 'Normal' não encontrado em Pastel Doce").toBeDefined();

      // ── 6. Criar pedido com 2 itens ────────────────────────────────────
      const orderRes = await atendenteCtx.post("/api/orders", {
        data: {
          clientName: "E2E Cliente Fluxo",
          operator: "E2E_Atendente",
          items: [
            {
              productId: pastelSalgado!.id,
              productSizeId: sizeGrande!.id,
              ingredients: ["Frango", "Queijo"],
            },
            {
              productId: pastelDoce!.id,
              productSizeId: sizeNormal!.id,
              ingredients: ["Doce de leite"],
            },
          ],
        },
      });
      expect(orderRes.status(), "Criar pedido não retornou 201").toBe(201);

      const order = await orderRes.json();
      expect(order.clientName).toBe("E2E Cliente Fluxo");
      expect(order.items).toHaveLength(2);
      expect(order.status).toBe("PEDIDO_FEITO");
      // 2000 (Grande Salgado) + 1500 (Normal Doce) = 3500 centavos
      expect(order.totalCents).toBe(3500);

      // ── 7. Login cozinha ────────────────────────────────────────────────
      const loginCozinha = await cozinhaCtx.post("/api/auth/login", {
        data: {
          name: "E2E_Cozinha",
          password: E2E_PIN_COZINHA,
          role: "cozinha",
        },
      });
      expect(loginCozinha.ok(), "Login E2E_Cozinha falhou").toBe(true);

      // ── 8. Cozinha: PEDIDO_FEITO → EM_PREPARO ──────────────────────────
      const emPreparo = await cozinhaCtx.patch(`/api/orders/${order.id}`, {
        data: { status: "EM_PREPARO", operator: "E2E_Cozinha" },
      });
      expect(emPreparo.ok(), "Transição pra EM_PREPARO falhou").toBe(true);

      // ── 9. Cozinha: EM_PREPARO → PRONTO ────────────────────────────────
      const pronto = await cozinhaCtx.patch(`/api/orders/${order.id}`, {
        data: { status: "PRONTO", operator: "E2E_Cozinha" },
      });
      expect(pronto.ok(), "Transição pra PRONTO falhou").toBe(true);
      const prontoBody = await pronto.json();
      expect(prontoBody.status).toBe("PRONTO");
      expect(prontoBody.readyBy).toBe("E2E_Cozinha");

      // ── 10. Atendente: PRONTO → ENTREGUE ───────────────────────────────
      const entregue = await atendenteCtx.patch(`/api/orders/${order.id}`, {
        data: { status: "ENTREGUE", operator: "E2E_Atendente" },
      });
      expect(entregue.ok(), "Transição pra ENTREGUE falhou").toBe(true);
      const entregueBody = await entregue.json();
      expect(entregueBody.status).toBe("ENTREGUE");
      expect(entregueBody.deliveredBy).toBe("E2E_Atendente");

      // ── 11. Validar row final via GET /api/orders ────────────────────────
      const allOrdersRes = await adminCtx.get("/api/orders?scope=today");
      expect(allOrdersRes.ok()).toBe(true);
      const allOrders = await allOrdersRes.json();

      type OrderRow = { id: number; status: string; items: unknown[] };
      const finalOrder = (allOrders as OrderRow[]).find(
        (o) => o.id === order.id,
      );
      expect(finalOrder, "Pedido não encontrado em GET /api/orders").toBeDefined();
      expect(finalOrder!.status).toBe("ENTREGUE");
      expect(finalOrder!.items).toHaveLength(2);
    } finally {
      await adminCtx.dispose();
      await atendenteCtx.dispose();
      await cozinhaCtx.dispose();
    }
  });

  test("transição inválida retorna 409 com code INVALID_TRANSITION", async ({
    playwright,
  }) => {
    const baseURL =
      process.env.PLAYWRIGHT_BASE_URL || "http://localhost:59574";

    const adminCtx = await playwright.request.newContext({ baseURL });

    try {
      const loginAdmin = await adminCtx.post("/api/auth/login", {
        data: { name: "Gil", password: "2699", role: "admin" },
      });
      expect(loginAdmin.ok()).toBe(true);

      // Garantir caixa aberto
      await adminCtx.post("/api/events/open", {
        data: { operator: "Gil", name: "E2E transição" },
      });

      // Buscar produto
      const productsRes = await adminCtx.get("/api/products?available=true");
      const products = await productsRes.json();
      type Product = { id: string; name: string; sizes: { id: string; name: string }[] };
      const pastelSalgado = (products as Product[]).find(
        (p) => p.name === "Pastel Salgado",
      );
      const sizePequeno = pastelSalgado?.sizes.find(
        (s) => s.name === "Pequeno",
      );
      expect(sizePequeno).toBeDefined();

      // Criar pedido
      const orderRes = await adminCtx.post("/api/orders", {
        data: {
          clientName: "E2E Transição Inválida",
          operator: "Gil",
          items: [
            {
              productId: pastelSalgado!.id,
              productSizeId: sizePequeno!.id,
              ingredients: ["Carne"],
            },
          ],
        },
      });
      expect(orderRes.status()).toBe(201);
      const order = await orderRes.json();

      // Tentar pular direto pra ENTREGUE sem passar por EM_PREPARO/PRONTO
      const invalidTransition = await adminCtx.patch(
        `/api/orders/${order.id}`,
        {
          data: { status: "ENTREGUE", operator: "Gil" },
        },
      );
      expect(invalidTransition.status()).toBe(409);
      const errBody = await invalidTransition.json();
      expect(errBody.code).toBe("INVALID_TRANSITION");
      expect(errBody.currentStatus).toBe("PEDIDO_FEITO");
      expect(errBody.attemptedStatus).toBe("ENTREGUE");
    } finally {
      await adminCtx.dispose();
    }
  });
});
