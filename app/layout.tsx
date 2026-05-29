import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { SplashScreen } from "@/components/SplashScreen";
import { PWAUpdatePrompt } from "@/components/PWAUpdatePrompt";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cozinha da Gil",
  description: "Sistema interno de pedidos da Cozinha da Gil",
  applicationName: "Cozinha da Gil",
  appleWebApp: {
    capable: true,
    title: "Cozinha da Gil",
    // black-translucent: status bar fica TRANSPARENTE sobre o app (texto branco).
    // App desenha edge-to-edge por baixo. Exige padding-top: env(safe-area-inset-top)
    // nos headers fixos pra conteúdo não ficar atrás do notch. Com "default" iOS
    // mostrava barra branca opaca SEPARADA do app — quebrava sensação nativa.
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    // iOS Safari NÃO renderiza SVG no apple-touch-icon — exige PNG 180×180
    // SEM canal alpha (RGB sólido). Com alpha, iOS cai no ícone genérico.
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // viewport-fit: cover é OBRIGATÓRIO pra `env(safe-area-inset-*)` funcionar
  // no iOS. Sem isso, viewport fica "inset by safe areas" e env() retorna 0px,
  // app não cobre notch, status bar fica como barra separada. Esse é o switch
  // que faz o app sair de "tela web" pra "tela nativa edge-to-edge".
  viewportFit: "cover",
  // NÃO bloqueamos zoom (maximumScale ausente) — respeita acessibilidade
  // WCAG 1.4.4 e permite pinch-zoom pra usuário com visão fraca.
  themeColor: "#FFD600",
  colorScheme: "light",
};

// === iOS splash screens — apple-touch-startup-image ===
// Next 14 metadata API NÃO suporta startup-image (só apple-touch-icon).
// Precisa de <link> direto no <head>. Cada splash tem media query específica
// por device (combinação device-width + device-height + pixel-ratio).
// Sem isso, iOS abre PWA com fundo branco/preto padrão por 1-2s — parece bug.
const IOS_SPLASHES = [
  // iPhones
  { src: "/splash/splash-1320x2868.png", media: "(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" }, // 17 Pro Max (novo)
  { src: "/splash/splash-1290x2796.png", media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" }, // 14/15/16 Pro Max
  { src: "/splash/splash-1179x2556.png", media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" }, // 14/15/16/17 Pro
  { src: "/splash/splash-1170x2532.png", media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" }, // 12/13/14
  { src: "/splash/splash-1284x2778.png", media: "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" }, // 12/13 Pro Max
  { src: "/splash/splash-1125x2436.png", media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" }, // X/XS/11 Pro
  { src: "/splash/splash-828x1792.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" }, // XR/11
  { src: "/splash/splash-750x1334.png", media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" }, // SE/6/7/8
  { src: "/splash/splash-1242x2208.png", media: "(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" }, // 6+/7+/8+
  // iPads — cozinha pode rodar em tablet maior (10"+) por causa da TV/densidade
  { src: "/splash/splash-2064x2752.png", media: "(device-width: 1032px) and (device-height: 1376px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" }, // iPad Pro 13"
  { src: "/splash/splash-2048x2732.png", media: "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" }, // iPad Air 13" / Pro 12.9"
  { src: "/splash/splash-1668x2388.png", media: "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" }, // iPad Pro 11"
  { src: "/splash/splash-1640x2360.png", media: "(device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" }, // iPad Air 11"
  { src: "/splash/splash-1620x2160.png", media: "(device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" }, // iPad 10ª
  { src: "/splash/splash-1488x2266.png", media: "(device-width: 744px) and (device-height: 1133px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" }, // iPad mini
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={jakarta.variable}>
      <head>
        {IOS_SPLASHES.map((s) => (
          <link
            key={s.src}
            rel="apple-touch-startup-image"
            href={s.src}
            media={s.media}
          />
        ))}
      </head>
      <body className="font-sans bg-surface text-ink">
        <SplashScreen />
        <PWAUpdatePrompt />
        {children}
      </body>
    </html>
  );
}
