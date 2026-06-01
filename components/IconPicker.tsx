"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Trash2, Upload, WifiOff, X } from "lucide-react";
import { Icon } from "@iconify/react";
import { useEscapeKey } from "@/lib/use-escape-key";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { useFocusTrap } from "@/lib/use-focus-trap";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Upload: preview do data URI antes de confirmar; mensagem de erro
  // (tamanho/tipo) se inválido. Saving = true enquanto chamada server roda.
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  // Status de rede + última falha de fetch. Quando offline (ou último
  // fetch falhou com erro de rede), a aba "Buscar ícone" vira read-only
  // com mensagem clara e auto-foca em "Subir arquivo". Iconify só
  // funciona online — a API + os pacotes de ícones vêm de api.iconify.design.
  // Em barraca wifi cai o tempo todo; sem esse fallback, IconPicker congela.
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [searchError, setSearchError] = useState<string | null>(null);

  useEscapeKey(onClose, open);
  useBodyScrollLock(open);
  const dialogRef = useFocusTrap(open);

  // Escuta eventos online/offline do browser pra refletir ao vivo
  // quando wifi vai e volta no meio do uso.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOnline = () => {
      setOnline(true);
      setSearchError(null); // limpa erro pra re-tentar busca
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Reset state ao abrir. Se está offline, default já é "upload" porque
  // a busca não vai funcionar; usuário não fica frustrado tentando.
  useEffect(() => {
    if (open) {
      setMode(online ? "search" : "upload");
      setQuery(suggestion ?? "");
      setResults([]);
      setUploadPreview(null);
      setUploadError(null);
      setSearchError(null);
      // foco no input depois do render
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, suggestion, online]);

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
    // Não tenta buscar se offline — banner já avisou.
    if (!online) {
      setResults([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setTotal(0);
      setTranslated(null);
      setSearchError(null);
      return;
    }
    const { translated: en, source } = translateForIconSearch(term);
    setTranslated(source === "dict" && en.toLowerCase() !== term.toLowerCase() ? en : null);
    setLoading(true);
    setSearchError(null);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      // Iconify search API — sem auth, free, ~200k icons agregados
      fetch(`https://api.iconify.design/search?query=${encodeURIComponent(en)}&limit=64`, {
        signal: ctrl.signal,
      })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json() as Promise<SearchResult>;
        })
        .then((data) => {
          setResults(data.icons ?? []);
          setTotal(data.total ?? 0);
          setLoading(false);
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            setLoading(false);
            // "fetch failed" / "NetworkError" / timeouts → trata como offline
            // (mesmo que navigator.onLine ainda esteja true — algumas redes
            // capturadas mantêm "online" mas bloqueiam saída).
            setSearchError(
              err instanceof Error ? err.message : "Falha de rede",
            );
          }
        });
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, open, online]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-[3px] flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
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
        {/* Banner offline / falha de rede — substitui input quando não
            tem como buscar. Empurra usuário pra aba "Subir arquivo" que
            funciona 100% local. Ícones já renderizados antes (cache HTTP
            do browser) continuam aparecendo nos chips do Cardápio. */}
        {(!online || searchError) && (
          <div className="p-4 border-b border-line">
            <div className="rounded-md border border-yellow-300 bg-yellow-50 text-ink p-4 flex items-start gap-3">
              <WifiOff size={20} strokeWidth={2.5} className="shrink-0 mt-0.5 text-yellow-700" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm mb-1">
                  {!online ? "Sem internet" : "Não consegui falar com a Iconify"}
                </div>
                <div className="text-xs text-ink-2 leading-snug">
                  A busca de ícones precisa de rede. Você ainda pode{" "}
                  <button
                    onClick={() => setMode("upload")}
                    className="underline font-semibold text-ink hover:text-ink-2"
                  >
                    subir um SVG ou PNG próprio
                  </button>
                  {" "}ou usar um ícone que já estava escolhido.
                </div>
                {searchError && online && (
                  <div className="text-[11px] text-ink-3 mt-1.5 font-mono">
                    {searchError}
                  </div>
                )}
              </div>
            </div>
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
              disabled={!online}
              className="input h-11 text-base pl-10 disabled:opacity-50 disabled:cursor-not-allowed"
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
