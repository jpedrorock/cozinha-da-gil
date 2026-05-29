"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Check } from "lucide-react";

/**
 * Renderiza o QR de PIX (BR Code) + bloco copia-e-cola pro cliente pagar.
 * O payload já vem montado por `lib/pix.ts`. Componente burro (display).
 */
export function PixCheckout({ payload }: { payload: string }) {
  const [dataUrl, setDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(payload, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [payload]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // navegador sem clipboard API — silencioso, user usa fallback
    }
  }

  return (
    <div className="rounded-xl border border-line bg-surface-elevated p-4 flex flex-col items-center gap-3">
      <h3 className="text-sm font-bold uppercase tracking-wide text-ink-3">Pagar com PIX</h3>
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt="QR Code PIX" width={220} height={220} className="rounded" />
      ) : (
        <div className="w-[220px] h-[220px] bg-surface-sunken rounded animate-pulse" />
      )}
      <details className="w-full">
        <summary className="text-xs text-ink-3 cursor-pointer text-center select-none">
          ou copie o código PIX
        </summary>
        <div className="mt-2 flex gap-2 items-stretch">
          <code className="flex-1 text-[10px] leading-tight bg-surface-sunken p-2 rounded break-all font-mono text-ink-2">
            {payload}
          </code>
          <button
            type="button"
            onClick={copy}
            className="shrink-0 px-3 rounded-md text-xs font-semibold bg-ink text-brand-yellow inline-flex items-center gap-1.5"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
      </details>
    </div>
  );
}
