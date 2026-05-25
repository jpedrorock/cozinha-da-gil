"use client";

import { AlertTriangle } from "lucide-react";

/**
 * Last-resort error boundary do Next 14 App Router. Captura crashes
 * que vazaram do error.tsx ou que acontecem ANTES de qualquer layout
 * montar (ex: erro de hidratação grave).
 *
 * NÃO usa componentes do app (BrandIcon, etc) porque o root layout
 * pode estar quebrado também — fica self-contained.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          textAlign: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#FFFCF5",
          color: "#1F1410",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "#FBEAE7",
            color: "#C0392B",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <AlertTriangle size={28} strokeWidth={2.5} aria-hidden />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
          Algo deu errado
        </h1>
        <p style={{ fontSize: 15, color: "#4A3F38", maxWidth: 420, marginBottom: 24 }}>
          Algo travou aqui dentro. Tente recarregar — se persistir, avisa quem
          configurou o app.
        </p>
        {error.digest && (
          <p style={{ fontSize: 12, color: "#8A7C6F", marginBottom: 16, fontFamily: "monospace" }}>
            Código: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            background: "#FFD400",
            color: "#1F1410",
            border: "none",
            padding: "12px 24px",
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 15,
            cursor: "pointer",
          }}
        >
          Tentar de novo
        </button>
      </body>
    </html>
  );
}
