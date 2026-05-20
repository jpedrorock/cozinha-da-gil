import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
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
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    // iOS Safari NÃO renderiza SVG no apple-touch-icon — exige PNG 180×180
    // com fundo opaco. Sem isso, "Add to Home Screen" usa ícone genérico.
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // NÃO bloqueamos zoom (maximumScale ausente) — respeita acessibilidade
  // WCAG 1.4.4 e permite pinch-zoom pra usuário com visão fraca.
  // Tap delay de 300ms já é eliminado só com width=device-width.
  themeColor: "#FFD600",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={jakarta.variable}>
      <body className="font-sans bg-surface text-ink">{children}</body>
    </html>
  );
}
