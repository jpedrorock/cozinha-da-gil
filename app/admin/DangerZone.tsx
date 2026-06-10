"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, ShieldOff, X } from "lucide-react";
import { useEscapeKey } from "@/lib/use-escape-key";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
// Focus trap vem com o merge do PR #41 (a11y bundle). Por enquanto modal
// fica sem ele — ESC + click no backdrop já fecham, mas usuário de teclado
// pode tabular pro conteúdo de trás. Aceitável pra Zona de Perigo
// (caso de uso raro) até o hook ficar disponível.

const CONFIRM_PHRASE = "APAGAR TUDO NA COZINHA DA GIL";
// Cooldown depois de expandir e ANTES do botão "Apagar..." ficar clicável.
// 3 segundos é tempo o suficiente pra Gil ler o aviso e ainda curto pra
// não exasperar quando intencional.
const COOLDOWN_MS = 3000;

type Preview = {
  orders: number;
  orderItems: number;
  events: number;
  broadcastLogs: number;
  preserves: {
    products: number;
    ingredients: number;
    users: number;
    customers: number;
  };
};

/**
 * "Zona de Perigo" — bloco escondido no fim de uma aba admin pra apagar
 * TODOS os dados operacionais (pedidos, items, eventos, broadcasts) e
 * recomeçar do zero. Mantém cardápio + usuários + clientes + config PIX.
 *
 * UX defensiva por camadas:
 *   1. Bloco colapsado por default — precisa expandir
 *   2. Botão "Apagar..." tem cooldown 3s após expandir
 *   3. Click abre modal com aviso enorme + contagens
 *   4. Modal pede frase EXATA "APAGAR TUDO NA COZINHA DA GIL"
 *   5. Botão final só habilita quando frase bate
 *   6. Backend valida frase de novo (defesa em camadas)
 *   7. Backup automático do dev.db ANTES do delete (recuperável)
 */
