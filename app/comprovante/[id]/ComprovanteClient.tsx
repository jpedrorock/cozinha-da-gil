"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Check, Coffee, Eye, EyeOff, Link as LinkIcon, MessageCircle, Package, Printer, Utensils } from "lucide-react";
import Link from "next/link";
import { BrandIcon, DoceIcon, PastelIcon } from "@/components/icons";
import type { OrderView } from "@/lib/orders";
import { formatPhoneDisplay } from "@/lib/orders";
import { formatBRL, SIZE_LABEL } from "@/lib/pricing";
import { buildPublicOrderUrl, buildWaUrl, templateReceipt } from "@/lib/whatsapp-templates";

export function ComprovanteClient({ order }: { order: OrderView }) {
  const created = new Date(order.createdAt);
  // Audit follow-up P2 #24: preview inline antes de imprimir. Em vez de
  // confiar no diálogo nativo do navegador (que renderiza preto-no-branco
  // genérico), o user vê a versão exata 80mm térmica antes de gastar
  // papel. Toggle "Pré-visualizar" → ticket vira monocromático + 80mm-wide.
  const [previewMode, setPreviewMode] = useState(false);
  const [copied, setCopied] = useState(false);
  // baseUrl precisa do window.location.origin, então só preenche depois
  // de montar. Antes disso, templateReceipt fica sem a linha "Acompanhe:"
  // — não é crítico, o botão "Enviar" rerenderiza com URL completa.
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  function handlePrint() {
    window.print();
  }

  async function handleCopyLink() {
    if (!trackUrl) return;
    try {
      await navigator.clipboard.writeText(trackUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback pra navegadores que negam clipboard sem HTTPS — em prod
      // tá com HTTPS, mas em dev local pode falhar. Mostra prompt simples.
      window.prompt("Copie o link manualmente:", trackUrl);
    }
  }

  // WhatsApp via <a href> em vez de window.open(): window.open é
  // bloqueado por popup-blocker e em PWA standalone (iOS/Android) abre
  // numa webview interna inútil — era a causa do "não abre" reportado.
  // Anchor com target=_blank deixa o OS resolver o link (abre o app
  // WhatsApp se instalado). wa.me é universal: mobile abre app, desktop
  // abre WhatsApp Web/Desktop. Telefone já vem normalizado (+55...) do
  // POST de pedido, então a conversa abre direto no número certo.
  const waUrl = buildWaUrl(order.clientPhone, templateReceipt(order, baseUrl ?? undefined));
  const trackUrl = buildPublicOrderUrl(order, baseUrl ?? undefined);

  return (
    <div
      className={`min-h-dvh flex flex-col items-center justify-start py-6 print:py-0 print:bg-white ${
        previewMode ? "bg-[#2a2a2a]" : "bg-surface"
      }`}
    >
      {/* Header só com label do modo preview (Voltar moveu pro rodapé junto
          aos outros botões — UX feedback Gil 01/06: link sozinho em cima
          ficava perdido; agrupar todas as ações embaixo é mais previsível
          e dá target mais gordo pro polegar). */}
      <div className="no-print w-full max-w-md px-4 mb-4 flex items-center justify-end min-h-[20px]">
        {previewMode && (
          <span className="t-label text-white/60 tracking-[0.1em]">
            Modo impressão · 80mm térmica
          </span>
        )}
      </div>

      <article
        id="ticket"
        className={
          previewMode
            ? // Preview mode: simula papel térmico 80mm — borda dashed, sombra
              // de impressora, monocromático, fonte do tamanho real impresso
              "bg-white text-black w-[280px] mx-auto p-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)] font-mono text-[11px] leading-[1.35] border border-dashed border-black/40"
            : "bg-white text-ink w-full max-w-[320px] mx-4 sm:mx-auto p-6 print:p-4 print:max-w-none print:shadow-none shadow-lg rounded-lg print:rounded-none font-mono text-sm leading-snug"
        }
      >
        <header className="text-center mb-4">
          <div className="flex justify-center mb-1">
            <BrandIcon size={40} />
          </div>
          <div className="font-sans font-bold text-lg leading-none">Cozinha da Gil</div>
          <div className="t-caption mt-0.5">Comprovante</div>
        </header>

        <div className="border-t border-dashed border-ink/40 my-3" />

        <div className="flex justify-between mb-1">
          <span>Pedido</span>
          <span className="font-bold">#{String(order.id).padStart(3, "0")}</span>
        </div>
        <div className="flex justify-between mb-1">
          <span>Cliente</span>
          <span className="font-bold">{order.clientName}</span>
        </div>
        {order.clientPhone && (
          <div className="flex justify-between mb-1">
            <span>Telefone</span>
            <span>{formatPhoneDisplay(order.clientPhone)}</span>
          </div>
        )}
        <div className="flex justify-between mb-1">
          <span>Data</span>
          <span>{created.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        {order.createdBy && order.createdBy !== "—" && (
          <div className="flex justify-between">
            <span>Atendente</span>
            <span>{order.createdBy}</span>
          </div>
        )}

        <div className="border-t border-dashed border-ink/40 my-3" />

        <div className="flex flex-col gap-3">
          {/* Expande cada item por quantidade — comprovante repete linhas
              em vez de "×2" pequeno, pra ficar inequívoco o que foi pedido. */}
          {order.items
            .flatMap((item, baseIdx) =>
              Array.from({ length: item.quantity }, (_, n) => ({ item, n, baseIdx })),
            )
            .map(({ item, n }, flatIdx, allUnits) => {
              const productName =
                item.productName ||
                (item.kind === "doce"
                  ? "Pastel Doce"
                  : item.kind === "salgado"
                  ? "Pastel Salgado"
                  : item.kind);
              const sizeLabel =
                item.size && SIZE_LABEL[item.size as keyof typeof SIZE_LABEL]
                  ? SIZE_LABEL[item.size as keyof typeof SIZE_LABEL]
                  : item.size;
              const sauceCost = item.sauces.length * 150;
              const baseUnit = item.unitPrice - sauceCost;
              const icon =
                item.kind === "doce" ? <DoceIcon size={16} /> :
                item.kind === "bebida" ? <Coffee size={16} strokeWidth={2} /> :
                item.kind === "macarrao" ? <Utensils size={16} strokeWidth={2} /> :
                item.kind === "combo" ? <Package size={16} strokeWidth={2} /> :
                <PastelIcon size={16} />;
              return (
                <div key={`${item.id}-${n}`}>
                  {allUnits.length > 1 && (
                    <div className="t-label mb-0.5">
                      Item {flatIdx + 1} de {allUnits.length}
                    </div>
                  )}
                  <div className="flex justify-between font-bold">
                    <span className="inline-flex items-center gap-1.5">
                      {icon}
                      <span>{sizeLabel ? `${productName} · ${sizeLabel}` : productName}</span>
                    </span>
                    <span className="t-num">{formatBRL(baseUnit)}</span>
                  </div>
                  {item.kind === "doce" && item.flavor ? (
                    <div className="text-xs text-ink-2 ml-4">{item.flavor}</div>
                  ) : item.toppings.length > 0 ? (
                    <div className="text-xs text-ink-2 ml-4">
                      + {item.toppings.join(", ")}
                    </div>
                  ) : null}
                  {item.sauces.length > 0 && (
                    <div className="flex justify-between text-xs text-ink-2 ml-4">
                      <span>Molhos: {item.sauces.join(", ")}</span>
                      <span className="t-num">{formatBRL(sauceCost)}</span>
                    </div>
                  )}
                  {item.notes && (
                    <div className="text-xs italic text-ink-2 ml-4">&ldquo;{item.notes}&rdquo;</div>
                  )}
                </div>
              );
            })}
        </div>

        <div className="border-t border-dashed border-ink/40 my-3" />

        {order.discountCents && order.discountCents > 0 ? (
          <>
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span className="t-num">{formatBRL(order.totalCents)}</span>
            </div>
            <div className="flex justify-between text-sm text-status-ready">
              <span>{order.promotionName ?? "Desconto"}</span>
              <span className="t-num">−{formatBRL(order.discountCents)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold mt-1">
              <span>Total</span>
              <span className="t-num">{formatBRL(order.finalCents)}</span>
            </div>
          </>
        ) : (
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span className="t-num">{formatBRL(order.totalCents)}</span>
          </div>
        )}

        <div className="border-t border-dashed border-ink/40 my-3" />

        <div className="text-center text-xs text-ink-3">
          Obrigado pela visita!
        </div>
      </article>

      <div className="no-print w-full max-w-md px-4 mt-6 flex flex-col gap-2">
        <button onClick={handlePrint} className="btn btn-primary w-full">
          <Printer size={18} strokeWidth={2.5} />
          Imprimir
        </button>
        {/* Preview toggle — útil pra conferir antes de gastar bobina térmica.
            Em festa cheia, errar 1 comprovante por bobina cara é dinheiro. */}
        <button
          onClick={() => setPreviewMode((v) => !v)}
          className="btn btn-ghost w-full"
          aria-pressed={previewMode}
        >
          {previewMode ? (
            <>
              <EyeOff size={18} strokeWidth={2.5} />
              Voltar à tela
            </>
          ) : (
            <>
              <Eye size={18} strokeWidth={2.5} />
              Pré-visualizar impressão
            </>
          )}
        </button>
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary w-full"
        >
          <MessageCircle size={18} strokeWidth={2.5} />
          Enviar no WhatsApp
        </a>
        {/* Link pro cliente acompanhar — fica disabled enquanto baseUrl
            ainda não montou (primeiro paint do SSR) ou se pedido legado
            sem token. Botão muda pra estado "Copiado!" por 2s pra dar
            feedback visual claro. */}
        {trackUrl && (
          <button
            onClick={handleCopyLink}
            className="btn btn-ghost w-full"
            aria-live="polite"
          >
            {copied ? (
              <>
                <Check size={18} strokeWidth={2.5} />
                Link copiado!
              </>
            ) : (
              <>
                <LinkIcon size={18} strokeWidth={2.5} />
                Copiar link de acompanhamento
              </>
            )}
          </button>
        )}
        {/* Separador visual antes do Voltar — ações principais ficam
            agrupadas, Voltar é o "encerrar fluxo". Mesma altura dos outros
            (btn-secondary mantém shape), só com peso visual menor. */}
        <div className="border-t border-line my-2" />
        <Link href="/atendente" className="btn btn-secondary w-full">
          <ArrowLeft size={18} strokeWidth={2.5} />
          Voltar à fila
        </Link>
      </div>

      <style jsx global>{`
        /* === IMPRESSÃO TÉRMICA ===
           Otimizado pra impressoras térmicas 80mm (largura de papel
           padrão "Bobina térmica 80mm" usada em maioria das POS).
           Margens zeradas, fonte ajustada, sem cores de fundo. */
        @page {
          size: 80mm auto;
          margin: 0;
        }
        @media print {
          html,
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 80mm !important;
          }
          .no-print {
            display: none !important;
          }
          /* Reset do container externo (div root da página) */
          body > div {
            min-height: 0 !important;
            padding: 0 !important;
            align-items: stretch !important;
            justify-content: flex-start !important;
            background: white !important;
          }
          /* Ticket ocupa a largura inteira do papel */
          #ticket {
            box-shadow: none !important;
            border-radius: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 4mm 3mm !important;
            font-size: 11px !important;
            line-height: 1.35 !important;
          }
          /* Headers menores na impressão pra caber em 80mm */
          #ticket header {
            margin-bottom: 2mm !important;
          }
          /* Cor preta puro pra contraste em térmica (que é monocromática) */
          #ticket,
          #ticket * {
            color: #000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          /* SVGs do brand mantém o stroke escuro */
          #ticket svg {
            color: #000 !important;
          }
        }
      `}</style>
    </div>
  );
}
