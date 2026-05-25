import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // Identidade estável do app — sem isso browsers usam start_url, e qualquer
    // mudança (ex: query param) faz re-install. Com `id`, app fica "ancorado".
    id: "/",
    // Scope explícito — define o que conta como "dentro do app". Sem isso,
    // links fora podem ser tratados como out-of-app no Chrome.
    scope: "/",
    name: "Cozinha da Gil",
    short_name: "Cozinha da Gil",
    description: "Sistema interno de pedidos da Cozinha da Gil",
    start_url: "/",
    display: "standalone",
    background_color: "#FFD600",
    theme_color: "#FFD600",
    orientation: "portrait-primary",
    lang: "pt-BR",
    // dir: direção de leitura — ajuda acessibilidade (RTL screen readers
    // pulam interpretação). Sempre LTR pro pt-BR.
    dir: "ltr",
    // Categories — só valores da spec W3C (food não está na lista oficial).
    // business + productivity + utilities batem com a natureza do POS.
    categories: ["business", "productivity", "utilities"],
    // Não sugere busca de app nativo — somos a versão definitiva.
    prefer_related_applications: false,
    // Shortcuts no long-press do ícone (Android) / 3D-touch (iOS).
    // Cada role tem atalho que cai DIRETO na tela operacional, pulando
    // a tela de login. Maria/José/Gil ganham 1 tap a menos toda manhã.
    shortcuts: [
      {
        name: "Atendente",
        short_name: "Atendente",
        description: "Anotar pedidos novos",
        url: "/atendente",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Cozinha",
        short_name: "Cozinha",
        description: "Ver pedidos pra preparar",
        url: "/cozinha",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Admin",
        short_name: "Admin",
        description: "Caixa, cardápio, vendas",
        url: "/admin",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
    icons: [
      // PNGs pro iOS (Add to Home Screen) e Android (Install Banner).
      // iOS Safari não renderiza SVG no apple-touch-icon — exige PNG 180×180.
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // Maskable PNG pro Android adaptive icon — safe-zone central com padding
      // de 10% (Android recorta o ícone em formatos variados conforme launcher).
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      // SVG mantido como fallback (favicon do browser desktop)
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
