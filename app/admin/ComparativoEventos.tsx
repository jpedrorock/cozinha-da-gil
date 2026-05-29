"use client";
import { useEffect, useState } from "react";
import { Clock, Trophy } from "lucide-react";
import { formatBRL } from "@/lib/pricing";

type EventEntry = {
  id: string;
  name: string | null;
  eventDate: string | null;
  openedAt: string;
  closedAt: string | null;
  openedBy: string;
  open: boolean;
  orderCount: number;
  revenueCents: number;
  avgTicketCents: number;
  peakHour: number | null;
  topItem: { name: string; count: number } | null;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

/**
 * Comparativo entre eventos (EventSession) — Fase 7 #3.
 * Lista os últimos eventos lado a lado: faturamento (com barra relativa pra
 * comparar de relance), nº de pedidos, ticket médio, hora de pico e item
 * campeão. Read-only; dados de /api/reports/events.
 */
export function ComparativoEventos() {
  const [events, setEvents] = useState<EventEntry[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/reports/events")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setEvents(Array.isArray(data.events) ? data.events : []);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="text-ink-3 text-sm py-8 text-center">Carregando eventos…</div>;
  }
  if (!events || events.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface-elevated p-8 text-center">
        <p className="text-ink-2 font-semibold">Nenhum evento ainda</p>
        <p className="text-ink-3 text-sm mt-1">
          Abra e feche um caixa pra começar a comparar eventos.
        </p>
      </div>
    );
  }

  const maxRevenue = Math.max(...events.map((e) => e.revenueCents), 1);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-ink-3 text-sm">
        Últimos {events.length} eventos — faturamento, hora de pico e o mais pedido de cada um.
      </p>
      {events.map((e) => {
        const label = e.name?.trim() || `Caixa de ${fmtDate(e.eventDate ?? e.openedAt)}`;
        const barPct = Math.round((e.revenueCents / maxRevenue) * 100);
        return (
          <div key={e.id} className="rounded-xl border border-line bg-surface-elevated p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <span className="block font-extrabold text-ink truncate">{label}</span>
                <span className="text-xs text-ink-3">
                  {fmtDate(e.openedAt)} · {e.openedBy}
                </span>
              </div>
              {e.open && (
                <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-status-ready-bg text-status-ready-ink">
                  aberto
                </span>
              )}
            </div>

            {/* Faturamento + barra relativa (compara de relance entre eventos) */}
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-2xl font-extrabold tabular-nums">{formatBRL(e.revenueCents)}</span>
              <span className="text-sm text-ink-3 tabular-nums text-right">
                {e.orderCount} {e.orderCount === 1 ? "pedido" : "pedidos"} · {formatBRL(e.avgTicketCents)}/ticket
              </span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-surface-sunken overflow-hidden">
              <div className="h-full bg-brand-yellow" style={{ width: `${barPct}%` }} />
            </div>

            {/* Pico + campeão */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-ink-2">
              {e.peakHour !== null && (
                <span className="inline-flex items-center gap-1">
                  <Clock size={14} strokeWidth={2} /> pico {e.peakHour}h
                </span>
              )}
              {e.topItem && (
                <span className="inline-flex items-center gap-1">
                  <Trophy size={14} strokeWidth={2} className="text-brand-orange" /> {e.topItem.name}{" "}
                  <span className="text-ink-3">(×{e.topItem.count})</span>
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
