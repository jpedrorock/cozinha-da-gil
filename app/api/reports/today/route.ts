import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseExtras } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = startOfDay(d);
  x.setDate(x.getDate() + 1);
  return x;
}

function parseDate(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fromParam = parseDate(url.searchParams.get("from"));
  const toParam = parseDate(url.searchParams.get("to"));
  const dateParam = parseDate(url.searchParams.get("date"));

  const today = new Date();
  // Compatibilidade: aceita ?date= (formato antigo) ou ?from=&to=
  const start = fromParam
    ? startOfDay(fromParam)
    : dateParam
    ? startOfDay(dateParam)
    : startOfDay(today);
  const end = toParam ? endOfDay(toParam) : dateParam ? endOfDay(dateParam) : endOfDay(today);

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: start, lt: end } },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });

  const active = orders.filter((o) => o.status !== "CANCELADO");
  const delivered = active.filter((o) => o.status === "ENTREGUE");
  const cancelled = orders.filter((o) => o.status === "CANCELADO");

  const revenueCents = active.reduce(
    (sum, o) => sum + o.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
    0,
  );

  const totalItems = active.reduce(
    (sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0),
    0,
  );

  // Decide buckets: por hora se 1 dia só, por dia se mais.
  const msInDay = 24 * 60 * 60 * 1000;
  const daySpan = Math.round((end.getTime() - start.getTime()) / msInDay);
  const groupBy: "hour" | "day" = daySpan <= 1 ? "hour" : "day";

  const byHour: Record<number, { count: number; revenueCents: number }> = {};
  let byDay: Array<{ date: string; count: number; revenueCents: number }> = [];

  if (groupBy === "hour") {
    for (let h = 0; h < 24; h++) byHour[h] = { count: 0, revenueCents: 0 };
    for (const o of active) {
      const h = new Date(o.createdAt).getHours();
      const items = o.items.reduce((s, i) => s + i.quantity, 0);
      const rev = o.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      byHour[h].count += 1;
      byHour[h].revenueCents += rev;
      void items;
    }
  } else {
    const buckets = new Map<string, { count: number; revenueCents: number }>();
    for (
      let d = new Date(start);
      d.getTime() < end.getTime();
      d.setDate(d.getDate() + 1)
    ) {
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, { count: 0, revenueCents: 0 });
    }
    for (const o of active) {
      const key = new Date(o.createdAt).toISOString().slice(0, 10);
      const b = buckets.get(key) ?? { count: 0, revenueCents: 0 };
      const rev = o.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      b.count += 1;
      b.revenueCents += rev;
      buckets.set(key, b);
    }
    byDay = Array.from(buckets.entries()).map(([date, v]) => ({ date, ...v }));
  }

  // Top toppings/sabores/molhos — agora considerando quantity E receita.
  // Audit-Crit B #11: além de "Catupiry apareceu em 12 pedidos", admin
  // quer saber "Catupiry gerou R$ 350 essa semana". Split share-based
  // dentro de cada categoria — sum por categoria ≈ revenue total.
  type Agg = { count: number; revenueCents: number };
  const toppingAgg: Record<string, Agg> = {};
  const flavorAgg: Record<string, Agg> = {};
  const sauceAgg: Record<string, Agg> = {};
  let salgadoCount = 0;
  let doceCount = 0;
  let pequenoCount = 0;
  let grandeCount = 0;
  let normalCount = 0;
  let miniCount = 0;

  function bump(record: Record<string, Agg>, key: string, count: number, revenue: number) {
    const cur = record[key] ?? { count: 0, revenueCents: 0 };
    cur.count += count;
    cur.revenueCents += revenue;
    record[key] = cur;
  }

  for (const o of active) {
    for (const item of o.items) {
      const qty = item.quantity || 1;
      const itemRevenue = item.unitPrice * qty;

      if (item.kind === "salgado") {
        salgadoCount += qty;
        if (item.size === "pequeno") pequenoCount += qty;
        if (item.size === "grande") grandeCount += qty;
        const toppings = parseExtras(item.toppings);
        // Share por topping pra somar ≈ total receita salgado
        const share = toppings.length > 0 ? itemRevenue / toppings.length : 0;
        for (const t of toppings) {
          bump(toppingAgg, t, qty, share);
        }
      }
      if (item.kind === "doce") {
        doceCount += qty;
        if (item.size === "normal") normalCount += qty;
        if (item.size === "mini") miniCount += qty;
        // Doce só tem 1 sabor — recebe receita inteira
        if (item.flavor) bump(flavorAgg, item.flavor, qty, itemRevenue);
      }
      const sauces = parseExtras(item.sauces);
      const sauceShare = sauces.length > 0 ? itemRevenue / sauces.length : 0;
      for (const s of sauces) {
        bump(sauceAgg, s, qty, sauceShare);
      }
    }
  }

  function top(record: Record<string, Agg>, n = 5) {
    return Object.entries(record)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, n)
      .map(([name, agg]) => ({
        name,
        count: agg.count,
        revenueCents: Math.round(agg.revenueCents),
      }));
  }

  // Tempos médios
  const prepDurations: number[] = [];
  const waitDurations: number[] = [];
  const totalDurations: number[] = [];
  for (const o of active) {
    if (o.preparedAt) {
      waitDurations.push(
        (new Date(o.preparedAt).getTime() - new Date(o.createdAt).getTime()) / 1000,
      );
    }
    if (o.preparedAt && o.readyAt) {
      prepDurations.push(
        (new Date(o.readyAt).getTime() - new Date(o.preparedAt).getTime()) / 1000,
      );
    }
    if (o.deliveredAt) {
      totalDurations.push(
        (new Date(o.deliveredAt).getTime() - new Date(o.createdAt).getTime()) / 1000,
      );
    }
  }

  function avg(arr: number[]) {
    if (arr.length === 0) return null;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  return NextResponse.json({
    from: start.toISOString(),
    to: end.toISOString(),
    daySpan,
    groupBy,
    counts: {
      total: orders.length,
      active: active.length,
      delivered: delivered.length,
      cancelled: cancelled.length,
      itemsTotal: totalItems,
      salgados: salgadoCount,
      doces: doceCount,
      pequenos: pequenoCount,
      grandes: grandeCount,
      docesNormais: normalCount,
      miniPacks: miniCount,
    },
    revenueCents,
    avgTicketCents: active.length > 0 ? Math.round(revenueCents / active.length) : 0,
    byHour: groupBy === "hour" ? byHour : null,
    byDay: groupBy === "day" ? byDay : null,
    top: {
      toppings: top(toppingAgg),
      flavors: top(flavorAgg),
      sauces: top(sauceAgg),
    },
    timings: {
      avgWaitSec: avg(waitDurations),
      avgPrepSec: avg(prepDurations),
      avgTotalSec: avg(totalDurations),
    },
  });
}
