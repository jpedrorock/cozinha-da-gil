import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeProduct } from "@/lib/products";
import { requireRole } from "@/lib/session";
import { saveProductImage } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/products — lista produtos com seus tamanhos.
 * Query: ?type=salgado|doce|bebida|macarrao|combo (opcional)
 *        ?available=true (opcional — só os ativos)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const onlyAvailable = url.searchParams.get("available") === "true";

  const where: { type?: string; available?: boolean } = {};
  if (type) where.type = type;
  if (onlyAvailable) where.available = true;

  const products = await prisma.product.findMany({
    where,
    include: { sizes: { orderBy: { position: "asc" } } },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(products.map(serializeProduct));
}

type ProductBody = {
  name?: unknown;
  type?: unknown;
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
  sizes?: unknown;
};

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
function asImageDataUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  if (!/^data:image\/(svg\+xml|png);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) return null;
  if (trimmed.length > 280_000) return null;
  return trimmed;
}

const ALLOWED_TYPES = ["salgado", "doce", "bebida", "macarrao", "combo"];
const ALLOWED_PRICING = ["fixed", "by_size"];

/**
 * POST /api/products — cria produto novo + sizes inline.
 * Body: { name, type, pricingMode, basePriceCents?, sizes?: [{name, description?, priceCents}], ... }
 */
export async function POST(request: Request) {
  const auth = await requireRole(["admin"]);
  if (auth instanceof NextResponse) return auth;

  let body: ProductBody;
  try {
    body = (await request.json()) as ProductBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const name = asStr(body.name);
  const type = asStr(body.type);
  const pricingMode = asStr(body.pricingMode) ?? "fixed";

  if (!name) return NextResponse.json({ error: "Nome obrigatório." }, { status: 400 });
  if (!type || !ALLOWED_TYPES.includes(type)) {
    return NextResponse.json({ error: `Tipo inválido. Use: ${ALLOWED_TYPES.join(", ")}.` }, { status: 400 });
  }
  if (!ALLOWED_PRICING.includes(pricingMode)) {
    return NextResponse.json({ error: "pricingMode deve ser 'fixed' ou 'by_size'." }, { status: 400 });
  }

  const sizesInput = Array.isArray(body.sizes) ? body.sizes : [];
  if (pricingMode === "by_size" && sizesInput.length === 0) {
    return NextResponse.json(
      { error: "Produto by_size precisa de pelo menos 1 tamanho." },
      { status: 400 },
    );
  }
  if (pricingMode === "fixed" && asInt(body.basePriceCents) === null) {
    return NextResponse.json(
      { error: "Produto fixed precisa de basePriceCents." },
      { status: 400 },
    );
  }

  try {
    const product = await prisma.product.create({
      data: {
        name,
        type,
        pricingMode,
        basePriceCents: pricingMode === "fixed" ? asInt(body.basePriceCents) : null,
        available: asBool(body.available, true),
        position: asInt(body.position) ?? 0,
        allowsIngredients: asBool(body.allowsIngredients, false),
        ingredientCategory: asStr(body.ingredientCategory),
        maxIngredients: asInt(body.maxIngredients),
        minIngredients: asInt(body.minIngredients),
        allowsSauces: asBool(body.allowsSauces, false),
        sauceCategory: asStr(body.sauceCategory),
        stock: asInt(body.stock),
        lowStockThreshold: asInt(body.lowStockThreshold),
        // imageDataUrl criado primeiro só pra ter ID; depois decode +
        // salva em disco e converte pra imageUrl no UPDATE abaixo.
        sizes:
          sizesInput.length > 0
            ? {
                create: sizesInput.map((s, i) => {
                  const sd = s as Record<string, unknown>;
                  return {
                    name: asStr(sd.name) ?? `Tamanho ${i + 1}`,
                    description: asStr(sd.description),
                    priceCents: asInt(sd.priceCents) ?? 0,
                    position: asInt(sd.position) ?? i,
                  };
                }),
              }
            : undefined,
      },
      include: { sizes: true },
    });

    // Audit #63: se admin mandou imageDataUrl, decodifica e grava no
    // filesystem (volume Coolify) em vez de inflar o row no DB.
    // imageDataUrl nunca persistido nessa flow nova.
    const incomingImage = asImageDataUrl(body.imageDataUrl);
    let final = product;
    if (incomingImage) {
      const imageUrl = await saveProductImage(product.id, incomingImage, null);
      if (imageUrl) {
        final = await prisma.product.update({
          where: { id: product.id },
          data: { imageUrl },
          include: { sizes: true },
        });
      }
    }
    return NextResponse.json(serializeProduct(final), { status: 201 });
  } catch (err) {
    const msg =
      err instanceof Error && err.message.includes("Unique constraint")
        ? `Já existe um produto "${name}" desse tipo.`
        : "Erro ao criar produto.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
