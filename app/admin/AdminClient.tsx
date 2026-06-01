"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useSwipeable } from "react-swipeable";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  ChartBar,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Coffee,
  Contact,
  Download,
  GripVertical,
  Image as ImageIcon,
  KeyRound,
  LogOut,
  Monitor as MonitorIcon,
  Lock,
  LockOpen,
  Menu as MenuIcon,
  Package,
  Receipt,
  Search,
  Tag,
  Trash2,
  Trophy,
  UserPlus,
  Users as UsersIcon,
  X,
  Utensils,
  UtensilsCrossed,
} from "lucide-react";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { ConfirmDialog, useConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { IngredientIcon } from "@/components/IngredientIcon";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Clientes } from "./Clientes";
import { ComparativoEventos } from "./ComparativoEventos";
import { AppHeader } from "@/components/AppHeader";
import { BrandIcon, PastelIcon, DoceIcon } from "@/components/icons";
// IconPicker carrega Iconify (~200k icons em memória ao buscar) e só serve
// a aba Cardápio em modo edição. Dynamic pra não pesar o bundle inicial
// que atendente também baixa indiretamente.
const IconPicker = dynamic(
  () => import("@/components/IconPicker").then((m) => m.IconPicker),
  { ssr: false },
);
import { PinInput } from "@/components/PinInput";
import { useEscapeKey } from "@/lib/use-escape-key";
import { useIdleLogout } from "@/lib/use-idle-logout";
import { useSSE } from "@/lib/use-sse";
import { useOperator } from "@/lib/use-operator";
import { formatBRL, SIZE_LABEL } from "@/lib/pricing";
import type { OrderView } from "@/lib/orders";
import type { ProductView } from "@/lib/products";
import type { PromotionView } from "@/lib/promotions";
import { isStaleEventSession, type EventSessionStatus } from "@/lib/event-session-shared";
import type { Ingredient } from "@prisma/client";

type Tab = "vendas" | "operacao" | "cardapio" | "promocoes" | "clientes" | "usuarios";

type AdminUser = {
  id: string;
  name: string;
  role: string;
  createdAt: string;
};

export type EventListEntry = {
  id: string;
  name: string | null;
  openedAt: string;
  openedBy: string;
  closedAt: string | null;
  closedBy: string | null;
  totalCents: number;
  orderCount: number;
};

export function AdminClient({
  todayOrders: initialTodayOrders,
  recentOrders: initialRecentOrders,
  initialIngredients,
  initialUsers,
  initialEventStatus,
  initialProducts,
  initialEvents,
  initialPromotions,
}: {
  todayOrders: OrderView[];
  recentOrders: OrderView[];
  initialIngredients: Ingredient[];
  initialUsers: AdminUser[];
  initialEventStatus: EventSessionStatus;
  initialProducts: ProductView[];
  initialEvents: EventListEntry[];
  initialPromotions: PromotionView[];
}) {
  const router = useRouter();
  const { operator, ready, clear } = useOperator();

  useEffect(() => {
    if (ready && (!operator || operator.role !== "admin")) {
      router.replace("/");
    }
  }, [ready, operator, router]);

  // Admin tem timeout menor (15min) — tela mais sensível, menos uso constante
  useIdleLogout(() => {
    clear();
    router.replace("/");
  }, 15 * 60 * 1000);

  // Default em "operacao" (Caixa) pra Gil cair direto onde decide se vai
  // abrir/fechar caixa — passo 1 do dia. Antes era "vendas".
  const [tab, setTab] = useState<Tab>("operacao");
  const { confirm, node: confirmDialogNode } = useConfirmDialog();
  const { showToast, node: toastNode } = useToast();
  const [todayOrders, setTodayOrders] = useState<OrderView[]>(initialTodayOrders);
  const [recentOrders, setRecentOrders] = useState<OrderView[]>(initialRecentOrders);
  const [ingredients, setIngredients] = useState<Ingredient[]>(initialIngredients);
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [eventStatus, setEventStatus] = useState<EventSessionStatus>(initialEventStatus);
  const [products, setProducts] = useState<ProductView[]>(initialProducts);
  const [events, setEvents] = useState<EventListEntry[]>(initialEvents);
  const [promotions, setPromotions] = useState<PromotionView[]>(initialPromotions);

  function mergeOrder(prev: OrderView[], order: OrderView, todayOnly: boolean) {
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const isToday = new Date(order.createdAt).getTime() >= startToday.getTime();
    if (todayOnly && !isToday) return prev;
    const without = prev.filter((o) => o.id !== order.id);
    return [order, ...without];
  }

  useSSE("/api/sse", {
    "order:created": (data) => {
      const order = data as OrderView;
      setTodayOrders((prev) => mergeOrder(prev, order, true));
      setRecentOrders((prev) => mergeOrder(prev, order, false));
    },
    "order:updated": (data) => {
      const order = data as OrderView;
      setTodayOrders((prev) => mergeOrder(prev, order, true));
      setRecentOrders((prev) => mergeOrder(prev, order, false));
    },
    "event:opened": () => {
      // refetch status + lista
      fetch("/api/events/current").then((r) => r.json()).then(setEventStatus);
      fetch("/api/events").then((r) => r.json()).then(setEvents);
    },
    "event:closed": () => {
      fetch("/api/events/current").then((r) => r.json()).then(setEventStatus);
      fetch("/api/events").then((r) => r.json()).then(setEvents);
    },
  });

  async function openEvent(name: string | null, eventDate: string | null) {
    const res = await fetch("/api/events/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operator: operator?.name, name, eventDate }),
    });
    if (res.ok) {
      const data = await res.json();
      setEventStatus({
        open: true,
        id: data.id,
        name: data.name,
        eventDate: data.eventDate ?? null,
        openedAt: data.openedAt,
        openedBy: data.openedBy,
      });
      fetch("/api/events").then((r) => r.json()).then(setEvents);
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || "Não foi possível abrir o caixa.", "error");
    }
  }

  async function closeEvent() {
    const ok = await confirm({
      title: "Fechar o caixa?",
      message: "O total da sessão será gravado e atendente vai parar de receber pedidos novos.",
      confirmLabel: "Fechar caixa",
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch("/api/events/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operator: operator?.name }),
    });
    if (res.ok) {
      setEventStatus({ open: false, id: null, name: null, eventDate: null, openedAt: null, openedBy: null });
      fetch("/api/events").then((r) => r.json()).then(setEvents);
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || "Não foi possível fechar o caixa.", "error");
    }
  }

  const caixaOrfao = eventStatus.open && isStaleEventSession(eventStatus.openedAt, 12);
  const [staleDismissed, setStaleDismissed] = useState(false);
  // Reset dismiss quando trocar de caixa (abrir/fechar)
  useEffect(() => {
    setStaleDismissed(false);
  }, [eventStatus.id]);

  return (
    <AdminShell tab={tab} setTab={setTab}>
      {/* Banner caixa órfão admin — mesmo que o atendente, mas com botão
          DIRETO "Fechar agora" porque admin pode resolver na hora. */}
      {caixaOrfao && !staleDismissed && (
        <div className="bg-brand-orange/15 border border-brand-orange/40 rounded-md px-4 py-3 mb-4 flex items-start gap-2.5">
          <AlertTriangle size={20} strokeWidth={2.25} className="shrink-0 text-brand-orange mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-ink">Caixa aberto há mais de 12 horas</div>
            <div className="text-xs text-ink-2 mt-0.5">
              {eventStatus.name ? `"${eventStatus.name}" ` : ""}desde{" "}
              {eventStatus.openedAt &&
                new Date(eventStatus.openedAt).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              . Vendas novas vão pra esse caixa — se for de outro evento, feche e abra um novo.
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={closeEvent}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-brand-orange text-white text-xs font-bold hover:brightness-110"
              >
                Fechar caixa agora
              </button>
              <button
                onClick={() => setStaleDismissed(true)}
                className="inline-flex items-center h-8 px-3 rounded-md text-ink-2 hover:text-ink hover:bg-brand-orange/10 text-xs font-semibold"
              >
                Dispensar
              </button>
            </div>
          </div>
        </div>
      )}
      {tab === "vendas" && (
        <Vendas
          todayOrders={todayOrders}
          eventStatus={eventStatus}
          recentOrders={recentOrders}
          events={events}
        />
      )}
      {tab === "operacao" && (
        <Operacao
          orders={todayOrders}
          eventStatus={eventStatus}
          onOpenEvent={openEvent}
          onCloseEvent={closeEvent}
        />
      )}
      {tab === "cardapio" && (
        <Cardapio
          products={products}
          setProducts={setProducts}
          ingredients={ingredients}
          onToggle={async (id, available) => {
            // Optimistic — toggle ativo já dispara o filtro no atendente via
            // SSE, então UI local pode atualizar antes do server confirmar.
            setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, available } : i)));
            await fetch(`/api/ingredients/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ available }),
            });
          }}
          onIconChange={async (id, icon) => {
            // Icon pode ser data URI (vai virar path no server) — usar resposta
            // pra refletir o path real, não o data URI. Otimismo só pra Iconify.
            const isDataUrl = typeof icon === "string" && icon.startsWith("data:");
            if (!isDataUrl) {
              setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, icon } : i)));
            }
            const res = await fetch(`/api/ingredients/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ icon }),
            });
            if (res.ok) {
              const updated = (await res.json()) as Ingredient;
              setIngredients((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
            }
          }}
          onCreate={async (payload) => {
            const res = await fetch(`/api/ingredients`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({ error: "Falha." }));
              throw new Error(err.error ?? "Falha ao criar ingrediente.");
            }
            const created = (await res.json()) as Ingredient;
            setIngredients((prev) => [...prev, created]);
            return created;
          }}
          onUpdate={async (id, partial) => {
            const res = await fetch(`/api/ingredients/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(partial),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({ error: "Falha." }));
              throw new Error(err.error ?? "Falha ao atualizar.");
            }
            const updated = (await res.json()) as Ingredient;
            setIngredients((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
            return updated;
          }}
          onDelete={async (id) => {
            const res = await fetch(`/api/ingredients/${id}`, { method: "DELETE" });
            if (!res.ok && res.status !== 404) {
              const err = await res.json().catch(() => ({ error: "Falha." }));
              throw new Error(err.error ?? "Falha ao remover.");
            }
            setIngredients((prev) => prev.filter((i) => i.id !== id));
          }}
          onReorder={async (category, orderedIds) => {
            // Optimistic: aplica nova ordem local imediatamente;
            // back-end re-numera as posições (0..N) e broadcast pro
            // atendente refletir as chips em tempo real.
            setIngredients((prev) => {
              const byId = new Map(prev.map((i) => [i.id, i]));
              const reordered: Ingredient[] = [];
              orderedIds.forEach((id, index) => {
                const ing = byId.get(id);
                if (ing) {
                  reordered.push({ ...ing, position: index });
                  byId.delete(id);
                }
              });
              // Items de OUTRAS categorias mantêm como estavam
              const rest = Array.from(byId.values());
              return [...reordered, ...rest];
            });
            const res = await fetch(`/api/ingredients/reorder`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ category, orderedIds }),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({ error: "Falha." }));
              throw new Error(err.error ?? "Falha ao reordenar.");
            }
          }}
        />
      )}
      {tab === "promocoes" && (
        <Promocoes
          promotions={promotions}
          setPromotions={setPromotions}
          products={products}
        />
      )}
      {tab === "clientes" && <Clientes />}
      {tab === "usuarios" && <Usuarios users={users} setUsers={setUsers} />}
      {confirmDialogNode}
      {toastNode}
    </AdminShell>
  );
}

/* ============================================================
   ADMIN SHELL — layout responsive.
   Mobile (< md): bottom nav 4 abas principais + "Mais" → sheet
   Desktop (>= md): sidebar lateral retrátil esquerda
   ============================================================ */
type TabMeta = {
  id: Tab;
  label: string;
  mobileLabel?: string; // override mais curto pra bottom-nav 320px
  icon: React.ReactNode;
  priority: number; // 0-3 = visível no mobile bottom nav, 4+ = no menu "Mais"
};

// Ordem do menu admin reflete fluxo real do dia:
//   1º Caixa — Gil sempre abre antes de qualquer venda começar
//   2º Vendas — KPIs depois que tá rolando
//   3º Cardápio — ajuste de estoque/produto no meio do dia
//   4º+ Mais — clientes, histórico, promo, usuários no menu "Mais"
// Operação renomeada pra Caixa porque é o que Gil chama. Conteúdo segue
// o mesmo (status do caixa atual + Abrir/Fechar + board ao vivo).
// Vendas inclui sub-tab "Pedidos" (antiga aba Histórico). Menu cuts down
// de 7 → 6 itens. Caixa fica primeiro como ponto de entrada do dia.
const ADMIN_TABS: TabMeta[] = [
  { id: "operacao", label: "Caixa", icon: <Activity size={22} strokeWidth={2} />, priority: 0 },
  { id: "vendas", label: "Vendas", icon: <ChartBar size={22} strokeWidth={2} />, priority: 1 },
  { id: "cardapio", label: "Cardápio", icon: <UtensilsCrossed size={22} strokeWidth={2} />, priority: 2 },
  { id: "clientes", label: "Clientes", icon: <Contact size={22} strokeWidth={2} />, priority: 4 },
  { id: "promocoes", label: "Promoções", icon: <Tag size={22} strokeWidth={2} />, priority: 6 },
  { id: "usuarios", label: "Usuários", icon: <UsersIcon size={22} strokeWidth={2} />, priority: 7 },
];

function AdminShell({
  tab,
  setTab,
  children,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { operator, clear } = useOperator();
  const [confirmingExit, setConfirmingExit] = useState(false);
  function doExit() {
    clear();
    router.replace("/");
  }
  const [moreOpen, setMoreOpen] = useState(false);
  // Sidebar default EXPANDIDA quando localStorage está vazio (primeiro
  // acesso) — atalho pra power user existe, mas discoverability dos labels
  // no primeiro contato é mais valiosa que economia de pixels. Audit P2 #15.
  // Quem prefere colapsada toggla e a preferência persiste.
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  useEffect(() => {
    const stored = localStorage.getItem("pdg:admin-sidebar");
    if (stored === "collapsed") setSidebarExpanded(false);
    // "expanded" ou ausente → mantém default true
  }, []);
  function toggleSidebar() {
    const next = !sidebarExpanded;
    setSidebarExpanded(next);
    localStorage.setItem("pdg:admin-sidebar", next ? "expanded" : "collapsed");
  }

  const mobilePrimary = ADMIN_TABS.filter((t) => t.priority < 3);
  const mobileMore = ADMIN_TABS.filter((t) => t.priority >= 3);

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row">
      {/* === DESKTOP SIDEBAR (md+) === */}
      <aside
        className={`hidden lg:flex flex-col fixed left-0 top-0 bottom-0 z-30 bg-surface-elevated border-r border-line transition-[width] duration-200 ease-out ${
          sidebarExpanded ? "w-56" : "w-16"
        }`}
      >
        <div className={`flex items-center gap-2 px-3 py-4 border-b border-line ${sidebarExpanded ? "" : "justify-center"}`}>
          <BrandIcon size={32} />
          {sidebarExpanded && (
            <div className="flex items-baseline gap-1 leading-none">
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-3">Cozinha da</span>
              <span className="text-lg font-bold -tracking-[0.01em]">Gil</span>
            </div>
          )}
        </div>
        <nav className="flex-1 flex flex-col gap-1 p-2 overflow-y-auto">
          {ADMIN_TABS.map((t) => (
            <SidebarButton
              key={t.id}
              active={tab === t.id}
              label={t.label}
              icon={t.icon}
              expanded={sidebarExpanded}
              onClick={() => setTab(t.id)}
            />
          ))}
        </nav>
        {/* Monitor — view minimalista pra acompanhar evento de longe
            (celular pessoal). Fora da nav principal pra não competir
            com Caixa/Vendas; sempre visível pra um pulo rápido. */}
        <Link
          href="/admin/monitor"
          className={`border-t border-line px-3 py-3 inline-flex items-center gap-2 text-ink-2 hover:text-ink hover:bg-surface-sunken transition ${
            sidebarExpanded ? "" : "justify-center"
          }`}
          title="Monitor (KPIs ao vivo)"
        >
          <MonitorIcon size={18} strokeWidth={2.25} />
          {sidebarExpanded && (
            <span className="text-sm font-semibold">Monitor</span>
          )}
        </Link>
        {/* Link pro guia — sempre visível embaixo, fora da nav de abas.
            Acesso de referência rápida sem ocupar slot de tab principal. */}
        <Link
          href="/guia"
          className={`border-t border-line px-3 py-3 inline-flex items-center gap-2 text-ink-2 hover:text-ink hover:bg-surface-sunken transition ${
            sidebarExpanded ? "" : "justify-center"
          }`}
          title="Guia do app"
        >
          <BookOpen size={18} strokeWidth={2.25} />
          {sidebarExpanded && (
            <span className="text-sm font-semibold">Guia do app</span>
          )}
        </Link>
        {/* Sair — no desktop o AppHeader (que tem o botão trocar operador)
            fica lg:hidden, então sem isso a Gil ficava presa no admin sem
            jeito de deslogar. Mostra operador logado quando expandido. */}
        <button
          onClick={() => setConfirmingExit(true)}
          className={`border-t border-line px-3 py-3 inline-flex items-center gap-2 text-ink-2 hover:text-danger hover:bg-danger/10 transition ${
            sidebarExpanded ? "" : "justify-center"
          }`}
          aria-label="Sair"
          title={operator ? `Sair (${operator.name})` : "Sair"}
        >
          <LogOut size={18} strokeWidth={2.25} />
          {sidebarExpanded && (
            <span className="text-sm font-semibold truncate">
              Sair{operator ? ` · ${operator.name}` : ""}
            </span>
          )}
        </button>
        <button
          onClick={toggleSidebar}
          className="border-t border-line px-3 py-3 inline-flex items-center gap-2 text-ink-3 hover:text-ink transition"
          aria-label={sidebarExpanded ? "Recolher menu" : "Expandir menu"}
          title={sidebarExpanded ? "Recolher menu" : "Expandir menu"}
        >
          {sidebarExpanded ? (
            <>
              <ChevronLeft size={18} strokeWidth={2.5} />
              <span className="text-sm font-semibold">Recolher</span>
            </>
          ) : (
            <ChevronRight size={18} strokeWidth={2.5} className="mx-auto" />
          )}
        </button>
      </aside>

      {/* Confirmação de sair — compartilhada (sidebar desktop). */}
      <ConfirmDialog
        open={confirmingExit}
        title="Sair do admin?"
        message={operator ? `Sair como "${operator.name}" e voltar pra tela de login.` : "Voltar pra tela de login."}
        confirmLabel="Sair"
        onConfirm={() => { setConfirmingExit(false); doExit(); }}
        onClose={() => setConfirmingExit(false)}
      />

      {/* === BrandHeader no mobile only — link rápido pro Monitor à direita === */}
      <div className="lg:hidden">
        <AppHeader
          right={
            <Link
              href="/admin/monitor"
              className="inline-flex items-center justify-center w-10 h-10 rounded-md text-ink-2 hover:text-ink hover:bg-surface-sunken"
              title="Monitor (KPIs ao vivo)"
              aria-label="Abrir monitor"
            >
              <MonitorIcon size={20} strokeWidth={2.25} />
            </Link>
          }
        />
      </div>

      {/* === MAIN === */}
      <div className={`flex-1 flex flex-col pb-24 lg:pb-8 transition-[padding] duration-200 ${sidebarExpanded ? "lg:pl-56" : "lg:pl-16"}`}>
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 md:px-8 py-5 md:py-8">
          {children}
        </main>
      </div>

      {/* === MOBILE BOTTOM NAV (< md) === */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-surface-elevated border-t border-line">
        <div className="grid grid-cols-4">
          {mobilePrimary.map((t) => (
            <TabButton
              key={t.id}
              active={tab === t.id}
              label={t.mobileLabel ?? t.label}
              icon={t.icon}
              onClick={() => setTab(t.id)}
            />
          ))}
          <TabButton
            active={mobileMore.some((t) => t.id === tab)}
            label="Mais"
            icon={<MenuIcon size={22} strokeWidth={2} />}
            onClick={() => setMoreOpen(true)}
          />
        </div>
      </nav>

      {/* === MOBILE "MAIS" SHEET === */}
      {moreOpen && (
        <MoreSheet
          tab={tab}
          mobileMore={mobileMore}
          setTab={setTab}
          onClose={() => setMoreOpen(false)}
        />
      )}
    </div>
  );
}

/* Bottom sheet do "Mais" no mobile. Swipe-down pra fechar (padrão iOS). */
function MoreSheet({
  tab,
  mobileMore,
  setTab,
  onClose,
}: {
  tab: Tab;
  mobileMore: TabMeta[];
  setTab: (t: Tab) => void;
  onClose: () => void;
}) {
  const swipeHandlers = useSwipeable({
    onSwipedDown: onClose,
    trackMouse: false,
    delta: 50,
  });
  useBodyScrollLock(true);
  return (
    <div
      className="lg:hidden fixed inset-0 z-40 bg-ink/50 backdrop-blur-[3px] flex items-end animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mais opções"
        onClick={(e) => e.stopPropagation()}
        {...swipeHandlers}
        className="w-full bg-surface-elevated rounded-t-xl p-5 animate-sheet-up"
      >
        <div className="w-12 h-1 rounded-full bg-line-strong mx-auto mb-4" aria-hidden />
        <div className="t-label mb-3">Mais opções</div>
        <div className="flex flex-col gap-2">
          {mobileMore.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setTab(t.id);
                  onClose();
                }}
                className={`inline-flex items-center gap-3 h-14 px-4 rounded-md text-base font-semibold transition ${
                  active
                    ? "bg-brand-yellow text-ink"
                    : "bg-surface text-ink-2 hover:bg-surface-sunken hover:text-ink"
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            );
          })}
          {/* Guia do app no rodapé do sheet — separado das abas
              principais. Link sai do admin (página dedicada). */}
          <Link
            href="/guia"
            onClick={onClose}
            className="inline-flex items-center gap-3 h-14 px-4 rounded-md text-base font-semibold bg-surface text-ink-2 hover:bg-surface-sunken hover:text-ink border-t border-line mt-2 pt-3"
          >
            <BookOpen size={22} strokeWidth={2} />
            <span>Guia do app</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function SidebarButton({
  active,
  label,
  icon,
  expanded,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={!expanded ? label : undefined}
      className={`group inline-flex items-center h-11 rounded-md transition-colors ${
        active
          ? "bg-brand-yellow text-ink font-bold"
          : "text-ink-3 hover:bg-surface-sunken hover:text-ink"
      } ${expanded ? "gap-3 px-3" : "justify-center"}`}
    >
      <span className="shrink-0">{icon}</span>
      {expanded && <span className="text-sm">{label}</span>}
    </button>
  );
}

function TabButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 py-2.5 px-1 min-w-0 transition-colors ${
        active ? "text-ink" : "text-ink-3 hover:text-ink-2"
      }`}
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
    >
      <span
        className={`w-12 max-w-[60%] h-1 rounded-full -mt-2.5 ${active ? "bg-brand-yellow" : "bg-transparent"}`}
      />
      {icon}
      {/* truncate pra caber em iPhone SE (320px width / 4 = 80px por tab). */}
      <span className="text-[11px] font-semibold w-full text-center truncate">{label}</span>
    </button>
  );
}

/* ============================================================
   VENDAS
   ============================================================ */

type Range = "today" | "week" | "month" | "custom";

type ReportData = {
  from: string;
  to: string;
  daySpan: number;
  groupBy: "hour" | "day";
  counts: {
    total: number;
    active: number;
    delivered: number;
    cancelled: number;
    itemsTotal: number;
    salgados: number;
    doces: number;
    pequenos: number;
    grandes: number;
    docesNormais: number;
    miniPacks: number;
  };
  revenueCents: number;
  avgTicketCents: number;
  byHour: Record<string, { count: number; revenueCents: number }> | null;
  byDay: Array<{ date: string; count: number; revenueCents: number }> | null;
  top: {
    toppings: Array<{ name: string; count: number }>;
    flavors: Array<{ name: string; count: number }>;
    sauces: Array<{ name: string; count: number }>;
  };
  timings: {
    avgWaitSec: number | null;
    avgPrepSec: number | null;
    avgTotalSec: number | null;
  };
};

function computeRangeDates(range: Range, customFrom: string, customTo: string): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (range === "today") return { from: fmt(today), to: fmt(today) };
  if (range === "week") {
    const start = new Date(today);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day; // segunda como início
    start.setDate(start.getDate() + diff);
    return { from: fmt(start), to: fmt(today) };
  }
  if (range === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: fmt(start), to: fmt(today) };
  }
  return { from: customFrom || fmt(today), to: customTo || fmt(today) };
}

function rangeLabel(range: Range, from: string, to: string): string {
  if (range === "today")
    return new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  if (range === "week") return `Esta semana · ${from.slice(8, 10)}/${from.slice(5, 7)} → hoje`;
  if (range === "month") {
    const month = new Date(from).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return `Mês de ${month}`;
  }
  return `${from} → ${to}`;
}

/**
 * VENDAS — dois ângulos do mesmo dado:
 *   - "Resumo" (agregado): KPIs, gráficos, top toppings, fechamento
 *   - "Pedidos" (detalhe): lista paginada com busca e filtro por evento
 *
 * Antes "Pedidos" era uma aba separada chamada Histórico, distante da Vendas
 * no menu. Causava confusão ("pra ver quem comprou vou em Histórico, mas
 * pra ver quanto vendi vou em Vendas — é a mesma pergunta!"). Unificado
 * com sub-tabs (mesmo padrão do Cardápio). Persiste em localStorage.
 */
function Vendas({
  todayOrders,
  eventStatus,
  recentOrders,
  events,
}: {
  todayOrders: OrderView[];
  eventStatus: EventSessionStatus;
  recentOrders: OrderView[];
  events: EventListEntry[];
}) {
  const [subTab, setSubTab] = useState<"resumo" | "pedidos" | "eventos">("resumo");
  useEffect(() => {
    const stored = localStorage.getItem("pdg:vendas-tab");
    if (stored === "resumo" || stored === "pedidos" || stored === "eventos") setSubTab(stored);
  }, []);
  function changeSubTab(t: "resumo" | "pedidos" | "eventos") {
    setSubTab(t);
    localStorage.setItem("pdg:vendas-tab", t);
  }

  const [range, setRange] = useState<Range>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  const dates = useMemo(() => computeRangeDates(range, customFrom, customTo), [range, customFrom, customTo]);

  useEffect(() => {
    // Resumo é o único que precisa do report — pedidos sub-tab tem seus
    // próprios filtros e dados locais. Evita fetch desnecessário.
    if (subTab !== "resumo") return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/reports/today?from=${dates.from}&to=${dates.to}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dates.from, dates.to, todayOrders.length, subTab]);

  const isToday = range === "today";

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="t-h1 mb-1">Vendas</h1>
        <p className="t-body-sm">
          {subTab === "resumo"
            ? "Números do período (faturamento, top toppings, gráficos)"
            : subTab === "eventos"
            ? "Comparativo entre eventos (faturamento, pico, mais pedido)"
            : "Lista de cada pedido (busca por nome, telefone ou número)"}
        </p>
      </header>

      {/* Sub-tabs Resumo / Pedidos — padrão do Cardápio. Estado persistido
          em localStorage pra Gil voltar onde tava ao sair e voltar. */}
      <div className="inline-flex bg-surface-sunken rounded-lg p-1 self-start">
        <SubTabButton
          active={subTab === "resumo"}
          label="Resumo"
          count={null}
          onClick={() => changeSubTab("resumo")}
        />
        <SubTabButton
          active={subTab === "pedidos"}
          label="Pedidos"
          count={null}
          onClick={() => changeSubTab("pedidos")}
        />
        <SubTabButton
          active={subTab === "eventos"}
          label="Eventos"
          count={null}
          onClick={() => changeSubTab("eventos")}
        />
      </div>

      {subTab === "pedidos" ? (
        <HistoricoBody orders={recentOrders} events={events} />
      ) : subTab === "eventos" ? (
        <ComparativoEventos />
      ) : (
      <>
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {(
          [
            ["today", "Hoje"],
            ["week", "Semana"],
            ["month", "Mês"],
            ["custom", "Personalizado"],
          ] as Array<[Range, string]>
        ).map(([id, label]) => {
          const active = range === id;
          return (
            <button
              key={id}
              onClick={() => setRange(id)}
              className={`shrink-0 h-9 px-4 rounded-full text-sm font-semibold border ${
                active
                  ? "bg-ink text-brand-yellow border-ink"
                  : "bg-surface-elevated text-ink-2 border-line-strong hover:border-ink-3"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <p className="t-caption text-ink-3 -mt-3">
        {rangeLabel(range, dates.from, dates.to)}
      </p>

      {range === "custom" && (
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block t-label mb-1">
              De
            </label>
            <input
              type="date"
              className="input input-sm"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block t-label mb-1">
              Até
            </label>
            <input
              type="date"
              className="input input-sm"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </div>
        </div>
      )}

      {loading && !report ? (
        <VendasSkeleton />
      ) : !report ? null : (
        <>
          <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label="Faturamento" value={formatBRL(report.revenueCents)} accent="brand" />
            <KPI
              label="Pedidos"
              value={String(report.counts.active)}
              sub={report.counts.delivered > 0 ? `${report.counts.delivered} entregues` : null}
            />
            <KPI
              label="Ticket médio"
              value={report.counts.active > 0 ? formatBRL(report.avgTicketCents) : "—"}
            />
            <KPI
              label="Tempo de preparo"
              value={report.timings.avgPrepSec ? formatDuration(report.timings.avgPrepSec) : "—"}
              sub={report.timings.avgPrepSec ? "média" : null}
            />
          </div>

          <Section
            title={report.groupBy === "hour" ? "Pedidos por hora" : "Pedidos por dia"}
            empty={report.counts.active === 0 ? "Sem pedidos no período" : null}
          >
            {report.groupBy === "hour" && report.byHour ? (
              <HourChart byHour={report.byHour} />
            ) : report.byDay ? (
              <DayChart byDay={report.byDay} />
            ) : null}
          </Section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Section
              title={`Top toppings${isToday ? "" : " — " + rangeLabel(range, dates.from, dates.to)}`}
              empty={report.top.toppings.length === 0 ? "—" : null}
            >
              <TopList items={report.top.toppings} highlightFirst={!isToday} />
            </Section>
            <Section
              title={`Top doces${isToday ? "" : " — " + rangeLabel(range, dates.from, dates.to)}`}
              empty={report.top.flavors.length === 0 ? "—" : null}
            >
              <TopList items={report.top.flavors} highlightFirst={!isToday} />
            </Section>
          </div>

          <Section title={isToday ? "Mistos do dia" : "Mistos do período"}>
            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-3">
              <MiniStat label="Salgados" value={report.counts.salgados} />
              <MiniStat label="Doces" value={report.counts.doces} />
              <MiniStat label="2 ingredientes" value={report.counts.pequenos} />
              <MiniStat label="Monte o seu" value={report.counts.grandes} />
              <MiniStat label="Doce normal" value={report.counts.docesNormais} />
              <MiniStat label="Mini Pack" value={report.counts.miniPacks} />
              <MiniStat label="Cancelados" value={report.counts.cancelled} tone="danger" />
              <MiniStat label="Itens totais" value={report.counts.itemsTotal} />
            </div>
          </Section>
        </>
      )}

      <RelatoriosSection eventStatus={eventStatus} />
      </>
      )}
    </div>
  );
}

