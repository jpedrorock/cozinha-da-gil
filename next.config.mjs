import withPWAInit from "@ducanh2912/next-pwa";

// Migrado de next-pwa@5.6 → @ducanh2912/next-pwa@10 (fork mantido, Next 15+).
// Mudanças de API do fork:
//   - runtimeCaching + skipWaiting moveram pra dentro de `workboxOptions`
//   - `fallbacks` virou top-level e FUNCIONA (o bug do 5.6 que forçava
//     precacheFallback em toda entry sumiu) → reativado document: "/offline"
const withPWA = withPWAInit({
  dest: "public",
  register: true,
  disable: process.env.NODE_ENV === "development",
  // Fallback automático de navegação quando offline. /offline existe como
  // rota normal (app/offline/page.tsx); o SW serve ela quando a navegação
  // falha sem rede, em vez do erro genérico do browser. Antes (next-pwa 5.6)
  // isso quebrava o build com runtimeCaching customizado — o fork resolve.
  fallbacks: {
    document: "/offline",
  },
  workboxOptions: {
    // skipWaiting:false — novo SW fica em `waiting` state e adiciona um
    // `message` listener; components/PWAUpdatePrompt.tsx manda SKIP_WAITING
    // quando o user clica "Nova versão — atualizar?". Sem isso (default true
    // do Workbox), o SW novo assume sozinho e pode recarregar no meio de um
    // pedido aberto, perdendo o state do form. PWA audit #5.
    skipWaiting: false,
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
        // Página pública de acompanhamento do pedido — `NetworkFirst` com
        // timeout curto (2s). Por quê NetworkFirst em vez do catch-all
        // `StaleWhileRevalidate`: cliente abrindo o link quer ver estado
        // atual ("Pronto!" vs "Em preparo" vs "Entregue") — SWR poderia
        // mostrar status antigo até o background sync atualizar.
        // Quando rede falha (wifi cai), cai pro cache imediatamente em vez
        // do fallback /offline genérico — cliente vê o estado conhecido
        // do pedido + indicador "offline" na própria página.
        // SSE continua precisando de rede pra atualizar live (bypass via
        // /api/sse acima); essa regra é só pro document HTML inicial.
        urlPattern: /\/p\/[A-Za-z0-9]{10}/,
        handler: "NetworkFirst",
        options: {
          cacheName: "pedido-public",
          networkTimeoutSeconds: 2,
          expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
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
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfkit referencia .afm fonts via fs.readFileSync no runtime — Next não
  // bundla esses arquivos por default. serverExternalPackages avisa pra tratar
  // pdfkit como módulo externo no server, mantendo a estrutura de arquivos do
  // node_modules em vez de re-empacotar.
  // (Next 15: saiu de `experimental.serverComponentsExternalPackages` pra raiz.)
  serverExternalPackages: ["pdfkit"],
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
