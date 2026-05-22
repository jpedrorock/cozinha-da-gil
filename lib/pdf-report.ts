import PDFDocument from "pdfkit";
import type { OrderView, OrderItemView } from "@/lib/orders";
import { formatBRL } from "@/lib/pricing";

/**
 * Relatório contábil PDF — layout brand pra Cozinha da Gil.
 *
 * Estrutura:
 *  - Capa: banner brand + título + KPIs em cards
 *  - Performance: atendentes, cozinheiros, gráfico por hora
 *  - Produtos: top por receita, por categoria, top ingredientes
 *  - Promoções + Cancelados (se houver)
 *  - Lista completa de pedidos (auditoria)
 *  - Footer com paginação
 *
 * pdfkit não suporta SVG nativo — todos os "ícones" são desenhados
 * com primitivas (rect, circle, path). Texto via Helvetica.
 */

export type ReportContext = {
  title: string;
  subtitle?: string;
  orders: OrderView[];
  /** Audit follow-up P3 #30: pedidos do período anterior equivalente
   *  pra KPIs mostrarem delta (+12%, -8%). Omitido = sem comparativo. */
  comparisonOrders?: OrderView[];
  /** Label humano do período comparado (ex: "vs 7d anteriores"). */
  comparisonLabel?: string;
};

// === Brand tokens ===
const C = {
  yellow: "#FFD400",
  yellowSoft: "#FFF4B8",
  ink: "#1F1410",
  ink2: "#4A3F38",
  ink3: "#8A7C6F",
  surface: "#FFFCF5",
  surfaceSunken: "#F6EFE3",
  line: "#E5DED5",
  lineStrong: "#C9BEAF",
  success: "#2E7D5F",
  successBg: "#E8F3ED",
  danger: "#C0392B",
  dangerBg: "#FBEAE7",
};

const M = { left: 40, right: 40, top: 56, bottom: 60 };
const BANNER_H = 28;

/** Tipografia escala unificada — em pt, equivalente ao sistema do app.
 *  display 26 / h1 18 / h2 13 / h3 10 / body 11 / body-sm 9.5 / label 8 / caption 8.5
 *  Helvetica regular vs Helvetica-Bold (sem extrabold). */
const T = {
  display: 26,
  h1: 18,
  h2: 13,
  h3: 10,
  body: 11,
  bodyLg: 12,
  bodySm: 9.5,
  label: 8,
  caption: 8.5,
};

const SIZE_LABEL: Record<string, string> = {
  P: "Pequeno",
  M: "Médio",
  G: "Grande",
};

export async function generateReportPDF(ctx: ReportContext): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margins: M,
    bufferPages: true,
    info: {
      Title: `Relatório Cozinha da Gil — ${ctx.title}`,
      Author: "Cozinha da Gil",
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk as Buffer));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  // Banner amarelo no topo de cada página (auto via pageAdded event)
  doc.on("pageAdded", () => drawTopBanner(doc));
  drawTopBanner(doc); // primeira página

  // Conteúdo flui em sequência; ensureSpace cuida das quebras.
  drawCover(doc, ctx);
  drawKPICards(doc, ctx);
  drawFinancialSummary(doc, ctx);

  drawOperators(doc, ctx);
  drawCooks(doc, ctx);
  drawHourlyChart(doc, ctx);

  drawTopProducts(doc, ctx);
  drawByCategory(doc, ctx);
  drawTopIngredients(doc, ctx);

  const promos = aggregatePromotions(ctx.orders);
  if (promos.length > 0) drawPromotions(doc, promos);
  const cancelled = ctx.orders.filter((o) => o.status === "CANCELADO");
  if (cancelled.length > 0) drawCancellations(doc, cancelled);

  if (ctx.orders.length > 0) drawOrderList(doc, ctx.orders);

  // Footer com paginação — fazer DEPOIS de todas as páginas existirem
  addFootersAndPageNumbers(doc);

  doc.end();
  return done;
}

// ============================================================
//   LAYOUT — Banner brand no topo de cada página
// ============================================================

function drawTopBanner(doc: PDFKit.PDFDocument) {
  const w = doc.page.width;
  // Faixa amarela fina no topo
  doc.save();
  doc.rect(0, 0, w, BANNER_H).fill(C.yellow);
  // Logo + nome — usa T.h3 pro título e T.bodySm pro subtítulo
  doc
    .fillColor(C.ink)
    .font("Helvetica-Bold")
    .fontSize(T.h3)
    .text("COZINHA DA GIL", M.left, 10, { lineBreak: false, width: 200 });
  doc
    .fillColor(C.ink2)
    .font("Helvetica")
    .fontSize(T.bodySm)
    .text("Relatório de Vendas", w - M.right - 200, 12, {
      width: 200,
      align: "right",
      lineBreak: false,
    });
  doc.restore();
  // Reset cursor logo abaixo do banner
  doc.x = M.left;
  doc.y = M.top;
}