/* ============================================================
   CAIXA — função-chave do dia.
   Estado FECHADO: card grande com CTA "Abrir caixa" (foco principal).
   Estado ABERTO: barra slim no topo, só status + botão pequeno de
   fechar, pra não competir com o Trello operacional abaixo.
   ============================================================ */
function CaixaSection({
  eventStatus,
  onOpen,
  onClose,
}: {
  eventStatus: EventSessionStatus;
  onOpen: (name: string | null, eventDate: string | null) => void;
  onClose: () => void;
}) {
  const [openName, setOpenName] = useState("");
  const [openDate, setOpenDate] = useState("");
  const openedAt = eventStatus.openedAt ? new Date(eventStatus.openedAt) : null;
  const eventDate = eventStatus.eventDate ? new Date(eventStatus.eventDate) : null;

  // ESTADO ABERTO: barra slim — só status + botão pequeno de fechar.
  // Antes era um card grande que tomava 1/3 da tela e competia com o Trello;
  // agora é uma faixa fina que apenas confirma "tá aberto" sem atrapalhar.
  // Faturamento/Pedidos saíram daqui porque o grid de Stats logo abaixo já
  // mostra (e ainda traz Cancelados). Data do evento entra como pílula
  // discreta no lado direito quando tem.
  if (eventStatus.open && openedAt) {
    return (
      <section
        key="open"
        aria-label="Caixa aberto"
        className="rounded-lg bg-ink text-ink-inverse px-4 md:px-5 py-3 flex items-center gap-3 animate-state-swap-in shadow-sm border-l-4 border-status-ready"
      >
        {/* Status dot pulsa pra reforçar "vivo / ao vivo" */}
        <span className="relative shrink-0 inline-flex items-center justify-center">
          <span className="absolute inline-flex size-2.5 rounded-full bg-status-ready opacity-60 animate-ping" />
          <span className="relative inline-flex size-2.5 rounded-full bg-status-ready" />
        </span>

        {/* Bloco de texto — flex-1 pra empurrar o botão pra direita.
            min-w-0 + truncate evitam overflow quando o nome é longo. */}
        <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="t-label tracking-[0.08em] text-status-ready">Caixa aberto</span>
          <span className="font-bold text-[15px] truncate">{eventStatus.name ?? "Sem nome"}</span>
          <span className="text-xs text-ink-3">
            por <span className="font-semibold text-ink-inverse">{eventStatus.openedBy}</span> às{" "}
            {openedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        {/* Data do evento — pílula discreta, só desktop pra não estourar mobile */}
        {eventDate && (
          <span className="hidden md:inline-flex shrink-0 items-center px-2.5 py-1 rounded-full bg-surface-elevated text-ink text-xs font-bold t-num">
            {eventDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
          </span>
        )}

        <button
          onClick={onClose}
          aria-label="Fechar caixa do evento"
          className="shrink-0 inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md bg-danger text-white font-bold text-xs hover:brightness-110 transition active:scale-[0.98]"
        >
          <Lock size={14} strokeWidth={2.5} />
          <span className="hidden xs:inline">Fechar caixa</span>
        </button>
      </section>
    );
  }

  // ESTADO FECHADO: card claro com call-to-action de abrir
  return (
    <section
      key="closed"
      className="rounded-lg bg-surface-elevated border-2 border-dashed border-brand-yellow p-6 md:p-8 flex flex-col gap-5 animate-state-swap-in shadow-md"
    >
      <div>
        <div className="t-label tracking-[0.1em] mb-2 inline-flex items-center gap-1.5">
          <Lock size={14} strokeWidth={2.5} />
          Caixa fechado
        </div>
        <h2 className="t-display mb-2">
          Abra um caixa pra começar
        </h2>
        <div className="text-sm text-ink-2">
          Atendente <strong>não consegue</strong> criar pedidos enquanto não tiver caixa aberto.
          Pedidos vão ficar agrupados nesse evento até você fechar.
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="flex-1">
            <label className="t-label mb-1.5 block">
              Nome do evento <span className="text-danger normal-case tracking-normal">*</span>
            </label>
            <input
              type="text"
              className="input w-full"
              placeholder="Ex: Festa Junina, Sexta normal…"
              value={openName}
              onChange={(e) => setOpenName(e.target.value)}
              required
            />
          </div>
          <div className="md:w-52">
            <label className="t-label mb-1.5 block">
              Data <span className="text-danger normal-case tracking-normal">*</span>
            </label>
            <input
              type="date"
              className="input w-full"
              value={openDate}
              onChange={(e) => setOpenDate(e.target.value)}
              aria-label="Data do evento"
              required
            />
          </div>
        </div>
        <button
          onClick={() => {
            if (!openName.trim() || !openDate) return;
            onOpen(openName.trim(), openDate);
            setOpenName("");
            setOpenDate("");
          }}
          disabled={!openName.trim() || !openDate}
          className="inline-flex items-center justify-center gap-2 h-14 px-5 rounded-md bg-brand-yellow text-ink font-bold text-[15px] hover:bg-brand-yellow-hover transition active:scale-[0.98] shadow-md disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-brand-yellow"
        >
          <LockOpen size={20} strokeWidth={2.5} />
          Abrir caixa do evento
        </button>
        {(!openName.trim() || !openDate) && (
          <p className="t-caption text-ink-3">
            Preenche nome e data pra abrir. Ajuda a saber depois &ldquo;qual caixa foi esse&rdquo;.
          </p>
        )}
      </div>
    </section>
  );
}

/* Relatórios — bloco discreto, separado do caixa porque é função
   de exportação/consulta, não operação. */
function RelatoriosSection({ eventStatus }: { eventStatus: EventSessionStatus }) {
  const today = new Date().toISOString().slice(0, 10);
  const useEvent = eventStatus.open && eventStatus.id;
  const scope = useEvent ? `?eventSessionId=${eventStatus.id}` : `?date=${today}`;
  const scopeLabel = useEvent
    ? eventStatus.name ?? "Caixa atual"
    : `Hoje (${new Date(today).toLocaleDateString("pt-BR")})`;

  return (
    <section className="rounded-lg bg-surface-elevated border border-line p-4 md:p-5 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="t-label">
            Relatórios
          </div>
          <div className="text-sm font-bold text-ink-2">{scopeLabel}</div>
        </div>
      </div>
      <div className="flex flex-col md:flex-row gap-2">
        <a
          href={`/api/reports/pdf${scope}`}
          className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-md border border-line-strong bg-surface text-ink-2 hover:text-ink hover:border-ink-3 font-semibold text-sm transition"
        >
          <Download size={16} strokeWidth={2.5} />
          PDF (contábil)
        </a>
        <a
          href={`/api/reports/csv${scope}`}
          className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-md border border-line-strong bg-surface text-ink-2 hover:text-ink hover:border-ink-3 font-semibold text-sm transition"
        >
          <Download size={16} strokeWidth={2.5} />
          CSV (planilha)
        </a>
      </div>
    </section>
  );
}

function VendasSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* KPIs */}
      <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg p-4 border border-line bg-surface-elevated">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton h-7 mt-2 w-24" />
            <div className="skeleton h-3 mt-1.5 w-16" />
          </div>
        ))}
      </div>
      {/* chart placeholder */}
      <section>
        <div className="skeleton h-3 w-28 mb-2" />
        <div className="card-lg p-4 md:p-5">
          <div className="flex items-end gap-1 h-32">
            {Array.from({ length: 12 }).map((_, i) => {
              const h = 30 + ((i * 17) % 70);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="skeleton h-3 w-3" />
                  <div className="skeleton w-full" style={{ height: `${h}%` }} />
                  <div className="skeleton h-2 w-5" />
                </div>
              );
            })}
          </div>
        </div>
      </section>
      {/* top lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[0, 1].map((i) => (
          <section key={i}>
            <div className="skeleton h-3 w-24 mb-2" />
            <div className="card-lg p-4 md:p-5 flex flex-col gap-2.5">
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className="flex items-center gap-3">
                  <div className="skeleton h-4 w-4 rounded-full" />
                  <div className="skeleton h-3 flex-1" />
                  <div className="skeleton h-3 w-8" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      {/* mini stats grid */}
      <section>
        <div className="skeleton h-3 w-32 mb-2" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-md bg-surface-elevated border border-line p-3">
              <div className="skeleton h-3 w-20" />
              <div className="skeleton h-5 w-10 mt-1.5" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function KPI({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string | null;
  accent?: "brand" | undefined;
}) {
  return (
    <div
      className={`rounded-lg p-4 border ${
        accent === "brand"
          ? "bg-brand-yellow border-brand-yellow-press"
          : "bg-surface-elevated border-line"
      }`}
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-2">{label}</div>
      <div className="text-[28px] md:text-[32px] font-bold -tracking-[0.015em] mt-1 t-num">{value}</div>
      {sub && <div className="text-[11px] text-ink-2 mt-0.5">{sub}</div>}
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "danger" | "warn";
}) {
  const color =
    tone === "danger" ? "text-danger" : tone === "warn" ? "text-brand-orange" : "text-ink";
  return (
    <div className="rounded-md bg-surface-elevated border border-line p-3">
      <div className="t-label">{label}</div>
      <div className={`text-xl font-extrabold t-num mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}

function Section({
  title,
  children,
  empty,
}: {
  title: string;
  children: React.ReactNode;
  empty?: string | null;
}) {
  return (
    <section>
      <h2 className="t-label mb-2">{title}</h2>
      {empty ? (
        <div className="card p-5 text-center text-ink-3 italic">{empty}</div>
      ) : (
        <div className="card-lg p-4 md:p-5">{children}</div>
      )}
    </section>
  );
}

function HourChart({
  byHour,
}: {
  byHour: Record<string, { count: number; revenueCents: number }>;
}) {
  const hours = Object.entries(byHour).map(([h, v]) => ({ hour: Number(h), ...v }));
  hours.sort((a, b) => a.hour - b.hour);
  const max = Math.max(1, ...hours.map((h) => h.count));
  const withData = hours.filter((h) => h.count > 0);
  const start = withData.length ? Math.min(...withData.map((h) => h.hour)) : 0;
  const end = withData.length ? Math.max(...withData.map((h) => h.hour)) : 23;
  const visible = hours.filter((h) => h.hour >= Math.max(0, start - 1) && h.hour <= Math.min(23, end + 1));
  const peakHour = withData.length
    ? withData.reduce((p, c) => (c.count > p.count ? c : p)).hour
    : -1;

  return (
    <div className="flex items-end gap-1 h-32">
      {visible.map((h) => {
        const pct = (h.count / max) * 100;
        const isPeak = h.hour === peakHour && h.count > 0;
        return (
          <div key={h.hour} className="flex-1 flex flex-col items-center gap-1.5">
            <div className="text-[10px] font-bold text-ink-2 t-num min-h-3">
              {h.count > 0 ? h.count : ""}
            </div>
            <div
              className={`w-full rounded-t ${isPeak ? "bg-brand-orange" : "bg-brand-yellow"}`}
              style={{ height: `${pct}%`, minHeight: h.count > 0 ? 4 : 0 }}
            />
            <div className="text-[10px] text-ink-3 t-num">
              {String(h.hour).padStart(2, "0")}h
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayChart({
  byDay,
}: {
  byDay: Array<{ date: string; count: number; revenueCents: number }>;
}) {
  if (byDay.length === 0) return null;
  const max = Math.max(1, ...byDay.map((d) => d.count));
  const peakDay = byDay.reduce((p, c) => (c.count > p.count ? c : p)).date;
  return (
    <div className="flex items-end gap-1 h-32 overflow-x-auto">
      {byDay.map((d) => {
        const pct = (d.count / max) * 100;
        const isPeak = d.date === peakDay && d.count > 0;
        const label = d.date.slice(8, 10) + "/" + d.date.slice(5, 7);
        return (
          <div key={d.date} className="flex-1 min-w-8 flex flex-col items-center gap-1.5">
            <div className="text-[10px] font-bold text-ink-2 t-num min-h-3">
              {d.count > 0 ? d.count : ""}
            </div>
            <div
              className={`w-full rounded-t ${isPeak ? "bg-brand-orange" : "bg-brand-yellow"}`}
              style={{ height: `${pct}%`, minHeight: d.count > 0 ? 4 : 0 }}
            />
            <div className="text-[10px] text-ink-3 t-num">{label}</div>
          </div>
        );
      })}
    </div>
  );
}

function TopList({
  items,
  highlightFirst = false,
}: {
  items: Array<{ name: string; count: number; revenueCents?: number }>;
  highlightFirst?: boolean;
}) {
  if (items.length === 0) return null;
  const max = Math.max(...items.map((i) => i.count));
  // Audit-Crit B #11: mostra receita quando o backend mandar (top do
  // /api/reports/today já retorna revenueCents). Útil pra Gil planejar
  // compras: "Catupiry deu R$ 350 esse mês" > "12 ocorrências".
  const hasRevenue = items.some((i) => typeof i.revenueCents === "number");
  return (
    <ul className="flex flex-col gap-2">
      {items.map((it, idx) => {
        const pct = (it.count / max) * 100;
        const isTop = idx === 0 && highlightFirst;
        return (
          <li key={it.name} className="flex items-center gap-3">
            <span className="text-sm font-semibold text-ink w-28 truncate flex items-center gap-1.5">
              {isTop && <Trophy size={14} strokeWidth={2.25} className="text-brand-orange shrink-0" aria-hidden />}
              <span className="truncate">{it.name}</span>
            </span>
            <div className="flex-1 h-2 bg-surface-sunken rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${isTop ? "bg-brand-orange" : "bg-brand-yellow"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-sm font-bold t-num w-8 text-right">{it.count}</span>
            {hasRevenue && (
              <span
                className="text-xs t-num text-ink-3 w-20 text-right tabular-nums"
                title="Receita atribuída (split por categoria)"
              >
                {it.revenueCents
                  ? formatBRL(it.revenueCents)
                  : "—"}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ============================================================
   HISTÓRICO
   ============================================================ */

function HistoricoBody({ orders: initialOrders, events }: { orders: OrderView[]; events: EventListEntry[] }) {
  type Range = "today" | "yesterday" | "7d" | "all";
  const [range, setRange] = useState<Range>("today");
  // Filtro por evento — string vazia = todos (usa range por data)
  const [eventId, setEventId] = useState<string>("");
  const [orders, setOrders] = useState<OrderView[]>(initialOrders);
  const [loading, setLoading] = useState(false);
  // Busca por nome/telefone/número (audit P3 #27): CRM tinha busca, Histórico
  // não — Gil queria "qual foi o pedido da Maria semana passada?". Filtra
  // em cima do range/evento — não vai pro servidor.
  const [query, setQuery] = useState("");
  // Paginação client-side: histórico pode ter 600+ pedidos em "Tudo".
  // Carregar tudo no DOM trava tablet. Mostra 50 por vez + botão "Ver mais".
  // Reset quando muda range/evento/query.
  const PAGE_SIZE = 50;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [range, eventId, query]);

  // Quando seleciona um evento, refetch orders desse evento
  useEffect(() => {
    if (!eventId) {
      setOrders(initialOrders);
      return;
    }
    setLoading(true);
    fetch(`/api/orders?eventSessionId=${eventId}`)
      .then((r) => r.json())
      .then((data) => setOrders(data))
      .finally(() => setLoading(false));
  }, [eventId, initialOrders]);

  const filtered = useMemo(() => {
    let result: OrderView[];
    // Quando filtro por evento ativo, mostra todos do evento — ignora range
    if (eventId) {
      result = orders;
    } else {
      const now = new Date();
      if (range === "today") {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        result = orders.filter((o) => new Date(o.createdAt) >= start);
      } else if (range === "yesterday") {
        const end = new Date(now);
        end.setHours(0, 0, 0, 0);
        const start = new Date(end);
        start.setDate(start.getDate() - 1);
        result = orders.filter((o) => {
          const t = new Date(o.createdAt);
          return t >= start && t < end;
        });
      } else if (range === "7d") {
        const start = new Date(now);
        start.setDate(start.getDate() - 7);
        result = orders.filter((o) => new Date(o.createdAt) >= start);
      } else {
        result = orders;
      }
    }
    // Aplica busca sobre o range filtrado — case-insensitive, casa em nome,
    // telefone (dígitos puros) e número do pedido (#042 ou 42).
    const q = query.trim().toLowerCase();
    if (!q) return result;
    const qDigits = q.replace(/\D/g, "");
    return result.filter((o) => {
      if (o.clientName.toLowerCase().includes(q)) return true;
      if (qDigits) {
        if (String(o.id).padStart(3, "0").includes(qDigits)) return true;
        if (o.clientPhone && o.clientPhone.replace(/\D/g, "").includes(qDigits)) return true;
      }
      return false;
    });
  }, [orders, range, eventId, query]);

  return (
    <div className="flex flex-col gap-5">
      <header>
        {/* Sem <h1> aqui — o título "Vendas" já tá no header da aba mãe;
            essa sub-tab é só lista de pedidos. */}

        {/* Busca por nome / telefone / #pedido (audit P3 #27) */}
        <div className="mb-3 relative">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, telefone ou #pedido…"
            className="input pl-10"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>

        {events.length > 0 && (
          <div className="mb-3">
            <label className="block t-label mb-1">
              Filtrar por evento
            </label>
            <select
              className="input input-sm w-full md:w-auto"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
            >
              <option value="">— Filtrar por data (abaixo) —</option>
              {events.map((s) => {
                const opened = new Date(s.openedAt);
                const label = `${s.name ?? "Caixa"} · ${opened.toLocaleDateString("pt-BR")} · ${s.orderCount} pedido${s.orderCount === 1 ? "" : "s"}${s.closedAt ? "" : " (aberto)"}`;
                return (
                  <option key={s.id} value={s.id}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {!eventId && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {(
              [
                ["today", "Hoje"],
                ["yesterday", "Ontem"],
                ["7d", "Últimos 7 dias"],
                ["all", "Tudo"],
              ] as Array<[Range, string]>
            ).map(([id, label]) => {
              const active = range === id;
              return (
                <button
                  key={id}
                  onClick={() => setRange(id)}
                  className={`shrink-0 h-9 px-4 rounded-full text-sm font-semibold border ${
                    active
                      ? "bg-ink text-brand-yellow border-ink"
                      : "bg-surface-elevated text-ink-2 border-line-strong hover:border-ink-3"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {loading ? (
        // Audit-Crit C #13: skeletons em vez de "Carregando…" — UX moderna.
        // Renderiza placeholders com mesma estrutura visual de HistoryRow
        // (avatar circular, 2 linhas, badge à direita) pra layout não
        // saltar quando dados chegam. Animação pulse pisca discreto.
        <ul className="flex flex-col gap-3" aria-busy="true" aria-live="polite">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="card p-4 flex items-center gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-surface-sunken shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="h-3 w-32 bg-surface-sunken rounded mb-2" />
                <div className="h-2.5 w-48 bg-surface-sunken rounded" />
              </div>
              <div className="h-6 w-20 bg-surface-sunken rounded" />
            </li>
          ))}
        </ul>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center border-dashed">
          <div className="flex justify-center mb-2 opacity-50">
            <ClipboardList size={56} strokeWidth={1.5} />
          </div>
          <div className="t-h4 text-ink-2">Sem pedidos neste período.</div>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {filtered.slice(0, visibleCount).map((o) => (
              <HistoryRow key={o.id} order={o} />
            ))}
          </ul>
          {visibleCount < filtered.length && (
            <button
              onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
              className="mt-3 w-full h-11 rounded-md border-2 border-dashed border-line-strong text-ink-2 font-semibold hover:border-ink-3 hover:text-ink transition-colors"
            >
              Ver mais {Math.min(PAGE_SIZE, filtered.length - visibleCount)}
              <span className="t-caption ml-2">
                ({visibleCount} de {filtered.length})
              </span>
            </button>
          )}
        </>
      )}
    </div>
  );
}

