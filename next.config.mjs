import nextPWA from "next-pwa";

const withPWA = nextPWA({
  dest: "public",
  register: true,
  // skipWaiting: false — novo SW fica em `waiting` state até receber
  // mensagem SKIP_WAITING do client. components/PWAUpdatePrompt.tsx
  // detecta e mostra toast "Nova versão — atualizar?" pro user clicar.
  // Sem isso, novo SW assumia silenciosamente e podia recarregar no
  // meio de pedido aberto, perdendo state do form. PWA audit #5.
  skipWaiting: false,
  disable: process.env.NODE_ENV === "development",
  // Fallback automático do SW quando navegação falha (offline).
  // NÃO usar `fallbacks: { document }` aqui — next-pwa 5.6.0 tem bug
  // que requer precacheFallback em TODA entry de runtimeCaching, o que
  // sobrescreve nossas regras de NetworkFirst/CacheFirst. Quando migrar
  // pra @ducanh2912/next-pwa (plano em docs/UPGRADE-NEXT-15.md), reativar.
  //
  // Por enquanto: /offline existe como rota normal (app/offline/page.tsx).
  // Navegação manual funciona; fallback automático no offline ainda mostra
  // erro genérico do browser. Aceitável — wifi de barraca volta rápido.
  // SSE não funciona offline. APIs de mutação também (POST/PATCH/DELETE) — falham com erro claro.
  // Cache de páginas: StaleWhileRevalidate. Assets imutáveis: CacheFirst.
  runtimeCaching: [
    {
      // Bypass total pra SSE — não cache, não intercepta
      urlPattern: /\/api\/sse/,
      handler: "NetworkOnly",
    },
    {
      // GETs de API: tenta rede, cai pro cache se offline (dados podem estar stale)
      urlPattern: /\/api\/.*/,
      handler: "NetworkFirst",
      method: "GET",
      options: {
        cacheName: "api-cache",
        networkTimeoutSeconds: 4,
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
      },
    },
    {
      // Mutações nunca tentam cache
      urlPattern: /\/api\/.*/,
      handler: "NetworkOnly",
      method: "POST",
    },
    {
      urlPattern: /\/api\/.*/,
      handler: "NetworkOnly",
      method: "PATCH",
    },
    {
      urlPattern: /\/api\/.*/,
      handler: "NetworkOnly",
      method: "DELETE",
    },
    {
      // Assets imutáveis do Next (hash no nome). CacheFirst = serve do
      // cache sem checar rede primeiro — mais rápido e funciona offline
      // mesmo após cold start. Quando o hash muda, a URL muda, browser
      // baixa o novo automaticamente. PWA audit #7.
      urlPattern: /\/_next\/static\/.+/,
      handler: "CacheFirst",
      options: {
        cacheName: "next-static",
        expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    {
      // Ícones e splashes do PWA — também imutáveis
      urlPattern: /\/(icons?|splash|apple-touch-icon|favicon)/,
      handler: "CacheFirst",
      options: {
        cacheName: "pwa-assets",
        expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    {
      // Imagens de produto (filesystem via /api/uploads) — fingerprint
      // de hash no filename, imutáveis também.
      urlPattern: /\/api\/uploads\/.+/,
      handler: "CacheFirst",
      options: {
        cacheName: "product-images",
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    {
      // Iconify: API pública de ícones usada pelo IconPicker e renderer
      // de Ingredient.icon. Em barraca com wifi instável, queremos que
      // ícones JÁ VISTOS continuem aparecendo offline. StaleWhileRevalidate
      // serve cache na hora + atualiza em background — UX fluida sem
      // sacrificar updates quando Iconify atualiza pacotes.
      urlPattern: /^https:\/\/api\.iconify\.design\/.+/,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "iconify",
        expiration: {
          maxEntries: 500,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 dias
        },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      // Páginas/HTML: stale-while-revalidate (catch-all final)
      urlPattern: /^https?.*/,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "pages",
        expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfkit referencia .afm fonts via fs.readFileSync no runtime — Next 14
  // não bundla esses arquivos por default. serverExternalPackages avisa pra
  // tratar pdfkit como módulo externo no server, mantendo a estrutura de
  // arquivos do node_modules em vez de re-empacotar.
  experimental: {
    serverComponentsExternalPackages: ["pdfkit"],
  },
  // Lint roda no build — falha trava produção. Limpeza dos 28 erros reais
  // feita na task de housekeeping (#67); arquivos gerados (sw.js, workbox-*)
  // ignorados via .eslintignore. Se algum erro voltar, build quebra cedo.
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Service Worker DEVE ser sempre fresh — senão usuários ficam grudados
  // em versão antiga sem nunca pegar updates. skipWaiting do next-pwa só
  // ajuda quando o browser baixa o novo sw.js; pra isso baixar, Cache-Control
  // tem que ser explícito. Mesmo pra workbox-*.js que o sw.js importa.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/workbox-:hash.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
