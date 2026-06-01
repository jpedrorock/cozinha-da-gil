/**
 * Templates centralizados de mensagens WhatsApp.
 *
 * Tudo via `wa.me` (gratuito, click-to-open). Sem WhatsApp Business API.
 * Pra Gil/atendente clicar e abrir conversa pré-formatada.
 *
 * Se crescer pra Business API depois, basta trocar `buildWaUrl` por uma
 * função `sendWhatsApp(phone, text)` que chama Meta. Templates ficam iguais.
 */
import type { OrderView } from "./orders";
import { formatBRL, SIZE_LABEL } from "./pricing";

/**
 * Monta URL wa.me. Se phone tiver dígitos válidos, abre conversa direto;
 * senão abre seletor pra Gil escolher contato manualmente.
 */
export function buildWaUrl(phone: string | null | undefined, text: string): string {
  const encoded = encodeURIComponent(text);
  const digits = phone?.replace(/\D/g, "") ?? "";
  return digits ? `https://wa.me/${digits}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

/**
 * URL deep-link nativa `whatsapp://send` — preferida em iOS/Android quando
 * o app WhatsApp está instalado, abre a conversa diretamente no app sem
 * passar pelo Safari embutido. Em PWA instalado isso fazia o atendente
 * cair no navegador e ter que clicar "Abrir no WhatsApp". Audit P1 #07.
 *
 * Uso recomendado: passa esse valor pra <a href="..." target="_blank"> —
 * anchor é melhor que window.open() pra iOS resolver o deep-link nativo.
 * Se phone vazio, cai pro `wa.me` web (sem destino válido pro app nativo).
 */
export function buildWaNativeUrl(phone: string | null | undefined, text: string): string {
  const encoded = encodeURIComponent(text);
  const digits = phone?.replace(/\D/g, "") ?? "";
  if (!digits) {
    return `https://wa.me/?text=${encoded}`;
  }
  return `whatsapp://send?phone=${digits}&text=${encoded}`;
}

/**
 * Monta link público de acompanhamento do pedido. Retorna `null` se não
 * tem token (pedidos legados antes do backfill) ou se não tem como saber
 * o origin (não chamado em browser e sem `baseUrl` passado).
 *
 * O `baseUrl` é opcional pra usos client-side onde `window.location.origin`
 * resolve. Em server (SSR / endpoint que monta link), passa explícito —
 * preferir `process.env.NEXT_PUBLIC_APP_URL` quando configurado.
 */
export function buildPublicOrderUrl(
  order: Pick<OrderView, "publicToken">,
  baseUrl?: string,
): string | null {
  if (!order.publicToken) return null;
  const origin =
    baseUrl ?? (typeof window !== "undefined" ? window.location.origin : null);
  if (!origin) return null;
  return `${origin.replace(/\/$/, "")}/p/${order.publicToken}`;
}

/**
 * Recibo do pedido (mesma lógica visual: repete linhas por quantidade,
 * sem "×N" inline pra reduzir ambiguidade no celular).
 *
 * Se `baseUrl` for passado E o pedido tem `publicToken`, adiciona linha
 * final "Acompanhe: <url>" pro cliente abrir e ver status ao vivo no
 * próprio celular.
 */
export function templateReceipt(order: OrderView, baseUrl?: string): string {
  const created = new Date(order.createdAt);
  const lines: string[] = [];
  lines.push(`*Cozinha da Gil — Pedido #${String(order.id).padStart(3, "0")}*`);
  lines.push(`${order.clientName} · ${created.toLocaleString("pt-BR")}`);
  lines.push("");
  for (const item of order.items) {
    const productName =
      item.productName ||
      (item.kind === "doce"
        ? "Pastel Doce"
        : item.kind === "salgado"
        ? "Pastel Salgado"
        : item.kind);
    const sizeLabel =
      item.size && SIZE_LABEL[item.size as keyof typeof SIZE_LABEL]
        ? SIZE_LABEL[item.size as keyof typeof SIZE_LABEL]
        : item.size;
    const header = sizeLabel ? `${productName} · ${sizeLabel}` : productName;
    for (let i = 0; i < item.quantity; i++) {
      lines.push(`• ${header}`);
      if (item.flavor) {
        lines.push(`   ${item.flavor}`);
      } else if (item.toppings.length > 0) {
        lines.push(`   ${item.toppings.join(", ")}`);
      }
      if (item.sauces.length > 0) lines.push(`   Molhos: ${item.sauces.join(", ")}`);
      if (item.notes) lines.push(`   _${item.notes}_`);
    }
  }
  lines.push("");
  if (order.discountCents && order.discountCents > 0) {
    lines.push(`Subtotal: ${formatBRL(order.totalCents)}`);
    lines.push(
      `Desconto${order.promotionName ? ` (${order.promotionName})` : ""}: -${formatBRL(
        order.discountCents,
      )}`,
    );
    lines.push(`*Total: ${formatBRL(order.finalCents)}*`);
  } else {
    lines.push(`*Total: ${formatBRL(order.totalCents)}*`);
  }
  const trackUrl = buildPublicOrderUrl(order, baseUrl);
  if (trackUrl) {
    lines.push("");
    lines.push(`Acompanhe: ${trackUrl}`);
  }
  return lines.join("\n");
}

/**
 * Aviso "pedido pronto" — curto, amigável, primeiro nome. Se tiver
 * publicToken + baseUrl, inclui link de acompanhamento (cliente pode
 * conferir antes de levantar da mesa).
 */
export function templateOrderReady(order: OrderView, baseUrl?: string): string {
  const num = String(order.id).padStart(3, "0");
  const firstName = order.clientName.split(" ")[0] || order.clientName;
  const lines = [
    `Oi ${firstName}! 👋`,
    "",
    `Seu pedido *#${num}* tá pronto pra retirar na Cozinha da Gil!`,
    "",
    "Quando puder, vem buscar — a gente te espera.",
  ];
  const trackUrl = buildPublicOrderUrl(order, baseUrl);
  if (trackUrl) {
    lines.push("");
    lines.push(`Acompanhe: ${trackUrl}`);
  }
  return lines.join("\n");
}

/**
 * Promoção (broadcast). Usa primeiro nome do cliente + corpo customizado pela Gil.
 */
export function templatePromo(customerName: string, message: string): string {
  const firstName = customerName.split(" ")[0] || customerName;
  return `Oi ${firstName}! 👋\n\n${message}\n\n— Cozinha da Gil`;
}
