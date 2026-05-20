import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializePromotion } from "@/lib/promotions";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asStr(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function asInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.floor(n) : null;
}
function asBool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}
function asDate(v: unknown): Date | null {
  if (!v) return null;
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

const ALLOWED_TYPES = ["percent", "fixed_cents", "free_item"];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const onlyActive = url.searchParams.get("active") === "true";
  const where = onlyActive ? { active: true } : {};
  const promos = await prisma.promotion.findMany({ where, orderBy: { createdAt: "desc" } });
  return NextResponse.json(promos.map(serializePromotion));
}

type PromoBody = {
  name?: unknown;
  description?: unknown;
  discountType?: unknown;
  discountValue?: unknown;
  active?: unknown;
  validFromDate?: unknown;
  validUntilDate?: unknown;
  appliesToProductIds?: unknown;
  minItems?: unknown;
  minTotalCents?: unknown;
  couponCode?: unknown;
  operator?: unknown;
};

export async function POST(request: Request) {
  const auth = await requireRole(["admin"]);
  if (auth instanceof NextResponse) return auth;

  let body: PromoBody;
  try {
    body = (await request.json()) as PromoBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const name = asStr(body.name);
  const discountType = asStr(body.discountType);
  const discountValue = asInt(body.discountValue);

  if (!name) return NextResponse.json({ error: "Nome obrigatório." }, { status: 400 });
  if (!discountType || !ALLOWED_TYPES.includes(discountType)) {
    return NextResponse.json({ error: `Tipo inválido. Use: ${ALLOWED_TYPES.join(", ")}.` }, { status: 400 });
  }
  if (discountValue === null || discountValue < 0) {
    return NextResponse.json({ error: "Valor de desconto obrigatório (≥0)." }, { status: 400 });
  }
  if (discountType === "percent" && discountValue > 100) {
    return NextResponse.json({ error: "Percentual deve ser ≤100." }, { status: 400 });
  }

  const appliesIds = Array.isArray(body.appliesToProductIds)
    ? body.appliesToProductIds.filter((x): x is string => typeof x === "string")
    : [];

  // Cupom (opcional). Normaliza pra UPPERCASE. Único — colisão dá 409.
  const couponRaw = asStr(body.couponCode);
  const couponCode = couponRaw ? couponRaw.toUpperCase().replace(/\s+/g, "") : null;

  try {
    const promo = await prisma.promotion.create({
      data: {
        name,
        description: asStr(body.description),
        discountType,
        discountValue,
        active: asBool(body.active, true),
        validFromDate: asDate(body.validFromDate),
        validUntilDate: asDate(body.validUntilDate),
        appliesToProductIds: JSON.stringify(appliesIds),
        minItems: asInt(body.minItems),
        minTotalCents: asInt(body.minTotalCents),
        couponCode,
        createdBy: asStr(body.operator) ?? "—",
      },
    });
    return NextResponse.json(serializePromotion(promo), { status: 201 });
  } catch (err) {
    const msg =
      err instanceof Error && err.message.includes("Unique constraint")
        ? `Já existe promoção com cupom "${couponCode}".`
        : "Erro ao criar promoção.";
    return NextResponse.json({ error: msg }, { status: 409 });
  }
}
