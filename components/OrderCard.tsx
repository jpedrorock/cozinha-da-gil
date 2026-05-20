"use client";
import { useEffect, useState } from "react";
import { Check, Coffee, HandPlatter, MessageCircle, Package, Pencil, Utensils } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { PastelIcon, DoceIcon } from "./icons";
import type { OrderView, OrderItemView } from "@/lib/orders";
import { SIZE_LABEL, formatBRL } from "@/lib/pricing";

function fmtTime(d: string | Date) {
  return new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function elapsedMin(d: string | Date, now: number) {
  return Math.max(0, Math.floor((now - new Date(d).getTime()) / 60000));
}

function iconFor(kind: string) {
  if (kind === "doce") return <DoceIcon size={18} />;
  if (kind === "bebida") return <Coffee size={18} strokeWidth={2} />;
  if (kind === "macarrao") return <Utensils size={18} strokeWidth={2} />;
  if (kind === "combo") return <Package size={18} strokeWidth={2} />;
  return <PastelIcon size={18} />;
}

function describeItem(item: OrderItemView): string {
  // Fase 6: snapshot productName + sizeName (fallback no legacy SIZE_LABEL[size])
  const productName = item.productName || (item.kind === "doce" ? "Pastel Doce" : item.kind === "salgado" ? "Pastel Salgado" : item.kind);
  const sizeLabel = item.size && SIZE_LABEL[item.size as keyof typeof SIZE_LABEL]
    ? SIZE_LABEL[item.size as keyof typeof SIZE_LABEL]
    : item.size;
  const head = sizeLabel ? `${productName} · ${sizeLabel}` : productName;
  const parts = [head];
  if (item.flavor) parts.push(item.flavor);
  else if (item.toppings.length > 0) parts.push(item.toppings.join(", "));
  if (item.sauces.length > 0) parts.push(`molhos: ${item.sauces.join(", ")}`);
  return parts.join(" · ");
}

export function OrderCard({
  order,
  now: nowProp,
  onCancel,
  onAdvance,
  onEdit,
  onNotifyReady,
}: {
  order: OrderView;
  /** Timestamp compartilhado pelo container (Fila atendente). Se omitido,
   *  o card cria o próprio interval — back-compat pra contextos que ainda
   *  não centralizaram (ex.: histórico). */
  now?: number | null;
  onCancel?: (id: number) => void;
  onAdvance?: (id: number) => void;
  onEdit?: () => void;
  /** Atendente clicou "Avisar" no card pronto — abre wa.me + marca no banco.
   *  Cozinha não recebe esse handler (atendente é quem comunica). */
  onNotifyReady?: (order: OrderView) => void;
}) {
  const [localNow, setLocalNow] = useState<number | null>(null);
  const now = nowProp !== undefined ? nowProp : localNow;
  // Pending visual durante o PATCH — evita double-tap em "Retirada"
  // (atendente acha que não clicou e toca de novo). SSE reseta naturalmente.
  const [advancePending, setAdvancePending] = useState(false);
  // Mesma defesa pro botão "Avisar" — double-tap dispararia 2× window.open
  // (2 abas WhatsApp) e 2× POST /notify-ready (2 BroadcastLog rows duplicadas).
  // Libera quando SSE entrega notifiedReadyAt → re-render esconde o botão.
  const [notifyPending, setNotifyPending] = useState(false);
  useEffect(() => {
    // Quando order muda status via SSE, libera o botão pra próximo
    setAdvancePending(false);
  }, [order.status]);
  useEffect(() => {
    setNotifyPending(false);
  }, [order.notifiedReadyAt]);
  useEffect(() => {
    // Só cria timer próprio se o container NÃO passar `now` (back-compat).
    // Quando passar, 1 timer central serve N cards — economiza bateria.
    if (nowProp !== undefined) return;
    setLocalNow(Date.now());
    if (order.status === "ENTREGUE" || order.status === "CANCELADO") return;
    const t = setInterval(() => setLocalNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [order.status, nowProp]);

  const mins = now === null ? 0 : elapsedMin(order.createdAt, now);
  const dim = order.status === "ENTREGUE" || order.status === "CANCELADO";

  // Bebida bypassa cozinha: quando pedido vem direto PRONTO e só tem bebida,
  // não passou pela cozinha — atendente pega na geladeira e entrega.
  // Destaque visual chamativo pra não passar batido.
  const onlyDrinks = order.items.length > 0 && order.items.every((i) => i.kind === "bebida");
  const drinksReady = order.status === "PRONTO" && onlyDrinks;

  return (
    <article
      className={`card p-4 flex flex-col gap-3 animate-card-in transition-[opacity,transform,box-shadow] duration-200 ease-out hover:shadow-md ${
        dim ? "opacity-60" : ""
      } ${drinksReady ? "border-l-4 border-status-ready bg-status-ready-bg/30 ring-2 ring-status-ready/40" : ""}`}
    >
      {drinksReady && (
        <div className="-mx-4 -mt-4 px-4 py-2 rounded-t-md bg-status-ready text-white t-label !text-white inline-flex items-center gap-2 animate-flash-ring-once">
          <Coffee size={14} strokeWidth={2.5} />
          <span>Entregar agora · só bebida, pega na geladeira</span>
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="t-caption t-num">
            #{String(order.id).padStart(3, "0")} · {fmtTime(order.createdAt)}
          </div>
          <div className="t-h2 truncate">{order.clientName}</div>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <ul className="flex flex-col gap-1.5">
        {/* Expande cada item por quantidade — repete linhas em vez de "×N"
            pra cozinha/atendente verem cada unidade do pedido. */}
        {order.items
          .flatMap((item) =>
            Array.from({ length: item.quantity }, (_, n) => ({ item, n })),
          )
          .map(({ item, n }, flatIdx, allUnits) => (
            <li
              key={`${item.id}-${n}`}
              className="t-body-sm flex gap-2 items-start"
            >
              {allUnits.length > 1 && (
                <span className="t-num t-caption font-bold shrink-0 w-4 mt-0.5">
                  {flatIdx + 1}.
                </span>
              )}
              <span className="shrink-0 mt-0.5">
                {iconFor(item.kind)}
              </span>
              <span className="leading-snug flex-1 text-ink-2">{describeItem(item)}</span>
              <span className="t-num font-semibold text-ink-2 shrink-0">
                {formatBRL(item.unitPrice)}
              </span>
            </li>
          ))}
      </ul>

      {order.items.some((i) => i.notes) && (
        <div className="text-xs bg-[#FFF4C2] text-[#5C4500] rounded-sm px-2.5 py-1.5 font-semibold leading-snug">
          {order.items.filter((i) => i.notes).map((i) => i.notes).join(" · ")}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex gap-2 items-baseline">
          {order.discountCents > 0 ? (
            <>
              <span className="line-through text-ink-3 t-num text-xs">{formatBRL(order.totalCents)}</span>
              <span className="t-h2 text-status-ready t-num">{formatBRL(order.finalCents)}</span>
            </>
          ) : (
            <span className="t-h2 t-num">{formatBRL(order.totalCents)}</span>
          )}
          {now !== null && mins > 0 && order.status !== "ENTREGUE" && order.status !== "CANCELADO" && (
            <span className="t-caption t-num" suppressHydrationWarning>
              · há {mins} min
            </span>
          )}
        </div>
        <div className="ml-auto flex gap-2">
          {/* Atendente só edita/cancela ANTES do preparo começar.
              Depois que cozinha clicou "Iniciar preparo", o pedido tá em
              produção e mudança vira ruído — cozinha já tá fazendo. */}
          {onEdit && order.status === "PEDIDO_FEITO" && (
            <button
              onClick={onEdit}
              className="btn btn-secondary btn-sm"
              title="Editar pedido"
            >
              <Pencil size={14} strokeWidth={2.5} />
              Editar
            </button>
          )}
          {onCancel && order.status === "PEDIDO_FEITO" && (
            <button
              onClick={() => onCancel(order.id)}
              className="btn btn-ghost btn-sm text-ink-3"
            >
              Cancelar
            </button>
          )}
          {/* Avisar cliente via WhatsApp: só atendente, só PRONTO, só com fone,
              e só se ainda não avisou. Depois de avisar, vira badge "Avisado". */}
          {onNotifyReady && order.status === "PRONTO" && order.clientPhone && !order.notifiedReadyAt && (
            <button
              onClick={() => {
                if (notifyPending) return;
                setNotifyPending(true);
                onNotifyReady(order);
              }}
              disabled={notifyPending}
              className="btn btn-secondary btn-sm disabled:opacity-70"
              title="Abrir WhatsApp pra avisar cliente"
            >
              {notifyPending ? (
                <span className="spinner-inline" aria-hidden />
              ) : (
                <MessageCircle size={14} strokeWidth={2.5} />
              )}
              {notifyPending ? "Avisando…" : "Avisar"}
            </button>
          )}
          {order.notifiedReadyAt && order.status === "PRONTO" && (
            <span className="inline-flex items-center gap-1 t-caption text-status-ready font-semibold">
              <Check size={12} strokeWidth={3} />
              Avisado
            </span>
          )}
          {onAdvance && order.status === "PRONTO" && (
            <button
              onClick={() => {
                if (advancePending) return;
                setAdvancePending(true);
                onAdvance(order.id);
              }}
              disabled={advancePending}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-status-ready text-white font-bold text-[13px] shadow-md hover:brightness-110 active:scale-[0.96] transition disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {advancePending ? (
                <span className="spinner-inline" aria-hidden />
              ) : (
                <HandPlatter size={16} strokeWidth={2.5} />
              )}
              {advancePending ? "Entregando…" : "Retirada"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