// ============================================================
//   CAPA — Título grande, subtítulo, badge de período
// ============================================================

function drawCover(doc: PDFKit.PDFDocument, ctx: ReportContext) {
  const w = doc.page.width - M.left - M.right;
  // Título — t-display
  doc
    .font("Helvetica-Bold")
    .fontSize(T.display)
    .fillColor(C.ink)
    .text(ctx.title, M.left, doc.y, { width: w });
  // Subtítulo — t-body-sm
  if (ctx.subtitle) {
    doc.moveDown(0.2);
    doc
      .font("Helvetica")
      .fontSize(T.bodySm)
      .fillColor(C.ink3)
      .text(ctx.subtitle, M.left, doc.y, { width: w });
  }
  // Linha divisória amarela curtinha (acento brand)
  doc.moveDown(0.6);
  const y = doc.y;
  doc
    .save()
    .lineWidth(3)
    .strokeColor(C.yellow)
    .moveTo(M.left, y)
    .lineTo(M.left + 48, y)
    .stroke()
    .restore();
  doc.moveDown(0.8);
}

// ============================================================
//   KPI CARDS — 4 cards horizontais com label + valor grande
// ============================================================

function drawKPICards(doc: PDFKit.PDFDocument, ctx: ReportContext) {
  const valid = ctx.orders.filter((o) => o.status !== "CANCELADO");
  const revenue = sum(valid, (o) => o.finalCents);
  const avgTicket = valid.length > 0 ? Math.round(revenue / valid.length) : 0;
  const prepDurations = ctx.orders
    .filter((o) => o.preparedAt && o.readyAt)
    .map((o) => new Date(o.readyAt!).getTime() - new Date(o.preparedAt!).getTime())
    .filter((d) => d > 0);
  const avgPrep =
    prepDurations.length > 0
      ? Math.round(prepDurations.reduce((s, d) => s + d, 0) / prepDurations.length / 60000)
      : 0;

  // Audit follow-up P3 #30: deltas vs período anterior, se houver.
  // Calcula mesmas métricas no comparison set e gera string de delta.
  let prevMetrics: { revenue: number; count: number; ticket: number; prep: number } | null = null;
  if (ctx.comparisonOrders && ctx.comparisonOrders.length > 0) {
    const pValid = ctx.comparisonOrders.filter((o) => o.status !== "CANCELADO");
    const pRev = sum(pValid, (o) => o.finalCents);
    const pTicket = pValid.length > 0 ? Math.round(pRev / pValid.length) : 0;
    const pDurs = ctx.comparisonOrders
      .filter((o) => o.preparedAt && o.readyAt)
      .map((o) => new Date(o.readyAt!).getTime() - new Date(o.preparedAt!).getTime())
      .filter((d) => d > 0);
    const pPrep =
      pDurs.length > 0
        ? Math.round(pDurs.reduce((s, d) => s + d, 0) / pDurs.length / 60000)
        : 0;
    prevMetrics = { revenue: pRev, count: pValid.length, ticket: pTicket, prep: pPrep };
  }

  // Formata delta: +12% (success), -8% (danger), — (sem comparação).
  // Mais positivo SEMPRE = melhor, exceto pra TEMPO (menor = melhor).
  function delta(current: number, previous: number | undefined, lowerIsBetter = false): { text: string; positive: boolean } | undefined {
    if (previous === undefined || previous === 0) return undefined;
    const pct = ((current - previous) / previous) * 100;
    if (Math.abs(pct) < 0.5) return { text: "= mesmo", positive: true };
    const sign = pct > 0 ? "+" : "";
    const rounded = pct.toFixed(0);
    const isImprovement = lowerIsBetter ? pct < 0 : pct > 0;
    return { text: `${sign}${rounded}% ${ctx.comparisonLabel ?? "vs anterior"}`, positive: isImprovement };
  }

  const cards = [
    {
      label: "FATURAMENTO",
      value: formatBRL(revenue),
      accent: true,
      delta: delta(revenue, prevMetrics?.revenue),
    },
    {
      label: "PEDIDOS",
      value: String(valid.length),
      sub: ctx.orders.length > valid.length ? `${ctx.orders.length - valid.length} cancelados` : undefined,
      delta: delta(valid.length, prevMetrics?.count),
    },
    {
      label: "TICKET MÉDIO",
      value: formatBRL(avgTicket),
      delta: delta(avgTicket, prevMetrics?.ticket),
    },
    {
      label: "TEMPO MÉDIO",
      value: avgPrep > 0 ? `${avgPrep} min` : "—",
      sub: avgPrep > 0 ? "preparo" : undefined,
      delta: avgPrep > 0 ? delta(avgPrep, prevMetrics?.prep, true) : undefined,
    },
  ];

  const w = doc.page.width - M.left - M.right;
  const gap = 10;
  const cardW = (w - gap * (cards.length - 1)) / cards.length;
  // Cards com delta crescem 12pt pra acomodar a linha extra
  const cardH = prevMetrics ? 82 : 70;
  const startY = doc.y;

  cards.forEach((card, i) => {
    const x = M.left + i * (cardW + gap);
    drawCard(doc, x, startY, cardW, cardH, card);
  });
  doc.y = startY + cardH + 20;
  doc.x = M.left;
}

