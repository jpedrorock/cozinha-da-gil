"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ChartBar,
  ChefHat,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Contact,
  CookingPot,
  History,
  Info,
  Keyboard,
  KeyRound,
  Lightbulb,
  ListOrdered,
  Plus,
  Rocket,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tag,
  TrendingUp,
  Users,
  UtensilsCrossed,
  Wifi,
  X,
  type LucideIcon,
} from "lucide-react";
import { BrandIcon } from "@/components/icons";
import { GUIDE, RULES, type GuideTab, type GuideSection } from "./guide-content";

// Mapeia nome do ícone (string no content) pro componente Lucide.
// Mantém content puro de data, sem dependência de React.
const ICONS: Record<string, LucideIcon> = {
  Activity,
  ChartBar,
  ChefHat,
  ClipboardList,
  Contact,
  CookingPot,
  History,
  Keyboard,
  KeyRound,
  ListOrdered,
  Plus,
  Search,
  Smartphone,
  Sparkles,
  Tag,
  TrendingUp,
  Users,
  UtensilsCrossed,
  Wifi,
};

function Icon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  const Cmp = ICONS[name];
  if (!Cmp) return null;
  return <Cmp size={size} strokeWidth={2} className={className} aria-hidden />;
}

// Cor por papel — usa tokens do brand. Mapeia identidade visual sem
// inventar paleta multicolor que não combina com app de barraca.
//   geral → ink (neutro/autoridade)
//   atendente → yellow (calmo, ação contínua)
//   cozinha → orange (urgência, ação reativa)
//   admin → ink (gestão, autoridade)
const TAB_THEMES: Record<
  GuideTab["id"],
  {
    /** Cor de destaque do hero da tab */
    accent: string;
    /** Background gradient do card category (top-left → bottom-right) */
    cardGradient: string;
    /** Background do ícone circular dentro do card */
    iconBg: string;
    /** Cor do texto do ícone */
    iconText: string;
    /** Border do card */
    cardBorder: string;
    /** Ring quando ativo */
    activeRing: string;
  }
> = {
  geral: {
    accent: "text-ink",
    cardGradient: "from-surface-elevated to-surface-sunken/40",
    iconBg: "bg-gradient-to-br from-ink to-ink-2",
    iconText: "text-white",
    cardBorder: "border-line hover:border-ink-3",
    activeRing: "border-ink",
  },
  atendente: {
    accent: "text-brand-orange",
    cardGradient: "from-brand-yellow-soft to-surface-elevated",
    iconBg: "bg-gradient-to-br from-brand-yellow to-brand-orange",
    iconText: "text-ink",
    cardBorder: "border-brand-yellow/40 hover:border-brand-orange",
    activeRing: "border-brand-orange",
  },
  cozinha: {
    accent: "text-brand-orange",
    cardGradient: "from-brand-orange/10 to-surface-elevated",
    iconBg: "bg-gradient-to-br from-brand-orange to-danger",
    iconText: "text-white",
    cardBorder: "border-brand-orange/30 hover:border-brand-orange",
    activeRing: "border-brand-orange",
  },
  admin: {
    accent: "text-ink",
    cardGradient: "from-surface-sunken/60 to-surface-elevated",
    iconBg: "bg-gradient-to-br from-ink-2 to-ink",
    iconText: "text-white",
    cardBorder: "border-line-strong hover:border-ink",
    activeRing: "border-ink",
  },
};

