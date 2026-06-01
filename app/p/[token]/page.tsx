import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { serializeOrder } from "@/lib/orders";
import { isValidPublicTokenFormat } from "@/lib/public-token";
import { PedidoClient } from "./PedidoClient";

// Página pública (sem login) que o cliente abre pelo link de acompanhamento.
// Token vai no path em vez de query — wa.me mostra path completo de forma
// limpa ("Acompanhe: https://.../p/abc7x9k2"), e analytics fica simples.
//
// SSR pra dois ganhos: (a) cliente vê o pedido na primeira tela sem flash
// de loading; (b) Open Graph fica certo se cliente compartilhar. O SSE
// inicializa depois e fica responsável por atualizações ao vivo.

export const dynamic = "force-dynamic";

async function fetchOrder(token: string) {
  if (!isValidPublicTokenFormat(token)) return null;
  const order = await prisma.order.findUnique({
    where: { publicToken: token },
    include: { items: true },
  });
  return order ? serializeOrder(order) : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const order = await fetchOrder(token);
  if (!order) return { title: "Pedido — Cozinha da Gil" };
  return {
    title: `Pedido #${String(order.id).padStart(3, "0")} — Cozinha da Gil`,
    description: `Acompanhe seu pedido em tempo real.`,
    robots: { index: false, follow: false }, // não indexar — link privado
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const order = await fetchOrder(token);
  if (!order) notFound();
  return <PedidoClient initialOrder={order} />;
}
