"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChartBar, ChevronDown, ClipboardList, CookingPot } from "lucide-react";
import { BrandIcon } from "@/components/icons";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useOperator, type Role } from "@/lib/use-operator";

function RoleIcon({ role, size }: { role: Role; size: number }) {
  if (role === "admin") return <ChartBar size={size} strokeWidth={2} />;
  if (role === "cozinha") return <CookingPot size={size} strokeWidth={2} />;
  return <ClipboardList size={size} strokeWidth={2} />;
}

export function AppHeader({
  right,
  showOperator = true,
}: {
  right?: React.ReactNode;
  showOperator?: boolean;
}) {
  const router = useRouter();
  const { operator, clear } = useOperator();
  const [confirmingSwitch, setConfirmingSwitch] = useState(false);

  function doSwitch() {
    clear();
    router.replace("/");
  }

  return (
    // pt-safe: respeita env(safe-area-inset-top) em iOS standalone com
    // status bar translucent. Sem isso, conteúdo do header ficaria atrás
    // do notch / Dynamic Island. Em browsers sem standalone, o env() é 0.
    <header
      className="sticky top-0 z-30 bg-surface-elevated border-b border-line no-select"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex items-center gap-3 px-4 md:px-6 h-16">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <BrandIcon size={32} />
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-3">
              Cozinha da
            </span>
            <span className="text-base font-extrabold -tracking-[0.01em]">Gil</span>
          </div>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          {right}
          {showOperator && operator && (
            <button
              onClick={() => setConfirmingSwitch(true)}
              className="hidden md:inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-line-strong text-sm font-semibold text-ink-2 hover:border-ink-3 hover:text-ink"
              title="Trocar operador"
            >
              <RoleIcon role={operator.role} size={16} />
              <span>{operator.name}</span>
              <ChevronDown size={14} strokeWidth={2.5} />
            </button>
          )}
          {showOperator && operator && (
            <button
              onClick={() => setConfirmingSwitch(true)}
              className="md:hidden inline-flex items-center justify-center h-9 w-9 rounded-full border border-line-strong text-ink-2"
              title={`${operator.name} — trocar`}
            >
              <RoleIcon role={operator.role} size={18} />
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmingSwitch}
        title="Trocar operador?"
        message={`Sair como "${operator?.name}" e voltar pra escolha de papel.`}
        confirmLabel="Sair"
        onConfirm={() => { setConfirmingSwitch(false); doSwitch(); }}
        onClose={() => setConfirmingSwitch(false)}
      />
    </header>
  );
}
