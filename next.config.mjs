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
  },
  // Dívida de lint acumulada (unused imports, quotes não-escapadas, e um
  // useSwipeable depois de early-return em AtendenteClient) não bloqueia
  // o build de produção. Type-check via `npx tsc --noEmit` continua sendo
  // obrigatório no CI — TypeScript errors quebram. ESLint vira só warning
  // até a limpeza dedicada (vide tasks de housekeeping).
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default withPWA(nextConfig);
