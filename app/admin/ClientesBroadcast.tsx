"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, MessageCircle, Send, SkipForward, X } from "lucide-react";
import type { Customer } from "@prisma/client";
import { formatPhoneDisplay } from "@/lib/orders";
import { buildWaUrl, templatePromo } from "@/lib/whatsapp-templates";
import { useOperator } from "@/lib/use-operator";
import { useConfirmDialog } from "@/components/ConfirmDialog";

type Phase = "compose" | "review" | "sending";
const DRAFT_KEY = "pdg:broadcast-draft";

export function ClientesBroadcast({ onBack }: { onBack: () => void }) {
  const { operator } = useOperator();
  const [phase, setPhase] = useState<Phase>("compose");
  const [message, setMessage] = useState("");
  const [recipients, setRecipients] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [campaignId] = useState(() => `c-${Date.now()}`);
  const [cursor, setCursor] = useState(0); // index do recipient atual no "sending"
  const { confirm, node: confirmNode } = useConfirmDialog();

  // Carrega clientes opt-in marketing
  useEffect(() => {
    fetch("/api/customers?filter=marketing")
      .then((r) => r.json())
      .then((data: Customer[]) => {
        setRecipients(data);
        // Default: todos selecionados
        setSelected(new Set(data.map((c) => c.id)));
        setLoading(false);
      });
  }, []);

  // Restaurar draft
  useEffect(() => {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) setMessage(draft);
  }, []);
  useEffect(() => {
    if (message) localStorage.setItem(DRAFT_KEY, message);
    else localStorage.removeItem(DRAFT_KEY);
  }, [message]);

  const selectedList = recipients.filter((c) => selected.has(c.id));

  function toggleAll() {
    if (selected.size === recipients.length) setSelected(new Set());
    else setSelected(new Set(recipients.map((c) => c.id)));
  }

  function startSending() {
    if (!message.trim() || selectedList.length === 0) return;
    setPhase("sending");
    setCursor(0);
  }

  function sendCurrent() {
    const c = selectedList[cursor];
    if (!c) return;
    const text = templatePromo(c.name, message.trim());
    window.open(buildWaUrl(c.phone, text), "_blank");
    // Log silencioso
    fetch(`/api/customers/${c.id}/broadcast-log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, campaignId, operator: operator?.name }),
    }).catch(() => {});
    advance();
  }

  function skip() {
    advance();
  }

  function advance() {
    if (cursor + 1 >= selectedList.length) {
      // Fim — voltar pra lista
      localStorage.removeItem(DRAFT_KEY);
      onBack();
      return;
    }
    setCursor(cursor + 1);
  }

  // === Fase: COMPOSE ===
  if (phase === "compose") {
    return (
      <div className="flex flex-col gap-5">
        <header className="flex items-center gap-3">
          <button onClick={onBack} className="text-ink-2 hover:text-ink">
            <ArrowLeft size={20} strokeWidth={2.25} />
          </button>
          <div>
            <h1 className="t-h1">Enviar promo</h1>
            <p className="t-body-sm">Pra clientes que aceitaram receber.</p>
          </div>
        </header>

        <div>
          <label className="t-label mb-1.5 block">Mensagem</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            placeholder="Ex: Promo de hoje: pastel grande pela metade do preço até as 20h!"
            className="textarea"
          />
          <p className="t-caption mt-1.5">
            Cada cliente recebe abertura: <span className="font-bold">Oi [primeiro nome]! 👋</span> e
            fechamento <span className="font-bold">— Cozinha da Gil</span>
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="t-label">Destinatários ({selectedList.length}/{recipients.length})</span>
            <button onClick={toggleAll} className="t-body-sm font-semibold text-ink-2 hover:text-ink">
              {selected.size === recipients.length ? "Desmarcar todos" : "Marcar todos"}
            </button>
          </div>
          {loading ? (
            <div className="t-body-sm text-ink-3 py-4 text-center">Carregando…</div>
          ) : recipients.length === 0 ? (
            <div className="card p-6 text-center">
              <div className="t-h2 mb-1">Ninguém deu opt-in pra marketing ainda</div>
              <p className="t-body-sm">
                Marque <span className="font-bold">opt-in marketing</span> no stepper do atendente
                ou no perfil do cliente.
              </p>
            </div>
          ) : (
            <ul className="border border-line rounded-md max-h-72 overflow-y-auto divide-y divide-line">
              {recipients.map((c) => {
                const checked = selected.has(c.id);
                return (
                  <li key={c.id}>
                    <label className="flex items-center gap-3 px-3 py-2 hover:bg-surface-sunken cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(c.id);
                          else next.delete(c.id);
                          setSelected(next);
                        }}
                        className="w-4 h-4 accent-brand-yellow"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="t-body-sm font-semibold truncate">{c.name}</div>
                        <div className="t-caption t-num">{formatPhoneDisplay(c.phone)}</div>
                      </div>
                      <div className="t-caption t-num shrink-0">
                        {c.totalOrders} {c.totalOrders === 1 ? "pedido" : "pedidos"}
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <button
          onClick={() => setPhase("review")}
          disabled={!message.trim() || selectedList.length === 0}
          className="btn btn-primary btn-lg w-full"
        >
          Revisar e enviar
          <ChevronRight size={18} strokeWidth={2.5} />
        </button>
      </div>
    );
  }

  // === Fase: REVIEW ===
  if (phase === "review") {
    const sample = selectedList[0];
    const preview = sample ? templatePromo(sample.name, message.trim()) : message.trim();
    return (
      <div className="flex flex-col gap-5">
        <header className="flex items-center gap-3">
          <button onClick={() => setPhase("compose")} className="text-ink-2 hover:text-ink">
            <ArrowLeft size={20} strokeWidth={2.25} />
          </button>
          <h1 className="t-h1">Revisar antes de enviar</h1>
        </header>

        <div className="card p-4">
          <div className="t-label mb-2">Preview (Cliente {sample?.name ?? "—"})</div>
          <pre className="t-body whitespace-pre-wrap font-sans bg-surface p-3 rounded-md border border-line">
            {preview}
          </pre>
        </div>

        <div className="card p-4 bg-status-preparing-bg border-status-preparing">
          <div className="t-h3 mb-1">⚠️ Como funciona</div>
          <ul className="t-body-sm flex flex-col gap-1 list-disc pl-5">
            <li>
              Próxima tela mostra <span className="font-bold">um cliente por vez</span>.
            </li>
            <li>
              Você clica <span className="font-bold">"Abrir WhatsApp"</span> → vai pro chat já com a
              mensagem digitada. Aí você revisa e dá ENVIAR no WhatsApp.
            </li>
            <li>
              Voltando aqui, clica <span className="font-bold">"Próximo"</span>.
            </li>
            <li>O app registra que abriu, mas não confirma se foi entregue.</li>
          </ul>
        </div>

        <button onClick={startSending} className="btn btn-primary btn-lg w-full">
          <Send size={18} strokeWidth={2.5} />
          Começar a enviar pra {selectedList.length}
        </button>
      </div>
    );
  }

  // === Fase: SENDING (one-by-one) ===
  const current = selectedList[cursor];
  if (!current) {
    return (
      <div className="text-center py-10">
        <div className="t-h2 mb-2">Tudo enviado! 🎉</div>
        <button onClick={onBack} className="btn btn-secondary">
          Voltar
        </button>
      </div>
    );
  }
  const text = templatePromo(current.name, message.trim());

  return (
    <div className="flex flex-col gap-5 max-w-xl mx-auto">
      <header className="flex items-center justify-between gap-3">
        <h1 className="t-h1">
          Enviando {cursor + 1} de {selectedList.length}
        </h1>
        <button
          onClick={async () => {
            const ok = await confirm({
              title: "Pausar broadcast?",
              message: "Você pode voltar depois, mas a posição não salva.",
              confirmLabel: "Pausar",
            });
            if (ok) onBack();
          }}
          className="text-ink-3 hover:text-ink p-1"
          aria-label="Pausar"
        >
          <X size={20} strokeWidth={2.5} />
        </button>
      </header>

      {/* Progress bar */}
      <div className="h-2 bg-surface-sunken rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-yellow transition-all"
          style={{ width: `${((cursor + 1) / selectedList.length) * 100}%` }}
        />
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="shrink-0 w-14 h-14 rounded-full bg-brand-yellow inline-flex items-center justify-center font-bold text-xl text-ink">
            {current.name[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            <div className="t-h2">{current.name}</div>
            <div className="t-caption t-num">{formatPhoneDisplay(current.phone)}</div>
            <div className="t-caption">
              {current.totalOrders} pedido{current.totalOrders === 1 ? "" : "s"} ·{" "}
              {current.lastOrderAt
                ? `último ${new Date(current.lastOrderAt).toLocaleDateString("pt-BR")}`
                : "nunca pediu"}
            </div>
          </div>
        </div>

        <div className="t-label mb-2">Mensagem que vai abrir</div>
        <pre className="t-body-sm whitespace-pre-wrap font-sans bg-surface p-3 rounded-md border border-line">
          {text}
        </pre>
      </div>

      <div className="flex flex-col gap-2">
        <button onClick={sendCurrent} className="btn btn-primary btn-lg w-full">
          <MessageCircle size={18} strokeWidth={2.5} />
          Abrir WhatsApp e marcar enviado
        </button>
        <button onClick={skip} className="btn btn-secondary w-full">
          <SkipForward size={16} strokeWidth={2.5} />
          Pular este cliente
        </button>
      </div>
      {confirmNode}
    </div>
  );
}
