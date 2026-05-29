"use client";
import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { useToast } from "@/components/Toast";

/**
 * Config do PIX (Fase 7 #1) — admin edita os 3 campos exigidos pelo BR
 * Code: chave + nome do recebedor + cidade. Vazio → QR não aparece no
 * comprovante. Singleton via /api/settings/payment.
 */
export function PagamentoSettings() {
  const [pixKey, setPixKey] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [merchantCity, setMerchantCity] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/payment")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setPixKey(data.pixKey ?? "");
        setMerchantName(data.merchantName ?? "");
        setMerchantCity(data.merchantCity ?? "");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/payment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pixKey, merchantName, merchantCity }),
      });
      if (!res.ok) throw new Error();
      showToast("Configuração salva", "success");
    } catch {
      showToast("Não foi possível salvar", "error");
    } finally {
      setSaving(false);
    }
  }

  const configured = pixKey.trim() && merchantName.trim() && merchantCity.trim();

  return (
    <section className="rounded-xl border border-line bg-surface-elevated p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-extrabold">Pagamento (PIX)</h2>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            configured
              ? "bg-status-ready-bg text-status-ready-ink"
              : "bg-surface-sunken text-ink-3"
          }`}
        >
          {configured ? "configurado — QR ativo" : "vazio — QR não aparece"}
        </span>
      </div>
      <p className="text-sm text-ink-3">
        Os 3 campos vão no QR de PIX que aparece no comprovante. O padrão BR Code
        do PIX exige todos.
      </p>
      <Field
        label="Chave PIX"
        placeholder="CPF/CNPJ/email/telefone/chave aleatória"
        value={pixKey}
        onChange={setPixKey}
        disabled={loading}
      />
      <Field
        label="Nome do recebedor"
        placeholder="ex: Gil Pasteis"
        hint="vira maiúsculo sem acento no QR · max 25 chars"
        value={merchantName}
        onChange={setMerchantName}
        maxLength={25}
        disabled={loading}
      />
      <Field
        label="Cidade"
        placeholder="ex: Sao Paulo"
        hint="max 15 chars"
        value={merchantCity}
        onChange={setMerchantCity}
        maxLength={15}
        disabled={loading}
      />
      <button
        type="button"
        onClick={save}
        disabled={saving || loading}
        className="self-start h-10 px-4 rounded-lg bg-ink text-brand-yellow font-bold inline-flex items-center gap-2 disabled:opacity-50"
      >
        <Save size={16} strokeWidth={2.5} />
        {saving ? "Salvando..." : "Salvar"}
      </button>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  disabled,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-bold uppercase tracking-wide text-ink-3">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        className="h-10 px-3 rounded-lg border border-line-strong bg-surface-elevated focus:border-ink focus:outline-none disabled:opacity-50"
      />
      {hint && <span className="text-xs text-ink-3">{hint}</span>}
    </label>
  );
}
