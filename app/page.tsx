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

type UserOption = { id: string; name: string; role: Role };

export default function LoginPage() {
  const router = useRouter();
  const { operator, ready, save } = useOperator();
  const [role, setRole] = useState<Role>("atendente");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && operator) {
      router.replace(`/${operator.role}`);
    }
  }, [ready, operator, router]);

  useEffect(() => {
    setError(null);
    setName("");
    fetch(`/api/users?role=${role}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setUsers(data);
      })
      .catch(() => setUsers([]));
  }, [role]);

  async function attemptLogin(pin: string) {
    if (!name.trim() || pin.length < PIN_LENGTH) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), password: pin, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Senha errada.");
        setPassword("");
        setSubmitting(false);
        return;
      }
      save({ id: data.id, role: data.role, name: data.name }, remember);
      router.replace(`/${data.role}`);
    } catch {
      setError("Sem conexão. Tente de novo.");
      setPassword("");
      setSubmitting(false);
    }
  }

  function handleLogin() {
    if (!name.trim()) {
      setError("Selecione um usuário.");
      return;
    }
    if (password.length < PIN_LENGTH) {
      setError(`Digite a senha de ${PIN_LENGTH} dígitos.`);
      return;
    }
    attemptLogin(password);
  }

  if (!ready || operator) {
    return <div className="min-h-dvh bg-surface" />;
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-4 bg-gradient-to-b from-brand-yellow to-brand-orange">
      {/* Banner discreto que aparece após 4s sugerindo "Adicionar à Tela de
          Início" (iOS) ou disparando prompt nativo (Android). Auto-hidden
          se já estiver instalado ou se user dispensou nos últimos 7 dias. */}
      <PWAInstallBanner />
      <div className="w-full max-w-md bg-surface-elevated rounded-xl shadow-lg p-6 md:p-7 relative">
        {/* Admin no canto superior direito do card */}
        <button
          onClick={() => setRole("admin")}
          className={`absolute top-4 right-4 inline-flex items-center gap-1.5 t-h3 transition-colors py-1.5 px-2.5 rounded-md ${
            role === "admin"
              ? "text-ink bg-brand-yellow"
              : "text-ink-3 hover:text-ink hover:bg-surface-sunken"
          }`}
        >
          <ChartBar size={14} strokeWidth={2.25} />
          <span>Admin (Gil)</span>
        </button>

        {/* Brand header — label + nome forte, alinhado pelo baseline */}
        <div className="flex items-baseline gap-2 mb-6">
          <BrandIcon size={40} className="self-center" />
          <span className="t-label">Cozinha da</span>
          <span className="text-[22px] font-bold -tracking-[0.01em] leading-none text-ink">Gil</span>
        </div>

        <h1 className="t-h1 mb-1">Entrar</h1>
        <p className="t-body-sm mb-5">Onde você vai trabalhar agora?</p>

        {/* Atendente + Cozinha — role pickers compactos. Ícone pequeno
            em cima, nome embaixo. Sem subtitle pra não competir com PIN. */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => setRole("atendente")}
            className={`h-20 rounded-lg border-2 flex flex-col items-center justify-center gap-1.5 transition-colors ${
              role === "atendente"
                ? "border-brand-yellow bg-[#FFFCE5] text-ink"
                : "border-line bg-surface-elevated text-ink-2 hover:border-ink-3 hover:text-ink"
            }`}
          >
            <ClipboardList size={22} strokeWidth={2} />
            <span className="text-[15px] font-semibold text-ink">Atendente</span>
          </button>
          <button
            onClick={() => setRole("cozinha")}
            className={`h-20 rounded-lg border-2 flex flex-col items-center justify-center gap-1.5 transition-colors ${
              role === "cozinha"
                ? "border-brand-yellow bg-[#FFFCE5] text-ink"
                : "border-line bg-surface-elevated text-ink-2 hover:border-ink-3 hover:text-ink"
            }`}
          >
            <CookingPot size={22} strokeWidth={2} />
            <span className="text-[15px] font-semibold text-ink">Cozinha</span>
          </button>
        </div>

        {/* Usuário */}
        <label className="t-label block mb-2 text-center">Usuário</label>
        {users.length === 0 ? (
          <div className="card p-4 t-body-sm italic mb-5 text-center">
            Nenhum usuário cadastrado pra essa função.
          </div>
        ) : users.length > 6 ? (
          <select
            className="input mb-5 w-full text-center font-semibold"
            value={name}
            onChange={(e) => setName(e.target.value)}
          >
            <option value="">— Selecione —</option>
            {users.map((u) => (
              <option key={u.id} value={u.name}>
                {u.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex flex-wrap gap-2 mb-5 max-h-40 overflow-y-auto justify-center">
            {users.map((u) => {
              const active = name === u.name;
              return (
                <button
                  key={u.id}
                  onClick={() => setName(u.name)}
                  className={`h-14 px-6 rounded-full border-2 text-lg font-bold transition-colors ${
                    active
                      ? "bg-ink text-brand-yellow border-ink"
                      : "bg-surface-elevated text-ink-2 border-line-strong hover:border-ink-3"
                  }`}
                >
                  {u.name}
                </button>
              );
            })}
          </div>
        )}

        {/* PIN */}
        <label className="t-label block mb-2 text-center">
          Senha de {PIN_LENGTH} dígitos
        </label>
        <div className="mb-4">
          <PinInput
            value={password}
            onChange={(v) => {
              setError(null);
              setPassword(v);
            }}
            length={PIN_LENGTH}
            autoFocus={!!name}
            // submitOnComplete=false: ao digitar o 4º dígito, NÃO loga
            // automaticamente. Atendente vê os 4 dots preenchidos, confirma
            // mentalmente, aperta "Entrar". Evita queimar tentativas do
            // rate-limit (5/60s) em erros de pressa.
            submitOnComplete={false}
            keypad
          />
        </div>

        <label className="flex items-start justify-center gap-2 mb-4 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 mt-0.5 shrink-0 accent-brand-yellow"
          />
          <div className="flex flex-col items-start">
            <span className="t-body-sm">Manter conectado nesse aparelho</span>
            <span className="t-caption">Não vai pedir senha nos próximos acessos.</span>
          </div>
        </label>

        {error && (
          <div className="t-body-sm text-danger bg-danger-bg rounded-md px-3 py-2 mb-3 text-center">
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={submitting || !name || password.length < PIN_LENGTH}
          className="btn btn-primary btn-lg w-full"
        >
          {submitting ? (
            <>
              <span className="spinner-inline" aria-hidden />
              <span>Entrando...</span>
            </>
          ) : (
            "Entrar →"
          )}
        </button>
      </div>

      {/* Tela do cliente — display público. Fora do card pois não precisa
          de senha; abre direto. Discreto na cor, maior pra fácil toque. */}
      <Link
        href="/cliente"
        className="mt-6 inline-flex items-center gap-2.5 text-ink/80 hover:text-ink bg-white/40 hover:bg-white/60 backdrop-blur px-5 py-3 rounded-full t-body font-semibold transition-colors"
      >
        <Monitor size={20} strokeWidth={2.25} />
        <span>Tela do cliente (painel público)</span>
      </Link>
    </main>
  );
}
