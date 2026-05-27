"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Wifi, WifiOff } from "lucide-react";
import type { OrderView } from "@/lib/orders";
import type { EventSessionStatus } from "@/lib/event-session-shared";
import { isStaleEventSession } from "@/lib/event-session-shared";
import { formatBRL } from "@/lib/pricing";
import { useSSE } from "@/lib/use-sse";

/**
 * Monitor — view minimalista pra Gil dar um pulo no celular durante
 * evento sem entrar no admin completo. 4 KPIs gigantes + lista live
 * dos pedidos em preparo. SSE mantém atualizado.
 *
 * Otimizado pra celular pessoal: tela cheia, sem sidebar, fonte grande,
 * cor de fundo escura pra menos brilho à distância. Tap nos KPIs faz
 * nada — é só observação.
 */
export function MonitorClient({
  eventStatus,
  initialOrders,
}: {
  eventStatus: EventSessionStatus;
  initialOrders: OrderView[];
}) {
  const [orders, setOrders] = useState<OrderView[]>(initialOrders);

  // Atualiza "agora" a cada 30s pra refrescar tempos de espera/preparo
  // sem precisar de re-render por SSE. Não causa rede; só re-cálculo.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // SSE — mesmo canal do admin/atendente/cozinha
  const sseStatus = useSSE("/api/sse", {
    "order:created": (data) => {
      const o = data as OrderView;
      setOrders((prev) => [o, ...prev.filter((x) => x.id !== o.id)]);
    },
    "order:updated": (data) => {
      const o = data as OrderView;
      setOrders((prev) => prev.map((x) => (x.id === o.id ? o : x)));
    },
  });

  // Filtra pedidos do caixa atual (se aberto), senão hoje todos.
  // Mesma lógica do Operacao do admin, aqui inline.
  const eventOrders = useMemo(() => {
    if (eventStatus.open && eventStatus.id) {
      return orders.filter((o) => o.eventSessionId === eventStatus.id);
    }
    return orders;
  }, [orders, eventStatus]);

  // KPIs calculados em memo pra re-render só quando mudam.
  const kpis = useMemo(() => {
    const active = eventOrders.filter((o) => o.status !== "CANCELADO");
    const delivered = active.filter((o) => o.status === "ENTREGUE");
    const revenue = active.reduce((s, o) => s + o.finalCents, 0);
    const avgTicket = active.length > 0 ? Math.round(revenue / active.length) : 0;

    // Tempo médio de preparo dos últimos 5 pedidos ENTREGUE.
    // Mede de createdAt → preparingStartedAt OU createdAt → updatedAt
    // (proxy razoável quando não temos timestamp dedicado de PRONTO).
    const recent = delivered.slice(0, 5);
    const prepTimes = recent
      .map((o) => {
        const created = new Date(o.createdAt).getTime();
        const updated = new Date(o.updatedAt).getTime();
        return Math.max(0, updated - created);
      })
      .filter((ms) => ms > 0);
    const avgPrepMs =
      prepTimes.length > 0
        ? Math.round(prepTimes.reduce((s, x) => s + x, 0) / prepTimes.length)
        : 0;

    return {
      revenue,
      count: active.length,
      avgTicket,
      avgPrepMs,
    };
  }, [eventOrders]);

  // Pedidos em PREPARO ordenados por mais antigo (urgência primeiro)
  const inPreparo = useMemo(
    () =>
      eventOrders
        .filter((o) => o.status === "EM_PREPARO")
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        ),
    [eventOrders],
  );

  // Pedidos NOVOS (PEDIDO_FEITO) — também úteis pro monitor
  const novos = useMemo(
    () =>
      eventOrders
        .filter((o) => o.status === "PEDIDO_FEITO")
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        ),
    [eventOrders],
  );

  const sessionStale = eventStatus.open && isStaleEventSession(eventStatus.openedAt);

  return (
    <div className="min-h-dvh bg-ink text-ink-inverse flex flex-col">
      {/* Header curto — sem sidebar/chrome admin. Só voltar + status. */}
      <header className="px-4 py-3 border-b border-ink-2 flex items-center justify-between gap-3 bg-ink-2/30">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-yellow hover:text-brand-yellow-hover"
        >
          <ArrowLeft size={18} strokeWidth={2.5} />
          Admin
        </Link>

        <div className="flex-1 text-center min-w-0">
          <div className="t-label tracking-[0.1em] text-ink-3">Monitor</div>
          <div className="text-sm font-bold truncate">
            {eventStatus.open ? (
              eventStatus.name ?? "Caixa atual"
            ) : (
              <span className="text-ink-3">Sem caixa aberto</span>
            )}
          </div>
        </div>

        {/* Indicador SSE pequeno: verde conectado, amarelo reconectando */}
        <div
          className="shrink-0 inline-flex items-center justify-center w-9 h-9"
          title={sseStatus === "open" ? "Conectado" : "Reconectando…"}
          aria-label={`Status: ${sseStatus}`}
        >
          {sseStatus === "open" ? (
            <Wifi size={18} strokeWidth={2.5} className="text-status-ready" />
          ) : sseStatus === "closed" ? (
            <WifiOff size={18} strokeWidth={2.5} className="text-danger" />
          ) : (
            <RefreshCw size={18} strokeWidth={2.5} className="text-brand-yellow animate-spin" />
          )}
        </div>
      </header>

      {/* Aviso de caixa stale (aberto >12h) — só se relevante */}
      {sessionStale && (
        <div className="px-4 py-2 bg-brand-orange/20 text-brand-orange text-xs text-center font-semibold border-b border-brand-orange/40">
          ⚠ Caixa aberto há muito tempo — talvez esquecido de fechar
        </div>
      )}

      {/* KPIs gigantes — 2 colunas mobile, 4 colunas md+ */}
      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Receita"
          value={formatBRL(kpis.revenue)}
          accent="brand"
        />
        <KpiCard label="Pedidos" value={String(kpis.count)} />
        <KpiCard
          label="Ticket médio"
          value={kpis.count > 0 ? formatBRL(kpis.avgTicket) : "—"}
        />
        <KpiCard
          label="Preparo médio"
          value={kpis.avgPrepMs > 0 ? formatDurationShort(kpis.avgPrepMs) : "—"}
          sub={kpis.avgPrepMs > 0 ? "últimos 5" : null}
        />
      </div>

      {/* Lista live: NOVOS + EM_PREPARO, ordenados por urgência (mais antigo primeiro) */}
      <div className="flex-1 px-4 pb-6 flex flex-col gap-4">
        <LiveSection
          title="Em preparo"
          dotColor="bg-status-preparing"
          orders={inPreparo}
          now={now}
          emptyLabel="Nenhum em preparo agora"
        />
        <LiveSection
          title="Novos (cozinha ainda não pegou)"
          dotColor="bg-status-incoming"
          orders={novos}
          now={now}
          emptyLabel="Nenhum pedido novo"
        />
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string | null;
  accent?: "brand";
}) {
  return (
    <div
      className={`rounded-lg p-4 ${
        accent === "brand"
          ? "bg-brand-yellow text-ink"
          : "bg-ink-2 text-ink-inverse"
      }`}
    >
      <div className="t-label tracking-[0.08em] opacity-80">{label}</div>
      <div className="text-3xl md:text-5xl font-extrabold t-num leading-none mt-1.5 truncate">
        {value}
      </div>
      {sub && <div className="text-[11px] opacity-70 mt-1">{sub}</div>}
    </div>
  );
}

