import nextPWA from "next-pwa";

const withPWA = nextPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  // SSE não funciona offline. APIs de mutação também (POST/PATCH/DELETE) — falham com erro claro.
  // Cache de páginas: StaleWhileRevalidate. Cache de assets: CacheFirst (default do next-pwa).
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
      // Páginas/HTML: stale-while-revalidate
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
    // instrumentation.ts roda 1x no boot do server. Usamos pra agendar
    // backup diário do SQLite (lib/backup-scheduler.ts). Em dev ou sem
    // BACKUP_SCHEDULE_ENABLED=true, o scheduler é no-op.
    instrumentationHook: true,
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
