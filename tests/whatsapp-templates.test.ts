import { describe, expect, it } from "vitest";
import {
  buildPublicOrderUrl,
  buildWaNativeUrl,
  buildWaUrl,
  templateOrderReady,
  templateReceipt,
} from "@/lib/whatsapp-templates";
import type { OrderView } from "@/lib/orders";

function fakeOrder(overrides: Partial<OrderView> = {}): OrderView {
  return {
    id: 42,
    clientName: "Maria",
    clientPhone: "+5511999998888",
    status: "PEDIDO_FEITO",
    createdAt: new Date("2026-06-01T20:00:00Z"),
    updatedAt: new Date("2026-06-01T20:00:00Z"),
    createdBy: "Atendente",
    preparedBy: null,
    preparedAt: null,
    readyBy: null,
    readyAt: null,
    deliveredBy: null,
    deliveredAt: null,
    cancelledBy: null,
    cancelledAt: null,
    cancelReason: null,
    customerId: null,
    notifiedReadyAt: null,
    notifiedReadyBy: null,
    eventSessionId: null,
    promotionId: null,
    promotionName: null,
    discountCents: 0,
    publicToken: "abc7x9k2Pq",
    items: [],
    totalCents: 1500,
    finalCents: 1500,
    ...overrides,
  } as OrderView;
}

describe("buildWaUrl", () => {
  it("com telefone normalizado (+55) → abre conversa direto", () => {
    const url = buildWaUrl("+5511999998888", "oi");
    expect(url).toBe("https://wa.me/5511999998888?text=oi");
  });

  it("encoda o texto (espaços, quebras, acentos)", () => {
    const url = buildWaUrl("+5511999998888", "Pedido #042\nPronto!");
    expect(url).toContain("https://wa.me/5511999998888?text=");
    expect(url).toContain(encodeURIComponent("Pedido #042\nPronto!"));
  });

  it("sem telefone → abre seletor de contato (wa.me sem número)", () => {
    expect(buildWaUrl(null, "oi")).toBe("https://wa.me/?text=oi");
    expect(buildWaUrl(undefined, "oi")).toBe("https://wa.me/?text=oi");
    expect(buildWaUrl("", "oi")).toBe("https://wa.me/?text=oi");
  });

  it("tira não-dígitos do telefone (parênteses, traços, espaços)", () => {
    const url = buildWaUrl("(11) 99999-8888", "oi");
    // sem +55 vira só os dígitos digitados — caso de telefone não-normalizado
    expect(url).toBe("https://wa.me/11999998888?text=oi");
  });
});

describe("buildWaNativeUrl", () => {
  it("com telefone → deep link whatsapp://send", () => {
    const url = buildWaNativeUrl("+5511999998888", "oi");
    expect(url).toBe("whatsapp://send?phone=5511999998888&text=oi");
  });

  it("sem telefone → cai pro wa.me web (sem destino nativo)", () => {
    expect(buildWaNativeUrl(null, "oi")).toBe("https://wa.me/?text=oi");
  });

  it("encoda o texto", () => {
    const url = buildWaNativeUrl("+5511999998888", "Olá, tá pronto 🍔");
    expect(url).toContain(encodeURIComponent("Olá, tá pronto 🍔"));
  });
});

describe("buildPublicOrderUrl", () => {
  it("monta URL com token + baseUrl explícito", () => {
    const url = buildPublicOrderUrl(fakeOrder(), "https://cozinhadagil.evapro.cloud");
    expect(url).toBe("https://cozinhadagil.evapro.cloud/p/abc7x9k2Pq");
  });

  it("retorna null se publicToken nulo (pedido legado pré-backfill)", () => {
    const url = buildPublicOrderUrl(fakeOrder({ publicToken: null }), "https://x.com");
    expect(url).toBeNull();
  });

  it("retorna null sem baseUrl e sem window (contexto server-side)", () => {
    // No vitest a env é jsdom mas window não tem origin do app — só localhost
    // de teste; ainda assim, sem baseUrl explícito retorna o origin do jsdom.
    // Pra simular pure-server, vou passar order com token mas sem baseUrl
    // e mockar window como undefined.
    const original = globalThis.window;
    // @ts-expect-error — apagar window simula SSR
    delete globalThis.window;
    try {
      expect(buildPublicOrderUrl(fakeOrder())).toBeNull();
    } finally {
      globalThis.window = original;
    }
  });

  it("remove barra final do baseUrl pra evitar // no path", () => {
    const url = buildPublicOrderUrl(fakeOrder(), "https://x.com/");
    expect(url).toBe("https://x.com/p/abc7x9k2Pq");
  });
});

describe("templateReceipt", () => {
  it("NÃO inclui linha de tracking quando baseUrl ausente", () => {
    const original = globalThis.window;
    // @ts-expect-error — simula SSR
    delete globalThis.window;
    try {
      const text = templateReceipt(fakeOrder());
      expect(text).not.toContain("Acompanhe:");
    } finally {
      globalThis.window = original;
    }
  });

  it("inclui linha 'Acompanhe: <url>' quando baseUrl + token presentes", () => {
    const text = templateReceipt(fakeOrder(), "https://cozinhadagil.evapro.cloud");
    expect(text).toContain("Acompanhe: https://cozinhadagil.evapro.cloud/p/abc7x9k2Pq");
  });

  it("NÃO inclui tracking se pedido sem publicToken (legado)", () => {
    const text = templateReceipt(fakeOrder({ publicToken: null }), "https://x.com");
    expect(text).not.toContain("Acompanhe:");
  });
});

describe("templateOrderReady", () => {
  it("usa primeiro nome do cliente", () => {
    const text = templateOrderReady(fakeOrder({ clientName: "Maria da Silva" }));
    expect(text).toContain("Oi Maria!");
  });

  it("inclui número do pedido formatado", () => {
    const text = templateOrderReady(fakeOrder({ id: 7 }));
    expect(text).toContain("#007");
  });

  it("inclui linha de tracking com baseUrl", () => {
    const text = templateOrderReady(fakeOrder(), "https://cozinhadagil.evapro.cloud");
    expect(text).toContain("Acompanhe: https://cozinhadagil.evapro.cloud/p/abc7x9k2Pq");
  });

  it("NÃO inclui tracking sem baseUrl ou sem token", () => {
    const original = globalThis.window;
    // @ts-expect-error — simula SSR
    delete globalThis.window;
    try {
      expect(templateOrderReady(fakeOrder())).not.toContain("Acompanhe:");
    } finally {
      globalThis.window = original;
    }
  });
});
