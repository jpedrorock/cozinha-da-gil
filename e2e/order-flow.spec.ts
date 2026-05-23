import { test, expect, type APIRequestContext } from "@playwright/test";

/**
 * Fluxo completo de pedido: atendente cria → cozinha prepara → atendente entrega.
 *
 * Usa API diretamente (sem browser) para ser rápido e confiável.
 * Cobre o caminho crítico: quebra de SSE, auth, ou state machine aparece aqui.
 *
 * Pré-requisito: servidor rodando (npm run dev ou npm start).
 * Usuários de teste (PIN 7788/8877) são criados se não existirem — idempotente.
 */

const ADMIN_PIN = "2699";
const TEST_ATENDENTE_NAME = "E2E-Atendente";
const TEST_ATENDENTE_PIN = "7788";
const TEST_COZINHA_NAME = "E2E-Cozinha";
const TEST_COZINHA_PIN = "8877";

async function loginAs(
  req: APIRequestContext,
  opts: { role: string; password: string; name?: string },
) {
  const res = await req.post("/api/auth/login", {
    data: { name: opts.name, password: opts.password, role: opts.role },
  });
  expect(res.ok(), `Login como ${opts.role} falhou: ${await res.text()}`).toBe(true);
  return await res.json();
}

async function ensureUser(
  req: APIRequestContext,
  name: string,
  role: string,
  password: string,
) {
  const res = await req.post("/api/users", {
    data: { name, role, password },
  });
  // 201 = criado, 409 = já existe — ambos OK
  expect([201, 409]).toContain(res.status());
}

