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
  ClipboardList,
  Contact,
  CookingPot,
  History,
  Keyboard,
  KeyRound,
  Lightbulb,
  ListOrdered,
  Plus,
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

export function GuiaClient() {
  const [activeTab, setActiveTab] = useState<GuideTab["id"]>("geral");
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const currentTab = GUIDE.find((t) => t.id === activeTab)!;

  // Busca filtra seções e tópicos. Match case-insensitive em title/body/tips/rules.
  // Quando busca ativa, todas as seções da tab atual abrem automaticamente.
  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return currentTab.sections;
    return currentTab.sections
      .map((sec) => {
        const titleMatch = sec.title.toLowerCase().includes(q) ||
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

  return (
    <div
      className="min-h-dvh bg-surface flex flex-col"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* === Header próprio (sem AppHeader pra não exigir operador) === */}
      <header className="sticky top-0 z-30 bg-surface-elevated border-b border-line">
        <div className="flex items-center gap-3 px-4 md:px-6 h-16 max-w-4xl mx-auto w-full">
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
          <div className="flex max-w-4xl mx-auto">
            {GUIDE.map((t) => {
              const active = t.id === activeTab;
              return (
                <button
                  key={t.id}
                  onClick={() => handleTabChange(t.id)}
                  className={`flex-1 min-w-[88px] flex items-center justify-center gap-1.5 px-3 py-3 text-sm font-semibold border-b-2 transition-colors ${
                    active
                      ? "border-brand-orange text-brand-orange bg-brand-orange/5"
                      : "border-transparent text-ink-3 hover:text-ink hover:bg-surface-sunken"
                  }`}
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

      {/* === Main content === */}
      <main className="flex-1 px-4 md:px-6 py-6 max-w-4xl mx-auto w-full">
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

        {/* Lista de seções (cards expansíveis) */}
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
          <div className="flex flex-col gap-3">
            {filteredSections.map((sec) => {
              // Com busca ativa, todas abertas. Sem busca, controle manual.
              const isOpen = !!search.trim() || openSection === sec.id;
              return (
                <article
                  key={sec.id}
                  className="card overflow-hidden transition-shadow hover:shadow-md"
                >
                  <button
                    onClick={() => setOpenSection(isOpen ? null : sec.id)}
                    className="w-full px-4 py-4 flex items-start gap-3 text-left hover:bg-surface-sunken/40 transition-colors"
                    aria-expanded={isOpen}
                    aria-controls={`sec-${sec.id}`}
                  >
                    <div className="shrink-0 w-10 h-10 rounded-full bg-brand-yellow inline-flex items-center justify-center text-ink">
                      <Icon name={sec.icon} size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="t-h3 mb-0.5">{sec.title}</h2>
                      <p className="t-body-sm text-ink-2">{sec.description}</p>
                    </div>
                    <ChevronDown
                      size={20}
                      strokeWidth={2.5}
                      className={`shrink-0 mt-1 text-ink-3 transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                      aria-hidden
                    />
                  </button>

                  {isOpen && (
                    <div
                      id={`sec-${sec.id}`}
                      className="border-t border-line px-4 py-4 flex flex-col gap-5 bg-surface-sunken/30"
                    >
                      {sec.topics.map((topic, idx) => (
                        <div key={idx} className="flex flex-col gap-2">
                          <h3 className="font-bold text-ink text-[15px] leading-tight">
                            {topic.title}
                          </h3>
                          <p className="t-body-sm leading-relaxed text-ink-2">
                            {topic.body}
                          </p>
                          {topic.tips && topic.tips.length > 0 && (
                            <ul className="flex flex-col gap-1 mt-1">
                              {topic.tips.map((tip, i) => (
                                <li key={i} className="flex items-start gap-2 t-body-sm text-ink-2">
                                  <Lightbulb
                                    size={14}
                                    strokeWidth={2.5}
                                    className="shrink-0 mt-0.5 text-brand-orange"
                                    aria-hidden
                                  />
                                  <span>{tip}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                          {topic.rules && topic.rules.length > 0 && (
                            <ul className="flex flex-col gap-1 mt-1 bg-danger-bg/40 border-l-2 border-danger rounded-r-md px-3 py-2">
                              {topic.rules.map((rule, i) => (
                                <li key={i} className="flex items-start gap-2 t-body-sm text-ink">
                                  <AlertCircle
                                    size={14}
                                    strokeWidth={2.5}
                                    className="shrink-0 mt-0.5 text-danger"
                                    aria-hidden
                                  />
                                  <span>{rule}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {/* === Bloco de Regras de Negócio (só na tab Geral) === */}
        {activeTab === "geral" && !search.trim() && (
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-4 px-1">
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
                  className="card p-4 border-l-4 border-brand-orange"
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

        {/* === Footer com versão / link pra voltar === */}
        <footer className="mt-12 mb-4 pt-6 border-t border-line text-center">
          <p className="t-caption text-ink-3 mb-2">
            Sempre que rolar feature nova, esse guia atualiza junto.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink"
          >
            <ArrowLeft size={14} strokeWidth={2.5} />
            Voltar pra tela inicial
          </Link>
        </footer>
      </main>
    </div>
  );
}