function drawCard(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  card: {
    label: string;
    value: string;
    sub?: string;
    accent?: boolean;
    delta?: { text: string; positive: boolean };
  },
) {
  doc.save();
  // Fundo + borda
  doc
    .roundedRect(x, y, w, h, 6)
    .fillAndStroke(card.accent ? C.yellow : C.surface, C.line);
  // Label — t-label
  doc
    .fillColor(card.accent ? C.ink : C.ink3)
    .font("Helvetica-Bold")
    .fontSize(T.label)
    .text(card.label, x + 10, y + 10, { width: w - 20, lineBreak: false });
  // Valor — t-h1 (ou h2 se longo)
  doc
    .fillColor(C.ink)
    .font("Helvetica-Bold")
    .fontSize(card.value.length > 10 ? T.h2 : T.h1)
    .text(card.value, x + 10, y + 24, { width: w - 20, lineBreak: false });
  // Delta (audit P3 #30) — empilha acima do sub se ambos existirem.
  // Verde quando melhora, vermelho quando piora. Texto compacto pra
  // caber em card 4-col estreito.
  if (card.delta) {
    doc
      .fillColor(card.delta.positive ? C.success : C.danger)
      .font("Helvetica-Bold")
      .fontSize(T.caption)
      .text(card.delta.text, x + 10, y + 48, { width: w - 20, lineBreak: false });
  }
  // Sub texto — t-caption (sempre no rodapé)
  if (card.sub) {
    doc
      .fillColor(card.accent ? C.ink2 : C.ink3)
      .font("Helvetica")
      .fontSize(T.caption)
      .text(card.sub, x + 10, y + h - 16, { width: w - 20, lineBreak: false });
  }
  doc.restore();
}

// ============================================================
//   RESUMO FINANCEIRO — bruto, descontos, líquido
// ============================================================

function drawFinancialSummary(doc: PDFKit.PDFDocument, ctx: ReportContext) {
  const valid = ctx.orders.filter((o) => o.status !== "CANCELADO");
  const gross = sum(valid, (o) => o.totalCents);
  const discount = sum(valid, (o) => o.discountCents ?? 0);
  const net = sum(valid, (o) => o.finalCents);
  const items = sum(valid, (o) => o.items.reduce((s, it) => s + it.quantity, 0));

  sectionTitle(doc, "Resumo financeiro");

  const rows: Array<[string, string, { bold?: boolean; color?: string }?]> = [
    ["Pedidos válidos", String(valid.length)],
    ["Itens vendidos", String(items)],
    ["Faturamento bruto", formatBRL(gross)],
  ];
  if (discount > 0) {
    rows.push(["Descontos aplicados", `- ${formatBRL(discount)}`, { color: C.success }]);
  }
  rows.push(["Faturamento líquido", formatBRL(net), { bold: true }]);

  for (const [label, value, opts] of rows) {
    twoCol(doc, label, value, opts);
  }
  doc.moveDown(0.5);
}

// ============================================================
//   PERFORMANCE — Vendas por atendente
// ============================================================

function drawOperators(doc: PDFKit.PDFDocument, ctx: ReportContext) {
  const valid = ctx.orders.filter((o) => o.status !== "CANCELADO");
  const rows = aggregateBy(valid, (o) => o.createdBy || "—");

  sectionTitle(doc, "Vendas por atendente", `${rows.length} ${rows.length === 1 ? "atendente" : "atendentes"} no período`);
  if (rows.length === 0) {
    placeholder(doc, "Sem dados de atendente.");
    return;
  }
  const maxRevenue = Math.max(...rows.map((r) => r.revenue));
  drawBarTable(doc, ["Atendente", "Pedidos", "Receita"], rows, maxRevenue);
}

function drawCooks(doc: PDFKit.PDFDocument, ctx: ReportContext) {
  const valid = ctx.orders.filter((o) => o.status !== "CANCELADO" && o.preparedBy);
  const rows = aggregateBy(valid, (o) => o.preparedBy ?? "—");

  sectionTitle(doc, "Preparo por cozinheiro", `${rows.length} ${rows.length === 1 ? "cozinheiro" : "cozinheiros"} no período`);
  if (rows.length === 0) {
    placeholder(doc, "Nenhum pedido foi pra cozinha (só bebidas).");
    return;
  }
  const maxRevenue = Math.max(...rows.map((r) => r.revenue));
  drawBarTable(doc, ["Cozinheiro", "Pedidos", "Receita"], rows, maxRevenue);
}

// ============================================================
//   GRÁFICO DE BARRAS — pedidos por hora
// ============================================================