function HistoryRow({ order }: { order: OrderView }) {
  const created = new Date(order.createdAt);
  const delivered = order.deliveredAt ? new Date(order.deliveredAt) : null;
  const total = delivered ? (delivered.getTime() - created.getTime()) / 1000 : null;

  const statusColor =
    order.status === "ENTREGUE"
      ? "text-status-delivered-ink bg-status-delivered-bg"
      : order.status === "CANCELADO"
      ? "text-danger bg-danger-bg"
      : order.status === "PRONTO"
      ? "text-status-ready-ink bg-status-ready-bg"
      : order.status === "EM_PREPARO"
      ? "text-status-preparing-ink bg-status-preparing-bg"
      : "text-status-incoming-ink bg-status-incoming-bg";

  const dim = order.status === "ENTREGUE" || order.status === "CANCELADO";

  return (
    <li className={`card p-4 transition-opacity ${dim ? "opacity-70" : ""}`}>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="font-mono text-xs text-ink-3 t-num">
            #{String(order.id).padStart(3, "0")} ·{" "}
            {created.toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          <div className="t-h2 truncate">{order.clientName}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={`text-[10px] font-bold uppercase tracking-[0.08em] px-2 py-0.5 rounded ${statusColor}`}
          >
            {order.status.replace("_", " ")}
          </span>
          <span className="text-sm font-bold t-num">{formatBRL(order.totalCents)}</span>
        </div>
      </div>

      <ul className="flex flex-col gap-1 mb-3">
        {/* Expande cada item por quantidade — repete linhas em vez de "×N",
            pra ficar inequívoco o que foi pedido (igual comprovante). */}
        {order.items
          .flatMap((it) =>
            Array.from({ length: it.quantity }, (_, n) => ({ it, n })),
          )
          .map(({ it, n }, flatIdx, allUnits) => {
            const productName =
              it.productName ||
              (it.kind === "doce"
                ? "Pastel Doce"
                : it.kind === "salgado"
                ? "Pastel Salgado"
                : it.kind);
            const sizeLabel =
              it.size && SIZE_LABEL[it.size as keyof typeof SIZE_LABEL]
                ? SIZE_LABEL[it.size as keyof typeof SIZE_LABEL]
                : it.size;
            const icon =
              it.kind === "doce" ? <DoceIcon size={16} /> :
              it.kind === "bebida" ? <Coffee size={16} strokeWidth={2} /> :
              it.kind === "macarrao" ? <Utensils size={16} strokeWidth={2} /> :
              it.kind === "combo" ? <Package size={16} strokeWidth={2} /> :
              <PastelIcon size={16} />;
            return (
              <li key={`${it.id}-${n}`} className="text-sm text-ink-2 flex items-start gap-2">
                {allUnits.length > 1 && (
                  <span className="text-[11px] font-bold text-ink-3 t-num w-4 mt-0.5">
                    {flatIdx + 1}.
                  </span>
                )}
                <span className="shrink-0 mt-0.5">{icon}</span>
                <span className="leading-snug flex-1">
                  <span className="font-semibold text-ink">{productName}</span>
                  {sizeLabel ? ` · ${sizeLabel}` : ""}
                  {it.kind === "doce" && it.flavor && ` · ${it.flavor}`}
                  {it.kind !== "doce" && it.toppings.length > 0 && ` · ${it.toppings.join(", ")}`}
                  {it.sauces.length > 0 && ` · molhos: ${it.sauces.join(", ")}`}
                </span>
                <span className="t-num font-semibold text-ink-2 shrink-0">
                  {formatBRL(it.unitPrice)}
                </span>
              </li>
            );
          })}
      </ul>

      <dl className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] border-t border-line pt-2">
        <Audit label="Criou" name={order.createdBy} at={order.createdAt} />
        <Audit label="Em preparo" name={order.preparedBy} at={order.preparedAt} />
        <Audit label="Pronto" name={order.readyBy} at={order.readyAt} />
        <Audit
          label={order.status === "CANCELADO" ? "Cancelou" : "Entregou"}
          name={order.status === "CANCELADO" ? order.cancelledBy : order.deliveredBy}
          at={order.status === "CANCELADO" ? order.cancelledAt : order.deliveredAt}
        />
      </dl>

      <div className="mt-2 flex items-center justify-between gap-2">
        {total !== null ? (
          <div className="text-[11px] text-ink-3 flex items-center gap-1">
            <Clock size={12} strokeWidth={2.5} />
            Total: {formatDuration(total)}
          </div>
        ) : (
          <span />
        )}
        <Link
          href={`/comprovante/${order.id}`}
          target="_blank"
          className="inline-flex items-center gap-1 text-xs font-semibold text-ink-2 hover:text-ink"
        >
          <Receipt size={14} strokeWidth={2.5} />
          Comprovante
        </Link>
      </div>

      {order.cancelReason && (
        <div className="mt-2 text-xs text-danger bg-danger-bg rounded-sm px-2.5 py-1.5">
          <span className="font-bold">Motivo:</span> {order.cancelReason}
        </div>
      )}
    </li>
  );
}

function Audit({
  label,
  name,
  at,
}: {
  label: string;
  name: string | null;
  at: string | Date | null;
}) {
  if (!name || !at) {
    return (
      <div>
        <div className="text-ink-3 font-semibold uppercase tracking-[0.06em] text-[10px]">{label}</div>
        <div className="text-ink-3 italic">—</div>
      </div>
    );
  }
  const time = new Date(at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <div>
      <div className="text-ink-3 font-semibold uppercase tracking-[0.06em] text-[10px]">{label}</div>
      <div className="text-ink font-semibold">{name}</div>
      <div className="text-ink-3 t-num">{time}</div>
    </div>
  );
}

/* ============================================================
   CARDÁPIO
   ============================================================ */

const CATEGORY_LABEL: Record<string, string> = {
  topping: "Toppings (salgados)",
  doce: "Doces (receitas)",
  molho: "Molhos extras",
  macarrao_topping: "Toppings (macarrão)",
  macarrao_molho: "Molhos (macarrão)",
  bebida_extra: "Bebidas (extras)",
};

// Lista canônica das categorias permitidas — usada no select do modal
// "Novo ingrediente" e no dropdown de mudar categoria. Mesmo set do
// allow-list da API em app/api/ingredients/route.ts.
const INGREDIENT_CATEGORIES = [
  "topping",
  "doce",
  "molho",
  "macarrao_topping",
  "macarrao_molho",
  "bebida_extra",
] as const;

