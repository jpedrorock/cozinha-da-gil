"use client";

import { useState } from "react";
import { CheckCircle2, Clock, CookingPot, HandPlatter, WifiOff, XCircle } from "lucide-react";
import { useSSE } from "@/lib/use-sse";
import { BrandIcon } from "@/components/icons";
import type { OrderView } from "@/lib/orders";
import { formatBRL } from "@/lib/pricing";

// Página de acompanhamento do cliente — uma URL por pedido, atualiza ao
// vivo via SSE. Filtro por id na callback porque o stream é global; é
// barato (1 comparação) e simples — não preciso de canal-por-pedido.

function statusVisual(status: OrderView["status"]) {
  switch (status) {
    case "PEDIDO_FEITO":
      return {
        Icon: Clock,
        label: "Pedido recebido",
        sub: "Em fila pra preparo.",
        bg: "bg-status-preparing-bg",
        text: "text-status-preparing-ink",
        ring: "ring-status-preparing",
        pulse: false,
      };
    case "EM_PREPARO":
      return {
        Icon: CookingPot,
        label: "Em preparo",
        sub: "Na cozinha agora.",
        bg: "bg-status-preparing-bg",
        text: "text-status-preparing-ink",
        ring: "ring-status-preparing",
        pulse: false,
      };
    case "PRONTO":
      return {
        Icon: HandPlatter,
        label: "Tá pronto!",
        sub: "Vem pegar no balcão.",
        bg: "bg-status-ready-bg",
        text: "text-status-ready-ink",
        ring: "ring-status-ready",
        pulse: true,
      };
    case "ENTREGUE":
      return {
        Icon: CheckCircle2,
        label: "Entregue",
        sub: "Obrigada! Volte sempre 🥟",
        bg: "bg-surface-sunken",
        text: "text-ink-2",
        ring: "ring-line",
        pulse: false,
      };
    case "CANCELADO":
      return {
        Icon: XCircle,
        label: "Cancelado",
        sub: "Esse pedido foi cancelado.",
        bg: "bg-danger-bg",
        text: "text-danger",
        ring: "ring-danger",
        pulse: false,
      };
  }
}

export function PedidoClient({ initialOrder }: { initialOrder: OrderView }) {
  const [order, setOrder] = useState<OrderView>(initialOrder);

  // SSE: só presta atenção em eventos do próprio pedido. Filtro por id
  // basta — o token nem precisa entrar aqui porque o stream já é público
  // de leitura (mesma infra que o painel /cliente usa).
  const sseStatus = useSSE("/api/sse", {
    "order:updated": (data) => {
      const incoming = data as OrderView;
      if (incoming.id === order.id) setOrder(incoming);
    },
  });

  const visual = statusVisual(order.status);
  const Icon = visual.Icon;
  const offline = sseStatus === "closed";

  return (
    <div className="h-dvh flex flex-col bg-surface overflow-hidden">
      <header
        className="bg-surface-elevated border-b border-line"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="max-w-md mx-auto px-5 py-4 flex items-center gap-3">
          <BrandIcon size={32} />
          <div className="flex flex-col leading-tight flex-1 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-3">
              Cozinha da
            </span>
            <span className="text-base font-extrabold -tracking-[0.01em]">Gil</span>
          </div>
          {offline && (
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold text-ink-3"
              title="Sem conexão — pode estar desatualizado"
            >
              <WifiOff size={14} strokeWidth={2.5} />
              Offline
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto max-w-md w-full mx-auto px-5 py-6 flex flex-col gap-5">
        {/* Saudação + #pedido */}
        <div>
          <div className="text-sm text-ink-3 font-medium">Olá,</div>
          <h1 className="text-2xl font-extrabold -tracking-[0.01em] mt-0.5 break-words">
            {order.clientName}
          </h1>
          <div className="text-xs text-ink-3 mt-1 font-mono">
            Pedido <span className="font-bold">#{String(order.id).padStart(3, "0")}</span>
          </div>
        </div>

        {/* Bloco grande de status — coração da página */}
        <section
          className={`rounded-2xl p-6 ring-2 ${visual.bg} ${visual.ring} ${
            visual.pulse ? "animate-flash-ring-once" : ""
          }`}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-4">
            <div
              className={`shrink-0 w-14 h-14 rounded-full inline-flex items-center justify-center bg-white/60 ${visual.text}`}
            >
              <Icon size={32} strokeWidth={2.25} />
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-2xl font-extrabold -tracking-[0.01em] ${visual.text}`}>
                {visual.label}
              </div>
              <div className="text-sm text-ink-2 mt-1">{visual.sub}</div>
            </div>
          </div>
        </section>

        {/* Items */}
        <section>
          <h2 className="t-label text-ink-3 mb-2">Seu pedido</h2>
          <ul className="rounded-xl bg-surface-elevated border border-line divide-y divide-line">
            {order.items.map((item) => (
              <li key={item.id} className="px-4 py-3 flex items-start gap-3">
                <span className="text-sm font-bold text-ink-3 tabular-nums shrink-0 w-6">
                  {item.quantity}×
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink">{item.productName}</div>
                  {(item.toppings.length > 0 ||
                    item.sauces.length > 0 ||
                    item.flavor) && (
                    <div className="text-xs text-ink-3 mt-0.5">
                      {[
                        item.flavor,
                        item.toppings.length > 0 ? item.toppings.join(", ") : null,
                        item.sauces.length > 0 ? item.sauces.join(", ") : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  )}
                </div>
                <span className="text-sm font-bold tabular-nums text-ink-2 shrink-0">
                  {formatBRL(item.unitPrice * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Total */}
        <section className="flex items-center justify-between border-t border-line pt-4">
          {order.discountCents > 0 ? (
            <div className="flex flex-col">
              <span className="text-xs text-ink-3 line-through tabular-nums">
                {formatBRL(order.totalCents)}
              </span>
              <span className="t-label text-ink-3">
                {order.promotionName ?? "Desconto"}: −{formatBRL(order.discountCents)}
              </span>
            </div>
          ) : (
            <span className="t-label text-ink-3">Total</span>
          )}
          <span className="text-2xl font-extrabold tabular-nums">
            {formatBRL(order.finalCents)}
          </span>
        </section>

        <p className="text-[11px] text-ink-3 text-center mt-2 leading-relaxed">
          Atualiza sozinho. Pode deixar essa página aberta no celular —
          quando ficar pronto, você vê aqui.
        </p>
      </main>
    </div>
  );
}
