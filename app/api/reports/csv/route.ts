import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseExtras } from "@/lib/orders";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes(";")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function fmt(d: Date | null): string {
  return d ? new Date(d).toLocaleString("pt-BR") : "";
}

function brl(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function durationSec(from: Date | null, to: Date | null): string {
  if (!from || !to) return "";
  return String(Math.round((to.getTime() - from.getTime()) / 1000));
}

/**
 * GET /api/reports/csv
 *   ?eventSessionId=XXX → CSV de UM caixa
 *   ?date=YYYY-MM-DD     → CSV de UM dia (default: hoje)
 *   ?from=&to=           → range arbitrário
 *
 * CSV bem detalhado pra Gil mandar pro contador. Uma linha POR ITEM
 * (não por pedido) — facilita análise de produto. Inclui:
 * - Identificação completa do pedido + cliente + telefone
 * - Status final + timestamps de cada transição + quem fez cada coisa
 * - Tempos derivados (preparo, espera, total) em segundos
 * - Promoção aplicada + desconto
 * - Detalhe do item (produto/tamanho/ingredientes/molhos/notas/preço)
 *
 * Admin only.
 */
export async function GET(request: Request) {
  const auth = await requireRole(["admin"]);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const eventSessionId = url.searchParams.get("eventSessionId");
  const dateParam = url.searchParams.get("date");
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  type Where = {
    eventSessionId?: string;
    createdAt?: { gte: Date; lt?: Date; lte?: Date };
  };
  const where: Where = {};
  let filenameBase = "vendas";

  if (eventSessionId) {
    where.eventSessionId = eventSessionId;
    const session = await prisma.eventSession.findUnique({ where: { id: eventSessionId } });
    const refDate = session?.eventDate ?? session?.openedAt ?? new Date();
    filenameBase = `caixa-${(session?.name ?? "sem-nome").replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}-${refDate.toISOString().slice(0, 10)}`;
  } else if (fromParam && toParam) {
    where.createdAt = { gte: new Date(fromParam), lte: new Date(`${toParam}T23:59:59.999Z`) };
    filenameBase = `periodo-${fromParam}-a-${toParam}`;
  } else {
    const ref = dateParam ? new Date(dateParam) : new Date();
    const start = startOfDay(ref);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    where.createdAt = { gte: start, lt: end };
    filenameBase = `dia-${start.toISOString().slice(0, 10)}`;
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      items: true,
      eventSession: { select: { name: true, eventDate: true, openedAt: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const headers = [
    // Identificação
    "pedido_id",
    "evento_caixa",
    "evento_data",
    "cliente_nome",
    "cliente_telefone",
    // Status + audit trail
    "status",
    "criado_em",
    "criado_por",
    "preparo_em",
    "preparo_por",
    "pronto_em",
    "pronto_por",
    "entregue_em",
    "entregue_por",
    "cancelado_em",
    "cancelado_por",
    "motivo_cancelamento",
    // Tempos derivados (segundos)
    "espera_ate_preparo_seg",
    "tempo_preparo_seg",
    "espera_ate_entrega_seg",
    "tempo_total_seg",
    // Financeiro do pedido
    "promocao_nome",
    "desconto_brl",
    "subtotal_brl",
    "total_final_brl",
    // Composição
    "qtd_itens_no_pedido",
    // Detalhe do item
    "item_indice",
    "produto",
    "tipo_produto",
    "tamanho",
    "ingredientes",
    "sabor_doce",
    "molhos",
    "observacoes",
    "item_quantidade",
    "item_preco_unitario_brl",
    "item_subtotal_brl",
  ];

  const rows: string[] = [headers.join(",")];

  for (const o of orders) {
    const subtotal = o.items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
    const finalCents = Math.max(0, subtotal - (o.discountCents ?? 0));
    const totalItems = o.items.reduce((s, it) => s + it.quantity, 0);

    const esperaPreparoSeg = durationSec(o.createdAt, o.preparedAt);
    const tempoPreparoSeg = durationSec(o.preparedAt, o.readyAt);
    const esperaEntregaSeg = durationSec(o.readyAt, o.deliveredAt);
    const tempoTotalSeg = durationSec(o.createdAt, o.deliveredAt ?? o.cancelledAt);

    const eventoCaixa = o.eventSession?.name ?? "";
    const eventoData = o.eventSession?.eventDate
      ? new Date(o.eventSession.eventDate).toLocaleDateString("pt-BR")
      : o.eventSession?.openedAt
      ? new Date(o.eventSession.openedAt).toLocaleDateString("pt-BR")
      : "";

    for (let i = 0; i < o.items.length; i++) {
      const item = o.items[i];
      const row = [
        o.id,
        eventoCaixa,
        eventoData,
        o.clientName,
        o.clientPhone ?? "",
        o.status,
        fmt(o.createdAt),
        o.createdBy,
        fmt(o.preparedAt),
        o.preparedBy ?? "",
        fmt(o.readyAt),
        o.readyBy ?? "",
        fmt(o.deliveredAt),
        o.deliveredBy ?? "",
        fmt(o.cancelledAt),
        o.cancelledBy ?? "",
        o.cancelReason ?? "",
        esperaPreparoSeg,
        tempoPreparoSeg,
        esperaEntregaSeg,
        tempoTotalSeg,
        o.promotionName ?? "",
        brl(o.discountCents ?? 0),
        brl(subtotal),
        brl(finalCents),
        totalItems,
        i + 1,
        item.productName || item.kind,
        item.kind,
        item.size,
        parseExtras(item.toppings).join("; "),
        item.flavor ?? "",
        parseExtras(item.sauces).join("; "),
        item.notes ?? "",
        item.quantity,
        brl(item.unitPrice),
        brl(item.unitPrice * item.quantity),
      ].map(csvEscape).join(",");
      rows.push(row);
    }
  }

  const csv = "﻿" + rows.join("\n"); // BOM pra Excel ler UTF-8

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cozinha-da-gil-${filenameBase}.csv"`,
    },
  });
}
