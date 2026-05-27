"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Trash2, Upload, X } from "lucide-react";
import { Icon } from "@iconify/react";
import { useEscapeKey } from "@/lib/use-escape-key";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { ICON_CATEGORIES, translateForIconSearch } from "@/lib/ingredient-i18n";

// Tamanho máximo de upload (~512KB). SVG raramente passa de 50KB; PNG
// pode subir mas se vier > 512KB é provável que seja arquivo errado.
const MAX_UPLOAD_BYTES = 512 * 1024;

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
  const [mode, setMode] = useState<"search" | "upload">("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  // Termo realmente enviado pra API (após tradução PT→EN). Quando difere
  // do `query` mostramos um hint pra Gil saber que traduzimos.
  const [translated, setTranslated] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState(false);
  // navigator.onLine pode ser false já ao abrir (barraca sem wifi)
  const [isOffline, setIsOffline] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Upload: preview do data URI antes de confirmar; mensagem de erro
  // (tamanho/tipo) se inválido. Saving = true enquanto chamada server roda.
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEscapeKey(onClose, open);
  useBodyScrollLock(open);

  // Detecta online/offline em tempo real
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOffline(!window.navigator.onLine);
    const goOnline = () => { setIsOffline(false); setNetworkError(false); };
    const goOffline = () => setIsOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Reset state ao abrir
  useEffect(() => {
    if (open) {
      setMode("search");
      setQuery(suggestion ?? "");
      setResults([]);
      setNetworkError(false);
      setUploadPreview(null);
      setUploadError(null);
      // foco no input depois do render
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, suggestion]);

  /** Lê arquivo SVG/PNG, valida, devolve data URI ou seta erro. */
  function handleFile(file: File) {
    setUploadError(null);
    if (!/^image\/(svg\+xml|png)$/.test(file.type)) {
      setUploadError("Aceito só SVG ou PNG.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError(`Arquivo muito grande (${(file.size / 1024).toFixed(0)} KB) — máx 512 KB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") setUploadPreview(result);
    };
    reader.onerror = () => setUploadError("Falha ao ler o arquivo.");
    reader.readAsDataURL(file);
  }

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
    if (isOffline) return;
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
          setNetworkError(false);
          setLoading(false);
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            setNetworkError(true);
            setLoading(false);
          }
        });
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, open, isOffline]);

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
              {mode === "search"
                ? "Buscar em ~200 mil ícones (Material, Phosphor, Twemoji, Fluent…)"
                : "Subir SVG ou PNG próprio do seu computador"}
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

        {/* Tabs entre buscar Iconify e subir arquivo próprio. */}
        <div className="px-4 pt-3 flex gap-1 border-b border-line" role="tablist" aria-label="Modo de escolha de ícone">
          <button
            role="tab"
            aria-selected={mode === "search"}
            onClick={() => setMode("search")}
            className={`px-4 h-9 -mb-[1px] border-b-2 text-sm font-semibold transition-colors ${
              mode === "search"
                ? "border-ink text-ink"
                : "border-transparent text-ink-3 hover:text-ink"
            }`}
          >
            <Search size={14} strokeWidth={2.5} className="inline mr-1.5 -mt-0.5" />
            Buscar ícone
          </button>
          <button
            role="tab"
            aria-selected={mode === "upload"}
            onClick={() => setMode("upload")}
            className={`px-4 h-9 -mb-[1px] border-b-2 text-sm font-semibold transition-colors ${
              mode === "upload"
                ? "border-ink text-ink"
                : "border-transparent text-ink-3 hover:text-ink"
            }`}
          >
            <Upload size={14} strokeWidth={2.5} className="inline mr-1.5 -mt-0.5" />
            Subir arquivo
          </button>
        </div>

        {mode === "search" ? (
        <>
        {(isOffline || networkError) && (
          <div className="mx-4 mt-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <span className="shrink-0 font-bold">Sem internet</span>
            <span>— só dá pra subir SVG/PNG ou usar ícone já escolhido.</span>
            <button
              type="button"
              onClick={() => setMode("upload")}
              className="ml-auto shrink-0 font-bold underline hover:no-underline"
            >
              Subir arquivo
            </button>
          </div>
        )}
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
              disabled={isOffline || networkError}
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
                        Mostrando ícones de <span className="font-semibold">&ldquo;{translated}&rdquo;</span>
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
        </>
        ) : (
          // === MODO UPLOAD ===
          // Drop zone + file input. Preview do data URI ao escolher.
          // Confirmação ("Usar esse ícone") chama onSelect com o data URI;
          // backend reconhece o prefixo "data:" e salva no filesystem.
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleFile(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`relative rounded-lg border-2 border-dashed p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
                dragOver
                  ? "border-brand-yellow bg-[#FFFCE5]"
                  : "border-line-strong hover:border-ink-3 bg-surface"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".svg,.png,image/svg+xml,image/png"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  // Reseta o input pra permitir re-selecionar o mesmo arquivo
                  e.target.value = "";
                }}
              />
              <Upload size={28} strokeWidth={2} className="text-ink-3" />
              <div className="text-center">
                <div className="text-sm font-semibold text-ink">
                  Arraste o arquivo aqui ou clique pra escolher
                </div>
                <div className="text-[11px] text-ink-3 mt-1">
                  SVG ou PNG até 512&nbsp;KB
                </div>
              </div>
            </div>

            {uploadError && (
              <div className="text-sm text-danger font-semibold bg-danger/10 px-3 py-2 rounded-md">
                {uploadError}
              </div>
            )}

            {uploadPreview && (
              <div className="rounded-md border border-line bg-surface-elevated p-4 flex items-center gap-4">
                <div className="shrink-0 w-16 h-16 rounded-md border border-line bg-surface flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={uploadPreview}
                    alt="Pré-visualização"
                    style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink">
                    Pronto pra usar
                  </div>
                  <div className="text-[11px] text-ink-3">
                    Vai ser salvo no servidor com hash do conteúdo.
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (uploadPreview) {
                      onSelect(uploadPreview);
                      onClose();
                    }
                  }}
                  className="shrink-0 inline-flex items-center justify-center h-10 px-4 rounded-md bg-brand-yellow text-ink font-bold text-sm hover:bg-brand-yellow-hover active:scale-[0.98]"
                >
                  Usar
                </button>
              </div>
            )}
          </div>
        )}

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