function drawHourlyChart(doc: PDFKit.PDFDocument, ctx: ReportContext) {
  const valid = ctx.orders.filter((o) => o.status !== "CANCELADO");
  if (valid.length === 0) return;

  const byHour = new Map<number, { count: number; revenue: number }>();
  for (const o of valid) {
    const h = new Date(o.createdAt).getHours();
    const cur = byHour.get(h) ?? { count: 0, revenue: 0 };
    cur.count++;
    cur.revenue += o.finalCents;
    byHour.set(h, cur);
  }

  // Range de horas: do mínimo ao máximo com dados (+ padding 1h cada lado)
  const hours = [...byHour.keys()];
  const minH = Math.max(0, Math.min(...hours));
  const maxH = Math.min(23, Math.max(...hours));
  const range: number[] = [];
  for (let h = minH; h <= maxH; h++) range.push(h);

  sectionTitle(doc, "Pedidos por hora", `Pico: ${peakHour(byHour)}`);

  ensureSpace(doc, 150);

  const totalW = doc.page.width - M.left - M.right;
  const barAreaH = 90;
  const labelH = 12;
  const valLabelH = 12;
  const startY = doc.y;
  const baseY = startY + valLabelH + barAreaH;
  const barGap = 4;
  const barW = Math.max(8, (totalW - barGap * (range.length - 1)) / range.length);
  const maxCount = Math.max(...range.map((h) => byHour.get(h)?.count ?? 0));

  // Linha do eixo X
  doc
    .save()
    .lineWidth(0.5)
    .strokeColor(C.line)
    .moveTo(M.left, baseY)
    .lineTo(M.left + totalW, baseY)
    .stroke()
    .restore();

  range.forEach((h, i) => {
    const data = byHour.get(h);
    const count = data?.count ?? 0;
    const x = M.left + i * (barW + barGap);
    const barH = maxCount === 0 ? 0 : (count / maxCount) * barAreaH;
    const y = baseY - barH;
    if (count > 0) {
      doc.save();
      doc
        .roundedRect(x, y, barW, barH, 2)
        .fill(C.yellow);
      doc.restore();
      // Valor no topo da barra
      doc
        .font("Helvetica-Bold")
        .fontSize(7)
        .fillColor(C.ink2)
        .text(String(count), x, y - 9, { width: barW, align: "center", lineBreak: false });
    }
    // Hora no eixo X
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(C.ink3)
      .text(`${String(h).padStart(2, "0")}h`, x, baseY + 4, { width: barW, align: "center", lineBreak: false });
  });

  doc.y = baseY + labelH + 8;
  doc.x = M.left;
}

function peakHour(byHour: Map<number, { count: number; revenue: number }>): string {
  let peakH = -1;
  let peakC = 0;
  for (const [h, v] of byHour.entries()) {
    if (v.count > peakC) {
      peakC = v.count;
      peakH = h;
    }
  }
  return peakH === -1 ? "—" : `${String(peakH).padStart(2, "0")}h (${peakC} pedidos)`;
}

// ============================================================
//   TOP PRODUTOS — tabela com barra horizontal
// ============================================================

function drawTopProducts(doc: PDFKit.PDFDocument, ctx: ReportContext) {
  const valid = ctx.orders.filter((o) => o.status !== "CANCELADO");
  type Agg = { name: string; qty: number; revenue: number; count: number };
  const map = new Map<string, Agg>();
  for (const o of valid) {
    for (const it of o.items) {
      const name = (it.productName || it.kind || "?").trim();
      const cur = map.get(name) ?? { name, qty: 0, revenue: 0, count: 0 };
      cur.qty += it.quantity;
      cur.revenue += it.unitPrice * it.quantity;
      cur.count++;
      map.set(name, cur);
    }
  }
  const sorted = [...map.values()].sort((a, b) => b.revenue - a.revenue);

  sectionTitle(doc, "Top produtos por receita", sorted.length > 0 ? `${sorted.length} produtos distintos` : undefined);
  if (sorted.length === 0) {
    placeholder(doc, "Sem produtos vendidos.");
    return;
  }
  const maxRev = sorted[0].revenue;
  const rows = sorted.map((p) => ({
    key: p.name,
    count: p.qty,
    revenue: p.revenue,
  }));
  drawBarTable(doc, ["Produto", "Qtd", "Receita"], rows, maxRev);
}

// ============================================================
//   POR CATEGORIA — salgado, doce, bebida, macarrão, combo
// ============================================================