export function DangerZone() {
  const [expanded, setExpanded] = useState(false);
  const [cooldownDone, setCooldownDone] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    backupPath: string;
    deleted: Preview;
  } | null>(null);

  // Fetch preview ao expandir (1 vez).
  useEffect(() => {
    if (!expanded || preview || loading) return;
    setLoading(true);
    fetch("/api/admin/danger-zone/preview", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => setPreview(d as Preview))
      .catch((err) => setError(err instanceof Error ? err.message : "Falha"))
      .finally(() => setLoading(false));
  }, [expanded, preview, loading]);

  // Cooldown ao expandir — botão fica disabled até X ms passarem.
  useEffect(() => {
    if (!expanded) {
      setCooldownDone(false);
      return;
    }
    const t = setTimeout(() => setCooldownDone(true), COOLDOWN_MS);
    return () => clearTimeout(t);
  }, [expanded]);

  useEscapeKey(() => setModalOpen(false), modalOpen);
  useBodyScrollLock(modalOpen);

  function openModal() {
    setPhrase("");
    setError(null);
    setModalOpen(true);
  }

  async function submitWipe() {
    if (phrase !== CONFIRM_PHRASE || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/danger-zone/wipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmPhrase: phrase }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Falha ao apagar.");
        return;
      }
      setSuccess({
        backupPath: data.backupPath,
        deleted: { ...preview!, ...data.deleted },
      });
      setModalOpen(false);
      // Recarrega preview pra mostrar zeros agora
      setPreview(null);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha de rede.");
    } finally {
      setSubmitting(false);
    }
  }

  const phraseMatches = phrase === CONFIRM_PHRASE;

  return (
    <section className="mt-12 pt-6 border-t border-line">
      {/* Header colapsável — texto vermelho discreto, sem fundo destacado
          pra não chamar atenção indevida em uso normal. */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-2 text-sm font-semibold text-danger hover:underline"
        aria-expanded={expanded}
      >
        <ShieldOff size={16} strokeWidth={2.5} />
        <span>Zona de Perigo</span>
        {expanded ? (
          <ChevronUp size={14} strokeWidth={2.5} />
        ) : (
          <ChevronDown size={14} strokeWidth={2.5} />
        )}
      </button>

      {expanded && (
        <div className="mt-4 rounded-lg border-2 border-danger bg-danger-bg p-5 flex flex-col gap-4 animate-fade-in">
          <header className="flex items-start gap-3">
            <AlertTriangle
              size={28}
              strokeWidth={2.5}
              className="shrink-0 text-danger"
            />
            <div>
              <h3 className="t-h2 text-danger">Apagar TODOS os dados de operação</h3>
              <p className="t-body-sm mt-1 text-ink-2">
                Isso apaga pedidos, items, eventos de caixa e logs de aviso ao cliente.
                <strong> Não dá pra desfazer pelo app</strong> — só pelo backup automático que
                a gente faz antes (você pode pedir restauração ao Claude se errar).
              </p>
            </div>
          </header>

          {/* Preview de contagens */}
          {loading && (
            <div className="text-sm text-ink-2 inline-flex items-center gap-2">
              <Loader2 size={14} strokeWidth={2.5} className="animate-spin" />
              <span>Contando o que vai apagar…</span>
            </div>
          )}
          {error && !modalOpen && !success && (
            <div className="text-sm font-semibold text-danger">{error}</div>
          )}
          {preview && (
            <div className="grid grid-cols-2 gap-3">
              <Counter label="Pedidos" value={preview.orders} kind="delete" />
              <Counter label="Items de pedido" value={preview.orderItems} kind="delete" />
              <Counter label="Eventos de caixa" value={preview.events} kind="delete" />
              <Counter label="Logs broadcast" value={preview.broadcastLogs} kind="delete" />
            </div>
          )}

          {/* O que NÃO vai mexer — pra Gil saber que cardápio fica */}
          {preview && (
            <details className="text-xs text-ink-2">
              <summary className="cursor-pointer font-semibold">
                O que <strong>NÃO</strong> vai apagar
              </summary>
              <ul className="mt-2 list-disc pl-5 leading-relaxed">
                <li>Cardápio: {preview.preserves.products} produtos + {preview.preserves.ingredients} ingredientes</li>
                <li>Usuários cadastrados ({preview.preserves.users})</li>
                <li>Base de clientes do CRM ({preview.preserves.customers})</li>
                <li>Config PIX (se tiver chave cadastrada)</li>
                <li>Promoções cadastradas</li>
              </ul>
            </details>
          )}

          <button
            onClick={openModal}
            disabled={!cooldownDone || !preview || loading}
            className="btn btn-danger w-full disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {!cooldownDone ? (
              <>
                <Loader2 size={16} strokeWidth={2.5} className="animate-spin" />
                Aguarde…
              </>
            ) : (
              <>
                <AlertTriangle size={16} strokeWidth={2.5} />
                Apagar tudo isso
              </>
            )}
          </button>
        </div>
      )}

      {/* Modal de confirmação por frase */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[100] bg-ink/50 backdrop-blur-[3px] flex items-center justify-center p-4 animate-fade-in"
          onClick={() => !submitting && setModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="wipe-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-surface-elevated rounded-xl shadow-2xl p-5 animate-sheet-up flex flex-col gap-4"
          >
            <header className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-full bg-danger-bg text-danger inline-flex items-center justify-center">
                <AlertTriangle size={20} strokeWidth={2.5} />
              </div>
              <div className="flex-1">
                <h2 id="wipe-title" className="t-h2 text-danger">Última confirmação</h2>
                <p className="t-body-sm mt-1">
                  Pra confirmar que você sabe o que tá fazendo, digite a frase abaixo
                  exatamente como aparece:
                </p>
              </div>
              <button
                onClick={() => !submitting && setModalOpen(false)}
                disabled={submitting}
                className="shrink-0 inline-flex items-center justify-center w-11 h-11 -mr-2 -mt-2 rounded-md text-ink-3 hover:text-ink hover:bg-surface-sunken disabled:opacity-50"
                aria-label="Fechar"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            </header>

            <div className="rounded-md bg-surface-sunken px-4 py-3 text-center font-mono font-bold text-ink select-all">
              {CONFIRM_PHRASE}
            </div>

            <label className="block">
              <span className="block t-label mb-1">Digite a frase exatamente</span>
              <input
                type="text"
                autoFocus
                value={phrase}
                onChange={(e) => {
                  setPhrase(e.target.value);
                  setError(null);
                }}
                disabled={submitting}
                placeholder={CONFIRM_PHRASE}
                className="input w-full font-mono"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
              />
            </label>

            {error && (
              <div className="text-sm font-semibold text-danger">{error}</div>
            )}

            <footer className="flex gap-2 mt-2">
              <button
                onClick={() => setModalOpen(false)}
                disabled={submitting}
                className="btn btn-ghost flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={submitWipe}
                disabled={!phraseMatches || submitting}
                className="btn btn-danger flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} strokeWidth={2.5} className="animate-spin" />
                    Apagando…
                  </>
                ) : (
                  "Apagar permanentemente"
                )}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Modal de sucesso pós-wipe — explícito sobre backup e contagens */}
      {success && (
        <div
          className="fixed inset-0 z-[100] bg-ink/50 backdrop-blur-[3px] flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSuccess(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-surface-elevated rounded-xl shadow-2xl p-5 animate-sheet-up flex flex-col gap-4"
          >
            <h2 className="t-h2">Dados apagados</h2>
            <div className="text-sm text-ink-2">
              Pronto. App tá zerado de operação.
            </div>
            <ul className="text-sm space-y-1 list-disc pl-5">
              <li>{success.deleted.orders} pedidos apagados</li>
              <li>{success.deleted.orderItems} items apagados</li>
              <li>{success.deleted.events} eventos apagados</li>
              <li>{success.deleted.broadcastLogs} logs apagados</li>
            </ul>
            <div className="rounded-md bg-surface-sunken p-3 text-xs">
              <div className="font-semibold mb-1">Backup criado em:</div>
              <code className="text-[11px] break-all">{success.backupPath}</code>
            </div>
            <button
              onClick={() => setSuccess(null)}
              className="btn btn-primary w-full"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Counter({
  label,
  value,
  kind,
}: {
  label: string;
  value: number;
  kind: "delete" | "keep";
}) {
  return (
    <div
      className={`rounded-md p-3 ${
        kind === "delete"
          ? "bg-danger/10 border border-danger/30"
          : "bg-surface-sunken border border-line"
      }`}
    >
      <div className="text-[10px] uppercase font-bold tracking-wide text-ink-3">
        {label}
      </div>
      <div
        className={`text-2xl font-extrabold tabular-nums mt-0.5 ${
          kind === "delete" ? "text-danger" : "text-ink-2"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
