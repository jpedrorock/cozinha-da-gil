import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializePromotion } from "@/lib/promotions";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asStr(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function asInt(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.floor(n) : null;
}
function asBool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}
function asDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireRole(["admin"]);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  const fields: Array<[string, (v: unknown) => unknown]> = [
    ["name", asStr],
    ["description", asStr],
    ["discountType", asStr],
    ["discountValue", asInt],
    ["active", asBool],
    ["validFromDate", asDate],
    ["validUntilDate", asDate],
    ["minItems", asInt],
    ["minTotalCents", asInt],
  ];
  for (const [key, parser] of fields) {
    if (body[key] !== undefined) {
      const parsed = parser(body[key]);
      if (parsed !== undefined) data[key] = parsed;
    }
  }
  if (body.appliesToProductIds !== undefined) {
    const ids = Array.isArray(body.appliesToProductIds)
      ? body.appliesToProductIds.filter((x): x is string => typeof x === "string")
      : [];
    data.appliesToProductIds = JSON.stringify(ids);
  }
  if (body.couponCode !== undefined) {
    const raw = asStr(body.couponCode);
    data.couponCode = raw ? raw.toUpperCase().replace(/\s+/g, "") : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada pra atualizar." }, { status: 400 });
  }

  try {
    const promo = await prisma.promotion.update({ where: { id: params.id }, data });
    return NextResponse.json(serializePromotion(promo));
  } catch {
    return NextResponse.json({ error: "Promoção não encontrada." }, { status: 404 });
  }
}

export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireRole(["admin"]);
  if (auth instanceof NextResponse) return auth;

  // Mantém pedidos que aplicaram essa promoção (promotionId vira null via FK)
  try {
    await prisma.promotion.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Promoção não encontrada." }, { status: 404 });
  }
}