function drawByCategory(doc: PDFKit.PDFDocument, ctx: ReportContext) {
  const valid = ctx.orders.filter((o) => o.status !== "CANCELADO");
  const cats: Record<string, { label: string; qty: number; revenue: number }> = {
    salgado: { label: "Pastéis salgados", qty: 0, revenue: 0 },
    doce: { label: "Pastéis doces", qty: 0, revenue: 0 },
    bebida: { label: "Bebidas", qty: 0, revenue: 0 },
    macarrao: { label: "Macarrão", qty: 0, revenue: 0 },
    combo: { label: "Combos", qty: 0, revenue: 0 },
  };
  for (const o of valid) {
    for (const it of o.items) {
      const k = it.kind || "salgado";
      if (cats[k]) {
        cats[k].qty += it.quantity;
        cats[k].revenue += it.unitPrice * it.quantity;
      }
    }
  }
  const rows = Object.entries(cats)
    .filter(([, v]) => v.qty > 0)
    .map(([, v]) => ({ key: v.label, count: v.qty, revenue: v.revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  sectionTitle(doc, "Por categoria");
  if (rows.length === 0) {
    placeholder(doc, "Sem categorias.");
    return;
  }
  const maxRev = rows[0].revenue;
  drawBarTable(doc, ["Categoria", "Qtd", "Receita"], rows, maxRev);
}

// ============================================================
//   TOP INGREDIENTES — toppings + sabores + molhos
// ============================================================

function drawTopIngredients(doc: PDFKit.PDFDocument, ctx: ReportContext) {
  const valid = ctx.orders.filter((o) => o.status !== "CANCELADO");
  const toppings = new Map<string, number>();
  const flavors = new Map<string, number>();
  const sauces = new Map<string, number>();

  for (const o of valid) {
    for (const it of o.items) {
      const q = it.quantity;
      if (it.flavor) flavors.set(it.flavor, (flavors.get(it.flavor) ?? 0) + q);
      for (const t of it.toppings) toppings.set(t, (toppings.get(t) ?? 0) + q);
      for (const s of it.sauces) sauces.set(s, (sauces.get(s) ?? 0) + q);
    }
  }

  const topT = topN(toppings, 8);
  const topF = topN(flavors, 8);
  const topS = topN(sauces, 8);

  if (topT.length === 0 && topF.length === 0 && topS.length === 0) return;

  sectionTitle(doc, "Top ingredientes");

  const w = doc.page.width - M.left - M.right;
  const colW = (w - 16) / 2;
  const startY = doc.y;
  let leftY = startY;
  let rightY = startY;

  if (topT.length > 0) {
    leftY = drawIngredientColumn(doc, M.left, leftY, colW, "Toppings (salgados)", topT);
  }
  if (topF.length > 0) {
    rightY = drawIngredientColumn(doc, M.left + colW + 16, rightY, colW, "Sabores (doces)", topF);
  }
  // Molhos em duas colunas se ainda houver espaço, senão ocupa full width
  doc.y = Math.max(leftY, rightY) + 12;
  doc.x = M.left;
  if (topS.length > 0) {
    doc.y = drawIngredientColumn(doc, M.left, doc.y, colW, "Molhos", topS);
    doc.x = M.left;
  }
  doc.moveDown(0.5);
}

function drawIngredientColumn(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  title: string,
  rows: Array<{ key: string; count: number }>,
): number {
  doc
    .font("Helvetica-Bold")
    .fontSize(T.label)
    .fillColor(C.ink3)
    .text(title.toUpperCase(), x, y, { width: w, lineBreak: false });
  let cy = y + 14;
  const max = Math.max(...rows.map((r) => r.count));
  for (const r of rows) {
    const ratio = max === 0 ? 0 : r.count / max;
    // Nome
    doc
      .font("Helvetica")
      .fontSize(T.bodySm)
      .fillColor(C.ink)
      .text(r.key, x, cy, { width: w * 0.55, lineBreak: false });
    // Barra
    const barX = x + w * 0.6;
    const barW = w * 0.3;
    doc
      .save()
      .roundedRect(barX, cy + 3, barW, 6, 3)
      .fill(C.surfaceSunken)
      .restore();
    doc
      .save()
      .roundedRect(barX, cy + 3, barW * ratio, 6, 3)
      .fill(C.yellow)
      .restore();
    // Quantidade
    doc
      .font("Helvetica-Bold")
      .fontSize(T.bodySm)
      .fillColor(C.ink)
      .text(String(r.count), x + w - 26, cy, { width: 26, align: "right", lineBreak: false });
    cy += 14;
  }
  return cy;
}

// ============================================================
//   PROMOÇÕES — quais foram aplicadas e quanto desconto
// ============================================================

type PromoAgg = { name: string; count: number; discount: number };

function aggregatePromotions(orders: OrderView[]): PromoAgg[] {
  const map = new Map<string, PromoAgg>();
  for (const o of orders) {
    if (o.status === "CANCELADO") continue;
    if (!o.promotionName || !o.discountCents) continue;
    const cur = map.get(o.promotionName) ?? { name: o.promotionName, count: 0, discount: 0 };
    cur.count++;
    cur.discount += o.discountCents;
    map.set(o.promotionName, cur);
  }
  return [...map.values()].sort((a, b) => b.discount - a.discount);
}

function drawPromotions(doc: PDFKit.PDFDocument, promos: PromoAgg[]) {
  const total = promos.reduce((s, p) => s + p.discount, 0);
  const totalUses = promos.reduce((s, p) => s + p.count, 0);
  sectionTitle(
    doc,
    "Promoções aplicadas",
    `${totalUses} aplicações · ${formatBRL(total)} em desconto`,
  );
  ensureSpace(doc, 20 + promos.length * 18);
  tableHeader(doc, ["Promoção", "Aplicações", "Desconto"], [0.55, 0.2, 0.25]);
  promos.forEach((p, i) => {
    tableRow(doc, [p.name, String(p.count), formatBRL(p.discount)], [0.55, 0.2, 0.25], { zebra: i % 2 === 1 });
  });
  doc.moveDown(0.4);
}

// ============================================================
//   CANCELADOS — pedido + cliente + motivo + por quem
// ============================================================

function drawCancellations(doc: PDFKit.PDFDocument, cancelled: OrderView[]) {
  sectionTitle(doc, `Pedidos cancelados`, `${cancelled.length} no período`, C.danger);
  ensureSpace(doc, 20 + cancelled.length * 16);
  tableHeader(doc, ["#", "Cliente", "Motivo", "Cancelado por"], [0.1, 0.25, 0.4, 0.25]);
  cancelled.forEach((o, i) => {
    tableRow(
      doc,
      [
        `#${String(o.id).padStart(3, "0")}`,
        truncate(o.clientName, 22),
        truncate(o.cancelReason ?? "—", 36),
        truncate(o.cancelledBy ?? "—", 18),
      ],
      [0.1, 0.25, 0.4, 0.25],
      { zebra: i % 2 === 1 },
    );
  });
}

// ============================================================
//   LISTA DE PEDIDOS — auditoria fim-a-fim
// ============================================================

function drawOrderList(doc: PDFKit.PDFDocument, orders: OrderView[]) {
  sectionTitle(doc, "Pedidos detalhados", `${orders.length} no total — auditoria completa`);
  ensureSpace(doc, 40);

  const cols = ["#", "Cliente", "Itens", "Status", "Hora", "Total"];
  const colWidths = [0.07, 0.18, 0.4, 0.1, 0.12, 0.13];
  tableHeader(doc, cols, colWidths);

  const totalW = doc.page.width - M.left - M.right;
  const itemsW = totalW * colWidths[2] - 8;

  orders.forEach((o, i) => {
    const itemsDesc = describeOrderItems(o.items);
    const row = [
      `#${String(o.id).padStart(3, "0")}`,
      truncate(o.clientName, 18),
      itemsDesc,
      statusShort(o.status),
      new Date(o.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      formatBRL(o.finalCents),
    ];
    // Calcula altura da row antecipadamente
    doc.font("Helvetica").fontSize(8);
    const itemsH = doc.heightOfString(itemsDesc, { width: itemsW });
    const rowH = Math.max(14, itemsH + 4);

    // Se a row não cabe na página atual, força nova página + redesenha header
    const remaining = doc.page.height - M.bottom - doc.y;
    if (rowH + 2 > remaining) {
      doc.addPage();
      tableHeader(doc, cols, colWidths);
    }
    tableRowWithItems(doc, row, colWidths, {
      zebra: i % 2 === 1,
      cancelled: o.status === "CANCELADO",
    });
  });
}

function describeOrderItems(items: OrderItemView[]): string {
  return items
    .map((it) => {
      const name = it.productName || it.kind || "?";
      const size = it.size && SIZE_LABEL[it.size] ? ` ${SIZE_LABEL[it.size]}` : it.size ? ` ${it.size}` : "";
      const qty = it.quantity > 1 ? `${it.quantity}× ` : "";
      const flavor = it.flavor ? ` (${it.flavor})` : "";
      const tops = it.toppings.length > 0 ? ` (${it.toppings.join(", ")})` : "";
      return `${qty}${name}${size}${flavor}${tops}`;
    })
    .join(" · ");
}

function statusShort(s: string): string {
  return (
    {
      PEDIDO_FEITO: "Aberto",
      EM_PREPARO: "Preparo",
      PRONTO: "Pronto",
      ENTREGUE: "Entregue",
      CANCELADO: "Cancelado",
    }[s] ?? s
  );
}

// ============================================================
//   FOOTER — paginação + data de geração
// ============================================================

function addFootersAndPageNumbers(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();
  const total = range.count;
  const genStamp = new Date().toLocaleString("pt-BR");
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Desativa bottom margin pra escrever embaixo sem disparar auto-pagination
    const origBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const w = doc.page.width;
    const h = doc.page.height;
    const y = h - 32;
    // Linha fina acima do footer
    doc
      .save()
      .lineWidth(0.5)
      .strokeColor(C.line)
      .moveTo(M.left, y)
      .lineTo(w - M.right, y)
      .stroke()
      .restore();
    doc
      .font("Helvetica")
      .fontSize(T.label)
      .fillColor(C.ink3)
      .text(`Gerado em ${genStamp}`, M.left, y + 8, {
        width: 300,
        align: "left",
        lineBreak: false,
      });
    doc.text(`Página ${i + 1} de ${total}`, w - M.right - 200, y + 8, {
      width: 200,
      align: "right",
      lineBreak: false,
    });

    doc.page.margins.bottom = origBottom;
  }
}

// ============================================================
//   HELPERS — primitivos reutilizáveis
// ============================================================

function sectionTitle(
  doc: PDFKit.PDFDocument,
  title: string,
  sub?: string,
  color: string = C.ink,
) {
  ensureSpace(doc, sub ? 50 : 36);
  doc.x = M.left;
  const y = doc.y;
  // Acento amarelo vertical na esquerda
  doc
    .save()
    .rect(M.left - 6, y + 3, 3, 13)
    .fill(C.yellow)
    .restore();
  // Título — t-h2 (sections do PDF são "h2" semanticamente)
  doc
    .font("Helvetica-Bold")
    .fontSize(T.h2)
    .fillColor(color)
    .text(title, M.left, y, { lineBreak: false });
  doc.y = y + T.h2 + 4;
  if (sub) {
    doc
      .font("Helvetica")
      .fontSize(T.bodySm)
      .fillColor(C.ink3)
      .text(sub, M.left, doc.y, { lineBreak: false });
    doc.y += T.bodySm + 2;
  }
  doc.y += 6;
  doc.x = M.left;
}

function placeholder(doc: PDFKit.PDFDocument, text: string) {
  doc
    .font("Helvetica-Oblique")
    .fontSize(T.bodySm)
    .fillColor(C.ink3)
    .text(text, M.left, doc.y);
  doc.moveDown(0.5);
}

function twoCol(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  opts: { bold?: boolean; color?: string } = {},
) {
  const leftX = M.left;
  const rightEdge = doc.page.width - M.right;
  const y = doc.y;
  doc
    .font("Helvetica")
    .fontSize(T.body)
    .fillColor(C.ink2)
    .text(label, leftX, y, { width: 220, lineBreak: false });
  doc
    .font(opts.bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(opts.bold ? T.bodyLg : T.body)
    .fillColor(opts.color ?? C.ink)
    .text(value, leftX, y, { width: rightEdge - leftX, align: "right", lineBreak: false });
  doc.moveDown(0.45);
}

function tableHeader(
  doc: PDFKit.PDFDocument,
  cols: string[],
  weights: number[],
) {
  const leftX = M.left;
  const totalW = doc.page.width - M.left - M.right;
  const y = doc.y;
  // Background do header
  doc.save().rect(leftX, y - 2, totalW, 16).fill(C.surfaceSunken).restore();
  doc.font("Helvetica-Bold").fontSize(T.label).fillColor(C.ink2);
  let cx = leftX;
  for (let i = 0; i < cols.length; i++) {
    const w = totalW * weights[i];
    const align = i === 0 || (i === 1 && weights.length > 3) ? "left" : "right";
    doc.text(cols[i].toUpperCase(), cx + 4, y + 2, { width: w - 8, align, lineBreak: false });
    cx += w;
  }
  doc.y = y + 16;
  doc.x = leftX;
}

function tableRow(
  doc: PDFKit.PDFDocument,
  cols: string[],
  weights: number[],
  opts: { zebra?: boolean; color?: string } = {},
) {
  ensureSpace(doc, 18);
  const leftX = M.left;
  const totalW = doc.page.width - M.left - M.right;
  const y = doc.y;
  if (opts.zebra) {
    doc.save().rect(leftX, y - 2, totalW, 16).fill(C.surface).restore();
  }
  doc.font("Helvetica").fontSize(T.body).fillColor(opts.color ?? C.ink);
  let cx = leftX;
  for (let i = 0; i < cols.length; i++) {
    const w = totalW * weights[i];
    const align = i === 0 || (i === 1 && weights.length > 3) ? "left" : "right";
    doc.text(cols[i], cx + 4, y + 1, { width: w - 8, align, lineBreak: false });
    cx += w;
  }
  doc.y = y + 16;
  doc.x = leftX;
}

function tableRowWithItems(
  doc: PDFKit.PDFDocument,
  cols: string[],
  weights: number[],
  opts: { zebra?: boolean; cancelled?: boolean } = {},
) {
  const leftX = M.left;
  const totalW = doc.page.width - M.left - M.right;
  const itemsW = totalW * weights[2] - 8;
  doc.font("Helvetica").fontSize(T.label);
  const itemsH = doc.heightOfString(cols[2], { width: itemsW });
  const rowH = Math.max(14, itemsH + 4);
  ensureSpace(doc, rowH + 2);
  const y = doc.y;

  if (opts.cancelled) {
    doc.save().rect(leftX, y - 1, totalW, rowH).fill(C.dangerBg).restore();
  } else if (opts.zebra) {
    doc.save().rect(leftX, y - 1, totalW, rowH).fill(C.surface).restore();
  }

  const baseColor = opts.cancelled ? C.danger : C.ink;
  const lastIdx = cols.length - 1;

  let cx = leftX;
  for (let i = 0; i < cols.length; i++) {
    const w = totalW * weights[i];
    // Última coluna (Total) e penúltima (Hora) à direita
    const align = i >= lastIdx - 1 ? "right" : "left";
    const isBold = i === 0 || i === lastIdx;
    const fontSize = i === 2 ? T.label : T.bodySm;
    doc
      .font(isBold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(fontSize)
      .fillColor(baseColor);
    doc.text(cols[i], cx + 4, y + 1, { width: w - 8, align });
    cx += w;
  }
  doc.y = y + rowH;
  doc.x = leftX;
}

function estimateRowHeight(doc: PDFKit.PDFDocument, text: string, width: number): number {
  // pdfkit calcula altura — usamos heightOfString
  doc.font("Helvetica").fontSize(T.label);
  return doc.heightOfString(text, { width });
}

/**
 * Tabela com barra horizontal proporcional. Cada row tem:
 * label | count | revenue + barra de fundo proporcional ao max.
 * Header se repete quando a tabela quebra de página.
 */
function drawBarTable(
  doc: PDFKit.PDFDocument,
  cols: string[],
  rows: Array<{ key: string; count: number; revenue: number }>,
  maxRevenue: number,
) {
  const leftX = M.left;
  const totalW = doc.page.width - M.left - M.right;

  function drawHeader() {
    const hy = doc.y;
    doc.save().rect(leftX, hy - 2, totalW, 16).fill(C.surfaceSunken).restore();
    doc.font("Helvetica-Bold").fontSize(T.label).fillColor(C.ink2);
    doc.text(cols[0].toUpperCase(), leftX + 4, hy + 2, { width: totalW * 0.55 - 8, lineBreak: false });
    doc.text(cols[1].toUpperCase(), leftX + totalW * 0.55, hy + 2, { width: totalW * 0.15 - 8, align: "right", lineBreak: false });
    doc.text(cols[2].toUpperCase(), leftX + totalW * 0.7, hy + 2, { width: totalW * 0.3 - 8, align: "right", lineBreak: false });
    doc.y = hy + 16;
  }

  // Garantir espaço pro header + pelo menos 3 rows pra não quebrar logo na primeira
  const minRows = Math.min(rows.length, 3);
  ensureSpace(doc, 22 + minRows * 22);
  drawHeader();

  rows.forEach((r, i) => {
    const pageBefore = doc.bufferedPageRange().count;
    ensureSpace(doc, 22);
    if (doc.bufferedPageRange().count > pageBefore) {
      drawHeader(); // continuou em nova página — repete o cabeçalho
    }
    const y = doc.y;
    const rowH = 20;
    if (i % 2 === 1) {
      doc.save().rect(leftX, y, totalW, rowH).fill(C.surface).restore();
    }
    // Barra proporcional dentro da última coluna
    const barX = leftX + totalW * 0.55;
    const barW = totalW * 0.45 - 4;
    const ratio = maxRevenue === 0 ? 0 : r.revenue / maxRevenue;
    doc
      .save()
      .roundedRect(barX, y + 6, barW, 8, 4)
      .fill(C.surfaceSunken)
      .restore();
    doc
      .save()
      .roundedRect(barX, y + 6, barW * ratio, 8, 4)
      .fill(C.yellow)
      .restore();
    doc.font("Helvetica-Bold").fontSize(T.bodySm).fillColor(C.ink);
    doc.text(r.key, leftX + 4, y + 5, { width: totalW * 0.5 - 8, lineBreak: false });
    doc.font("Helvetica").fontSize(T.bodySm).fillColor(C.ink2);
    doc.text(String(r.count), leftX + totalW * 0.55, y + 5, { width: totalW * 0.15 - 8, align: "right", lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(T.bodySm).fillColor(C.ink);
    doc.text(formatBRL(r.revenue), leftX + totalW * 0.7, y + 5, { width: totalW * 0.3 - 8, align: "right", lineBreak: false });
    doc.y = y + rowH;
  });
  doc.x = leftX;
  doc.moveDown(0.4);
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  const available = doc.page.height - M.bottom - doc.y;
  if (available < needed) {
    doc.addPage();
  }
}

function sum<T>(arr: T[], fn: (x: T) => number): number {
  return arr.reduce((s, x) => s + fn(x), 0);
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

function topN(map: Map<string, number>, n: number): Array<{ key: string; count: number }> {
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

function aggregateBy(
  orders: OrderView[],
  keyFn: (o: OrderView) => string,
): Array<{ key: string; count: number; revenue: number }> {
  const map = new Map<string, { count: number; revenue: number }>();
  for (const o of orders) {
    const k = keyFn(o);
    const cur = map.get(k) ?? { count: 0, revenue: 0 };
    cur.count++;
    cur.revenue += o.finalCents;
    map.set(k, cur);
  }
  return [...map.entries()]
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.revenue - a.revenue);
}