function LiveSection({
  title,
  dotColor,
  orders,
  now,
  emptyLabel,
}: {
  title: string;
  dotColor: string;
  orders: OrderView[];
  now: number;
  emptyLabel: string;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotColor}`} />
        <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-ink-3">
          {title} <span className="opacity-60">({orders.length})</span>
        </h2>
      </div>
      {orders.length === 0 ? (
        <div className="text-sm text-ink-3 italic py-2">{emptyLabel}</div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {orders.map((o) => (
            <LiveRow key={o.id} order={o} now={now} />
          ))}
        </ul>
      )}
    </section>
  );
}

function LiveRow({ order, now }: { order: OrderView; now: number }) {
  const ageMin = Math.max(
    0,
    Math.floor((now - new Date(order.createdAt).getTime()) / 60_000),
  );
  // Pedidos > 15min em PREPARO chamam atenção (vermelho)
  const urgent = order.status === "EM_PREPARO" && ageMin >= 15;
  return (
    <li
      className={`rounded-md px-3 py-2 flex items-center justify-between gap-2 bg-ink-2/50 ${
        urgent ? "ring-1 ring-danger/60" : ""
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="t-num text-xs text-ink-3 shrink-0 tabular-nums">
          #{String(order.id).padStart(3, "0")}
        </span>
        <span className="text-base font-semibold truncate">
          {order.clientName}
        </span>
      </div>
      <span
        className={`text-sm font-bold t-num tabular-nums shrink-0 ${
          urgent ? "text-danger" : "text-ink-3"
        }`}
      >
        {ageMin}min
      </span>
    </li>
  );
}

function formatDurationShort(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  if (min < 60) return sec === 0 ? `${min}m` : `${min}m${sec}s`;
  const hr = Math.floor(min / 60);
  return `${hr}h${min % 60}m`;
}
