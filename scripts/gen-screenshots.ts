/**
 * Gera screenshots reais do app pra declarar no manifest PWA.
 * Resultado: PNGs em /public/screenshots/ — atendente, cozinha, cliente.
 *
 * Chrome Android usa esses screenshots no "rich install dialog" do
 * banner de instalação PWA — mostra prévias do app em vez de só ícone.
 * Audit PWA #6.
 *
 * Uso:
 *   1. Em outro terminal: `npm run dev`
 *   2. Garante que Gil + Maria + José existem (e2e/global-setup.ts faz isso):
 *      `npx playwright test --list` (roda globalSetup)
 *   3. `npx tsx scripts/gen-screenshots.ts`
 *
 * Idempotente: sobrescreve se já existir.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodeRequire = eval("require") as NodeRequire;
const fs = nodeRequire("fs").promises as typeof import("fs").promises;
const path = nodeRequire("path") as typeof import("path");

import { chromium, type APIRequestContext } from "playwright";

const BASE_URL = process.env.SCREENSHOT_BASE_URL || "http://localhost:3000";
const OUT_DIR = path.join(process.cwd(), "public", "screenshots");

// iPhone 14 Pro logical viewport — bom proxy de "mobile típico" pra
// rich install do Chrome Android (espera narrow form factor).
const VIEWPORT = { width: 390, height: 844 };

const GIL_PIN = "2699";
const MARIA_PIN = "1111";
const JOSE_PIN = "2222";

async function loginAs(
  request: APIRequestContext,
  name: string,
  pin: string,
  role: "admin" | "atendente" | "cozinha",
) {
  const res = await request.post(`${BASE_URL}/api/auth/login`, {
    data: { name, password: pin, role },
  });
  if (!res.ok()) {
    throw new Error(`Login falhou (${role}/${name}): ${res.status()}`);
  }
}

async function waitForSplashGone(page: import("playwright").Page) {
  // App tem splash z-100 nos primeiros ~600ms — espera sumir pra não
  // capturar a tela de boot em vez do conteúdo real.
  await page
    .locator('[aria-hidden="true"].fixed.z-\\[100\\]')
    .waitFor({ state: "hidden", timeout: 5_000 })
    .catch(() => {/* já sumiu */});
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();

  // Abre caixa (Gil) pra atendente/cozinha terem contexto válido
  const setupCtx = await browser.newContext({ baseURL: BASE_URL });
  await loginAs(setupCtx.request, "Gil", GIL_PIN, "admin");
  await setupCtx.request.post(`${BASE_URL}/api/events/open`, {
    data: { operator: "Gil", name: "Screenshot demo" },
  });
  // Cria 2 pedidos pra cozinha não ficar vazia
  const productsRes = await setupCtx.request.get(`${BASE_URL}/api/products`);
  const products = (await productsRes.json()) as Array<{
    id: string;
    type: string;
    sizes: Array<{ id: string }>;
  }>;
  const pastel = products.find((p) => p.type === "salgado");
  if (pastel) {
    const sizeId = pastel.sizes[0]?.id;
    // Login como Maria pra criar pedido com operador correto
    const mariaSetup = await browser.newContext({ baseURL: BASE_URL });
    await loginAs(mariaSetup.request, "Maria", MARIA_PIN, "atendente");
    for (const cliente of ["Ana", "Bruno"]) {
      await mariaSetup.request.post(`${BASE_URL}/api/orders`, {
        data: {
          clientName: cliente,
          operator: "Maria",
          items: [
            {
              productId: pastel.id,
              productSizeId: sizeId,
              ingredients: ["Frango"],
              sauces: [],
              quantity: 1,
            },
          ],
        },
      });
    }
    await mariaSetup.close();
  }
  await setupCtx.close();

  const targets: Array<{
    name: string;
    url: string;
    label: string;
    auth: { name: string; pin: string; role: "admin" | "atendente" | "cozinha" } | null;
  }> = [
    {
      name: "01-atendente.png",
      url: "/atendente",
      label: "Atendente — fila + novo pedido",
      auth: { name: "Maria", pin: MARIA_PIN, role: "atendente" },
    },
    {
      name: "02-cozinha.png",
      url: "/cozinha",
      label: "Cozinha — pedidos em tempo real",
      auth: { name: "José", pin: JOSE_PIN, role: "cozinha" },
    },
    {
      name: "03-cliente.png",
      url: "/cliente",
      label: "Painel cliente — TV pública",
      auth: null,
    },
  ];

  for (const t of targets) {
    const ctx = await browser.newContext({
      baseURL: BASE_URL,
      viewport: VIEWPORT,
      // Reduz scrollbars que estragam screenshot
      deviceScaleFactor: 2, // retina-like pra ficar nítido
    });
    if (t.auth) {
      await loginAs(ctx.request, t.auth.name, t.auth.pin, t.auth.role);
    }
    const page = await ctx.newPage();
    await page.goto(t.url, { waitUntil: "networkidle" });
    await waitForSplashGone(page);
    // pequena pausa pra animações terminarem (fade-in, slide-up)
    await page.waitForTimeout(800);

    const outPath = path.join(OUT_DIR, t.name);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`✓ ${t.name} — ${t.label}`);
    await ctx.close();
  }

  await browser.close();
  console.log(`\nResultado: ${targets.length} screenshots em ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
