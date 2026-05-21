"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChartBar, ClipboardList, CookingPot, Monitor } from "lucide-react";
import Link from "next/link";
import { BrandIcon } from "@/components/icons";
import { PinInput } from "@/components/PinInput";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { useOperator, type Role } from "@/lib/use-operator";

const PIN_LENGTH = 4;

// Só os 2 modos operacionais (uso diário, rotação de operador). Admin é Gil
// só, acesso esporádico — fica num link no rodapé junto com Tela do cliente.
const ROLE_TABS: Array<{ id: Role; label: string; Icon: typeof ClipboardList }> = [
  { id: "atendente", label: "Atendente", Icon: ClipboardList },
  { id: "cozinha", label: "Cozinha", Icon: CookingPot },
];

export default function LoginPage() {
  const router = useRouter();
  const { operator, ready, save } = useOperator();
  const [role, setRole] = useState<Role>("atendente");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);

  useEffect(() => {
    if (ready && operator) {
      router.replace(`/${operator.role}`);
    }
  }, [ready, operator, router]);

  useEffect(() => {
    // Ao trocar de role, limpa estado pra começar PIN novo do zero.
    setError(null);
    setPassword("");
  }, [role]);

  async function attemptLogin(pin: string) {
    if (pin.length < PIN_LENGTH || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      // Server identifica o user pelo {role + PIN} — sem precisar passar name.
      // Requer que cada user no role tenha PIN único. Conflito → 409.
      const res = await fetch("/api/auth/login", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pin, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Senha errada.");
        setPassword("");
        setShakeKey((k) => k + 1);
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate([60, 30, 60]);
        }
        setSubmitting(false);
        return;
      }
      save({ id: data.id, role: data.role, name: data.name }, true);
      router.replace(`/${data.role}`);
    } catch {
      setError("Sem conexão. Tente de novo.");
      setPassword("");
      setShakeKey((k) => k + 1);
      setSubmitting(false);
    }
  }

  // Auto-submit ao completar 4 dígitos (350ms delay pra ver confirmação visual)
  useEffect(() => {
    if (password.length === PIN_LENGTH && !submitting) {
      const t = setTimeout(() => attemptLogin(password), 350);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password]);

  if (!ready || operator) {
    return <div className="min-h-dvh bg-surface" />;
  }

  return (
    <main
      className="min-h-dvh flex flex-col bg-gradient-to-b from-brand-yellow to-brand-orange"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 8px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 8px)",
        paddingLeft: "max(env(safe-area-inset-left), 8px)",
        paddingRight: "max(env(safe-area-inset-right), 8px)",
      }}
    >
      <PWAInstallBanner />

      {/* Card centralizado verticalmente */}
      <div className="flex-1 flex items-center justify-center w-full">
        <div className="w-full max-w-sm bg-surface-elevated rounded-3xl shadow-xl px-5 py-5 flex flex-col gap-5">
          {/* Marca em destaque: BrandIcon grande + "Cozinha da Gil" inline
              com "Gil" extra-bold gigante à direita. Hierarquia visual:
              o brand é o herói da tela. */}
          <div className="flex flex-col items-center gap-2 pt-1">
            <BrandIcon size={80} />
            <div className="flex items-baseline gap-2 leading-none mt-1">
              <span className="text-lg font-medium text-ink-2">Cozinha da</span>
              <span className="text-[34px] font-black -tracking-[0.02em] text-ink">Gil</span>
            </div>
          </div>

          {/* Segmented control: Atendente / Cozinha. Admin vai pro rodapé. */}
          {role === "admin" ? (
            <div className="flex items-center justify-between bg-ink rounded-full px-4 py-2.5 text-brand-yellow">
              <span className="inline-flex items-center gap-1.5 text-sm font-bold">
                <ChartBar size={14} strokeWidth={2.5} />
                Modo Admin
              </span>
              <button
                onClick={() => setRole("atendente")}
                className="text-xs font-semibold opacity-80 hover:opacity-100"
              >
                ← voltar
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1 p-1 bg-surface-sunken rounded-full">
              {ROLE_TABS.map(({ id, label, Icon }) => {
                const active = role === id;
                return (
                  <button
                    key={id}
                    onClick={() => setRole(id)}
                    className={`h-12 rounded-full inline-flex items-center justify-center gap-2 text-base font-bold transition-colors ${
                      active
                        ? "bg-surface-elevated text-ink shadow-sm"
                        : "text-ink-3 hover:text-ink-2"
                    }`}
                  >
                    <Icon size={18} strokeWidth={2.25} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* PIN com asteriscos discretos em vez de dots grandes — visual
              mais leve, sem amarelo no campo (mantém amarelo só pro brand). */}
          <div key={shakeKey} className={error ? "animate-shake-x" : ""}>
            <PinInput
              value={password}
              onChange={(v) => {
                setError(null);
                setPassword(v);
              }}
              length={PIN_LENGTH}
              autoFocus
              submitOnComplete={false}
              keypad
              renderDots="asterisk"
            />
          </div>

          {/* Status: erro OU loading. Reservar espaço pra não pular layout. */}
          <div className="min-h-[24px] text-center">
            {error && !submitting && (
              <div className="t-body-sm text-danger font-semibold">{error}</div>
            )}
            {submitting && (
              <div className="t-body-sm text-ink-2 inline-flex items-center justify-center gap-2">
                <span className="spinner-inline" aria-hidden />
                <span>Entrando…</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rodapé: Admin + Tela do cliente */}
      <div className="flex justify-center items-center gap-1 text-xs">
        <button
          onClick={() => setRole("admin")}
          className={`inline-flex items-center gap-1.5 text-ink/70 hover:text-ink font-semibold px-3 py-1.5 rounded-full transition-colors ${
            role === "admin" ? "text-ink bg-white/30" : ""
          }`}
        >
          <ChartBar size={14} strokeWidth={2.25} />
          <span>Admin</span>
        </button>
        <span className="text-ink/30" aria-hidden>·</span>
        <Link
          href="/cliente"
          className="inline-flex items-center gap-1.5 text-ink/70 hover:text-ink font-semibold px-3 py-1.5 rounded-full"
        >
          <Monitor size={14} strokeWidth={2.25} />
          <span>Tela do cliente</span>
        </Link>
      </div>
    </main>
  );
}
