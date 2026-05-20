import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cozinha da Gil",
    short_name: "Cozinha da Gil",
    description: "Sistema interno de pedidos da Cozinha da Gil",
    start_url: "/",
    display: "standalone",
    background_color: "#FFD600",
    theme_color: "#FFD600",
    orientation: "portrait-primary",
    lang: "pt-BR",
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
      // Mantém SVGs como fallback (favicon do browser + maskable Android)
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
