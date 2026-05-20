"use client";
import { useEffect, useMemo, useState } from "react";
import { Contact, MessageCircle, Search, Send, Trash2, X } from "lucide-react";
import type { Customer } from "@prisma/client";
import type { OrderView } from "@/lib/orders";
import { formatPhoneDisplay } from "@/lib/orders";
import { formatBRL } from "@/lib/pricing";
import { buildWaUrl, templatePromo } from "@/lib/whatsapp-templates";
import { useEscapeKey } from "@/lib/use-escape-key";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { ClientesBroadcast } from "./ClientesBroadcast";

type FilterKey = "" | "active30" | "frequent" | "vip" | "marketing";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "", label: "Todos" },
  { key: "active30", label: "Ativos (30d)" },
  { key: "frequent", label: "Frequentes" },
  { key: "vip", label: "VIPs" },
  { key: "marketing", label: "Opt-in marketing" },
];

export function Clientes() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [broadcastMode, setBroadcastMode] = useState(false);

  async function refetch() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter) params.set("filter", filter);
    if (q.trim()) params.set("q", q.trim());
    const r = await fetch(`/api/customers?${params.toString()}`);
    if (r.ok) setCustomers(await r.json());
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(refetch, q ? 200 : 0); // debounce só na busca
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, q]);

  // Paginação client-side: em CRM produção pode chegar a 500+ clientes;
  // renderizar todos em mobile pesa o re-render. Mostra 25 por vez com
  // "Ver mais" — padrão já usado em Histórico do admin.
  const PAGE_SIZE = 25;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => {
    // Reset quando filtros mudam — usuário não espera "continuar daqui"
    setVisibleCount(PAGE_SIZE);
  }, [filter, q]);
  const visibleCustomers = customers.slice(0, visibleCount);
  const hasMore = customers.length > visibleCount;

  const summary = useMemo(() => {
    return {
      total: customers.length,
      active: customers.filter((c) => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        return c.lastOrderAt && new Date(c.lastOrderAt) >= cutoff;
      }).length,
      marketing: customers.filter((c) => c.optInMarketing).length,
    };
  }, [customers]);

  if (broadcastMode) {
    return <ClientesBroadcast onBack={() => setBroadcastMode(false)} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="t-h1 mb-1">Clientes</h1>
          <p className="t-body-sm">
            Quem já comprou aqui. Telefone vira contato pra avisar de pedido pronto ou mandar promo
            depois (opt-in).
          </p>
        </div>
        <button
          onClick={() => setBroadcastMode(true)}
          className="inline-flex items-center gap-1.5 h-11 px-4 rounded-md bg-ink text-brand-yellow text-[13px] font-bold hover:brightness-110 active:scale-[0.97] transition shrink-0"
          title="Enviar promo em massa pra opt-in marketing"
        >
          <Send size={14} strokeWidth={2.5} />
          Enviar promo
        </button>
      </header>

      {/* KPIs sumarizados */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Total" value={summary.total} />
        <SummaryCard label="Ativos (30d)" value={summary.active} />
        <SummaryCard label="Marketing opt-in" value={summary.marketing} accent />
      </div>

      {/* Busca + filtros */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search
            size={18}
            strokeWidth={2.25}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome ou telefone…"
            className="input pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`h-9 px-4 rounded-full border-2 text-[13px] font-semibold transition-colors ${
                filter === f.key
                  ? "bg-ink text-brand-yellow border-ink"
                  : "bg-surface-elevated text-ink-2 border-line-strong hover:border-ink-3"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-10 t-body-sm text-ink-3">Carregando…</div>
      ) : customers.length === 0 ? (
        <div className="card p-10 text-center">
          <Contact size={48} strokeWidth={1.5} className="text-ink-3 mx-auto mb-3 opacity-60" />
          <div className="t-h2 mb-1">Nenhum cliente aqui</div>
          <p className="t-body-sm">
            {q.trim()
              ? "Nada bate com essa busca. Tenta outro termo."
              : filter
              ? "Mude o filtro pra ver outros clientes."
              : "Quando atendente registrar telefone num pedido, o cliente aparece aqui."}
          </p>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {visibleCustomers.map((c) => (
              <CustomerRow key={c.id} customer={c} onOpen={() => setSelected(c.id)} />
            ))}
          </ul>
          {hasMore && (
            <button
              onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
              className="btn btn-secondary self-center mt-2"
            >
              Ver mais {Math.min(PAGE_SIZE, customers.length - visibleCount)} de {customers.length - visibleCount}
            </button>
          )}
        </>
      )}

      {/* Drawer */}
      {selected && (
        <CustomerDrawer
          id={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            refetch();
          }}
          onDeleted={() => {
            setSelected(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-md p-3 border ${accent ? "bg-brand-yellow border-brand-yellow" : "bg-surface-elevated border-line"}`}>
      <div className="t-label">{label}</div>
      <div className="text-2xl font-bold t-num">{value}</div>
    </div>
  );
}

function CustomerRow({ customer, onOpen }: { customer: Customer; onOpen: () => void }) {
  const last = customer.lastOrderAt ? new Date(customer.lastOrderAt) : null;
  const daysAgo = last ? Math.floor((Date.now() - last.getTime()) / 86400000) : null;

  return (
    <li className="card p-4 flex items-center gap-4">
      <button onClick={onOpen} className="flex-1 flex items-center gap-3 text-left min-w-0">
        <div className="shrink-0 w-10 h-10 rounded-full bg-brand-yellow inline-flex items-center justify-center font-bold text-ink">
          {customer.name[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="t-h2 truncate">{customer.name}</div>
          <div className="t-caption t-num">{formatPhoneDisplay(customer.phone)}</div>
        </div>
        <div className="hidden md:flex flex-col items-end gap-0.5 shrink-0">
          <div className="t-body-sm font-bold t-num">
            {customer.totalOrders} {customer.totalOrders === 1 ? "pedido" : "pedidos"}
          </div>
          <div className="t-caption t-num">{formatBRL(customer.totalSpentCents)}</div>
        </div>
        {daysAgo !== null && (
          <div className="hidden md:block shrink-0 t-caption text-ink-3 min-w-[80px] text-right">
            {daysAgo === 0 ? "hoje" : daysAgo === 1 ? "ontem" : `há ${daysAgo}d`}
          </div>
        )}
      </button>
      <a
        href={buildWaUrl(customer.phone, "")}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-md text-status-ready hover:bg-status-ready-bg transition-colors"
        title="Abrir WhatsApp"
        onClick={(e) => e.stopPropagation()}
      >
        <MessageCircle size={18} strokeWidth={2.25} />
      </a>
    </li>
  );
}

function CustomerDrawer({
  id,
  onClose,
  onChanged,
  onDeleted,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [data, setData] = useState<{ customer: Customer; orders: OrderView[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notes, setNotes] = useState("");
  const [optInMarketing, setOptInMarketing] = useState(false);

  useEscapeKey(onClose);
  useBodyScrollLock(true);

  useEffect(() => {
    fetch(`/api/customers/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setNotes(d.customer.notes ?? "");
        setOptInMarketing(d.customer.optInMarketing);
      });
  }, [id]);

  async function save() {
    if (!data) return;
    setSaving(true);
    const r = await fetch(`/api/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notes.trim() || null, optInMarketing }),
    });
    setSaving(false);
    if (r.ok) {
      onChanged();
      onClose();
    }
  }

  async function destroy() {
    const r = await fetch(`/api/customers/${id}`, { method: "DELETE" });
    if (r.ok) onDeleted();
  }

  if (!data) {
    return (
      <div className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-[3px] flex items-end md:items-center justify-center p-4 animate-fade-in">
        <div className="bg-surface-elevated rounded-xl p-6">
          <div className="t-body-sm text-ink-3">Carregando…</div>
        </div>
      </div>
    );
  }

  const c = data.customer;

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-[3px] flex items-end md:items-center justify-center md:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-2xl bg-surface-elevated rounded-t-xl md:rounded-xl max-h-[90dvh] flex flex-col animate-sheet-up"
      >
        <header className="flex items-center justify-between p-5 border-b border-line">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 w-12 h-12 rounded-full bg-brand-yellow inline-flex items-center justify-center font-bold text-lg text-ink">
              {c.name[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0">
              <h2 className="t-h1 truncate">{c.name}</h2>
              <div className="t-caption t-num">{formatPhoneDisplay(c.phone)}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 inline-flex items-center justify-center w-11 h-11 -mr-2 rounded-md text-ink-3 hover:text-ink hover:bg-surface-sunken"
            aria-label="Fechar"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <SummaryCard label="Pedidos" value={c.totalOrders} />
            <div className="rounded-md p-3 border border-line bg-surface-elevated">
              <div className="t-label">Gasto total</div>
              <div className="text-xl font-bold t-num">{formatBRL(c.totalSpentCents)}</div>
            </div>
            <div className="rounded-md p-3 border border-line bg-surface-elevated">
              <div className="t-label">Cliente desde</div>
              <div className="text-[13px] font-semibold t-num">
                {new Date(c.firstOrderAt).toLocaleDateString("pt-BR")}
              </div>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="t-label mb-1.5 block">Notas (Gil only)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: aniversário 12/05 · vegetariano · cliente da escola da Ana"
              rows={3}
              className="textarea text-[13px]"
            />
          </div>

          {/* Opt-in marketing */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={optInMarketing}
              onChange={(e) => setOptInMarketing(e.target.checked)}
              className="mt-1 w-4 h-4 accent-brand-yellow"
            />
            <div>
              <div className="t-body font-semibold">Recebe promoções por WhatsApp</div>
              <div className="t-caption">
                Aviso de pedido pronto sempre funciona. Marketing precisa esse opt-in.
              </div>
            </div>
          </label>

          {/* Últimos pedidos */}
          <div>
            <h3 className="t-label mb-2">Últimos pedidos ({data.orders.length})</h3>
            {data.orders.length === 0 ? (
              <div className="t-body-sm text-ink-3 italic">Nenhum pedido ainda.</div>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {data.orders.slice(0, 10).map((o) => (
                  <li key={o.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-surface-sunken">
                    <span className="t-caption t-num text-ink-3 shrink-0 w-12">
                      #{String(o.id).padStart(3, "0")}
                    </span>
                    <span className="flex-1 t-body-sm truncate">
                      {o.items.map((it) => `${it.quantity}× ${it.productName || it.kind}`).join(" · ")}
                    </span>
                    <span className="t-body-sm font-bold t-num shrink-0">
                      {formatBRL(o.finalCents)}
                    </span>
                    <span className="t-caption t-num text-ink-3 shrink-0 hidden md:block">
                      {new Date(o.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <footer className="border-t border-line p-4 flex items-center justify-between gap-2 flex-wrap">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="t-body-sm text-danger font-semibold">Confirmar apagar?</span>
              <button onClick={destroy} className="btn btn-danger btn-sm">
                Apagar
              </button>
              <button onClick={() => setConfirmDelete(false)} className="btn btn-ghost btn-sm">
                Não
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 t-body-sm text-danger hover:underline"
            >
              <Trash2 size={14} strokeWidth={2.5} />
              Apagar cliente
            </button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <a
              href={buildWaUrl(c.phone, templatePromo(c.name, ""))}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary btn-sm"
            >
              <MessageCircle size={14} />
              WhatsApp
            </a>
            <button onClick={save} disabled={saving} className="btn btn-primary btn-sm">
              {saving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
