import type { OrderStatus } from "@prisma/client";

const MAP: Record<OrderStatus, { label: string; cls: string }> = {
  PEDIDO_FEITO: { label: "Pedido feito", cls: "badge-new" },
  EM_PREPARO: { label: "Em preparo", cls: "badge-preparing" },
  PRONTO: { label: "Pronto", cls: "badge-ready" },
  ENTREGUE: { label: "Entregue", cls: "badge-delivered" },
  CANCELADO: { label: "Cancelado", cls: "badge-cancelled" },
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const { label, cls } = MAP[status];
  // key={status} força re-mount no React quando o status muda
  // → dispara animate-badge-pop. Não dispara no mount inicial do card
  // porque card-in cobre o "entrar na tela".
  return (
    <span key={status} className={`badge ${cls} animate-badge-pop`}>
      {label}
    </span>
  );
}
