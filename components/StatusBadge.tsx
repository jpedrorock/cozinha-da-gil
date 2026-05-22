import type { OrderStatus } from "@prisma/client";
import { Ban, Check, ChefHat, ClipboardCheck, HandPlatter } from "lucide-react";

// Audit-Crit B #12: ícones nos status pra scan rápido.
// Cook lê 30 cards na fila numa olhada — ícone bate antes do texto.
// Tamanho 12px alinha com o `t-label` do badge sem inflar layout.
const MAP: Record<
  OrderStatus,
  { label: string; cls: string; Icon: typeof Check }
> = {
  PEDIDO_FEITO: { label: "Pedido feito", cls: "badge-new", Icon: ClipboardCheck },
  EM_PREPARO: { label: "Em preparo", cls: "badge-preparing", Icon: ChefHat },
  PRONTO: { label: "Pronto", cls: "badge-ready", Icon: HandPlatter },
  ENTREGUE: { label: "Entregue", cls: "badge-delivered", Icon: Check },
  CANCELADO: { label: "Cancelado", cls: "badge-cancelled", Icon: Ban },
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const { label, cls, Icon } = MAP[status];
  // key={status} força re-mount no React quando o status muda
  // → dispara animate-badge-pop. Não dispara no mount inicial do card
  // porque card-in cobre o "entrar na tela".
  return (
    <span key={status} className={`badge ${cls} animate-badge-pop inline-flex items-center gap-1`}>
      <Icon size={12} strokeWidth={2.75} aria-hidden />
      {label}
    </span>
  );
}