export function GuiaClient() {
  const [activeTab, setActiveTab] = useState<GuideTab["id"]>("geral");
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const currentTab = GUIDE.find((t) => t.id === activeTab)!;
  const theme = TAB_THEMES[activeTab];

  // Busca filtra seções e tópicos. Match case-insensitive em title/body/tips/rules.
  // Quando busca ativa, todas as seções da tab atual abrem automaticamente.
  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return currentTab.sections;
    return currentTab.sections
      .map((sec) => {
        const titleMatch =
          sec.title.toLowerCase().includes(q) ||
          sec.description.toLowerCase().includes(q);
        const topicMatches = sec.topics.filter((t) => {
          const inTitle = t.title.toLowerCase().includes(q);
          const inBody = t.body.toLowerCase().includes(q);
          const inTips = t.tips?.some((tip) => tip.toLowerCase().includes(q)) ?? false;
          const inRules = t.rules?.some((r) => r.toLowerCase().includes(q)) ?? false;
          return inTitle || inBody || inTips || inRules;
        });
        if (titleMatch || topicMatches.length > 0) {
          return { ...sec, topics: titleMatch ? sec.topics : topicMatches };
        }
        return null;
      })
      .filter((s): s is GuideSection => s !== null);
  }, [currentTab, search]);

  // Quando muda de tab, fecha tudo pra começar fresh
  function handleTabChange(id: GuideTab["id"]) {
    setActiveTab(id);
    setOpenSection(null);
    setSearch("");
  }

  // Heurística rápida pra mostrar "X min" estimado por seção.
  // ~30s por tópico simples + 15s por bullet adicional. Aproximação útil.
  function estimateReadMin(sec: GuideSection): number {
    const seconds = sec.topics.reduce((acc, t) => {
      const bullets = (t.tips?.length ?? 0) + (t.rules?.length ?? 0);
      return acc + 30 + bullets * 15 + Math.floor(t.body.length / 30);
    }, 0);
    return Math.max(1, Math.round(seconds / 60));
  }

  return (
    <div
      className="min-h-dvh bg-surface flex flex-col"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* === Header sticky === */}
      <header className="sticky top-0 z-30 bg-surface-elevated/95 backdrop-blur border-b border-line">
        <div className="flex items-center gap-3 px-4 md:px-6 h-16 max-w-5xl mx-auto w-full">
          <Link
            href="/"
            className="inline-flex items-center justify-center w-10 h-10 -ml-2 rounded-md text-ink-2 hover:text-ink hover:bg-surface-sunken transition"
            aria-label="Voltar pra tela inicial"
            title="Voltar"
          >
            <ArrowLeft size={20} strokeWidth={2.5} />
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <BrandIcon size={32} />
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-3">
                Guia
              </span>
              <span className="text-base font-extrabold -tracking-[0.01em] truncate">
                Como usar o app
              </span>
            </div>
          </div>
        </div>

        {/* === Tabs por papel === */}
        <nav
          className="border-t border-line bg-surface overflow-x-auto"
          aria-label="Categorias do guia"
        >
          <div className="flex max-w-5xl mx-auto">
            {GUIDE.map((t) => {
              const active = t.id === activeTab;
              const tabTheme = TAB_THEMES[t.id];
              return (
                <button
                  key={t.id}
                  onClick={() => handleTabChange(t.id)}
                  className={`flex-1 min-w-[88px] flex items-center justify-center gap-1.5 px-3 py-3 text-sm font-semibold border-b-2 transition-colors ${
                    active
                      ? `${tabTheme.accent} bg-surface-elevated`
                      : "border-transparent text-ink-3 hover:text-ink hover:bg-surface-sunken"
                  }`}
                  style={{
                    borderBottomColor: active ? "currentColor" : "transparent",
                  }}
                  aria-pressed={active}
                >
                  <Icon name={t.icon} size={16} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* === Hero da tab ativa === */}
      <section className="px-4 md:px-6 pt-6 max-w-5xl mx-auto w-full">
        <div
          className={`relative overflow-hidden rounded-2xl border ${theme.cardBorder} bg-gradient-to-br ${theme.cardGradient} p-5 md:p-7`}
        >
          {/* Blob de luz no canto pra dar profundidade */}
          <div
            className="absolute -top-12 -right-12 w-44 h-44 bg-brand-yellow/30 blur-3xl rounded-full pointer-events-none"
            aria-hidden
          />
          <div className="relative flex items-start gap-4">
            <div
              className={`shrink-0 w-14 h-14 rounded-xl ${theme.iconBg} ${theme.iconText} inline-flex items-center justify-center shadow-md`}
            >
              <Icon name={currentTab.icon} size={28} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-3 mb-1">
                Guia · {currentTab.label}
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold -tracking-[0.015em] mb-1 text-ink">
                {tabHeroTitle(activeTab)}
              </h1>
              <p className="t-body-sm text-ink-2 max-w-2xl">
                {tabHeroSubtitle(activeTab)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* === Main content === */}
      <main className="flex-1 px-4 md:px-6 py-6 max-w-5xl mx-auto w-full">
        {/* Busca */}
        <div className="relative mb-5">
          <Search
            size={18}
            strokeWidth={2.25}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Buscar em ${currentTab.label.toLowerCase()}…`}
            className="input pl-10 pr-10 h-11"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 inline-flex items-center justify-center rounded-md text-ink-3 hover:text-ink hover:bg-surface-sunken"
              aria-label="Limpar busca"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          )}
        </div>

        {/* === Grid de cards de seção === */}
        {filteredSections.length === 0 ? (
          <div className="card p-10 text-center">
            <Search size={40} strokeWidth={1.5} className="mx-auto mb-3 text-ink-3 opacity-40" />
            <div className="t-h3 text-ink-2">Nenhum tópico bate com &ldquo;{search}&rdquo;</div>
            <button
              onClick={() => setSearch("")}
              className="mt-3 text-sm font-semibold text-brand-orange hover:underline"
            >
              Limpar busca
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSections.map((sec) => {
              const isOpen = !!search.trim() || openSection === sec.id;
              const min = estimateReadMin(sec);
              return (
                <article
                  key={sec.id}
                  className={`group rounded-xl border-2 ${
                    isOpen ? theme.activeRing : theme.cardBorder
                  } bg-gradient-to-br ${theme.cardGradient} overflow-hidden transition-all md:col-span-${
                    isOpen ? "2" : "1"
                  } ${isOpen ? "shadow-lg" : "hover:shadow-md hover:-translate-y-0.5"}`}
                >
                  <button
                    onClick={() => setOpenSection(isOpen ? null : sec.id)}
                    className="w-full p-4 md:p-5 flex items-start gap-3 text-left"
                    aria-expanded={isOpen}
                    aria-controls={`sec-${sec.id}`}
                  >
                    <div
                      className={`shrink-0 w-12 h-12 rounded-xl ${theme.iconBg} ${theme.iconText} inline-flex items-center justify-center shadow-sm transition-transform group-hover:scale-105`}
                    >
                      <Icon name={sec.icon} size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="t-h3 mb-0.5 leading-tight">{sec.title}</h2>
                      <p className="t-body-sm text-ink-2 mb-2">
                        {sec.description}
                      </p>
                      <div className="flex items-center gap-3 t-caption text-ink-3">
                        <span className="inline-flex items-center gap-1">
                          <ListOrdered size={12} strokeWidth={2.5} aria-hidden />
                          {sec.topics.length} {sec.topics.length === 1 ? "tópico" : "tópicos"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock size={12} strokeWidth={2.5} aria-hidden />
                          ~{min} min
                        </span>
                      </div>
                    </div>
                    {isOpen ? (
                      <ChevronDown
                        size={20}
                        strokeWidth={2.5}
                        className="shrink-0 mt-1 text-ink-3"
                        aria-hidden
                      />
                    ) : (
                      <ChevronRight
                        size={20}
                        strokeWidth={2.5}
                        className="shrink-0 mt-1 text-ink-3 transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    )}
                  </button>

                  {isOpen && (
                    <div
                      id={`sec-${sec.id}`}
                      className="border-t border-line/60 px-4 md:px-6 py-5 bg-surface-elevated/80 flex flex-col gap-6"
                    >
                      {sec.topics.map((topic, tIdx) => (
                        <Step
                          key={tIdx}
                          index={tIdx + 1}
                          total={sec.topics.length}
                          title={topic.title}
                          body={topic.body}
                          tips={topic.tips}
                          rules={topic.rules}
                        />
                      ))}

                      {/* Related: aponta pra próxima seção da mesma tab */}
                      {!search.trim() && filteredSections.length > 1 && (
                        <RelatedSection
                          current={sec}
                          all={filteredSections}
                          theme={theme}
                          onPick={(id) => setOpenSection(id)}
                        />
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {/* === Bloco de Regras de Negócio (só na tab Geral) === */}
        {activeTab === "geral" && !search.trim() && (
          <div className="mt-10">
            <div className="flex items-center gap-2 mb-2 px-1">
              <ShieldCheck size={20} strokeWidth={2.25} className="text-brand-orange" aria-hidden />
              <h2 className="t-h2">Regras de negócio</h2>
            </div>
            <p className="t-body-sm text-ink-2 mb-4 px-1">
              Lógicas importantes do backend que afetam todo mundo.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {RULES.map((rule, idx) => (
                <article
                  key={idx}
                  className="rounded-xl border border-line bg-gradient-to-br from-surface-elevated to-surface-sunken/40 p-4 border-l-4 border-l-brand-orange"
                >
                  <h3 className="font-bold text-ink text-[15px] mb-1.5 leading-tight">
                    {rule.title}
                  </h3>
                  <p className="t-body-sm leading-relaxed text-ink-2">{rule.body}</p>
                </article>
              ))}
            </div>
          </div>
        )}

        {/* === CTA final === */}
        <footer className="mt-12 mb-4 pt-6 border-t border-line text-center">
          <div className="inline-flex flex-col items-center gap-2">
            <Rocket
              size={24}
              strokeWidth={2}
              className="text-brand-orange"
              aria-hidden
            />
            <p className="t-body-sm text-ink-2 max-w-md">
              Esse guia atualiza junto com cada feature nova do app.
              <br />
              <span className="text-ink-3">Algo confuso? Avisa a Gil pra ajustar.</span>
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 mt-2 text-sm font-semibold text-ink-2 hover:text-ink"
            >
              <ArrowLeft size={14} strokeWidth={2.5} />
              Voltar pra tela inicial
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}

// ============================================================
//   Step — tópico numerado com timeline visual (linha vertical)
// ============================================================
function Step({
  index,
  total,
  title,
  body,
  tips,
  rules,
}: {
  index: number;
  total: number;
  title: string;
  body: string;
  tips?: string[];
  rules?: string[];
}) {
  const isLast = index === total;
  return (
    <div className="relative pl-10">
      {/* Bolinha numerada */}
      <div className="absolute left-0 top-0 w-7 h-7 rounded-full bg-brand-yellow text-ink inline-flex items-center justify-center font-extrabold text-sm t-num shadow-sm">
        {index}
      </div>
      {/* Linha vertical conectora (some no último) */}
      {!isLast && (
        <div
          className="absolute left-[13px] top-7 bottom-0 w-px bg-line-strong/60"
          aria-hidden
        />
      )}
      <div className="flex flex-col gap-2 pb-2">
        <h3 className="font-bold text-ink text-[15px] leading-tight pt-0.5">
          {title}
        </h3>
        <p className="t-body-sm leading-relaxed text-ink-2">{body}</p>
        {tips && tips.length > 0 && (
          <Callout kind="tip">
            {tips.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </Callout>
        )}
        {rules && rules.length > 0 && (
          <Callout kind="rule">
            {rules.map((rule, i) => (
              <li key={i}>{rule}</li>
            ))}
          </Callout>
        )}
      </div>
    </div>
  );
}

// ============================================================
//   Callout — boxes coloridos pra dicas, regras, info
// ============================================================
function Callout({
  kind,
  children,
}: {
  kind: "tip" | "rule" | "info";
  children: React.ReactNode;
}) {
  const config = {
    tip: {
      Icon: Lightbulb,
      bg: "bg-brand-yellow-soft/60",
      border: "border-brand-orange/40",
      iconColor: "text-brand-orange",
      label: "Truque",
    },
    rule: {
      Icon: AlertCircle,
      bg: "bg-danger-bg/60",
      border: "border-danger/40",
      iconColor: "text-danger",
      label: "Atenção",
    },
    info: {
      Icon: Info,
      bg: "bg-surface-sunken/60",
      border: "border-ink-3/30",
      iconColor: "text-ink-2",
      label: "Saiba",
    },
  }[kind];
  const { Icon: IconCmp, bg, border, iconColor, label } = config;
  return (
    <div className={`rounded-lg border ${border} ${bg} px-3 py-2.5 mt-1`}>
      <div className={`flex items-center gap-1.5 mb-1 ${iconColor}`}>
        <IconCmp size={14} strokeWidth={2.5} aria-hidden />
        <span className="text-[10px] font-bold uppercase tracking-[0.08em]">
          {label}
        </span>
      </div>
      <ul className="flex flex-col gap-1 ml-0.5 list-none t-body-sm text-ink-2 leading-snug">
        {children}
      </ul>
    </div>
  );
}

// ============================================================
//   RelatedSection — empurra pro próximo tópico da mesma tab
// ============================================================
function RelatedSection({
  current,
  all,
  theme,
  onPick,
}: {
  current: GuideSection;
  all: GuideSection[];
  theme: (typeof TAB_THEMES)[GuideTab["id"]];
  onPick: (id: string) => void;
}) {
  const currentIdx = all.findIndex((s) => s.id === current.id);
  const next = all[(currentIdx + 1) % all.length];
  if (!next || next.id === current.id) return null;
  return (
    <div className="border-t border-line/40 pt-4 mt-2">
      <div className="t-label text-ink-3 mb-2">Próximo tópico</div>
      <button
        onClick={() => {
          onPick(next.id);
          // scrollIntoView no card-alvo via ID
          requestAnimationFrame(() => {
            document
              .getElementById(`sec-${next.id}`)
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          });
        }}
        className={`w-full text-left rounded-lg border ${theme.cardBorder} bg-surface-elevated p-3 flex items-center gap-3 hover:shadow-md transition-all group`}
      >
        <div
          className={`shrink-0 w-10 h-10 rounded-lg ${theme.iconBg} ${theme.iconText} inline-flex items-center justify-center`}
        >
          <Icon name={next.icon} size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[14px] text-ink truncate">
            {next.title}
          </div>
          <div className="t-caption truncate">{next.description}</div>
        </div>
        <ChevronRight
          size={18}
          strokeWidth={2.5}
          className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </button>
    </div>
  );
}

// ============================================================
//   Conteúdo do hero por tab — escrito inline pra ficar próximo
//   da estilização. Não vai pra guide-content.ts porque é só copy
//   de apresentação, não documentação técnica.
// ============================================================
function tabHeroTitle(id: GuideTab["id"]): string {
  switch (id) {
    case "geral":
      return "Aprende com a gente";
    case "atendente":
      return "Como anotar pedido direitinho";
    case "cozinha":
      return "Como receber e preparar";
    case "admin":
      return "Como Gil controla tudo";
  }
}

function tabHeroSubtitle(id: GuideTab["id"]): string {
  switch (id) {
    case "geral":
      return "Os primeiros passos: como entrar, instalar no celular e o que fazer quando a internet trava.";
    case "atendente":
      return "Passo-a-passo de cada coisa que você faz: anotar pedido, mudar item, avisar cliente que tá pronto.";
    case "cozinha":
      return "Receber, preparar no tempo certo, achar pedido rápido, ligar/desligar som de alarme.";
    case "admin":
      return "Vendas do dia, cardápio, clientes, histórico, promoções, funcionários. Tudo que Gil precisa.";
  }
}
