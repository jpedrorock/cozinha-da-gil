"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownUp, Check, CheckCheck, Coffee, Package, Play, Search, Utensils, Volume2, VolumeX, WifiOff, X } from "lucide-react";
import { useIdleLogout } from "@/lib/use-idle-logout";
import { useSSE } from "@/lib/use-sse";
import { useOperator } from "@/lib/use-operator";
import { isSoundEnabled, setSoundEnabled, useDing } from "@/lib/use-sound";
import { AppHeader } from "@/components/AppHeader";
import { CancelDialog } from "@/components/CancelDialog";
import { useToast } from "@/components/Toast";
import { PastelIcon, DoceIcon } from "@/components/icons";
import type { OrderView, OrderItemView } from "@/lib/orders";
import { SIZE_LABEL } from "@/lib/pricing";
import { summarizeChecklist } from "@/lib/kitchen-display";
import { sseDebugEnabled } from "@/lib/sse-debug";
import type { OrderStatus } from "@prisma/client";

const PREP_TARGET_MIN = 20;
const PREP_WARN_MIN = 10;
const PREP_URGENT_MIN = 15;
const FLASH_DURATION_MS = 4000;
// Audit-Crit B #21: re-ding em pedidos passados da meta a cada 2min.
// Equilíbrio: insistente o suficiente pra forçar ação, espaçado o
// suficiente pra não virar tortura sonora. 2min × 5 ciclos = 10min
// de incômodo crescente — bem antes disso cook já agiu.
const OVER_TARGET_RE_DING_MS = 2 * 60 * 1000;

type Stage = "PEDIDO_FEITO" | "EM_PREPARO";

const STAGE_CONFIG: Record<
  Stage,
  { label: string; badge: string; badgeBg: string; badgeInk: string; border: string; next: OrderStatus; action: string }
> = {
  PEDIDO_FEITO: {
    label: "Novo",
    badge: "Novo",
    badgeBg: "bg-status-incoming-bg",
    badgeInk: "text-status-incoming-ink",
    border: "border-l-status-incoming",
    next: "EM_PREPARO",
    action: "Iniciar preparo",
  },
  EM_PREPARO: {
    label: "Em preparo",
    badge: "Em preparo",
    badgeBg: "bg-status-preparing-bg",
    badgeInk: "text-status-preparing-ink",
    border: "border-l-status-preparing",
    next: "PRONTO",
    action: "Finalizar",
  },
};

