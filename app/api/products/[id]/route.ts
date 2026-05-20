import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeProduct } from "@/lib/products";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProductPatch = {
  name?: unknown;
  pricingMode?: unknown;
  basePriceCents?: unknown;
  available?: unknown;
  position?: unknown;
  allowsIngredients?: unknown;
  ingredientCategory?: unknown;
  maxIngredients?: unknown;
  minIngredients?: unknown;
  allowsSauces?: unknown;
  sauceCategory?: unknown;
  stock?: unknown;
  lowStockThreshold?: unknown;
  imageDataUrl?: unknown;
};

/** Valida data URI de SVG/PNG e limita a 200KB. Retorna string OK ou null. */
function asImageDataUrl(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  if (!trimmed) return null;
  // Aceita só SVG ou PNG base64
  const match = /^data:image\/(svg\+xml|png);base64,([A-Za-z0-9+/=]+)$/.exec(trimmed);
  if (!match) return undefined;
  // Limite ~200KB de payload base64
  if (trimmed.length > 280_000) return undefined;
  return trimmed;
}

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

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole(["admin"]);
  if (auth instanceof NextResponse) return auth;

  let body: ProductPatch;
  try {
    body = (await request.json()) as ProductPatch;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  const fields: Array<[keyof ProductPatch, (v: unknown) => unknown]> = [
    ["name", asStr],
    ["pricingMode", asStr],
    ["basePriceCents", asInt],
    ["available", asBool],
    ["position", asInt],
    ["allowsIngredients", asBool],
    ["ingredientCategory", asStr],
    ["maxIngredients", asInt],
    ["minIngredients", asInt],
    ["allowsSauces", asBool],
    ["sauceCategory", asStr],
    ["stock", asInt],
    ["lowStockThreshold", asInt],
    ["imageDataUrl", asImageDataUrl],
  ];
  for (const [key, parser] of fields) {
    if (body[key] !== undefined) {
      const parsed = parser(body[key]);
      if (parsed !== undefined) data[key] = parsed;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada pra atualizar." }, { status: 400 });
  }

  try {
    const product = await prisma.product.update({
      where: { id: params.id },
      data,
      include: { sizes: true },
    });
    return NextResponse.json(serializeProduct(product));
  } catch {
    return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
  }
}

/**
 * DELETE — só permitido se não tem OrderItem referenciando.
 * Caso contrário, soft-disable com PATCH { available: false }.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole(["admin"]);
  if (auth instanceof NextResponse) return auth;

  const referenced = await prisma.orderItem.count({ where: { productId: params.id } });
  if (referenced > 0) {
    return NextResponse.json(
      {
        error: `Não dá pra apagar — ${referenced} pedido(s) já usaram esse produto. Desative no toggle "Disponível" pra esconder do atendente.`,
      },
      { status: 409 },
    );
  }
  try {
    await prisma.product.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
  }
}