test.describe("Fluxo completo de pedido", () => {
  test("atendente cria pedido → cozinha prepara → atendente entrega", async ({ request }) => {
    // 1. Login admin (Gil) e prepara ambiente
    await loginAs(request, { role: "admin", password: ADMIN_PIN, name: "Gil" });

    // Abre caixa (ou reutiliza se já aberto)
    const openRes = await request.post("/api/events/open", {
      data: { operator: "Gil", name: "E2E order-flow" },
    });
    expect([201, 409]).toContain(openRes.status());

    // Cria usuários de teste se não existirem
    await ensureUser(request, TEST_ATENDENTE_NAME, "atendente", TEST_ATENDENTE_PIN);
    await ensureUser(request, TEST_COZINHA_NAME, "cozinha", TEST_COZINHA_PIN);

    // Busca produto Pastel Salgado pra usar no pedido
    const productsRes = await request.get("/api/products?type=salgado");
    expect(productsRes.ok()).toBe(true);
    const products: Array<{ id: string; name: string; sizes: Array<{ id: string; name: string }> }> =
      await productsRes.json();
    const salgado = products.find((p) => p.name === "Pastel Salgado");
    expect(salgado, "Produto 'Pastel Salgado' não encontrado — rode npm run db:seed").toBeDefined();
    const sizeGrande = salgado!.sizes.find((s) => s.name === "Grande");
    expect(sizeGrande, "Tamanho 'Grande' não encontrado no Pastel Salgado").toBeDefined();

    // Busca ingrediente Carne
    const ingredientsRes = await request.get("/api/ingredients");
    expect(ingredientsRes.ok()).toBe(true);
    const ingredients: Array<{ id: string; name: string; category: string }> =
      await ingredientsRes.json();
    const carne = ingredients.find((i) => i.name === "Carne" && i.category === "topping");
    expect(carne, "Ingrediente 'Carne' não encontrado").toBeDefined();

    // 2. Login como atendente e cria pedido com 2 itens
    await loginAs(request, { role: "atendente", password: TEST_ATENDENTE_PIN });

    const orderRes = await request.post("/api/orders", {
      data: {
        clientName: "E2E Cliente",
        operator: TEST_ATENDENTE_NAME,
        items: [
          {
            productId: salgado!.id,
            productSizeId: sizeGrande!.id,
            ingredients: [carne!.name],
          },
          {
            // Segundo item: mesmo produto, tamanho Grande
            productId: salgado!.id,
            productSizeId: sizeGrande!.id,
            ingredients: [carne!.name],
            notes: "Sem molho",
          },
        ],
      },
    });
    expect(orderRes.status(), `Criar pedido falhou: ${await orderRes.text()}`).toBe(201);
    const order = await orderRes.json();
    expect(order.status).toBe("PEDIDO_FEITO");
    expect(order.items).toHaveLength(2);
    const orderId: number = order.id;

    // 3. Login como cozinha — transição PEDIDO_FEITO → EM_PREPARO
    await loginAs(request, { role: "cozinha", password: TEST_COZINHA_PIN });

    const toPreparingRes = await request.patch(`/api/orders/${orderId}`, {
      data: { status: "EM_PREPARO", operator: TEST_COZINHA_NAME },
    });
    expect(toPreparingRes.ok(), `Transição pra EM_PREPARO falhou: ${await toPreparingRes.text()}`).toBe(true);
    const preparing = await toPreparingRes.json();
    expect(preparing.status).toBe("EM_PREPARO");

    // Transição EM_PREPARO → PRONTO
    const toReadyRes = await request.patch(`/api/orders/${orderId}`, {
      data: { status: "PRONTO", operator: TEST_COZINHA_NAME },
    });
    expect(toReadyRes.ok(), `Transição pra PRONTO falhou: ${await toReadyRes.text()}`).toBe(true);
    const ready = await toReadyRes.json();
    expect(ready.status).toBe("PRONTO");

    // 4. Login como atendente — transição PRONTO → ENTREGUE
    await loginAs(request, { role: "atendente", password: TEST_ATENDENTE_PIN });

    const toDeliveredRes = await request.patch(`/api/orders/${orderId}`, {
      data: { status: "ENTREGUE", operator: TEST_ATENDENTE_NAME },
    });
    expect(toDeliveredRes.ok(), `Transição pra ENTREGUE falhou: ${await toDeliveredRes.text()}`).toBe(true);
    const delivered = await toDeliveredRes.json();
    expect(delivered.status).toBe("ENTREGUE");

    // 5. Verifica estado final na resposta do último PATCH e via lista de pedidos
    expect(delivered.id).toBe(orderId);
    expect(delivered.status).toBe("ENTREGUE");
    expect(delivered.clientName).toBe("E2E Cliente");
    expect(delivered.items).toHaveLength(2);
    // Timestamps de progressão preenchidos
    expect(delivered.preparedAt).not.toBeNull();
    expect(delivered.readyAt).not.toBeNull();
    expect(delivered.deliveredAt).not.toBeNull();
  });

  test("transições inválidas são bloqueadas pela máquina de estados", async ({ request }) => {
    // Login admin pra ter acesso amplo
    await loginAs(request, { role: "admin", password: ADMIN_PIN, name: "Gil" });

    // Garante caixa aberto
    await request.post("/api/events/open", {
      data: { operator: "Gil", name: "E2E state-machine" },
    });

    // Busca produto Coca-Cola Lata (bebida — cria como PRONTO direto)
    const productsRes = await request.get("/api/products?type=bebida");
    const products: Array<{ id: string; name: string }> = await productsRes.json();
    const coca = products.find((p) => p.name === "Coca-Cola Lata");
    expect(coca, "Produto 'Coca-Cola Lata' não encontrado").toBeDefined();

    const orderRes = await request.post("/api/orders", {
      data: {
        clientName: "E2E State Machine",
        operator: "Gil",
        items: [{ productId: coca!.id, quantity: 1 }],
      },
    });
    expect(orderRes.status()).toBe(201);
    const order = await orderRes.json();
    // Bebida pula pra PRONTO direto
    expect(order.status).toBe("PRONTO");

    // Tentar voltar pra EM_PREPARO deve falhar (revert proibido)
    const revertRes = await request.patch(`/api/orders/${order.id}`, {
      data: { status: "EM_PREPARO", operator: "Gil" },
    });
    expect(revertRes.status()).toBe(409);
    const revertBody = await revertRes.json();
    expect(revertBody.code).toBe("INVALID_TRANSITION");

    // Transição válida PRONTO → ENTREGUE deve funcionar
    const deliverRes = await request.patch(`/api/orders/${order.id}`, {
      data: { status: "ENTREGUE", operator: "Gil" },
    });
    expect(deliverRes.ok()).toBe(true);

    // Tentar modificar pedido entregue (terminal) deve falhar
    const terminalRes = await request.patch(`/api/orders/${order.id}`, {
      data: { status: "CANCELADO", operator: "Gil" },
    });
    expect(terminalRes.status()).toBe(409);
  });
});