export function CozinhaClient({
  initialOrders,
  allToppings,
}: {
  initialOrders: OrderView[];
  allToppings: string[];
}) {
  const router = useRouter();
  const { operator, ready, clear } = useOperator();

  useEffect(() => {
    if (ready && (!operator || operator.role !== "cozinha")) {
      router.replace("/");
    }
  }, [ready, operator, router]);

  // Cozinha NÃO desloga por inatividade (audit P2 #18) — tablet fixo na
  // barraca, sem risco de outra pessoa abrir. Logout interromperia a
  // cozinheira ocupada com mão na massa. Outras roles mantêm timeout.
  useIdleLogout(
    () => {
      clear();
      router.replace("/");
    },
    30 * 60 * 1000,
    true, // disabled = true → não dispara nunca
  );

  const [orders, setOrders] = useState<OrderView[]>(initialOrders);
  const [clock, setClock] = useState<Date | null>(null);
  // `now` central pra todos os tickets — antes cada Ticket criava o próprio
  // setInterval(1000ms). Com 20 cards na fila (festa cheia) era 20 timers/s.
  // Agora é 1. Cada Ticket calcula seu elapsed do prop.
  const [now, setNow] = useState<number | null>(null);
  const [recentlyArrived, setRecentlyArrived] = useState<Set<number>>(new Set());
  // Pedidos editados em EM_PREPARO via atendente (audit-crit #1+#6).
  // Backend sinaliza com `_editedInPreparation: true` no broadcast;
  // ring vermelho + ding alertam cook pra revisar antes de continuar.
  const [recentlyEdited, setRecentlyEdited] = useState<Set<number>>(new Set());
  const [soundOn, setSoundOn] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<OrderView | null>(null);
  // Pedidos com mutation pendente — usado pra mostrar "Salvando…" no botão
  // e bloquear double-click. Em slow 3G, sem isso o card sumia antes do
  // fetch resolver e cozinheiro achava que tinha entregue (sem saber que
  // a rede falhou). Limpo ao receber order:updated via SSE ou no erro.
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());
  const ding = useDing();
  const { showToast, node: toastNode } = useToast();
  // Audit-Crit B #21: rastreia qual nível de alarme já tocou pra cada
  // pedido. Sem isso, o loop de check (a cada 30s) re-disparava o ding
  // toda iteração — tortura. Map<orderId, { level, lastDingedAt }>.
  // Reset quando pedido sai da fila (PRONTO/ENTREGUE/CANCELADO).
  const alarmStateRef = useRef<Map<number, { level: "warn" | "urgent" | "over"; lastDingedAt: number }>>(
    new Map(),
  );

  useEffect(() => {
    setSoundOn(isSoundEnabled());
    setClock(new Date());
    setNow(Date.now());
    const tClock = setInterval(() => setClock(new Date()), 30_000);
    // Cronômetro de cada ticket precisa de 1s pra mm:ss avançar suave.
    // Single source — propagado via prop pra todos os Tickets.
    const tNow = setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      clearInterval(tClock);
      clearInterval(tNow);
    };
  }, []);

  // Audit follow-up P3 #28: atalhos de teclado pra cook com laptop/teclado
  // na estação. Cozinha desktop é caso comum (tablet conectado a teclado
  // Bluetooth, ou notebook fixo). Mouse-only é ineficiente em sessão de 6h.
  //
  // Shortcuts:
  //   /  → toggle busca (foca input quando abre)
  //   S  → toggle ordenação chegada ↔ urgência
  //   M  → toggle som on/off
  //   ?  → mostra/esconde overlay de ajuda
  //
  // Bloqueio: não dispara em input/textarea (digitando busca). Caso `?`
  // shift+/ no qwerty US, capturado também.
  const [helpOpen, setHelpOpen] = useState(false);
  // Ref pra acessar ding atual sem re-attach o listener a cada render
  // (useDing retorna função nova cada render). Listener fica imutável.
  const dingRef = useRef(ding);
  dingRef.current = ding;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      // Não atalha enquanto digitando
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      // Functional updates pra sempre pegar state mais recente sem
      // precisar re-attach o listener a cada render.
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        setHelpOpen(false);
        setSearchOpen(false);
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        setSearchOpen((open) => {
          if (open) setSearch("");
          return !open;
        });
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        setSortMode((cur) => {
          const next = cur === "chegada" ? "urgencia" : "chegada";
          try {
            localStorage.setItem("pdg:cozinha-sort", next);
          } catch {}
          return next;
        });
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        setSoundOn((cur) => {
          const next = !cur;
          setSoundEnabled(next);
          if (next) dingRef.current();
          return next;
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Audit-Crit B #21: alarme escalonado. Cook olha pra fora 5min, volta
  // e pedido tá há 25min sem ação. Sem som insistente, vira reclamação
  // do cliente. Lógica:
  //   - 10min (WARN): ding warn 1×
  //   - 15min (URGENT): ding urgent 1×
  //   - 20min (OVER TARGET): ding urgent + re-ding a cada 2min até cook agir
  //   - Som off no header também silencia esses alarmes (isSoundEnabled)
  //
  // Mantém estado por orderId em ref pra não re-disparar a cada tick.
  // Limpa quando pedido sai da fila (PRONTO/ENTREGUE/CANCELADO via SSE
  // já remove de `orders`, o cleanup abaixo derruba o entry).
  useEffect(() => {
    const tick = () => {
      const nowMs = Date.now();
      const activeIds = new Set<number>();
      for (const o of orders) {
        if (o.status !== "PEDIDO_FEITO" && o.status !== "EM_PREPARO") continue;
        activeIds.add(o.id);
        const stageStart =
          o.status === "EM_PREPARO" && o.preparedAt
            ? new Date(o.preparedAt).getTime()
            : new Date(o.createdAt).getTime();
        const elapsedMin = (nowMs - stageStart) / 60_000;
        const state = alarmStateRef.current.get(o.id);

        // Determina nível atual baseado no elapsed
        let shouldDing: "warn" | "urgent" | "over" | null = null;
        if (elapsedMin >= PREP_TARGET_MIN) {
          // OVER: 1ª vez OU passou 2min do último re-ding
          if (!state || state.level !== "over") {
            shouldDing = "over";
          } else if (nowMs - state.lastDingedAt >= OVER_TARGET_RE_DING_MS) {
            shouldDing = "over";
          }
        } else if (elapsedMin >= PREP_URGENT_MIN) {
          if (!state || (state.level !== "urgent" && state.level !== "over")) {
            shouldDing = "urgent";
          }
        } else if (elapsedMin >= PREP_WARN_MIN) {
          if (!state) shouldDing = "warn";
        }

        if (shouldDing) {
          if (shouldDing === "over" || shouldDing === "urgent") {
            ding("urgent");
          } else {
            ding("warn");
          }
          alarmStateRef.current.set(o.id, { level: shouldDing, lastDingedAt: nowMs });
        }
      }
      // Cleanup: pedidos que saíram da fila perdem o entry
      for (const id of Array.from(alarmStateRef.current.keys())) {
        if (!activeIds.has(id)) alarmStateRef.current.delete(id);
      }
    };
    // 30s é granular o suficiente pra alarmes minutários sem ser caro
    const t = setInterval(tick, 30_000);
    tick(); // dispara imediato ao mount/order change pra não esperar 30s
    return () => clearInterval(t);
  }, [orders, ding]);

  function markArrived(id: number) {
    setRecentlyArrived((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setRecentlyArrived((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, FLASH_DURATION_MS);
  }

  function markEdited(id: number) {
    setRecentlyEdited((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setRecentlyEdited((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, FLASH_DURATION_MS * 2); // 8s — quer chamar atenção forte
  }

  const sseStatus = useSSE("/api/sse", {
    "order:created": (data) => {
      const order = data as OrderView;
      // [LATÊNCIA] Mede tempo desde createdAt (server) até chegar aqui.
      // Inclui: db commit + serialize + broadcast + rede + parse client.
      if (sseDebugEnabled()) {
        const lagMs = Date.now() - new Date(order.createdAt).getTime();
        console.log(`[SSE-LAT] cozinha order:created id=${order.id} lag=${lagMs}ms status=${order.status}`);
      }
      if (order.status === "PEDIDO_FEITO" || order.status === "EM_PREPARO") {
        setOrders((prev) => [...prev.filter((o) => o.id !== order.id), order]);
        markArrived(order.id);
        ding();
      }
    },
    "order:updated": (data) => {
      const raw = data as OrderView & { _editedInPreparation?: boolean };
      const order: OrderView = raw;
      if (sseDebugEnabled()) {
        const lagMs = Date.now() - new Date(order.updatedAt).getTime();
        console.log(`[SSE-LAT] cozinha order:updated id=${order.id} lag=${lagMs}ms status=${order.status}`);
      }
      setOrders((prev) => {
        const without = prev.filter((o) => o.id !== order.id);
        if (order.status === "PEDIDO_FEITO" || order.status === "EM_PREPARO") {
          return [...without, order];
        }
        return without;
      });
      // Audit-Crit #1+#6: atendente alterou pedido enquanto cozinha preparava.
      // Ring vermelho + ding pra cook olhar e revisar antes de continuar.
      // Sem isso, o card só re-renderiza silenciosamente e cook segue
      // a versão antiga na cabeça.
      if (raw._editedInPreparation) {
        markEdited(order.id);
        ding();
      }
      // Mutation chegou de volta — libera o "Salvando…" do botão
      setPendingIds((prev) => {
        if (!prev.has(order.id)) return prev;
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
    },
  });

  async function advance(id: number, to: OrderStatus) {
    // Marca pending ANTES do fetch — botão vira "Salvando…" + bloqueia
    // double-tap. Limpa em onerror local OU quando SSE trouxer
    // order:updated (cenário feliz). Sem isso, em 3G ruim o card some
    // antes do fetch resolver e cozinheiro acha que entregou.
    setPendingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to, operator: operator?.name }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      // SSE order:updated vai chegar e remover o pending. Em caso raro
      // de SSE desconectado, libera após 6s pra não travar a UI.
      setTimeout(() => {
        setPendingIds((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 6000);
    } catch {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      showToast("Sem conexão. Toque de novo.", "error");
    }
  }

  async function cancelOrder(id: number, reason: string) {
    setPendingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELADO", operator: operator?.name, reason }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCancelTarget(null);
    } catch {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      showToast("Não foi possível cancelar agora.", "error");
    }
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) ding();
  }

  // === Busca + ordenação configurável (audit crítica #4) ===
  // Cenário: 30 pedidos na fila, José cozinhando — "qual era do Pedro?"
  // Busca rápida por nome ou #pedido. Ordenação alternável: chegada (default,
  // FIFO) OU urgência (em preparo há mais tempo + com notes especiais primeiro).
  // Persistido em localStorage pra preferência ficar.
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sortMode, setSortMode] = useState<"chegada" | "urgencia">("chegada");

  // Histórico de prontos — drawer read-only pra cook conferir o que já
  // finalizou hoje (evita refazer pedido por engano). Fetch on-demand ao
  // abrir, não pesa o realtime. Feedback Gil.
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyOrders, setHistoryOrders] = useState<OrderView[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  async function openHistory() {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/orders?scope=today");
      const data = (await res.json()) as OrderView[];
      // Só finalizados (PRONTO + ENTREGUE), mais recentes primeiro.
      const done = data
        .filter((o) => o.status === "PRONTO" || o.status === "ENTREGUE")
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setHistoryOrders(done);
    } catch {
      setHistoryOrders([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  // Restore preferência
  useEffect(() => {
    try {
      const stored = localStorage.getItem("pdg:cozinha-sort");
      if (stored === "urgencia") setSortMode("urgencia");
    } catch {}
  }, []);
  function toggleSort() {
    const next = sortMode === "chegada" ? "urgencia" : "chegada";
    setSortMode(next);
    try {
      localStorage.setItem("pdg:cozinha-sort", next);
    } catch {}
  }

  // Ordenação por urgência: pedidos com mais tempo em EM_PREPARO primeiro
  // (atraso real); empate desempata pela presença de observações (notes)
  // — pedido com obs precisa de atenção extra; depois chegada ASC.
  function urgencyScore(o: OrderView, nowMs: number): number {
    let score = 0;
    if (o.status === "EM_PREPARO") {
      const startTs = o.preparedAt ? new Date(o.preparedAt).getTime() : new Date(o.createdAt).getTime();
      score += Math.max(0, Math.floor((nowMs - startTs) / 60_000)) * 100;
    }
    if (o.items.some((it) => it.notes && it.notes.trim().length > 0)) {
      score += 50;
    }
    return score;
  }

  // Pedidos que precisam preparo na cozinha:
  // - status ∈ {PEDIDO_FEITO, EM_PREPARO}
  // - pelo menos 1 item NÃO é bebida (bebida vai direto do atendente)
  const queue = useMemo(() => {
    const nowMs = now ?? Date.now();
    const base = orders
      .filter((o) => o.status === "PEDIDO_FEITO" || o.status === "EM_PREPARO")
      .filter((o) => o.items.some((it) => it.kind !== "bebida"));

    // Busca filtra ANTES da ordenação
    const q = search.trim().toLowerCase();
    const filtered = q
      ? base.filter((o) => {
          if (o.clientName.toLowerCase().includes(q)) return true;
          if (String(o.id).padStart(3, "0").includes(q)) return true;
          if (String(o.id).includes(q)) return true;
          return false;
        })
      : base;

    if (sortMode === "urgencia") {
      return [...filtered].sort((a, b) => {
        const diff = urgencyScore(b, nowMs) - urgencyScore(a, nowMs);
        if (diff !== 0) return diff;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    }
    return [...filtered].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [orders, search, sortMode, now]);

  const novosCount = queue.filter((o) => o.status === "PEDIDO_FEITO").length;
  // Total real (sem filtro de busca) pra mostrar "X de Y" quando filtrando
  const totalQueueCount = orders.filter(
    (o) =>
      (o.status === "PEDIDO_FEITO" || o.status === "EM_PREPARO") &&
      o.items.some((it) => it.kind !== "bebida"),
  ).length;

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Feedback Gil: header lotado de ícones — movemos controles globais
          (busca/ordenar/som) pro bottom action bar com labels visíveis.
          Header agora só mostra info passiva: status conexão, badges de
          contagem, relógio. Tudo mais espaçado. */}
      <AppHeader
        right={
          <div className="flex items-center gap-2">
            {sseStatus !== "open" && (
              <span
                className="inline-flex items-center gap-1.5 bg-danger-bg text-danger text-xs font-bold uppercase tracking-[0.06em] px-2.5 py-1 rounded-full"
                title="Sem conexão com servidor — pedidos novos podem demorar"
              >
                <WifiOff size={14} strokeWidth={2.5} />
                <span className="hidden sm:inline">Sem conexão</span>
              </span>
            )}
            {novosCount > 0 && (
              <span
                className="bg-status-incoming text-white font-bold text-[15px] px-3 py-1.5 rounded-full t-num animate-badge-pop"
                title="Pedidos novos aguardando preparo"
              >
                {novosCount} novo{novosCount === 1 ? "" : "s"}
              </span>
            )}
            <span
              className="t-caption text-ink-3 t-num bg-surface-sunken px-2 py-1 rounded-full hidden sm:inline"
              title="Total de pedidos na fila"
            >
              {search ? `${queue.length} de ${totalQueueCount}` : `${queue.length} na fila`}
            </span>
            <span className="font-mono font-bold text-[17px] t-num text-ink hidden sm:block" aria-label="Hora atual">
              {clock
                ? clock.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                : "--:--"}
            </span>
          </div>
        }
      />

      {/* Barra de busca expansível — só quando ativada via botão Search */}
      {searchOpen && (
        <div className="bg-surface-elevated border-b border-line px-4 py-2 sticky top-16 z-20">
          <div className="relative max-w-md mx-auto">
            <Search
              size={16}
              strokeWidth={2.25}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none"
              aria-hidden
            />
            <input
              type="search"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou número do pedido…"
              className="input pl-10 h-10"
            />
          </div>
        </div>
      )}

      <main
        className="flex-1 p-4 md:p-6"
        // Padding bottom respeita altura do action bar fixo (72px) +
        // safe-area do iPhone, pra último card não ficar coberto.
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 88px)" }}
      >
        {queue.length === 0 ? (
          search ? (
            <div className="text-center py-20 text-ink-3">
              <Search size={48} strokeWidth={1.5} className="mx-auto mb-3 opacity-40" />
              <div className="t-h3">Nenhum pedido bate com &ldquo;{search}&rdquo;</div>
              <button
                onClick={() => setSearch("")}
                className="mt-3 text-sm font-semibold text-ink-2 hover:text-ink underline"
              >
                Limpar busca
              </button>
            </div>
          ) : (
            <EmptyState />
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4 max-w-screen-2xl mx-auto">
            {/* max-w-screen-2xl evita ticket cards esticarem em TV ultra-wide
                (>1536px), mantendo legível à distância. Audit UX desktop 2026-05-27. */}
            {queue.map((o) => {
              const stage: Stage = o.status === "PEDIDO_FEITO" ? "PEDIDO_FEITO" : "EM_PREPARO";
              const next: OrderStatus = stage === "PEDIDO_FEITO" ? "EM_PREPARO" : "PRONTO";
              return (
                <Ticket
                  key={o.id}
                  order={o}
                  stage={stage}
                  allToppings={allToppings}
                  flash={recentlyArrived.has(o.id)}
                  flashEdited={recentlyEdited.has(o.id)}
                  pending={pendingIds.has(o.id)}
                  now={now}
                  onAdvance={() => advance(o.id, next)}
                  onCancel={() => setCancelTarget(o)}
                />
              );
            })}
          </div>
        )}
      </main>

      <CancelDialog
        open={cancelTarget !== null}
        orderLabel={cancelTarget ? `#${String(cancelTarget.id).padStart(3, "0")} · ${cancelTarget.clientName}` : ""}
        onConfirm={(reason) => cancelTarget && cancelOrder(cancelTarget.id, reason)}
        onClose={() => setCancelTarget(null)}
      />

      {/* Feedback Gil: header lotado de ícones — agora botnav fixa embaixo
          com label visível em cada botão. A11y: cada label é uma palavra
          que descreve a ação atual (Buscar/Urgência/Som), evitando que
          cook precise hover descobrir o que faz. Sticky bottom + safe-area
          pra iOS standalone. Layout horizontal igual ao admin bottom-nav. */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-surface-elevated border-t border-line-strong"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Controles da cozinha"
      >
        <div className="flex items-stretch justify-around max-w-md mx-auto">
          <button
            onClick={() => {
              setSearchOpen((v) => !v);
              if (searchOpen) setSearch("");
            }}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[60px] transition-colors ${
              searchOpen || search
                ? "text-brand-orange bg-brand-orange/10"
                : "text-ink-2 hover:text-ink hover:bg-surface-sunken"
            }`}
            aria-label={searchOpen ? "Fechar busca" : "Abrir busca de pedido"}
            aria-pressed={searchOpen || !!search}
            title="Buscar pedido por nome ou número  ·  atalho: /"
          >
            <Search size={22} strokeWidth={2.25} aria-hidden />
            <span className="text-[11px] font-semibold leading-none">
              {search ? "Buscando" : "Buscar"}
            </span>
          </button>

          <button
            onClick={toggleSort}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[60px] transition-colors ${
              sortMode === "urgencia"
                ? "text-brand-orange bg-brand-orange/10"
                : "text-ink-2 hover:text-ink hover:bg-surface-sunken"
            }`}
            aria-label={
              sortMode === "urgencia"
                ? "Modo urgência ativo. Tocar pra ordenar por chegada"
                : "Modo chegada (FIFO) ativo. Tocar pra ordenar por urgência (atrasos primeiro)"
            }
            aria-pressed={sortMode === "urgencia"}
            title={
              sortMode === "urgencia"
                ? "Urgência (atrasos primeiro) — tocar pra FIFO  ·  atalho: S"
                : "Chegada (FIFO) — tocar pra urgência  ·  atalho: S"
            }
          >
            <ArrowDownUp size={22} strokeWidth={2.25} aria-hidden />
            <span className="text-[11px] font-semibold leading-none">
              {sortMode === "urgencia" ? "Urgência" : "Chegada"}
            </span>
          </button>

          <button
            onClick={toggleSound}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[60px] transition-colors ${
              soundOn
                ? "text-ink hover:text-ink hover:bg-surface-sunken"
                : "text-ink-3 hover:text-ink-2 hover:bg-surface-sunken"
            }`}
            aria-label={soundOn ? "Som ligado. Tocar pra silenciar alarmes" : "Som silenciado. Tocar pra ligar alarmes"}
            aria-pressed={soundOn}
            title={soundOn ? "Som ligado — tocar pra silenciar  ·  atalho: M" : "Silenciado — tocar pra ligar  ·  atalho: M"}
          >
            {soundOn ? (
              <Volume2 size={22} strokeWidth={2.25} aria-hidden />
            ) : (
              <VolumeX size={22} strokeWidth={2.25} aria-hidden />
            )}
            <span className="text-[11px] font-semibold leading-none">
              {soundOn ? "Som" : "Mudo"}
            </span>
          </button>

          <button
            onClick={openHistory}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[60px] text-ink-2 hover:text-ink hover:bg-surface-sunken transition-colors"
            aria-label="Ver pedidos prontos de hoje"
            title="Histórico de prontos hoje (read-only)"
          >
            <CheckCheck size={22} strokeWidth={2.25} aria-hidden />
            <span className="text-[11px] font-semibold leading-none">Prontos</span>
          </button>
        </div>
      </nav>

      {/* Audit follow-up P3 #28: overlay de atalhos. Aciona com `?`
          (shift+/ no qwerty US). Click no fundo ou Esc fecha. Útil pro
          cook descobrir os atalhos sem ter que decorar. */}
      {helpOpen && (
        <div
          className="fixed inset-0 z-[100] bg-ink/60 backdrop-blur-[3px] flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setHelpOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="kb-help-title"
        >
          <div
            className="w-full max-w-sm bg-surface-elevated rounded-xl shadow-2xl p-6 animate-sheet-up"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="kb-help-title" className="t-h2 mb-4">Atalhos de teclado</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
              <dt className="font-mono font-bold text-ink bg-surface-sunken px-2 py-0.5 rounded text-center">/</dt>
              <dd className="text-ink-2 self-center">Buscar pedido</dd>
              <dt className="font-mono font-bold text-ink bg-surface-sunken px-2 py-0.5 rounded text-center">S</dt>
              <dd className="text-ink-2 self-center">Alternar ordenação (chegada ↔ urgência)</dd>
              <dt className="font-mono font-bold text-ink bg-surface-sunken px-2 py-0.5 rounded text-center">M</dt>
              <dd className="text-ink-2 self-center">Ligar/silenciar som</dd>
              <dt className="font-mono font-bold text-ink bg-surface-sunken px-2 py-0.5 rounded text-center">Esc</dt>
              <dd className="text-ink-2 self-center">Fechar busca / ajuda</dd>
              <dt className="font-mono font-bold text-ink bg-surface-sunken px-2 py-0.5 rounded text-center">?</dt>
              <dd className="text-ink-2 self-center">Mostrar esta ajuda</dd>
            </dl>
            <button
              onClick={() => setHelpOpen(false)}
              className="btn btn-primary w-full mt-5"
              autoFocus
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Drawer "Prontos" — histórico read-only dos finalizados de hoje.
          Slide-up modal; click fora ou botão fecha. Cook confere o que já
          saiu pra não refazer por engano. */}
      {historyOpen && (
        <div
          className="fixed inset-0 z-[100] bg-ink/60 backdrop-blur-[3px] flex items-end md:items-center justify-center md:p-4 animate-fade-in"
          onClick={() => setHistoryOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Pedidos prontos hoje"
        >
          <div
            className="w-full md:max-w-lg bg-surface rounded-t-xl md:rounded-xl max-h-[85dvh] flex flex-col animate-sheet-up"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between p-4 border-b border-line bg-surface-elevated rounded-t-xl">
              <div>
                <div className="t-label">Histórico de hoje</div>
                <h2 className="t-h2">
                  Prontos{!historyLoading ? ` (${historyOrders.length})` : ""}
                </h2>
              </div>
              <button
                onClick={() => setHistoryOpen(false)}
                className="shrink-0 inline-flex items-center justify-center w-11 h-11 -mr-2 rounded-md text-ink-3 hover:text-ink hover:bg-surface-sunken"
                aria-label="Fechar"
              >
                <X size={22} strokeWidth={2.5} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4">
              {historyLoading ? (
                <div className="text-center py-12 text-ink-3">Carregando…</div>
              ) : historyOrders.length === 0 ? (
                <div className="text-center py-12 text-ink-3">
                  Nenhum pedido finalizado hoje ainda.
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {historyOrders.map((o) => {
                    const finished = new Date(o.updatedAt);
                    const itemsSummary = o.items
                      .map((it) => `${it.quantity > 1 ? `${it.quantity}× ` : ""}${it.productName || it.kind}`)
                      .join(", ");
                    return (
                      <li
                        key={o.id}
                        className="rounded-md border border-line bg-surface-elevated px-3 py-2.5"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="t-num text-xs text-ink-3 tabular-nums shrink-0">
                              #{String(o.id).padStart(3, "0")}
                            </span>
                            <span className="font-bold truncate">{o.clientName}</span>
                            {o.status === "ENTREGUE" && (
                              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-status-ready-ink border border-status-ready/40 rounded px-1.5 py-0.5">
                                entregue
                              </span>
                            )}
                          </div>
                          <span className="t-num text-xs text-ink-3 tabular-nums shrink-0">
                            {finished.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <div className="text-sm text-ink-2 mt-0.5 truncate">{itemsSummary}</div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {toastNode}
    </div>
  );
}

function Ticket({
  order,
  stage,
  allToppings,
  flash,
  flashEdited,
  pending,
  now,
  onAdvance,
  onCancel,
}: {
  order: OrderView;
  stage: Stage;
  allToppings: string[];
  flash: boolean;
  /** Audit-Crit #1+#6: atendente editou o pedido em EM_PREPARO.
   *  Ring vermelho + label "ALTERADO" pra cook não passar batido. */
  flashEdited: boolean;
  pending: boolean;
  /** Timestamp central do CozinhaClient — vide nota no parent. */
  now: number | null;
  onAdvance: () => void;
  onCancel: () => void;
}) {
  const cfg = STAGE_CONFIG[stage];

  // Animação de saída quando "Finalizar" é clicado — exit micro-celebration.
  const [leaving, setLeaving] = useState(false);

  // Cronômetros diferentes por estágio
  const stageStartTs =
    stage === "EM_PREPARO" && order.preparedAt
      ? new Date(order.preparedAt).getTime()
      : new Date(order.createdAt).getTime();

  const elapsedSec = now === null ? 0 : Math.floor((now - stageStartTs) / 1000);
  const mm = Math.floor(elapsedSec / 60);
  const ss = elapsedSec % 60;

  let timerColor = "text-ink";
  if (stage === "PEDIDO_FEITO") {
    timerColor = mm >= 5 ? "text-brand-orange" : "text-ink-2";
  } else {
    timerColor =
      mm >= PREP_TARGET_MIN
        ? "text-danger"
        : mm >= PREP_URGENT_MIN
        ? "text-danger"
        : mm >= PREP_WARN_MIN
        ? "text-brand-orange"
        : "text-ink";
  }

  const createdTime = new Date(order.createdAt).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // ============================================================
  // TOQUE ESPECIAL: card EM_PREPARO ganha anel de progresso circular
  // ao redor do cronômetro digital, com cor escalonada (verde →
  // amarelo → laranja → vermelho) conforme aproxima da meta de 20min.
  // Decisão de design (inspirado em Toast KDS / Square KDS / iFood):
  //   1. Ring > barra: percepção rápida com mão ocupada, "relógio"
  //      circular é metáfora universal em cozinha. Lê de longe.
  //   2. Cor + preenchimento dão DUAS pistas redundantes — funciona
  //      mesmo em quem tem daltonismo de vermelho/verde.
  //   3. Mantém o mm:ss digital (precisão) — anel é ADICIONAL.
  //   4. Quando >20min (atrasado), o card inteiro ganha glow pulsante
  //      vermelho (animação prep-glow) — alarma sem ser irritante.
  //   5. Tudo em SVG estático + CSS — zero JS animation loop, zero
  //      mudança de layout, respeita prefers-reduced-motion via
  //      regra global.
  // ============================================================
  const isPreparing = stage === "EM_PREPARO";
  const prepElapsedSec = isPreparing ? elapsedSec : 0;
  // Limita o anel em 1.25x a meta — passou disso, fica "cheio" e
  // o glow externo carrega a urgência. Evita o ring "engolir" o
  // espaço visual indefinidamente.
  const ringMaxSec = PREP_TARGET_MIN * 60 * 1.25;
  const ringPct = isPreparing
    ? Math.min(1, prepElapsedSec / (PREP_TARGET_MIN * 60))
    : 0;
  const ringPctClamped = isPreparing
    ? Math.min(1, prepElapsedSec / ringMaxSec)
    : 0;

  // Stroke color do anel (matching com timerColor mas em hex pro SVG)
  let ringStroke = "#1F9B4A"; // ready-green (0-10min)
  if (mm >= PREP_TARGET_MIN) ringStroke = "#D03A2C"; // danger
  else if (mm >= PREP_URGENT_MIN) ringStroke = "#FF6B00"; // brand-orange
  else if (mm >= PREP_WARN_MIN) ringStroke = "#E5B400"; // preparing-yellow

  // Tick visual quando o anel muda de zona de risco — substitui o
  // prep-glow infinito como "alarme" pontual. Key muda → re-renderiza
  // wrapper com animate-ring-tick.
  const [tickKey, setTickKey] = useState(0);
  useEffect(() => {
    setTickKey((k) => k + 1);
  }, [ringStroke]);

  const overTarget = isPreparing && mm >= PREP_TARGET_MIN;

  // Cozinha: duplicar item por unidade em vez de mostrar badge ×N.
  // Decisão deliberada — repetição visual é alarme natural; badge
  // pequeno pode passar batido na pressa e causar erro (faz 1 em
  // vez de 3). Atendente/comprovante/admin mantêm agrupado.
  // Filtra bebida — atendente entrega direto, cozinha não prepara.
  const expandedItems = order.items
    .filter((item) => item.kind !== "bebida")
    .flatMap((item) =>
      Array.from({ length: item.quantity }, (_, n) => ({ item, n })),
    );

  return (
    <article
      className={`card p-5 flex flex-col gap-3 shadow-md border-l-4 ${cfg.border} ${
        leaving ? "animate-ticket-out pointer-events-none" : "animate-card-in"
      } ${
        flash && !leaving ? "ring-4 ring-brand-orange ring-opacity-60 animate-flash-ring" : ""
      } ${
        // Edit-em-preparo é mais grave que arrived — ring vermelho destaca
        // que conteúdo MUDOU enquanto cook olhava pra outro lado.
        flashEdited && !leaving ? "ring-4 ring-danger ring-opacity-80 animate-flash-ring" : ""
      } ${overTarget && !leaving ? "animate-prep-glow" : ""}`}
    >
      {flashEdited && !leaving && (
        <div className="-mx-5 -mt-5 px-5 py-2 rounded-t-md bg-danger text-white t-label !text-white inline-flex items-center gap-2 animate-flash-ring-once">
          <span className="text-xl leading-none">⚠</span>
          <span>Atendente alterou — revise os itens</span>
        </div>
      )}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            {/* Número do pedido em destaque (audit P3 #26): atendente grita
                "número 42!" — fica primário. Antes era text-xs no meio do
                horário; agora text-lg + tracking pra leitura à distância. */}
            <div className="font-mono text-lg font-bold t-num text-ink leading-none">
              #{String(order.id).padStart(3, "0")}
            </div>
            <div className="font-mono text-xs t-num text-ink-3 tracking-[0.04em]">
              {createdTime}
            </div>
            <span
              key={stage}
              className={`t-label tracking-[0.1em] px-1.5 py-0.5 rounded ${cfg.badgeBg} ${cfg.badgeInk} animate-badge-pop`}
            >
              {cfg.badge}
            </span>
          </div>
          <h2 className="text-[24px] font-bold -tracking-[0.015em] truncate">{order.clientName}</h2>
          {order.createdBy && order.createdBy !== "—" && (
            <div className="t-caption mt-0.5">por {order.createdBy}</div>
          )}
        </div>
        <div className="shrink-0 flex flex-col items-end">
          {isPreparing ? (
            <div key={tickKey} className="animate-ring-tick">
              <PrepTimerRing
                mm={mm}
                ss={ss}
                now={now}
                pct={ringPctClamped}
                fullPct={ringPct}
                stroke={ringStroke}
                colorClass={timerColor}
              />
            </div>
          ) : (
            <div className={`font-mono text-2xl font-bold t-num ${timerColor}`} suppressHydrationWarning>
              {now === null ? "--:--" : `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`}
            </div>
          )}
          {isPreparing && (
            <div
              className={`mt-1 t-label tracking-[0.06em] ${
                overTarget ? "text-danger" : ""
              }`}
            >
              {overTarget ? `+${mm - PREP_TARGET_MIN}min sobre meta` : `meta ${PREP_TARGET_MIN}min`}
            </div>
          )}
        </div>
      </header>

      <div className="border-t-2 border-dashed border-line -mx-5" />

      {/* Feedback Gil: vertical um abaixo do outro ocupava muito espaço
          quando pedido tinha 3-4 unidades. Agora 2 colunas no md+ pra
          aproveitar largura. 1 item segue full-width (zoom natural).
          Mobile fica vertical pra cada bloco ser legível em 360px. */}
      <ul
        className={
          expandedItems.length > 1
            ? "grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-2.5"
            : "flex flex-col gap-3"
        }
      >
        {expandedItems.map(({ item, n }, idx) => (
          <li
            key={`${item.id}-${n}`}
            // Cada unidade vira "bloco" próprio com badge numerado.
            // Quando tem só 1 item, sem destaque pra não inflar.
            className={
              expandedItems.length > 1
                ? "flex flex-col gap-1.5 rounded-md bg-surface-sunken/60 border-l-4 border-brand-yellow p-2.5"
                : "flex flex-col gap-2"
            }
          >
            {expandedItems.length > 1 && (
              <div className="flex items-center gap-1.5 -mb-0.5">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-brand-yellow text-ink font-bold text-[13px] t-num shrink-0">
                  {idx + 1}
                </span>
                <span className="t-label">
                  de {expandedItems.length}
                </span>
              </div>
            )}
            <TicketItem
              item={item}
              allToppings={allToppings}
              compact={expandedItems.length > 1}
            />
          </li>
        ))}
      </ul>

      <div className="mt-1 flex flex-col gap-2">
        <button
          onClick={() => {
            if (pending) return;
            // Quando "Finalizar" (EM_PREPARO → PRONTO), dispara
            // animate-ticket-out por 200ms antes do fetch que removeria
            // o card da fila. Atendente em PEDIDO_FEITO segue sem delay.
            if (stage === "EM_PREPARO") {
              setLeaving(true);
              setTimeout(onAdvance, 200);
            } else {
              onAdvance();
            }
          }}
          disabled={pending}
          className={`w-full h-14 rounded-md text-[17px] font-bold inline-flex items-center justify-center gap-2 shadow-md hover:brightness-110 active:scale-[0.96] transition text-white disabled:opacity-80 disabled:cursor-wait disabled:scale-100 ${
            stage === "PEDIDO_FEITO"
              ? "bg-status-incoming"
              : "bg-status-ready"
          }`}
        >
          {pending ? (
            <>
              <span className="spinner-inline" aria-hidden />
              <span>Salvando…</span>
            </>
          ) : (
            <>
              {stage === "PEDIDO_FEITO" && <Play size={20} strokeWidth={3} fill="currentColor" />}
              {stage === "EM_PREPARO" && <Check size={22} strokeWidth={3} />}
              {cfg.action}
            </>
          )}
        </button>
        {(stage === "PEDIDO_FEITO" || stage === "EM_PREPARO") && (
          // Cancelar fica em linha separada do CTA primário pra não virar
          // fat-finger trap. Label visível ("Cancelar pedido"), ícone X
          // discreto à direita, border-only sem fundo (não compete).
          <button
            onClick={onCancel}
            disabled={pending}
            className="w-full h-9 rounded-md border border-line text-ink-3 hover:border-danger hover:text-danger text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 active:scale-[0.97] transition disabled:opacity-50"
            title="Cancelar pedido"
          >
            <X size={14} strokeWidth={2.5} />
            <span>Cancelar pedido</span>
          </button>
        )}
      </div>
    </article>
  );
}

/**
 * Anel de progresso circular ao redor do cronômetro digital.
 *
 * - 80x80px (legível a alguns metros de distância)
 * - SVG estático com strokeDasharray controlando o preenchimento.
 * - Cor do anel passada via prop (escalonada conforme tempo decorrido)
 * - O número mm:ss fica centrado dentro do anel; mantém precisão.
 */
function PrepTimerRing({
  mm,
  ss,
  now,
  pct,
  fullPct,
  stroke,
  colorClass,
}: {
  mm: number;
  ss: number;
  now: number | null;
  pct: number; // 0..1 (clamped p/ não passar do círculo)
  fullPct: number; // 0..1 (real, pra detectar overflow)
  stroke: string;
  colorClass: string;
}) {
  const size = 80;
  const stroke_w = 6;
  const r = (size - stroke_w) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  const overflow = fullPct >= 1;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="rotate-[-90deg]"
        aria-hidden
      >
        {/* track (cinza claro) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#EFE9DE"
          strokeWidth={stroke_w}
          fill="none"
        />
        {/* progresso */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={stroke}
          strokeWidth={stroke_w}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{
            // Sem transition no offset — anel TICA a cada segundo (relógio),
            // não desliza. A transição de 600ms anterior parecia "lerda"
            // contra o tick de 1s do `now`. Cor continua animando suave.
            transition: "stroke 220ms ease-out",
          }}
        />
        {/* dot de "overflow" — pequeno indicador girando quando passou 100% */}
        {overflow && (
          <circle
            cx={size / 2 + r}
            cy={size / 2}
            r={stroke_w / 2 + 1}
            fill={stroke}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={`font-mono text-[17px] font-bold t-num leading-none ${colorClass}`}
          suppressHydrationWarning
        >
          {now === null ? "--:--" : `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`}
        </div>
      </div>
    </div>
  );
}

function ProductIcon({ kind }: { kind: string }) {
  // Ícones grandes (40px) pra cozinheira identificar o tipo em
  // um olhar — hands-busy + tempo curto por pedido.
  if (kind === "doce") return <DoceIcon size={40} />;
  if (kind === "bebida") return <Coffee size={40} strokeWidth={2} />;
  if (kind === "macarrao") return <Utensils size={40} strokeWidth={2} />;
  if (kind === "combo") return <Package size={40} strokeWidth={2} />;
  return <PastelIcon size={40} />;
}

function TicketItem({
  item,
  allToppings,
  compact = false,
}: {
  item: OrderItemView;
  allToppings: string[];
  /** Quando pedido tem >1 unidade, renderiza em grid 2-col com fonts
   *  menores e gaps mais apertados pra caber 2 lado-a-lado sem perder
   *  legibilidade. Feedback Gil: vertical inflava muito. */
  compact?: boolean;
}) {
  // Fase 6: usa snapshot productName se existir (pra macarrão/bebida/combo/etc),
  // senão fallback no SIZE_LABEL antigo.
  const productName = item.productName || (item.kind === "doce" ? "Pastel doce" : item.kind === "salgado" ? "Pastel salgado" : item.kind);
  const sizeLabel = item.size && SIZE_LABEL[item.size as keyof typeof SIZE_LABEL]
    ? SIZE_LABEL[item.size as keyof typeof SIZE_LABEL]
    : item.size;
  const isMini = item.size === "mini";
  const isPequeno = item.kind === "salgado" && item.size === "pequeno";
  const showsToppingChecklist = item.kind === "salgado";

  return (
    <div className={compact ? "flex flex-col gap-1.5" : "flex flex-col gap-2.5"}>
      <div className={compact ? "flex items-center gap-2" : "flex items-center gap-3"}>
        <span className="shrink-0">
          <ProductIcon kind={item.kind} />
        </span>
        <div className="flex-1 min-w-0">
          <div
            className={
              compact
                ? "text-base font-bold leading-tight -tracking-[0.01em]"
                : "text-xl font-bold leading-tight -tracking-[0.01em]"
            }
          >
            {sizeLabel || productName}
            {isMini && (
              <span
                className={
                  compact
                    ? "text-[12px] text-ink-3 font-medium ml-1"
                    : "text-[15px] text-ink-3 font-medium ml-1.5"
                }
              >
                · 10 unid.
              </span>
            )}
          </div>
          {sizeLabel && productName && (
            <div className={compact ? "text-[10px] uppercase tracking-[0.06em] text-ink-3 mt-0" : "t-label tracking-[0.06em] mt-0.5"}>
              {productName}
            </div>
          )}
        </div>
      </div>

      {showsToppingChecklist && (
        <Checklist
          all={allToppings}
          selected={item.toppings}
          mode={isPequeno ? "only-in" : "smart"}
          emptyLabel="Sem toppings"
          compact={compact}
        />
      )}

      {item.kind === "doce" && item.flavor && (
        <div className={
          compact
            ? "bg-[#FFFCE5] border border-brand-yellow rounded-sm px-2 py-1.5 flex items-center gap-1.5"
            : "bg-[#FFFCE5] border border-brand-yellow rounded-sm px-3 py-2 flex items-center gap-2"
        }>
          <CheckIcon />
          <span className={compact ? "text-[13px] font-bold" : "text-[15px] font-bold"}>{item.flavor}</span>
        </div>
      )}

      {/* Macarrão / Combo: lista de ingredientes em chips compactos
          (não usa Checklist porque a lista de referência é específica) */}
      {(item.kind === "macarrao" || item.kind === "combo") && item.toppings.length > 0 && (
        <div>
          <div className={compact ? "text-[10px] uppercase tracking-[0.06em] text-ink-3 mb-1" : "t-label mb-1.5"}>
            {item.kind === "combo" ? "Sabores" : "Ingredientes"}
          </div>
          <ul className={compact ? "flex flex-wrap gap-x-2 gap-y-0.5" : "flex flex-wrap gap-x-4 gap-y-1"}>
            {item.toppings.map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <CheckIcon />
                <span className={compact ? "text-[13px] font-bold text-ink" : "text-[15px] font-bold text-ink"}>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {item.sauces.length > 0 && (
        <div>
          <div className={compact ? "text-[10px] uppercase tracking-[0.06em] text-ink-3 mb-1" : "t-label mb-1.5"}>Molhos</div>
          <ul className={compact ? "flex flex-wrap gap-x-2 gap-y-0.5" : "flex flex-wrap gap-x-4 gap-y-1"}>
            {item.sauces.map((m) => (
              <li key={m} className="flex items-center gap-1.5">
                <CheckIcon />
                <span className={compact ? "text-[12px] font-bold text-ink" : "text-sm font-bold text-ink"}>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {item.notes && (() => {
        // Audit-Crit #3: separa modificadores negativos ("sem X") do resto.
        // SEM CEBOLA em vermelho gritado é o que cozinha precisa ler ANTES
        // de começar. O resto vai amarelo padrão.
        const parts = item.notes.split(",").map((s) => s.trim()).filter(Boolean);
        const negatives = parts.filter((p) => /^sem\s+/i.test(p));
        const rest = parts.filter((p) => !/^sem\s+/i.test(p));
        return (
          <div className="mt-1 flex flex-col gap-1">
            {negatives.length > 0 && (
              <div className="bg-danger text-white rounded-sm px-3 py-2 flex gap-2 items-center font-extrabold uppercase tracking-wide">
                <span className="text-lg leading-none">⚠</span>
                <span className="text-[16px] leading-tight">
                  {negatives.join(" · ")}
                </span>
              </div>
            )}
            {rest.length > 0 && (
              <div className="bg-[#FFF4C2] text-[#5C4500] rounded-sm px-3 py-2 flex gap-2 items-start">
                <span className="t-label !text-current tracking-[0.06em] mt-0.5">Obs</span>
                <span className="text-[15px] font-semibold leading-snug">{rest.join(", ")}</span>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

function Checklist({
  all,
  selected,
  mode,
  emptyLabel,
  compact = false,
}: {
  all: string[];
  selected: string[];
  // "only-in"  → só os que vão (pastel pequeno; sempre poucos)
  // "smart"    → adapta: maioria vai → mostra "menos X"; minoria → mostra os que vão
  // "all"      → todos com ✓/✗ (legado, mantido por compat)
  mode: "all" | "only-in" | "smart";
  emptyLabel: string;
  compact?: boolean;
}) {
  const selectedSet = new Set(selected);
  const inItems = all.filter((n) => selectedSet.has(n));

  if (mode === "only-in") {
    if (inItems.length === 0) {
      return <div className="text-sm text-ink-3 italic">{emptyLabel}</div>;
    }
    return (
      <ul className="flex flex-col gap-1">
        {inItems.map((n) => (
          <li key={n} className="flex items-center gap-2">
            <CheckIcon />
            <span className={`${compact ? "text-sm" : "text-base"} font-bold text-ink`}>{n}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (mode === "smart") {
    // Regra pura em lib/kitchen-display.ts (testada). Aqui só renderiza.
    const display = summarizeChecklist(all, selected);
    if (display.kind === "empty") {
      return <div className="text-sm text-ink-3 italic">{emptyLabel}</div>;
    }
    if (display.kind === "all") {
      return (
        <div className="flex items-center gap-2">
          <CheckIcon />
          <span className={`${compact ? "text-sm" : "text-base"} font-bold text-ink`}>
            Tudo ({display.total})
          </span>
        </div>
      );
    }
    // Maioria vai (faltam poucos) → mostra só os que NÃO vão, em destaque.
    // "Esquecer de NÃO pôr" é o erro caro (cozinha põe sem querer), então
    // os "menos X" ganham peso visual — laranja de atenção (não vermelho
    // sólido, que fica reservado pros modificadores manuais "sem X").
    if (display.kind === "most-going") {
      return (
        <div className="rounded-sm bg-[#FFF4C2] px-2.5 py-1.5">
          <div className={`${compact ? "text-[10px]" : "t-label"} uppercase tracking-[0.06em] text-[#8a5a00] mb-1`}>
            Vai tudo, menos:
          </div>
          <ul className="flex flex-wrap gap-x-3 gap-y-0.5">
            {display.missing.map((n) => (
              <li key={n} className="flex items-center gap-1.5">
                <X size={compact ? 14 : 16} strokeWidth={3} className="shrink-0 text-brand-orange" />
                <span className={`${compact ? "text-[13px]" : "text-[15px]"} font-bold text-[#8a5a00]`}>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    // Minoria vai → mostra só os que vão (✓)
    return (
      <ul className="flex flex-col gap-1">
        {display.going.map((n) => (
          <li key={n} className="flex items-center gap-2">
            <CheckIcon />
            <span className={`${compact ? "text-sm" : "text-base"} font-bold text-ink`}>{n}</span>
          </li>
        ))}
      </ul>
    );
  }

  // Layout responsivo: 1 coluna em tablet portrait (sm e abaixo), 2 colunas
  // em landscape/TV (md+). Em portrait, nomes longos não quebram em 2 linhas
  // — altura previsível por linha. Audit P2 #16.
  const rows = Math.ceil(all.length / 2);
  const left = all.slice(0, rows);
  const right = all.slice(rows);

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-x-3 ${compact ? "gap-y-0.5" : "gap-y-1"}`}>
      {[left, right].map((col, i) => (
        <ul key={i} className="flex flex-col gap-1">
          {col.map((name) => {
            const isIn = selectedSet.has(name);
            return (
              <li key={name} className="flex items-center gap-2">
                {isIn ? <CheckIcon /> : <XIcon />}
                <span
                  className={`${compact ? "text-sm" : "text-base"} truncate ${
                    isIn ? "font-bold text-ink" : "font-medium text-ink-3 line-through"
                  }`}
                >
                  {name}
                </span>
              </li>
            );
          })}
        </ul>
      ))}
    </div>
  );
}

function CheckIcon() {
  return <Check size={18} strokeWidth={3} className="shrink-0 text-status-ready" />;
}

function XIcon() {
  return <X size={18} strokeWidth={2.5} className="shrink-0 text-ink-3" />;
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center text-ink-3 py-20">
      <div className="opacity-40 mb-3 animate-empty-breathe">
        <PastelIcon size={96} className="md:w-32 md:h-32" />
      </div>
      <div className="t-h3 text-ink-2">Cozinha vazia.</div>
      <div className="t-body-sm mt-1">Quando entrar pedido, aparece aqui.</div>
    </div>
  );
}