function Cardapio({
  products,
  setProducts,
  ingredients,
  onToggle,
  onIconChange,
  onCreate,
  onUpdate,
  onDelete,
  onReorder,
}: {
  products: ProductView[];
  setProducts: React.Dispatch<React.SetStateAction<ProductView[]>>;
  ingredients: Ingredient[];
  onToggle: (id: string, available: boolean) => void;
  onIconChange: (id: string, icon: string | null) => void;
  onCreate: (payload: { name: string; category: string; icon?: string | null }) => Promise<Ingredient>;
  onUpdate: (id: string, partial: { name?: string; category?: string }) => Promise<Ingredient>;
  onDelete: (id: string) => Promise<void>;
  onReorder: (category: string, orderedIds: string[]) => Promise<void>;
}) {
  const [editingProduct, setEditingProduct] = useState<ProductView | "new" | null>(null);
  // Estado pra modal de novo ingrediente. Se aberta com categoria pré-
  // selecionada (clique no botão "+" da seção), vem aqui.
  const [creatingIngredient, setCreatingIngredient] = useState<string | "any" | null>(null);
  const { confirm, node: confirmDialogNode } = useConfirmDialog();
  const { showToast, node: toastNode } = useToast();

  const grouped = useMemo(() => {
    const g: Record<string, Ingredient[]> = {};
    for (const i of ingredients) (g[i.category] ??= []).push(i);
    return g;
  }, [ingredients]);

  const productsByType = useMemo(() => {
    const g: Record<string, ProductView[]> = {};
    for (const p of products) (g[p.type] ??= []).push(p);
    return g;
  }, [products]);

  async function toggleProductAvailable(id: string, available: boolean) {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, available } : p)));
    await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ available }),
    });
  }

  async function refetchProducts() {
    const data = await fetch("/api/products").then((r) => r.json());
    setProducts(data);
  }

  // Sub-tabs do Cardápio. Persistido em localStorage pra Gil não perder
  // o contexto quando troca de tab admin e volta.
  const [subTab, setSubTab] = useState<"produtos" | "ingredientes">("produtos");
  useEffect(() => {
    const stored = localStorage.getItem("pdg:cardapio-tab");
    if (stored === "ingredientes" || stored === "produtos") setSubTab(stored);
  }, []);
  function changeTab(t: "produtos" | "ingredientes") {
    setSubTab(t);
    localStorage.setItem("pdg:cardapio-tab", t);
  }

  // Busca rápida no Ingredientes — filtro client-side pelo nome.
  // Reset quando troca sub-tab pra não ficar com filtro órfão.
  const [ingredientSearch, setIngredientSearch] = useState("");
  useEffect(() => {
    if (subTab !== "ingredientes") setIngredientSearch("");
  }, [subTab]);

  const filteredGrouped = useMemo(() => {
    const q = ingredientSearch.trim().toLowerCase();
    if (!q) return grouped;
    const result: Record<string, Ingredient[]> = {};
    for (const [cat, items] of Object.entries(grouped)) {
      // Match no nome — case-insensitive, substring.
      // Procurar também na categoria seria útil mas confunde se Gil
      // digitar "doce" e ver tudo que tá em categoria=doce e nada
      // que TEM "doce" no nome. Match só por nome é mais previsível.
      const matches = items.filter((i) => i.name.toLowerCase().includes(q));
      if (matches.length > 0) result[cat] = matches;
    }
    return result;
  }, [grouped, ingredientSearch]);

  const filteredTotal = useMemo(
    () => Object.values(filteredGrouped).reduce((sum, items) => sum + items.length, 0),
    [filteredGrouped],
  );

  const productCount = products.length;
  const ingredientCount = ingredients.length;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="t-h1 mb-1">Cardápio</h1>
        <p className="t-body-sm">
          Desligue um item quando acabar — ele some das opções no atendente em tempo real.
        </p>
      </header>

      {/* Sub-tabs Produtos / Ingredientes — segmented control */}
      <div className="inline-flex bg-surface-sunken rounded-lg p-1 self-start">
        <SubTabButton
          active={subTab === "produtos"}
          label="Produtos"
          count={productCount}
          onClick={() => changeTab("produtos")}
        />
        <SubTabButton
          active={subTab === "ingredientes"}
          label="Ingredientes"
          count={ingredientCount}
          onClick={() => changeTab("ingredientes")}
        />
      </div>

      {subTab === "produtos" && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="t-body-sm">
              Pastéis, macarrão, bebidas e combos. O que vai pra venda no atendente.
            </p>
            <button
              onClick={() => setEditingProduct("new")}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-ink text-brand-yellow text-sm font-semibold hover:brightness-110 shrink-0 ml-3"
            >
              <UserPlus size={14} strokeWidth={2.5} />
              Novo produto
            </button>
          </div>
          {Object.entries(productsByType).map(([type, items]) => (
            <div key={type} className="mb-4">
              <div className="t-label tracking-[0.06em] mb-2">
                {PRODUCT_TYPE_LABEL[type] ?? type}
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {items.map((p) => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    onToggle={toggleProductAvailable}
                    onEdit={() => setEditingProduct(p)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {subTab === "ingredientes" && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="t-body-sm">
              Toppings, molhos e sabores. Clica no nome pra renomear; lixeira apaga.
            </p>
            <button
              onClick={() => setCreatingIngredient("any")}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-ink text-brand-yellow text-sm font-semibold hover:brightness-110 shrink-0 ml-3"
            >
              <UserPlus size={14} strokeWidth={2.5} />
              Novo ingrediente
            </button>
          </div>

          {/* Busca rápida — útil agora que Gil pode chegar a 40+ ingredientes
              depois de adicionar livremente. Filtro client-side, sem fetch. */}
          <div className="relative mb-1">
            <Search
              size={18}
              strokeWidth={2.25}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none"
            />
            <input
              type="search"
              value={ingredientSearch}
              onChange={(e) => setIngredientSearch(e.target.value)}
              placeholder={`Buscar entre ${ingredientCount} ingredientes…`}
              className="input pl-10"
              aria-label="Buscar ingrediente"
            />
            {ingredientSearch.trim() && (
              <button
                onClick={() => setIngredientSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink p-1.5 rounded"
                aria-label="Limpar busca"
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            )}
          </div>
          {ingredientSearch.trim() && (
            <p className="t-caption text-ink-3 mb-3">
              {filteredTotal === 0
                ? "Nenhum ingrediente encontrado."
                : `${filteredTotal} de ${ingredientCount} ingredientes`}
            </p>
          )}

          {Object.entries(filteredGrouped).map(([category, items]) => (
            <IngredientsCategoryList
              key={category}
              category={category}
              items={items}
              dragEnabled={!ingredientSearch.trim()}
              onAddClick={() => setCreatingIngredient(category)}
              onToggle={onToggle}
              onIconChange={onIconChange}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onReorder={onReorder}
              confirm={confirm}
              showToast={showToast}
            />
          ))}
        </section>
      )}

      {editingProduct && (
        <ProductModal
          product={editingProduct === "new" ? null : editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={() => {
            setEditingProduct(null);
            refetchProducts();
          }}
        />
      )}

      {creatingIngredient && (
        <IngredientCreateModal
          initialCategory={creatingIngredient === "any" ? null : creatingIngredient}
          onClose={() => setCreatingIngredient(null)}
          onCreate={async (payload) => {
            try {
              await onCreate(payload);
              showToast(`"${payload.name}" adicionado.`, "success");
              setCreatingIngredient(null);
            } catch (e) {
              showToast(
                e instanceof Error ? e.message : "Falha ao criar.",
                "error",
              );
              // não fecha o modal, deixa Gil tentar de novo com nome corrigido
            }
          }}
        />
      )}

      {confirmDialogNode}
      {toastNode}
    </div>
  );
}

function SubTabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  // count opcional — null esconde o badge (usado em Vendas onde
  // "Resumo" / "Pedidos" não tem contagem natural).
  count: number | null;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 h-9 px-4 rounded-md text-sm font-semibold transition-colors ${
        active
          ? "bg-surface-elevated text-ink shadow-sm"
          : "text-ink-3 hover:text-ink"
      }`}
    >
      <span>{label}</span>
      {count !== null && (
        <span
          className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded ${
            active ? "bg-brand-yellow text-ink" : "bg-line text-ink-3"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/* ============================================================
   PROMOÇÕES — tab própria. Lista de descontos editáveis + cupons.
   ============================================================ */
function Promocoes({
  promotions,
  setPromotions,
  products,
}: {
  promotions: PromotionView[];
  setPromotions: React.Dispatch<React.SetStateAction<PromotionView[]>>;
  products: ProductView[];
}) {
  const [editingPromo, setEditingPromo] = useState<PromotionView | "new" | null>(null);
  const { confirm, node: confirmNode } = useConfirmDialog();
  const ativas = promotions.filter((p) => p.active);
  const inativas = promotions.filter((p) => !p.active);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="flex items-start justify-between gap-3 mb-1">
          <h1 className="t-h1">Promoções</h1>
          <button
            onClick={() => setEditingPromo("new")}
            className="inline-flex items-center gap-1.5 h-11 px-4 rounded-md bg-ink text-brand-yellow text-[13px] font-bold hover:brightness-110 active:scale-[0.97] transition shrink-0"
          >
            <UserPlus size={16} strokeWidth={2.5} />
            Nova promoção
          </button>
        </div>
        <p className="t-body-sm">
          Descontos automáticos (auto-aplicam quando carrinho passa nas condições) ou cupons digitáveis pelo atendente.
        </p>
      </header>

      {promotions.length === 0 ? (
        <div className="card p-10 text-center border-dashed">
          <div className="t-h4 text-ink-2 mb-1">Nenhuma promoção ainda.</div>
          <div className="t-body-sm">
            Crie uma pra oferecer descontos. Pode ser % off, valor fixo R$ ou item grátis.
          </div>
        </div>
      ) : (
        <>
          {ativas.length > 0 && (
            <section>
              <div className="t-label mb-2">
                Ativas ({ativas.length})
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {ativas.map((p) => (
                  <PromotionRow
                    key={p.id}
                    promo={p}
                    onToggle={async (active) => {
                      setPromotions((prev) => prev.map((x) => (x.id === p.id ? { ...x, active } : x)));
                      await fetch(`/api/promotions/${p.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ active }),
                      });
                    }}
                    onEdit={() => setEditingPromo(p)}
                  />
                ))}
              </ul>
            </section>
          )}

          {inativas.length > 0 && (
            <section>
              <div className="t-label mb-2">
                Pausadas ({inativas.length})
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {inativas.map((p) => (
                  <PromotionRow
                    key={p.id}
                    promo={p}
                    onToggle={async (active) => {
                      setPromotions((prev) => prev.map((x) => (x.id === p.id ? { ...x, active } : x)));
                      await fetch(`/api/promotions/${p.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ active }),
                      });
                    }}
                    onEdit={() => setEditingPromo(p)}
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {editingPromo && (
        <PromotionModal
          promo={editingPromo === "new" ? null : editingPromo}
          products={products}
          onClose={() => setEditingPromo(null)}
          onSaved={async () => {
            setEditingPromo(null);
            const data = await fetch("/api/promotions").then((r) => r.json());
            setPromotions(data);
          }}
          onDelete={async (id) => {
            const ok = await confirm({
              title: "Apagar essa promoção?",
              message: "Pedidos antigos que usaram essa promo continuam intactos.",
              confirmLabel: "Apagar",
              destructive: true,
            });
            if (!ok) return;
            await fetch(`/api/promotions/${id}`, { method: "DELETE" });
            setPromotions((prev) => prev.filter((x) => x.id !== id));
            setEditingPromo(null);
          }}
        />
      )}
      {confirmNode}
    </div>
  );
}

function PromotionRow({
  promo,
  onToggle,
  onEdit,
}: {
  promo: PromotionView;
  onToggle: (active: boolean) => void;
  onEdit: () => void;
}) {
  const discountText =
    promo.discountType === "percent"
      ? `${promo.discountValue}% off`
      : promo.discountType === "fixed_cents"
      ? `${formatBRL(promo.discountValue)} off`
      : "item grátis";
  const conditions: string[] = [];
  if (promo.couponCode) conditions.push(`cupom: ${promo.couponCode}`);
  if (promo.minItems) conditions.push(`mín ${promo.minItems} itens`);
  if (promo.minTotalCents) conditions.push(`mín ${formatBRL(promo.minTotalCents)}`);
  if (promo.appliesToProductIds.length > 0) conditions.push(`${promo.appliesToProductIds.length} produto(s)`);

  return (
    <li
      className={`flex flex-col rounded-md border bg-surface-elevated px-4 py-3 gap-2 ${
        promo.active ? "border-line" : "border-line opacity-70"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col min-w-0 flex-1">
          <span className={`text-base font-semibold truncate ${promo.active ? "text-ink" : "text-ink-3 line-through"}`}>
            {promo.name}
          </span>
          <span className="text-xs text-ink-3">
            {discountText}
            {conditions.length > 0 ? ` · ${conditions.join(" · ")}` : ""}
          </span>
        </div>
        <Toggle on={promo.active} onChange={onToggle} labelOn="Ativa" labelOff="Pausada" />
      </div>
      {promo.description && (
        <div className="text-xs text-ink-2 italic">&ldquo;{promo.description}&rdquo;</div>
      )}
      <button
        onClick={onEdit}
        className="text-[11px] text-ink-3 font-semibold hover:text-ink-2 text-left"
      >
        Editar promoção
      </button>
    </li>
  );
}

function PromotionModal({
  promo,
  products,
  onClose,
  onSaved,
  onDelete,
}: {
  promo: PromotionView | null;
  products: ProductView[];
  onClose: () => void;
  onSaved: () => void;
  onDelete: (id: string) => void;
}) {
  useBodyScrollLock(true);
  const isNew = promo === null;
  const [name, setName] = useState(promo?.name ?? "");
  const [description, setDescription] = useState(promo?.description ?? "");
  const [discountType, setDiscountType] = useState<"percent" | "fixed_cents" | "free_item">(
    (promo?.discountType as "percent" | "fixed_cents" | "free_item") ?? "percent",
  );
  const [discountValue, setDiscountValue] = useState(
    promo?.discountValue !== undefined
      ? promo.discountType === "fixed_cents"
        ? String(promo.discountValue / 100)
        : String(promo.discountValue)
      : "",
  );
  const [active, setActive] = useState(promo?.active ?? true);
  const [minItems, setMinItems] = useState(promo?.minItems?.toString() ?? "");
  const [minTotal, setMinTotal] = useState(
    promo?.minTotalCents !== null && promo?.minTotalCents !== undefined
      ? String(promo.minTotalCents / 100)
      : "",
  );
  const [appliesTo, setAppliesTo] = useState<string[]>(promo?.appliesToProductIds ?? []);
  const [couponCode, setCouponCode] = useState(promo?.couponCode ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeKey(onClose);

  async function save() {
    setError(null);
    if (!name.trim()) return setError("Nome obrigatório.");
    // free_item não precisa de discountValue (0 ok); outros precisam
    const dv = discountType === "free_item" ? 0 : parseFloat(discountValue);
    if (discountType !== "free_item") {
      if (isNaN(dv) || dv < 0) return setError("Valor de desconto inválido.");
      if (discountType === "percent" && dv > 100) return setError("Percentual deve ser até 100.");
    }

    setSubmitting(true);
    const body = {
      name: name.trim(),
      description: description.trim() || null,
      discountType,
      discountValue: discountType === "fixed_cents" ? Math.round(dv * 100) : Math.floor(dv),
      active,
      minItems: minItems ? parseInt(minItems) : null,
      minTotalCents: minTotal ? Math.round(parseFloat(minTotal) * 100) : null,
      appliesToProductIds: appliesTo,
      couponCode: couponCode.trim() || null,
    };

    try {
      if (isNew) {
        const res = await fetch("/api/promotions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json();
          setError(err.error || "Erro.");
          setSubmitting(false);
          return;
        }
      } else {
        const res = await fetch(`/api/promotions/${promo!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json();
          setError(err.error || "Erro.");
          setSubmitting(false);
          return;
        }
      }
      onSaved();
    } catch {
      setError("Erro de rede.");
      setSubmitting(false);
    }
  }

  function toggleProduct(id: string) {
    setAppliesTo((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="promo-modal-title"
        className="bg-surface-elevated rounded-lg max-w-lg w-full max-h-[90dvh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="promo-modal-title" className="t-h3 mb-4">{isNew ? "Nova promoção" : `Editar ${promo!.name}`}</h2>

        <div className="flex flex-col gap-3">
          <div>
            <label className="block">
              <span className="block t-label mb-1">Nome</span>
              <input className="input input-sm" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
          </div>

          <div>
            <label className="block t-label mb-1">
              Descrição (opcional)
            </label>
            <input
              className="input input-sm"
              placeholder='Ex: "Sexta da Gil"'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="block t-label mb-1">Desconto</label>
            <div className="flex gap-2">
              <select
                className="input input-sm w-32"
                value={discountType}
                onChange={(e) =>
                  setDiscountType(e.target.value as "percent" | "fixed_cents" | "free_item")
                }
              >
                <option value="percent">%</option>
                <option value="fixed_cents">R$</option>
                <option value="free_item">Item grátis</option>
              </select>
              {discountType !== "free_item" && (
                <input
                  type="number"
                  step={discountType === "percent" ? "1" : "0.01"}
                  min="0"
                  max={discountType === "percent" ? "100" : undefined}
                  className="input input-sm flex-1"
                  placeholder={discountType === "percent" ? "10" : "5.00"}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                />
              )}
            </div>
            {discountType === "free_item" && (
              <div className="text-[10px] text-ink-3 mt-1">
                Zera o preço do item ELEGÍVEL mais barato. Use &ldquo;Aplica a quais produtos&rdquo; pra restringir (ex: só refrigerante).
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block t-label mb-1">
                Mín. itens
              </label>
              <input
                type="number"
                min="0"
                className="input input-sm"
                placeholder="—"
                value={minItems}
                onChange={(e) => setMinItems(e.target.value)}
              />
            </div>
            <div>
              <label className="block t-label mb-1">
                Mín. total (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input input-sm"
                placeholder="—"
                value={minTotal}
                onChange={(e) => setMinTotal(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block t-label mb-1">
              Aplica a quais produtos? (vazio = todos)
            </label>
            <div className="flex flex-wrap gap-1.5 p-2 border border-line rounded-md bg-surface">
              {products.map((p) => {
                const sel = appliesTo.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggleProduct(p.id)}
                    className={`h-8 px-3 rounded-full text-xs font-semibold border-2 transition-colors ${
                      sel ? "bg-ink text-brand-yellow border-ink" : "bg-surface-elevated text-ink-2 border-line-strong"
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block t-label mb-1">
              Cupom (opcional)
            </label>
            <input
              className="input input-sm uppercase t-num"
              placeholder="Ex: FESTA10 — em branco = aplica automaticamente"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
            />
            <div className="text-[10px] text-ink-3 mt-1">
              Com cupom, atendente precisa digitar o código pra aplicar. Sem cupom, sistema oferece automaticamente quando elegível.
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <span>Ativa</span>
          </label>

          {error && <div className="text-sm text-danger bg-danger-bg rounded px-3 py-2">{error}</div>}

          <div className="flex gap-2 pt-2">
            <button onClick={save} disabled={submitting} className="btn btn-primary flex-1">
              {submitting ? "Salvando..." : "Salvar"}
            </button>
            <button onClick={onClose} className="btn btn-secondary">
              Cancelar
            </button>
            {!isNew && (
              <button
                onClick={() => onDelete(promo!.id)}
                className="btn btn-danger"
                title="Apagar"
              >
                <Trash2 size={16} strokeWidth={2.25} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const PRODUCT_TYPE_LABEL: Record<string, string> = {
  salgado: "Pastel salgado",
  doce: "Pastel doce",
  macarrao: "Macarrão",
  bebida: "Bebidas",
  combo: "Combos",
};

function ProductRow({
  product,
  onToggle,
  onEdit,
}: {
  product: ProductView;
  onToggle: (id: string, available: boolean) => void;
  onEdit: () => void;
}) {
  const priceDisplay =
    product.pricingMode === "fixed"
      ? formatBRL(product.basePriceCents ?? 0)
      : product.sizes.length > 0
      ? `${formatBRL(Math.min(...product.sizes.map((s) => s.priceCents)))} – ${formatBRL(Math.max(...product.sizes.map((s) => s.priceCents)))}`
      : "—";

  return (
    <li
      className={`flex flex-col rounded-md border bg-surface-elevated px-4 py-3 gap-2 ${
        product.available ? "border-line" : "border-line opacity-70"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {(product.imageUrl ?? product.imageDataUrl) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl ?? product.imageDataUrl ?? ""}
              alt=""
              width={36}
              height={36}
              loading="lazy"
              decoding="async"
              draggable={false}
              className="w-9 h-9 object-contain shrink-0 select-none"
              style={{ WebkitTouchCallout: "none" }}
            />
          )}
          <div className="flex flex-col min-w-0 flex-1">
            <span
              className={`text-[15px] font-semibold truncate ${
                product.available ? "text-ink" : "text-ink-3 line-through"
              }`}
            >
              {product.name}
            </span>
            <span className="t-caption t-num">
              {priceDisplay}
              {product.sizes.length > 0 ? ` · ${product.sizes.length} tamanho${product.sizes.length === 1 ? "" : "s"}` : ""}
            </span>
          </div>
        </div>
        <Toggle
          on={product.available}
          onChange={(v) => onToggle(product.id, v)}
          labelOn="Disponível"
          labelOff="Esgotou"
        />
      </div>
      <button
        onClick={onEdit}
        className="inline-flex items-center self-start h-9 px-2 -mx-2 text-xs font-semibold text-ink-2 hover:text-ink rounded-md hover:bg-surface-sunken transition-colors"
      >
        Editar produto
      </button>
    </li>
  );
}

function ProductModal({
  product,
  onClose,
  onSaved,
}: {
  product: ProductView | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  useBodyScrollLock(true);
  const isNew = product === null;
  const [name, setName] = useState(product?.name ?? "");
  const [type, setType] = useState(product?.type ?? "bebida");
  const [pricingMode, setPricingMode] = useState<"fixed" | "by_size">(
    (product?.pricingMode as "fixed" | "by_size") ?? "fixed",
  );
  const [basePrice, setBasePrice] = useState(
    product?.basePriceCents !== null && product?.basePriceCents !== undefined
      ? String(product.basePriceCents / 100)
      : "",
  );
  // Estado da imagem no editor:
  //   imageDataUrl: o que mostra no preview — pode ser data URI (novo
  //     arquivo), URL (/api/uploads/...) ou null
  //   imageChange: 'none' = não enviar imageDataUrl no payload; 'replace'
  //     = enviar o data URI; 'remove' = enviar null. Audit #63.
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(
    product?.imageUrl ?? product?.imageDataUrl ?? null,
  );
  const [imageChange, setImageChange] = useState<"none" | "replace" | "remove">("none");
  const [imageError, setImageError] = useState<string | null>(null);
  const [allowsIngredients, setAllowsIngredients] = useState(product?.allowsIngredients ?? false);
  const [ingredientCategory, setIngredientCategory] = useState(product?.ingredientCategory ?? "");
  const [minIngredients, setMinIngredients] = useState(
    product?.minIngredients?.toString() ?? "",
  );
  const [maxIngredients, setMaxIngredients] = useState(
    product?.maxIngredients?.toString() ?? "",
  );
  const [allowsSauces, setAllowsSauces] = useState(product?.allowsSauces ?? false);
  const [sauceCategory, setSauceCategory] = useState(product?.sauceCategory ?? "");
  const [sizes, setSizes] = useState<{ id?: string; name: string; description: string; priceCents: number }[]>(
    product?.sizes.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description ?? "",
      priceCents: s.priceCents,
    })) ?? [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeKey(onClose);

  /** Lê arquivo SVG/PNG, valida tamanho/tipo, converte pra data URI. */
  function handleImageFile(file: File | null) {
    setImageError(null);
    if (!file) {
      setImageDataUrl(null);
      setImageChange("remove");
      return;
    }
    if (file.size > 200_000) {
      setImageError("Arquivo maior que 200KB. Otimize antes de subir.");
      return;
    }
    if (file.type !== "image/svg+xml" && file.type !== "image/png") {
      setImageError("Só SVG ou PNG.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setImageDataUrl(result);
        setImageChange("replace");
      }
    };
    reader.onerror = () => setImageError("Erro lendo arquivo.");
    reader.readAsDataURL(file);
  }

  async function save() {
    setError(null);
    if (!name.trim()) return setError("Nome obrigatório.");
    if (pricingMode === "fixed" && !basePrice.trim()) return setError("Preço base obrigatório.");
    if (pricingMode === "by_size" && sizes.length === 0) return setError("Adicione pelo menos 1 tamanho.");

    setSubmitting(true);
    const basePriceCents = pricingMode === "fixed" ? Math.round(parseFloat(basePrice) * 100) : null;
    const body = {
      name: name.trim(),
      type,
      pricingMode,
      basePriceCents,
      allowsIngredients,
      ingredientCategory: allowsIngredients ? ingredientCategory || null : null,
      minIngredients: allowsIngredients && minIngredients ? parseInt(minIngredients) : null,
      maxIngredients: allowsIngredients && maxIngredients ? parseInt(maxIngredients) : null,
      allowsSauces,
      sauceCategory: allowsSauces ? sauceCategory || null : null,
      // imageDataUrl só vai no payload quando user trocou/removeu (audit #63).
      // Replace = manda data URI (backend converte pra file); Remove = null
      // (backend deleta file existente); None = omite (preserva intacto).
      ...(imageChange === "replace" ? { imageDataUrl } : {}),
      ...(imageChange === "remove" ? { imageDataUrl: null } : {}),
      ...(pricingMode === "by_size" && isNew ? { sizes: sizes.map((s, i) => ({ name: s.name, description: s.description || null, priceCents: s.priceCents, position: i })) } : {}),
    };

    try {
      if (isNew) {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json();
          setError(err.error || "Erro.");
          setSubmitting(false);
          return;
        }
      } else {
        const res = await fetch(`/api/products/${product!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json();
          setError(err.error || "Erro.");
          setSubmitting(false);
          return;
        }
        // Atualiza/cria/deleta sizes se by_size
        if (pricingMode === "by_size") {
          const existingIds = new Set(product!.sizes.map((s) => s.id));
          const currentIds = new Set(sizes.filter((s) => s.id).map((s) => s.id!));
          // delete removed
          for (const id of existingIds) {
            if (!currentIds.has(id)) {
              await fetch(`/api/products/${product!.id}/sizes/${id}`, { method: "DELETE" });
            }
          }
          // upsert
          for (let i = 0; i < sizes.length; i++) {
            const s = sizes[i];
            if (s.id) {
              await fetch(`/api/products/${product!.id}/sizes/${s.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: s.name, description: s.description || null, priceCents: s.priceCents, position: i }),
              });
            } else {
              await fetch(`/api/products/${product!.id}/sizes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: s.name, description: s.description || null, priceCents: s.priceCents, position: i }),
              });
            }
          }
        }
      }
      onSaved();
    } catch {
      setError("Erro de rede.");
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
        className="bg-surface-elevated rounded-lg max-w-lg w-full max-h-[90dvh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="product-modal-title" className="t-h3 mb-4">{isNew ? "Novo produto" : `Editar ${product!.name}`}</h2>

        <div className="flex flex-col gap-3">
          <div>
            <label className="block">
              <span className="block t-label mb-1">Nome</span>
              <input className="input input-sm" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
          </div>

          <div>
            <label className="block t-label mb-1">Tipo</label>
            <select
              className="input input-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
              disabled={!isNew}
            >
              <option value="salgado">Pastel salgado</option>
              <option value="doce">Pastel doce</option>
              <option value="macarrao">Macarrão</option>
              <option value="bebida">Bebida</option>
              <option value="combo">Combo</option>
            </select>
            {!isNew && <div className="text-[10px] text-ink-3 mt-1">Tipo não pode ser alterado depois de criado.</div>}
          </div>

          <div>
            <label className="block t-label mb-1">
              Imagem <span className="text-ink-3 normal-case tracking-normal font-medium">(opcional — SVG/PNG, máx 200KB)</span>
            </label>
            <div className="flex items-center gap-3">
              {/* Preview do ícone atual */}
              <div className="shrink-0 w-14 h-14 rounded-md border border-line bg-surface flex items-center justify-center overflow-hidden">
                {imageDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageDataUrl}
                    alt=""
                    width={56}
                    height={56}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="max-w-full max-h-full object-contain select-none"
                    style={{ WebkitTouchCallout: "none" }}
                  />
                ) : (
                  <span className="t-caption text-ink-3">sem img</span>
                )}
              </div>
              <div className="flex-1 flex flex-col gap-1.5">
                <label className="inline-flex items-center justify-center h-9 px-3 rounded-md border border-line-strong text-ink-2 hover:border-ink-3 hover:text-ink text-[13px] font-semibold cursor-pointer transition-colors">
                  {imageDataUrl ? "Trocar imagem" : "Escolher arquivo"}
                  <input
                    type="file"
                    accept="image/svg+xml,image/png"
                    className="hidden"
                    onChange={(e) => handleImageFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                {imageDataUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setImageDataUrl(null);
                      setImageError(null);
                      setImageChange("remove");
                    }}
                    className="t-caption text-danger hover:underline self-start"
                  >
                    Remover imagem
                  </button>
                )}
              </div>
            </div>
            {imageError && (
              <p className="t-caption text-danger mt-1.5">{imageError}</p>
            )}
            <p className="t-caption mt-1.5">
              Bom pra Coca, Sprite, Guaraná. PNG transparente ou SVG vetor.
            </p>
          </div>

          <div>
            <label className="block t-label mb-1">Preço</label>
            <div className="flex gap-2">
              <select
                className="input input-sm w-32"
                value={pricingMode}
                onChange={(e) => setPricingMode(e.target.value as "fixed" | "by_size")}
              >
                <option value="fixed">Fixo</option>
                <option value="by_size">Por tamanho</option>
              </select>
              {pricingMode === "fixed" && (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input input-sm flex-1"
                  placeholder="R$"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                />
              )}
            </div>
          </div>

          {pricingMode === "by_size" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block t-label">Tamanhos</label>
                <button
                  onClick={() => setSizes((prev) => [...prev, { name: "", description: "", priceCents: 0 }])}
                  className="inline-flex items-center h-9 px-3 text-xs font-semibold text-ink-2 hover:text-ink hover:bg-surface-sunken border border-line-strong rounded-md"
                >
                  + Adicionar
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {sizes.map((s, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      placeholder="Nome"
                      className="input h-9 text-xs flex-1"
                      value={s.name}
                      onChange={(e) => setSizes((p) => p.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)))}
                    />
                    <input
                      placeholder="Descrição"
                      className="input h-9 text-xs flex-1"
                      value={s.description}
                      onChange={(e) => setSizes((p) => p.map((x, idx) => (idx === i ? { ...x, description: e.target.value } : x)))}
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="R$"
                      className="input h-9 text-xs w-20"
                      value={s.priceCents / 100}
                      onChange={(e) =>
                        setSizes((p) =>
                          p.map((x, idx) =>
                            idx === i ? { ...x, priceCents: Math.round(parseFloat(e.target.value || "0") * 100) } : x,
                          ),
                        )
                      }
                    />
                    <button
                      onClick={() => setSizes((p) => p.filter((_, idx) => idx !== i))}
                      className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-md text-ink-3 hover:text-danger hover:bg-danger-bg"
                      aria-label="Remover"
                    >
                      <Trash2 size={14} strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-line pt-3 flex flex-col gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowsIngredients}
                onChange={(e) => setAllowsIngredients(e.target.checked)}
              />
              <span>Aceita ingredientes</span>
            </label>
            {allowsIngredients && (
              <div className="flex gap-2 ml-6">
                <select
                  className="input h-9 text-xs flex-1"
                  value={ingredientCategory}
                  onChange={(e) => setIngredientCategory(e.target.value)}
                >
                  <option value="">Categoria…</option>
                  <option value="topping">Toppings pastel</option>
                  <option value="doce">Doces</option>
                  <option value="macarrao_topping">Toppings macarrão</option>
                </select>
                <input
                  type="number"
                  placeholder="Mín"
                  className="input h-9 text-xs w-16"
                  value={minIngredients}
                  onChange={(e) => setMinIngredients(e.target.value)}
                />
                <input
                  type="number"
                  placeholder="Máx"
                  className="input h-9 text-xs w-16"
                  value={maxIngredients}
                  onChange={(e) => setMaxIngredients(e.target.value)}
                />
              </div>
            )}

            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowsSauces}
                onChange={(e) => setAllowsSauces(e.target.checked)}
              />
              <span>Aceita molhos</span>
            </label>
            {allowsSauces && (
              <select
                className="input h-9 text-xs ml-6"
                value={sauceCategory}
                onChange={(e) => setSauceCategory(e.target.value)}
              >
                <option value="">Categoria (default: molho)</option>
                <option value="molho">Molhos pastel</option>
                <option value="macarrao_molho">Molhos macarrão</option>
              </select>
            )}
          </div>

          {error && <div className="text-sm text-danger bg-danger-bg rounded px-3 py-2">{error}</div>}

          <div className="flex gap-2 pt-2">
            <button onClick={save} disabled={submitting} className="btn btn-primary flex-1">
              {submitting ? "Salvando..." : "Salvar"}
            </button>
            <button onClick={onClose} className="btn btn-secondary">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Lista de ingredientes de UMA categoria, com drag-and-drop de reorder
 * dentro da categoria. Quando dragEnabled=false (busca ativa), o DnD é
 * suspenso — não faz sentido reordenar uma lista filtrada (apaga itens
 * que sumiram do filtro).
 *
 * Optimistic update local + chamada POST /api/ingredients/reorder pra
 * persistir; backend broadcastará `ingredient:reordered` pro atendente.
 */
type ConfirmFn = (opts: {
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
}) => Promise<boolean>;
type ShowToastFn = (text: string, tone?: "info" | "success" | "error") => void;

function IngredientsCategoryList({
  category,
  items,
  dragEnabled,
  onAddClick,
  onToggle,
  onIconChange,
  onUpdate,
  onDelete,
  onReorder,
  confirm,
  showToast,
}: {
  category: string;
  items: Ingredient[];
  dragEnabled: boolean;
  onAddClick: () => void;
  onToggle: (id: string, available: boolean) => void;
  onIconChange: (id: string, icon: string | null) => void;
  onUpdate: (id: string, partial: { name?: string; category?: string }) => Promise<Ingredient>;
  onDelete: (id: string) => Promise<void>;
  onReorder: (category: string, orderedIds: string[]) => Promise<void>;
  confirm: ConfirmFn;
  showToast: ShowToastFn;
}) {
  // Snapshot local pra optimistic update durante o drag — backend confirma
  // depois. Se falhar, revert pro `items` do prop (re-render natural via SSE).
  const [order, setOrder] = useState<Ingredient[]>(items);
  useEffect(() => {
    setOrder(items);
  }, [items]);

  const sensors = useSensors(
    // PointerSensor com `activationConstraint` de 8px evita conflito
    // com clicks normais (toggle, lápis, lixeira) — só inicia drag se
    // o pointer moveu pelo menos 8px após o mousedown.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.findIndex((i) => i.id === active.id);
    const newIndex = order.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next);
    try {
      await onReorder(category, next.map((i) => i.id));
    } catch (e) {
      // Reverte local; SSE depois traz a verdade do servidor.
      setOrder(items);
      showToast(
        e instanceof Error ? e.message : "Falha ao reordenar.",
        "error",
      );
    }
  }

  const ids = useMemo(() => order.map((i) => i.id), [order]);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="t-label tracking-[0.06em]">
          {CATEGORY_LABEL[category] ?? category}{" "}
          <span className="text-ink-3 font-normal tabular-nums">({items.length})</span>
        </div>
        <button
          onClick={onAddClick}
          className="t-caption text-ink-3 hover:text-ink font-semibold inline-flex items-center gap-1 -mr-1 px-2 py-1 rounded hover:bg-surface-sunken"
          title={`Adicionar ${(CATEGORY_LABEL[category] ?? category).toLowerCase()}`}
        >
          + Adicionar
        </button>
      </div>

      {dragEnabled ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {order.map((ing) => (
                <SortableIngredientRow
                  key={ing.id}
                  ing={ing}
                  onToggle={onToggle}
                  onIconChange={onIconChange}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  confirm={confirm}
                  showToast={showToast}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      ) : (
        // Busca ativa — sem drag, lista estática
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {items.map((ing) => (
            <IngredientRow
              key={ing.id}
              ing={ing}
              onToggle={onToggle}
              onIconChange={onIconChange}
              onRename={async (newName) => {
                try {
                  await onUpdate(ing.id, { name: newName });
                } catch (e) {
                  showToast(e instanceof Error ? e.message : "Falha ao renomear.", "error");
                }
              }}
              onDelete={async () => {
                const ok = await confirm({
                  title: `Remover "${ing.name}"?`,
                  message:
                    "Pedidos antigos com esse ingrediente continuam intactos (o nome ficou gravado neles). Só some das opções novas.",
                  confirmLabel: "Remover",
                  destructive: true,
                });
                if (!ok) return;
                try {
                  await onDelete(ing.id);
                  showToast(`"${ing.name}" removido.`, "success");
                } catch (e) {
                  showToast(e instanceof Error ? e.message : "Falha ao remover.", "error");
                }
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Wrapper de IngredientRow que injeta drag handle + estilo de drag via
 * `useSortable`. Posiciona o handle como primeiro elemento da row.
 */
function SortableIngredientRow({
  ing,
  onToggle,
  onIconChange,
  onUpdate,
  onDelete,
  confirm,
  showToast,
}: {
  ing: Ingredient;
  onToggle: (id: string, available: boolean) => void;
  onIconChange: (id: string, icon: string | null) => void;
  onUpdate: (id: string, partial: { name?: string; category?: string }) => Promise<Ingredient>;
  onDelete: (id: string) => Promise<void>;
  confirm: ConfirmFn;
  showToast: ShowToastFn;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ing.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : "auto",
  };

  const handle = (
    <button
      ref={setNodeRef as unknown as React.Ref<HTMLButtonElement>}
      {...attributes}
      {...listeners}
      className="shrink-0 inline-flex items-center justify-center w-7 h-9 -ml-1.5 rounded text-ink-3 hover:text-ink hover:bg-surface-sunken cursor-grab active:cursor-grabbing touch-none"
      aria-label={`Arrastar ${ing.name} pra reordenar`}
      title="Arrastar pra reordenar"
    >
      <GripVertical size={16} strokeWidth={2} />
    </button>
  );

  return (
    <div ref={setNodeRef} style={style}>
      <IngredientRow
        ing={ing}
        onToggle={onToggle}
        onIconChange={onIconChange}
        onRename={async (newName) => {
          try {
            await onUpdate(ing.id, { name: newName });
          } catch (e) {
            showToast(e instanceof Error ? e.message : "Falha ao renomear.", "error");
          }
        }}
        onDelete={async () => {
          const ok = await confirm({
            title: `Remover "${ing.name}"?`,
            message:
              "Pedidos antigos com esse ingrediente continuam intactos (o nome ficou gravado neles). Só some das opções novas.",
            confirmLabel: "Remover",
            destructive: true,
          });
          if (!ok) return;
          try {
            await onDelete(ing.id);
            showToast(`"${ing.name}" removido.`, "success");
          } catch (e) {
            showToast(e instanceof Error ? e.message : "Falha ao remover.", "error");
          }
        }}
        dragHandle={handle}
      />
    </div>
  );
}

function IngredientRow({
  ing,
  onToggle,
  onIconChange,
  onRename,
  onDelete,
  dragHandle,
}: {
  ing: Ingredient;
  onToggle: (id: string, available: boolean) => void;
  onIconChange: (id: string, icon: string | null) => void;
  onRename: (newName: string) => Promise<void>;
  onDelete: () => Promise<void>;
  // Handle de drag injetado pelo wrapper Sortable. Quando undefined,
  // o row é estático (busca ativa ou contexto sem dnd).
  dragHandle?: React.ReactNode;
}) {
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  // Rename inline: click no lápis → input toma lugar do <span>; Enter
  // salva, Esc cancela. Mantém UX rápida sem modal pra mexer só no nome.
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(ing.name);
  const [renaming, setRenaming] = useState(false);

  async function commitRename() {
    const trimmed = nameDraft.trim();
    if (trimmed === "" || trimmed === ing.name) {
      setEditingName(false);
      setNameDraft(ing.name);
      return;
    }
    setRenaming(true);
    try {
      await onRename(trimmed);
      setEditingName(false);
    } finally {
      setRenaming(false);
    }
  }

  return (
    <li
      className={`flex flex-col rounded-md border bg-surface-elevated px-4 py-3 gap-2 ${
        ing.available ? "border-line" : "border-line opacity-70"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Drag handle injetado pelo wrapper Sortable (Cardapio). */}
          {dragHandle}
          {/* Botão de ícone: clica e abre picker. Mostra ícone se houver, senão placeholder. */}
          <button
            onClick={() => setIconPickerOpen(true)}
            title={ing.icon ? `Trocar ícone (${ing.icon})` : "Escolher ícone"}
            className={`shrink-0 w-9 h-9 rounded-md border flex items-center justify-center transition-colors ${
              ing.icon
                ? "border-line bg-surface hover:border-ink-3"
                : "border-dashed border-line-strong bg-surface text-ink-3 hover:border-ink-3 hover:text-ink"
            }`}
          >
            {ing.icon ? (
              <IngredientIcon icon={ing.icon} size={22} alt={ing.name} />
            ) : (
              <ImageIcon size={16} strokeWidth={2} />
            )}
          </button>

          {editingName ? (
            <input
              type="text"
              autoFocus
              value={nameDraft}
              disabled={renaming}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") {
                  setEditingName(false);
                  setNameDraft(ing.name);
                }
              }}
              onBlur={commitRename}
              className="input h-8 text-base font-semibold flex-1 min-w-0"
              aria-label={`Renomear ${ing.name}`}
              maxLength={60}
            />
          ) : (
            <button
              onClick={() => {
                setNameDraft(ing.name);
                setEditingName(true);
              }}
              className={`text-base font-semibold truncate text-left hover:underline decoration-dotted underline-offset-4 ${
                ing.available ? "text-ink" : "text-ink-3 line-through"
              }`}
              title="Clique pra renomear"
            >
              {ing.name}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Toggle
            on={ing.available}
            onChange={(v) => onToggle(ing.id, v)}
            labelOn="Disponível"
            labelOff="Esgotou"
          />
          {/* Botão de remover discreto — escondido em hover desktop, sempre
              visível em touch (mobile). Wrap em flex-shrink-0 pra não comprimir. */}
          <button
            onClick={onDelete}
            title={`Remover ${ing.name}`}
            aria-label={`Remover ${ing.name}`}
            className="inline-flex items-center justify-center w-9 h-9 rounded-md text-ink-3 hover:text-danger hover:bg-danger/10 transition-colors"
          >
            <Trash2 size={16} strokeWidth={2.25} />
          </button>
        </div>
      </div>

      <IconPicker
        open={iconPickerOpen}
        initial={ing.icon ?? null}
        suggestion={ing.name}
        onClose={() => setIconPickerOpen(false)}
        onSelect={(icon) => onIconChange(ing.id, icon)}
      />
    </li>
  );
}

/**
 * Modal de criação de ingrediente novo.
 *
 * Fluxo:
 *   1. Gil digita o nome (obrigatório), escolhe categoria (dropdown)
 *   2. Opcionalmente escolhe ícone — abre IconPicker que aceita Iconify
 *      OU upload de SVG/PNG (data URI)
 *   3. Salvar chama onCreate; modal só fecha se sucesso (toast cuida do
 *      feedback, erro mantém modal aberto pra Gil corrigir)
 *
 * Não usa react-hook-form/Zod pra manter consistente com ProductModal —
 * validação fica no servidor + checagem básica aqui (nome trim+1char).
 */
function IngredientCreateModal({
  initialCategory,
  onClose,
  onCreate,
}: {
  initialCategory: string | null;
  onClose: () => void;
  onCreate: (payload: { name: string; category: string; icon?: string | null }) => Promise<void> | void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(initialCategory ?? "topping");
  const [icon, setIcon] = useState<string | null>(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEscapeKey(onClose, !iconPickerOpen);
  useBodyScrollLock(true);

  const canSave = name.trim().length >= 1 && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      await onCreate({ name: name.trim(), category, icon });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-ink/50 backdrop-blur-[3px] flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Novo ingrediente"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-surface-elevated rounded-xl shadow-xl flex flex-col animate-sheet-up"
      >
        <header className="flex items-center justify-between p-4 border-b border-line">
          <h2 className="text-lg font-extrabold leading-none">Novo ingrediente</h2>
          <button
            onClick={onClose}
            className="shrink-0 inline-flex items-center justify-center w-11 h-11 -mr-2 rounded-md text-ink-3 hover:text-ink hover:bg-surface-sunken"
            aria-label="Fechar"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </header>

        <div className="p-4 flex flex-col gap-4">
          {/* Ícone — opcional, mas visualmente proeminente porque carrega
              o reconhecimento do ingrediente no admin. */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIconPickerOpen(true)}
              className={`shrink-0 w-16 h-16 rounded-md border-2 flex items-center justify-center transition-colors ${
                icon
                  ? "border-line bg-surface hover:border-ink-3"
                  : "border-dashed border-line-strong bg-surface text-ink-3 hover:border-ink-3 hover:text-ink"
              }`}
              title={icon ? "Trocar ícone" : "Escolher ícone"}
            >
              {icon ? (
                <IngredientIcon icon={icon} size={40} alt={name || "Ícone"} />
              ) : (
                <ImageIcon size={22} strokeWidth={2} />
              )}
            </button>
            <div className="flex flex-col gap-1">
              <div className="text-sm font-semibold text-ink">
                {icon ? "Ícone escolhido" : "Sem ícone (opcional)"}
              </div>
              <button
                onClick={() => setIconPickerOpen(true)}
                className="text-xs font-semibold text-ink-2 hover:text-ink hover:underline self-start"
              >
                {icon ? "Trocar ícone" : "Escolher ícone…"}
              </button>
            </div>
          </div>

          <div>
            <label className="block t-label mb-1.5">
              Nome <span className="text-danger normal-case tracking-normal">*</span>
            </label>
            <input
              type="text"
              autoFocus
              className="input w-full"
              placeholder="ex: Goiabada, Frango com requeijão…"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSave) handleSave();
              }}
            />
          </div>

          <div>
            <label className="block t-label mb-1.5">Categoria</label>
            <select
              className="input w-full"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {INGREDIENT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABEL[cat] ?? cat}
                </option>
              ))}
            </select>
            <p className="t-caption text-ink-3 mt-1">
              Topping vai pro pastel salgado; doce vai pro doce; molho aparece como extra.
              Se errar dá pra mover depois.
            </p>
          </div>
        </div>

        <footer className="p-4 border-t border-line flex items-center justify-end gap-2">
          <button onClick={onClose} className="btn btn-secondary btn-sm" disabled={saving}>
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="btn btn-primary btn-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Salvando…" : "Criar ingrediente"}
          </button>
        </footer>

        <IconPicker
          open={iconPickerOpen}
          initial={icon}
          suggestion={name}
          onClose={() => setIconPickerOpen(false)}
          onSelect={setIcon}
        />
      </div>
    </div>
  );
}

function Toggle({
  on,
  onChange,
  labelOn,
  labelOff,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  labelOn: string;
  labelOff: string;
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="inline-flex items-center gap-2"
      aria-pressed={on}
    >
      <span
        className={`text-[10px] font-bold uppercase tracking-[0.08em] ${
          on ? "text-status-ready-ink" : "text-danger"
        }`}
      >
        {on ? labelOn : labelOff}
      </span>
      <span
        className={`relative w-11 h-6 rounded-full transition-colors ${
          on ? "bg-status-ready" : "bg-status-delivered"
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

/* ============================================================
   USUÁRIOS
   ============================================================ */

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  atendente: "Atendente",
  cozinha: "Cozinha",
};

const ROLE_ORDER = ["admin", "atendente", "cozinha"] as const;

/* ============================================================
   OPERAÇÃO — visão macro Kanban ao vivo do fluxo de pedidos.
   4 colunas (Novos / Em preparo / Prontos / Entregues).
   SSE já atualiza `todayOrders` no AdminClient pai, então rerender automático.
   ============================================================ */
function Operacao({
  orders,
  eventStatus,
  onOpenEvent,
  onCloseEvent,
}: {
  orders: OrderView[];
  eventStatus: EventSessionStatus;
  onOpenEvent: (name: string | null, eventDate: string | null) => void;
  onCloseEvent: () => void;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Apenas pedidos do caixa atual (se aberto), senão hoje todos
  const filtered = useMemo(() => {
    if (eventStatus.open && eventStatus.id) {
      return orders.filter((o) => o.eventSessionId === eventStatus.id);
    }
    return orders;
  }, [orders, eventStatus]);

  const byStatus = useMemo(() => {
    const groups: Record<string, OrderView[]> = {
      PEDIDO_FEITO: [],
      EM_PREPARO: [],
      PRONTO: [],
      ENTREGUE: [],
    };
    for (const o of filtered) {
      if (o.status === "CANCELADO") continue;
      groups[o.status]?.push(o);
    }
    // Cada coluna ordenada por chegada (oldest first)
    for (const k of Object.keys(groups)) {
      groups[k].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    }
    return groups;
  }, [filtered]);

  const totals = useMemo(() => {
    const total = filtered.filter((o) => o.status !== "CANCELADO");
    return {
      pedidos: total.length,
      receita: total.reduce((s, o) => s + o.finalCents, 0),
      cancelados: filtered.filter((o) => o.status === "CANCELADO").length,
    };
  }, [filtered]);

  const columns: Array<{
    key: "PEDIDO_FEITO" | "EM_PREPARO" | "PRONTO" | "ENTREGUE";
    label: string;
    accent: string;
    headerBg: string;
    headerText: string;
    dotColor: string;
  }> = [
    {
      key: "PEDIDO_FEITO",
      label: "Novos",
      accent: "border-status-incoming/30",
      headerBg: "bg-status-incoming",
      headerText: "text-white",
      dotColor: "bg-status-incoming",
    },
    {
      key: "EM_PREPARO",
      label: "Em preparo",
      accent: "border-status-preparing/30",
      headerBg: "bg-status-preparing",
      headerText: "text-status-preparing-ink",
      dotColor: "bg-status-preparing",
    },
    {
      key: "PRONTO",
      label: "Prontos",
      accent: "border-status-ready/30",
      headerBg: "bg-status-ready",
      headerText: "text-white",
      dotColor: "bg-status-ready",
    },
    {
      key: "ENTREGUE",
      label: "Entregues",
      accent: "border-line-strong/40",
      headerBg: "bg-ink-3",
      headerText: "text-white",
      dotColor: "bg-ink-3",
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="t-h1 mb-1">Caixa</h1>
        <p className="t-body-sm">
          {eventStatus.open
            ? `Ao vivo · ${eventStatus.name ?? "Caixa atual"}`
            : "Sem caixa aberto — mostrando histórico de hoje"}
        </p>
      </header>

      {/* CaixaSection ANTES de tudo — quando fechado, a CTA "Abrir caixa"
          é o foco principal. Quando aberto, vira faixa slim no topo (só
          status + botão pequeno de fechar) pra não roubar foco do Trello. */}
      <CaixaSection
        eventStatus={eventStatus}
        onOpen={onOpenEvent}
        onClose={onCloseEvent}
      />

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <Stat label="Pedidos" value={String(totals.pedidos)} />
        <Stat label="Receita" value={formatBRL(totals.receita)} accent />
        <Stat label="Cancelados" value={String(totals.cancelados)} tone={totals.cancelados > 0 ? "danger" : "neutral"} />
      </div>

      {/* Kanban Trello-style — scroll horizontal no mobile/tablet,
          4 colunas lado-a-lado no desktop. Cada coluna com header
          colorido sólido, fundo cinza suave, cards "post-it" individuais. */}
      <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-2 xl:grid-cols-4">
        {columns.map((col) => {
          const allItems = byStatus[col.key] ?? [];
          // Audit P1 #11: ENTREGUE acumula infinito em evento de 200 pedidos.
          // Mostra só os últimos 10 + counter com "Ver todos" futuro. Foco
          // de "Operação" é o que tá acontecendo agora, não histórico.
          const ENTREGUE_LIMIT = 10;
          const isEntregue = col.key === "ENTREGUE";
          const items = isEntregue ? allItems.slice(0, ENTREGUE_LIMIT) : allItems;
          const hiddenCount = isEntregue ? Math.max(0, allItems.length - ENTREGUE_LIMIT) : 0;
          return (
            <section
              key={col.key}
              className={`flex-shrink-0 w-72 md:w-auto rounded-lg bg-surface-sunken/70 border ${col.accent} flex flex-col min-h-[280px]`}
            >
              <header
                className={`px-4 py-3 ${col.headerBg} ${col.headerText} rounded-t-lg flex items-center justify-between shadow-sm`}
              >
                <span className="text-sm font-bold uppercase tracking-[0.08em]">
                  {col.label}
                </span>
                <span className="text-[15px] font-bold t-num h-7 min-w-7 px-2 inline-flex items-center justify-center rounded-full bg-white/25">
                  {allItems.length}
                </span>
              </header>
              {items.length === 0 ? (
                <div className="flex-1 flex items-center justify-center py-10 text-xs text-ink-3 italic">
                  nenhum pedido
                </div>
              ) : (
                <ul className="flex flex-col gap-2 p-2.5">
                  {items.map((o) => (
                    <OperacaoCard key={o.id} order={o} now={now} dotColor={col.dotColor} />
                  ))}
                  {hiddenCount > 0 && (
                    <li className="text-center py-2 t-caption text-ink-3 italic">
                      + {hiddenCount} mais entregue{hiddenCount === 1 ? "" : "s"} no Histórico
                    </li>
                  )}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  tone = "neutral",
}: {
  label: string;
  value: string;
  accent?: boolean;
  tone?: "neutral" | "danger";
}) {
  const colorClass =
    tone === "danger" ? "text-danger" : accent ? "text-status-ready-ink" : "text-ink";
  return (
    <div className="rounded-md bg-surface-elevated border border-line px-4 py-3">
      <div className="t-label mb-0.5">
        {label}
      </div>
      <div className={`text-2xl font-bold t-num ${colorClass}`}>{value}</div>
    </div>
  );
}

function OperacaoCard({
  order,
  now,
  dotColor,
}: {
  order: OrderView;
  now: number | null;
  dotColor: string;
}) {
  const created = new Date(order.createdAt);
  const elapsedMin =
    now === null ? 0 : Math.max(0, Math.floor((now - created.getTime()) / 60000));
  // Cor do tempo: > 20min = atenção, > 30min = atraso forte
  const timeColor =
    elapsedMin >= 30 ? "text-danger" : elapsedMin >= 20 ? "text-brand-orange" : "text-ink-3";

  // Resumo curto dos items (primeiros 2-3)
  const itemSummary = order.items
    .slice(0, 3)
    .map((it) => {
      const qty = it.quantity > 1 ? `${it.quantity}x ` : "";
      const name = it.productName || it.kind || "?";
      return `${qty}${name}`;
    })
    .join(" · ");
  const hasMore = order.items.length > 3;

  return (
    <li className="rounded-md bg-surface-elevated shadow-sm hover:shadow-md transition-shadow border border-line p-3 flex flex-col gap-1.5 cursor-default">
      {/* Header: # + bullet de cor + tempo */}
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${dotColor} shrink-0`} aria-hidden />
          <span className="text-xs font-bold text-ink-3 t-num">
            #{String(order.id).padStart(3, "0")}
          </span>
        </div>
        <span
          className={`text-[11px] font-extrabold t-num ${timeColor}`}
          suppressHydrationWarning
        >
          {now === null ? "--" : elapsedMin === 0 ? "agora" : `${elapsedMin}min`}
        </span>
      </div>

      {/* Nome cliente — destaque */}
      <div className="text-[15px] font-bold leading-tight truncate">
        {order.clientName}
      </div>

      {/* Resumo dos items (post-it style) */}
      <div className="text-[11px] text-ink-2 leading-snug line-clamp-2">
        {itemSummary}
        {hasMore && <span className="text-ink-3"> · +{order.items.length - 3}</span>}
      </div>

      {/* Footer: total + atendente */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-line/60 mt-1">
        <span className="text-sm t-num font-bold text-status-ready-ink">
          {formatBRL(order.finalCents)}
        </span>
        {order.createdBy && order.createdBy !== "—" && (
          <span className="text-[10px] text-ink-3 truncate inline-flex items-center gap-1">
            <span className="h-4 w-4 rounded-full bg-brand-yellow/50 inline-flex items-center justify-center text-[8px] font-extrabold text-ink shrink-0">
              {order.createdBy.charAt(0).toUpperCase()}
            </span>
            {order.createdBy}
          </span>
        )}
      </div>
    </li>
  );
}

function Usuarios({
  users,
  setUsers,
}: {
  users: AdminUser[];
  setUsers: (next: AdminUser[]) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { confirm, node: confirmNode } = useConfirmDialog();

  async function reload() {
    const res = await fetch("/api/users");
    if (!res.ok) return;
    setUsers(await res.json());
  }

  async function createUser(data: { name: string; role: string; password: string }) {
    setError(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error || "Erro ao criar.");
      return;
    }
    setCreating(false);
    reload();
  }

  async function resetPassword(id: string, password: string) {
    setError(null);
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Erro ao trocar senha.");
      return;
    }
    setResettingId(null);
  }

  async function deleteUser(id: string) {
    const ok = await confirm({
      title: "Excluir este usuário?",
      message: "Essa ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Erro ao excluir.");
      return;
    }
    setUsers(users.filter((u) => u.id !== id));
  }

  const byRole: Record<string, AdminUser[]> = {};
  for (const u of users) (byRole[u.role] ??= []).push(u);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="t-h1 mb-1">Usuários</h1>
          <p className="t-body-sm">Cada operador entra com nome + senha. Auditoria fica registrada no histórico.</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="btn btn-primary btn-sm shrink-0"
        >
          <UserPlus size={16} strokeWidth={2.5} />
          Novo
        </button>
      </header>

      {error && (
        <div className="text-sm text-danger bg-danger-bg rounded-sm px-3 py-2">{error}</div>
      )}

      {creating && (
        <NewUserForm
          onCreate={createUser}
          onCancel={() => {
            setCreating(false);
            setError(null);
          }}
        />
      )}

      {ROLE_ORDER.map((role) => {
        const items = byRole[role] ?? [];
        if (items.length === 0) return null;
        return (
          <section key={role}>
            <h2 className="t-label mb-3">{ROLE_LABEL[role]}</h2>
            <ul className="flex flex-col gap-2">
              {items.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  resetting={resettingId === u.id}
                  onResetStart={() => {
                    setResettingId(u.id);
                    setError(null);
                  }}
                  onResetCancel={() => setResettingId(null)}
                  onResetConfirm={(pwd) => resetPassword(u.id, pwd)}
                  onDelete={() => deleteUser(u.id)}
                />
              ))}
            </ul>
          </section>
        );
      })}
      {confirmNode}
    </div>
  );
}

function NewUserForm({
  onCreate,
  onCancel,
}: {
  onCreate: (data: { name: string; role: string; password: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>("atendente");
  const [password, setPassword] = useState("");

  return (
    <div className="card-lg p-5 flex flex-col gap-4">
      <h3 className="t-h4">Novo usuário</h3>
      <div>
        <label className="block">
          <span className="block t-label mb-1">Nome</span>
          <input className="input" placeholder="Ex: Ana" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      </div>
      <div>
        <label className="block t-label mb-1">Função</label>
        <div className="flex gap-2 flex-wrap">
          {ROLE_ORDER.map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`h-9 px-4 rounded-full border-2 text-[13px] font-semibold ${
                role === r
                  ? "bg-ink text-brand-yellow border-ink"
                  : "bg-surface-elevated text-ink-2 border-line-strong hover:border-ink-3"
              }`}
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block t-label mb-2">
          Senha (4 dígitos)
        </label>
        <div className="flex justify-center">
          <PinInput value={password} onChange={setPassword} />
        </div>
      </div>
      <div className="flex gap-2 mt-2">
        <button onClick={onCancel} className="btn btn-ghost flex-1">Cancelar</button>
        <button
          disabled={!name.trim() || password.length < 4}
          onClick={() => onCreate({ name: name.trim(), role, password })}
          className="btn btn-primary flex-1"
        >
          Criar
        </button>
      </div>
    </div>
  );
}

function UserRow({
  user,
  resetting,
  onResetStart,
  onResetCancel,
  onResetConfirm,
  onDelete,
}: {
  user: AdminUser;
  resetting: boolean;
  onResetStart: () => void;
  onResetCancel: () => void;
  onResetConfirm: (password: string) => void;
  onDelete: () => void;
}) {
  const [pwd, setPwd] = useState("");

  return (
    <li className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-bold truncate">{user.name}</div>
          <div className="text-[11px] text-ink-3 uppercase tracking-[0.06em] font-semibold">
            {ROLE_LABEL[user.role] ?? user.role}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onResetStart}
            className="inline-flex items-center gap-1 h-9 px-3 rounded-md border border-line-strong text-ink-2 hover:border-ink-3 hover:text-ink text-xs font-semibold"
            title="Trocar senha"
          >
            <KeyRound size={14} strokeWidth={2.5} />
            Senha
          </button>
          <button
            onClick={onDelete}
            className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-line-strong text-ink-3 hover:border-danger hover:text-danger"
            title="Excluir"
            aria-label="Excluir"
          >
            <Trash2 size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>
      {resetting && (
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <div className="t-label text-center">
            Nova senha (4 dígitos)
          </div>
          <div className="flex justify-center">
            <PinInput
              value={pwd}
              onChange={setPwd}
              autoFocus
              onComplete={(v) => {
                onResetConfirm(v);
                setPwd("");
              }}
              size="md"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setPwd("");
                onResetCancel();
              }}
              className="btn btn-ghost btn-sm flex-1"
            >
              Cancelar
            </button>
            <button
              disabled={pwd.length < 4}
              onClick={() => {
                onResetConfirm(pwd);
                setPwd("");
              }}
              className="btn btn-primary btn-sm flex-1"
            >
              Salvar
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

/* ============================================================
   Helpers
   ============================================================ */

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  if (m === 0) return `${s}s`;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}min`;
}
