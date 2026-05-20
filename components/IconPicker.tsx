"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Trash2, X } from "lucide-react";
import { Icon } from "@iconify/react";
import { useEscapeKey } from "@/lib/use-escape-key";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { ICON_CATEGORIES, translateForIconSearch } from "@/lib/ingredient-i18n";

type SearchResult = {
  icons: string[];
  total: number;
};

/**
 * IconPicker — escolhe ícone de qualquer biblioteca Iconify (~200k icons).
 * Busca via API pública `api.iconify.design/search` (sem auth).
 *
 * Uso: abre como modal; chama onSelect com `"prefix:name"` (ex `"mdi:food-drumstick"`).
 * onSelect(null) limpa o ícone atual.
 */
export function IconPicker({
  open,
  initial,
  suggestion,
  onClose,
  onSelect,
}: {
  open: boolean;
  initial: string | null;
  suggestion?: string; // termo inicial sugerido (nome do ingrediente)
  onClose: () => void;
  onSelect: (icon: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  // Termo realmente enviado pra API (após tradução PT→EN). Quando difere
  // do `query` mostramos um hint pra Gil saber que traduzimos.
  const [translated, setTranslated] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEscapeKey(onClose, open);
  useBodyScrollLock(open);

  // Reset state ao abrir
  useEffect(() => {
    if (open) {
      setQuery(suggestion ?? "");
      setResults([]);
      // foco no input depois do render
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, suggestion]);

  // Busca debounced — traduz PT→EN antes de chamar a API
  useEffect(() => {
    if (!open) return;
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setTotal(0);
      setTranslated(null);
      return;
    }
    const { translated: en, source } = translateForIconSearch(term);
    setTranslated(source === "dict" && en.toLowerCase() !== term.toLowerCase() ? en : null);
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      // Iconify search API — sem auth, free, ~200k icons agregados
      fetch(`https://api.iconify.design/search?query=${encodeURIComponent(en)}&limit=64`, {
        signal: ctrl.signal,
      })
        .then((r) => r.json() as Promise<SearchResult>)
        .then((data) => {
          setResults(data.icons ?? []);
          setTotal(data.total ?? 0);
          setLoading(false);
        })
        .catch((err) => {
          if (err.name !== "AbortError") setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-[3px] flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Escolher ícone"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[80dvh] bg-surface-elevated rounded-xl shadow-xl flex flex-col animate-sheet-up"
      >
        <header className="flex items-center justify-between p-4 border-b border-line">
          <div>
            <h2 className="text-lg font-extrabold leading-none">Escolher ícone</h2>
            <p className="text-xs text-ink-3 mt-1">
              Buscar em ~200 mil ícones (Material, Phosphor, Twemoji, Fluent…)
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 inline-flex items-center justify-center w-11 h-11 -mr-2 rounded-md text-ink-3 hover:text-ink hover:bg-surface-sunken"
            aria-label="Fechar"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </header>

        <div className="p-4 border-b border-line">
          <div className="relative">
            <Search
              size={18}
              strokeWidth={2.25}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none"
            />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ex: frango, bacon, queijo, pizza…"
              className="input h-11 text-base pl-10"
            />
          </div>
          {/* Chips de categorias — clicar preenche o campo de busca.
              Útil quando Gil não sabe o que buscar. */}
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {ICON_CATEGORIES.map((cat) => (
              <button
                key={cat.label}
                onClick={() => setQuery(cat.label.toLowerCase())}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-line-strong text-ink-2 hover:border-ink-3 hover:bg-surface-sunken transition-colors"
                type="button"
              >
                {cat.label}
              </button>
            ))}
          </div>
          {query.trim().length >= 2 && (
            <div className="text-[11px] text-ink-3 mt-2">
              {loading
                ? translated
                  ? `Buscando "${translated}" (traduzido de "${query.trim()}")…`
                  : "Buscando…"
                : total === 0
                ? "Nenhum resultado. Tente outro termo."
                : (
                  <>
                    {translated && (
                      <span className="text-ink-2">
                        Mostrando ícones de <span className="font-semibold">"{translated}"</span>
                        {" · "}
                      </span>
                    )}
                    {`${total} resultado${total === 1 ? "" : "s"}${results.length < total ? ` · mostrando ${results.length}` : ""}`}
                  </>
                )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {results.length === 0 && !loading && query.trim().length < 2 && (
            <div className="text-center text-sm text-ink-3 py-12">
              Digite pelo menos 2 letras pra buscar.
              <br />
              <span className="text-[11px]">
                Dica: termos em inglês têm mais resultados.
              </span>
            </div>
          )}
          {results.length > 0 && (
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
              {results.map((id) => {
                const active = id === initial;
                return (
                  <button
                    key={id}
                    onClick={() => {
                      onSelect(id);
                      onClose();
                    }}
                    title={id}
                    className={`aspect-square rounded-md border flex items-center justify-center transition-colors ${
                      active
                        ? "bg-brand-yellow border-ink"
                        : "bg-surface border-line hover:border-ink-3 hover:bg-surface-sunken"
                    }`}
                  >
                    <Icon icon={id} width={28} height={28} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <footer className="p-4 border-t border-line flex items-center justify-between gap-2">
          {initial ? (
            <button
              onClick={() => {
                onSelect(null);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-danger hover:underline"
            >
              <Trash2 size={14} strokeWidth={2.5} />
              Remover ícone
            </button>
          ) : (
            <span />
          )}
          <button onClick={onClose} className="btn btn-secondary btn-sm">
            Cancelar
          </button>
        </footer>
      </div>
    </div>
  );
}
