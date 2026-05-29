import { expect, test } from "@playwright/test";

/**
 * E2E da regra de bypass de bebida (app/api/orders/route.ts):
 *
 *   const allBebida = resolvedItems.every((it) => it.kind === "bebida");
 *   const initialStatus = allBebida ? "PRONTO" : "PEDIDO_FEITO";
 *
 * Bebida não passa pela cozinha — atendente pega da geladeira e entrega.
 * Então pedido SÓ de bebida já nasce PRONTO (pula PEDIDO_FEITO/EM_PREPARO).
 * Pedido MISTO (pastel + bebida) segue o fluxo normal pela cozinha.
 *
 * Esse caminho perdeu cobertura quando o teste de Coca no order-flow foi
 * trocado por pastel (justamente porque bebida bypassa e quebrava o ciclo
 * completo). Aqui ele é testado de propósito, via API direta.
 *
 * Pré-requisitos (mesma infra do order-flow.spec.ts):
 *  - Gil admin PIN 2699 (seed) · Maria atendente PIN 1111 (globalSetup)
 *  - Produtos seedados (`npm run db:seed`): ao menos 1 bebida + 1 salgado
 *  - Servidor em PLAYWRIGHT_BASE_URL (default http://localhost:3000)
 */

const GIL_PIN = "2699";
const MARIA_PIN = "1111";
const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

type ApiProduct = {
  id: string;
  type: string;
  pricingMode: string;
  sizes: Array<{ id: string; name: string }>;
};

/** Item de bebida: pricingMode 'fixed' não exige size, mas manda se houver. */
function bebidaItem(bebida: ApiProduct) {
  const item: Record<string, unknown> = {
    productId: bebida.id,
    ingredients: [],
    sauces: [],
    quantity: 1,
  };
  if (bebida.sizes.length > 0) item.productSizeId = bebida.sizes[0].id;
  return item;
}

test.describe("Bebida bypassa a cozinha", () => {
  test.setTimeout(30_000);

  test("pedido só de bebida nasce PRONTO (não passa pela cozinha)", async ({
    playwright,
  }) => {
    const eventName = `E2E bebida ${Date.now()}`;
    const clientName = `Cliente bebida ${Date.now()}`;

    // Gil abre caixa
    const gilCtx = await playwright.request.newContext({ baseURL: BASE });
    const gilLogin = await gilCtx.post("/api/auth/login", {
      data: { name: "Gil", password: GIL_PIN, role: "admin" },
    });
    expect(gilLogin.ok()).toBe(true);
    const openRes = await gilCtx.post("/api/events/open", {
      data: { operator: "Gil", name: eventName },
    });
    expect([201, 409]).toContain(openRes.status());

    // Maria cria pedido só de bebida
    const mariaCtx = await playwright.request.newContext({ baseURL: BASE });
    const mariaLogin = await mariaCtx.post("/api/auth/login", {
      data: { name: "Maria", password: MARIA_PIN, role: "atendente" },
    });
    expect(mariaLogin.ok()).toBe(true);

    const products = (await (await mariaCtx.get("/api/products")).json()) as ApiProduct[];
    const bebida = products.find((p) => p.type === "bebida");
    if (!bebida) throw new Error("Nenhuma bebida no seed (rode npm run db:seed)");

    const orderRes = await mariaCtx.post("/api/orders", {
      data: { clientName, operator: "Maria", items: [bebidaItem(bebida)] },
    });
    expect(orderRes.status()).toBe(201);
    const order = await orderRes.json();

    // O ponto do teste: bebida pula a cozinha → já nasce PRONTO
    expect(order.status).toBe("PRONTO");

    await gilCtx.dispose();
    await mariaCtx.dispose();
  });

  test("pedido misto (pastel + bebida) NÃO bypassa — nasce PEDIDO_FEITO", async ({
    playwright,
  }) => {
    const eventName = `E2E misto ${Date.now()}`;
    const clientName = `Cliente misto ${Date.now()}`;

    const gilCtx = await playwright.request.newContext({ baseURL: BASE });
    await gilCtx.post("/api/auth/login", {
      data: { name: "Gil", password: GIL_PIN, role: "admin" },
    });
    await gilCtx.post("/api/events/open", {
      data: { operator: "Gil", name: eventName },
    });

    const mariaCtx = await playwright.request.newContext({ baseURL: BASE });
    await mariaCtx.post("/api/auth/login", {
      data: { name: "Maria", password: MARIA_PIN, role: "atendente" },
    });

    const products = (await (await mariaCtx.get("/api/products")).json()) as ApiProduct[];
    const bebida = products.find((p) => p.type === "bebida");
    const pastel = products.find((p) => p.type === "salgado");
    if (!bebida || !pastel || pastel.sizes.length === 0) {
      throw new Error("Seed incompleto (precisa de bebida + pastel salgado)");
    }
    const sizePequeno =
      pastel.sizes.find((s) => /pequeno/i.test(s.name)) ?? pastel.sizes[0];

    const orderRes = await mariaCtx.post("/api/orders", {
      data: {
        clientName,
        operator: "Maria",
        items: [
          {
            productId: pastel.id,
            productSizeId: sizePequeno.id,
            ingredients: ["Frango"],
            sauces: [],
            quantity: 1,
          },
          bebidaItem(bebida),
        ],
      },
    });
    expect(orderRes.status()).toBe(201);
    const order = await orderRes.json();

    // Tem pastel no meio → cozinha precisa preparar → fluxo normal
    expect(order.status).toBe("PEDIDO_FEITO");

    await gilCtx.dispose();
    await mariaCtx.dispose();
  });
});
