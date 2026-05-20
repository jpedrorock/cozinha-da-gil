import type { Order, OrderItem, OrderStatus } from "@prisma/client";
import type { Kind, Size } from "./pricing";

export type OrderItemView = Omit<OrderItem, "toppings" | "sauces"> & {
  toppings: string[];
  sauces: string[];
};

export type OrderView = Omit<Order, "items"> & {
  items: OrderItemView[];
  totalCents: number;     // subtotal (sem desconto)
  finalCents: number;     // totalCents - discountCents
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PEDIDO_FEITO: "Pedido feito",
  EM_PREPARO: "Em preparo",
  PRONTO: "Pronto",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
};

export function parseExtras(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

const parseStringArray = parseExtras;

export function serializeOrder(order: Order & { items: OrderItem[] }): OrderView {
  const items: OrderItemView[] = order.items.map((item) => ({
    ...item,
    toppings: parseStringArray(item.toppings),
    sauces: parseStringArray(item.sauces),
  }));
  const totalCents = items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
  const finalCents = Math.max(0, totalCents - (order.discountCents ?? 0));
  return { ...order, items, totalCents, finalCents };
}

/**
 * Normaliza telefone BR — aceita 10 ou 11 dígitos (com ou sem DDD,
 * com ou sem +55), retorna `+55XXXXXXXXXXX` ou null.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  // Se começar com 55 e tiver 12 ou 13 dígitos, mantém. Senão, prepende.
  let withCountry = digits;
  if (digits.length === 10 || digits.length === 11) {
    withCountry = "55" + digits;
  } else if (digits.length === 12 || digits.length === 13) {
    if (!digits.startsWith("55")) return null;
  } else {
    return null;
  }
  return "+" + withCountry;
}

export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return "";
  // Espera formato +55XXXXXXXXXXX, retorna (XX) XXXXX-XXXX
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 12) return phone;
  const local = digits.slice(2); // remove "55"
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return phone;
}

export function asKind(v: unknown): Kind | null {
  return v === "salgado" || v === "doce" ? v : null;
}

export function asSize(v: unknown): Size | null {
  return v === "pequeno" || v === "grande" || v === "normal" || v === "mini" ? v : null;
}
