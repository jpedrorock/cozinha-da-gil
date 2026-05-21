"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChartBar, ClipboardList, CookingPot, Monitor } from "lucide-react";
import Link from "next/link";
import { BrandIcon } from "@/components/icons";
import { PinInput } from "@/components/PinInput";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { useOperator, type Role } from "@/lib/use-operator";

const PIN_LENGTH = 4;

type UserOption = { id: string; name: string; role: Role };

const ROLE_TABS: Array<{ id: Role; label: string; Icon: typeof ClipboardList }> = [
  { id: "atendente", label: "Atendente", Icon: ClipboardList },
  { id: "cozinha", label: "Cozinha", Icon: CookingPot },
  { id: "admin", label: "Admin", Icon: ChartBar },
];

export default function LoginPage() {
  const router = useRouter();
  const { operator, ready, save } = useOperator();
  const [role, setRole] = useState<Role>("atendente");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Key incrementa a cada erro pra re-disparar animação shake nos dots
  const [shakeKey, setShakeKey] = useState(0);

  useEffect(() => {
    if (ready && operator) {
      router.replace(`/${operator.role}`);
    }
  }, [ready, operator, router]);

  useEffect(() => {
    setError(null);
    setName("");
    setPassword("");
    fetch(`/api/users?role=${role}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setUsers(data);
      })
      .catch(() => setUsers([]));
  }, [role]);

  async function attemptLogin(pin: string) {
    if (!name.trim() || pin.length < PIN_LENGTH || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), password: pin, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Erro de senha: shake + vibrate + clear pra retentar.
        // Visual + tátil pra atendente perceber sem precisar ler texto.
        setError(data.error || "Senha errada.");
        setPassword("");
        setShakeKey((k) => k + 1);
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate([60, 30, 60]); // dois pulsos curtos
        }
        setSubmitting(false);
        return;
      }
      // Sucesso: salva sessão e redireciona. `remember: true` por default —
      // POS de família não precisa do checkbox manual (eliminado pra
      // economizar espaço vertical no iPhone SE).
      save({ id: data.id, role: data.role, name: data.name }, true);
      router.replace(`/${data.role}`);
    } catch {
      setError("Sem conexão. Tente de novo.");
      setPassword("");
      setShakeKey((k) => k + 1);
      setSubmitting(false);
    }
  }

  // Auto-submit: assim que o 4º dígito é digitado E há usuário selecionado,
  // tenta logar automaticamente. Se errar, shake + clear (retry imediato).
  // Sem botão "Entrar" — economiza ~64px verticais no iPhone SE.
  useEffect(() => {
    if (password.length === PIN_LENGTH && name && !submitting) {
      // Pequeno delay (350ms) pra usuário ver os 4 dots preenchidos antes
      // de submeter — sensação de "confirmação visual" sem clique manual.
      const t = setTimeout(() => attemptLogin(password), 350);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password, name]);

  // Auto-foca o input do PIN ao escolher usuário
  const pinAutoFocus = useMemo(() => !!name && password.length < PIN_LENGTH, [name, password]);

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

      {/* Marca em destaque ACIMA do card — aproveita o gradient amarelo
          vazio do topo (~30% da tela). BrandIcon grande + "COZINHA DA Gil"
          stack vertical com hierarquia clara: label discreto + nome forte.
          Usa o espaço respirado pra dar protagonismo de brand sem custar
          área do card de login. */}
      <div className="flex-1 flex flex-col items-center justify-center w-full gap-5">
        <div className="flex flex-col items-center gap-2">
          <BrandIcon size={72} />
          <div className="flex flex-col items-center leading-none">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink/70">
              Cozinha da
            </span>
            <span className="text-[34px] font-extrabold -tracking-[0.02em] text-ink mt-1">
              Gil
            </span>
          </div>
        </div>

        {/* Card de login — mais compacto agora que a marca saiu pra cima. */}
        <div className="w-full max-w-sm bg-surface-elevated rounded-xl shadow-lg px-5 py-4 flex flex-col gap-3">
          {/* Segmented control — 3 modos compactos. Substitui os 2 cards
              grandes "Atendente/Cozinha" + botão "Admin" no canto.
              Tamanho fixo, sem wrap, cabe em 320px. */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-surface-sunken rounded-lg">
            {ROLE_TABS.map(({ id, label, Icon }) => {
              const active = role === id;
              return (
                <button
                  key={id}
                  onClick={() => setRole(id)}
                  className={`h-10 rounded-md inline-flex items-center justify-center gap-1.5 text-xs font-bold transition-colors ${
                    active
                      ? "bg-surface-elevated text-ink shadow-sm"
                      : "text-ink-3 hover:text-ink-2"
                  }`}
                >
                  <Icon size={14} strokeWidth={2.25} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {/* Lista de usuários do modo atual — pills compactas em grid.
              Max 2 linhas; se passar, vira scroll horizontal compacto. */}
          {users.length === 0 ? (
            <div className="text-center t-body-sm italic py-2">
              Nenhum {role} cadastrado.
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5 justify-center">
              {users.map((u) => {
                const active = name === u.name;
                return (
                  <button
                    key={u.id}
                    onClick={() => setName(u.name)}
                    className={`h-10 px-4 rounded-full border-2 text-sm font-bold transition-colors ${
                      active
                        ? "bg-ink text-brand-yellow border-ink"
                        : "bg-surface-elevated text-ink-2 border-line-strong"
                    }`}
                  >
                    {u.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* PIN — dots + numpad. Shake key força re-animação a cada erro. */}
          <div key={shakeKey} className={error ? "animate-shake-x" : ""}>
            <PinInput
              value={password}
              onChange={(v) => {
                setError(null);
                setPassword(v);
              }}
              length={PIN_LENGTH}
              autoFocus={pinAutoFocus}
              // Auto-submit em si fica no useEffect acima — o PinInput só
              // informa que completou via onChange (last digit). Mantemos
              // submitOnComplete=false pra evitar dupla chamada.
              submitOnComplete={false}
              keypad
            />
          </div>

          {/* Status: erro OU loading. Stack vertical pra não inflar quando
              há ambos. Mensagens curtas pra caber em 1 linha. */}
          {error && !submitting && (
            <div className="t-body-sm text-danger bg-danger-bg rounded-md px-3 py-1.5 text-center font-semibold">
              {error}
            </div>
          )}
          {submitting && (
            <div className="t-body-sm text-ink-2 inline-flex items-center justify-center gap-2">
              <span className="spinner-inline" aria-hidden />
              <span>Entrando…</span>
            </div>
          )}
        </div>
      </div>

      {/* Rodapé: link discreto pra Tela do cliente (display público).
          Não precisa de login, dá pra abrir direto em TV/painel. */}
      <div className="flex justify-center">
        <Link
          href="/cliente"
          className="inline-flex items-center gap-1.5 text-ink/70 hover:text-ink text-xs font-semibold px-3 py-1.5 rounded-full"
        >
          <Monitor size={14} strokeWidth={2.25} />
          <span>Tela do cliente</span>
        </Link>
      </div>
    </main>
  );
}
