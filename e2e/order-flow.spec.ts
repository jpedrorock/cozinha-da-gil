import { test, expect, request as apiRequest } from "@playwright/test";

/**
 * Fluxo completo de pedido:
 * Gil abre caixa → atendente cria pedido → cozinha prepara → atendente entrega.
 * Valida transições de status e timestamps.
 */
test.describe("Fluxo completo de pedido", () => {
  test(
    "atendente cria → cozinha prepara → atendente entrega",
    async ({ baseURL }) => {
      const base = baseURL!;

      // Contextos separados = sessões independentes (cookies isolados por user)
      const adminCtx = await apiRequest.newContext({ baseURL: base });
      const atendenteCtx = await apiRequest.newContext({ baseURL: base });
      const cozinhaCtx = await apiRequest.newContext({ baseURL: base });

      try {
        // ── 1. Login Gil ─────────────────────────────────────────────────
        const loginGil = await adminCtx.post("/api/auth/login", {
          data: { name: "Gil", password: "2699", role: "admin" },
        });
        expect(loginGil.ok(), "login Gil").toBe(true);

        // ── 2. Abre caixa (idempotente: 201 = criou, 409 = já aberto) ───
        const openCaixa = await adminCtx.post("/api/events/open", {
          data: { operator: "Gil", name: "E2E order-flow" },
        });
        expect(
          [201, 409],
          "abrir caixa retorna 201 ou 409",
        ).toContain(openCaixa.status());

        // ── 3. Garante usuários de teste ──────────────────────────────────
        // 201 = criado agora, 409 = já existia de run anterior — ambos OK
        await adminCtx.post("/api/users", {
          data: { name: "E2E-Atendente", role: "atendente", password: "7777" },
        });
        await adminCtx.post("/api/users", {
          data: { name: "E2E-Cozinha", role: "cozinha", password: "6666" },
        });

        // ── 4. Busca produtos ──────────────────────────────────────────────
        const productsRes = await adminCtx.get("/api/products?type=salgado");
        expect(productsRes.ok(), "GET /api/products?type=salgado").toBe(true);
        const products = await productsRes.json();

        const pastelSalgado = products.find(
          (p: { name: string }) => p.name === "Pastel Salgado",
        );
        expect(pastelSalgado, "produto Pastel Salgado existe").toBeDefined();

        const sizeGrande = pastelSalgado.sizes.find(
          (s: { name: string }) => s.name === "Grande",
        );
        const sizePequeno = pastelSalgado.sizes.find(
          (s: { name: string }) => s.name === "Pequeno",
        );
        expect(sizeGrande, "tamanho Grande existe").toBeDefined();
        expect(sizePequeno, "tamanho Pequeno existe").toBeDefined();

        // ── 5. Login como atendente ────────────────────────────────────────
        const loginAtendente = await atendenteCtx.post("/api/auth/login", {
          data: {
            name: "E2E-Atendente",
            password: "7777",
            role: "atendente",
          },
        });
        expect(loginAtendente.ok(), "login E2E-Atendente").toBe(true);

        // ── 6. Cria pedido com 2 itens ─────────────────────────────────────
        const orderRes = await atendenteCtx.post("/api/orders", {
          data: {
            clientName: "E2E-Cliente",
            operator: "E2E-Atendente",
            items: [
              {
                productId: pastelSalgado.id,
                productSizeId: sizeGrande.id,
                quantity: 1,
              },
              {
                productId: pastelSalgado.id,
                productSizeId: sizePequeno.id,
                quantity: 1,
              },
            ],
          },
        });
        expect(orderRes.status(), "criar pedido retorna 201").toBe(201);

        const order = await orderRes.json();
        expect(order.status, "pedido inicia como PEDIDO_FEITO").toBe(
          "PEDIDO_FEITO",
        );
        expect(order.items, "pedido tem 2 itens").toHaveLength(2);
        expect(order.clientName).toBe("E2E-Cliente");

        // ── 7. Login como cozinha ──────────────────────────────────────────
        const loginCozinha = await cozinhaCtx.post("/api/auth/login", {
          data: { name: "E2E-Cozinha", password: "6666", role: "cozinha" },
        });
        expect(loginCozinha.ok(), "login E2E-Cozinha").toBe(true);

        // ── 8. Cozinha: PEDIDO_FEITO → EM_PREPARO ─────────────────────────
        const emPreparoRes = await cozinhaCtx.patch(
          `/api/orders/${order.id}`,
          { data: { status: "EM_PREPARO", operator: "E2E-Cozinha" } },
        );
        expect(emPreparoRes.ok(), "transição → EM_PREPARO").toBe(true);
        const emPreparo = await emPreparoRes.json();
        expect(emPreparo.status).toBe("EM_PREPARO");
        expect(emPreparo.preparedBy).toBe("E2E-Cozinha");
        expect(emPreparo.preparedAt).not.toBeNull();

        // ── 9. Cozinha: EM_PREPARO → PRONTO ───────────────────────────────
        const prontoRes = await cozinhaCtx.patch(`/api/orders/${order.id}`, {
          data: { status: "PRONTO", operator: "E2E-Cozinha" },
        });
        expect(prontoRes.ok(), "transição → PRONTO").toBe(true);
        const pronto = await prontoRes.json();
        expect(pronto.status).toBe("PRONTO");
        expect(pronto.readyBy).toBe("E2E-Cozinha");
        expect(pronto.readyAt).not.toBeNull();

        // ── 10. Atendente: PRONTO → ENTREGUE ──────────────────────────────
        const entregueRes = await atendenteCtx.patch(
          `/api/orders/${order.id}`,
          { data: { status: "ENTREGUE", operator: "E2E-Atendente" } },
        );
        expect(entregueRes.ok(), "transição → ENTREGUE").toBe(true);
        const entregue = await entregueRes.json();
        expect(entregue.status).toBe("ENTREGUE");
        expect(entregue.deliveredBy).toBe("E2E-Atendente");
        expect(entregue.deliveredAt).not.toBeNull();
        expect(entregue.items).toHaveLength(2);

        // ── 11. Valida que transições inválidas são bloqueadas ─────────────
        // ENTREGUE é estado terminal — deve rejeitar qualquer tentativa de reverter
        const revertRes = await adminCtx.patch(`/api/orders/${order.id}`, {
          data: { status: "PRONTO" },
        });
        expect(revertRes.status(), "reverter ENTREGUE → PRONTO é inválido").toBe(
          409,
        );
        const revertBody = await revertRes.json();
        expect(revertBody.code).toBe("INVALID_TRANSITION");
      } finally {
        await adminCtx.dispose();
        await atendenteCtx.dispose();
        await cozinhaCtx.dispose();
      }
    },
  );
});
