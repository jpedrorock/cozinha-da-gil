import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Ingredient } from "@prisma/client";
import { requireRole } from "@/lib/session";
import { broadcast } from "@/lib/sse";
import { saveIngredientImage } from "@/lib/uploads";
import {
  ALLOWED_CATEGORIES,
  isAllowedCategory,
  validateIngredientName,
  parseIconValue,
} from "@/lib/ingredients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type IngredientsByCategory = Record<string, Ingredient[]>;

export async function GET() {
  const all = await prisma.ingredient.findMany({
    orderBy: [{ category: "asc" }, { position: "asc" }],
  });

  const grouped: IngredientsByCategory = {};
  for (const ing of all) {
    (grouped[ing.category] ??= []).push(ing);
  }

  return NextResponse.json(grouped);
}

/**
 * POST /api/ingredients
 *
 * Cria ingrediente novo. Body:
 *   { name, category, icon? }
 *
 * `icon` aceita:
 *   - null / undefined          → sem ícone
 *   - "prefix:name" (Iconify)   → grava como string
 *   - "data:image/(svg|png);b64,..." → decodifica, salva em
 *     /uploads/ingredients/ e grava o path resultante
 *   - "/api/uploads/ingredients/..." → já é path, mantém
 *
 * Unique constraint `(category, name)` evita duplicata na mesma
 * categoria. Trim defensivo no nome.
 */
export async function POST(request: Request) {
  const auth = await requireRole(["admin"]);
  if (auth instanceof NextResponse) return auth;

  let body: { name?: unknown; category?: unknown; icon?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const nameResult = validateIngredientName(body.name);
  if (!nameResult.ok) {
    return NextResponse.json({ error: nameResult.error }, { status: 400 });
  }
  const name = nameResult.name;

  if (!isAllowedCategory(body.category)) {
    return NextResponse.json(
      { error: `Categoria inválida. Use uma de: ${ALLOWED_CATEGORIES.join(", ")}.` },
      { status: 400 },
    );
  }

  // Resolve ícone — pode virar arquivo se for data URI.
  let iconValue: string | null = null;
  const iconParsed = parseIconValue(body.icon);
  if (iconParsed.kind === "invalid") {
    return NextResponse.json({ error: "Formato de ícone inválido." }, { status: 400 });
  } else if (iconParsed.kind === "data-uri") {
    const url = await saveIngredientImage(iconParsed.value, null);
    if (!url) {
      return NextResponse.json(
        { error: "Imagem inválida — use SVG ou PNG até alguns MB." },
        { status: 400 },
      );
    }
    iconValue = url;
  } else if (iconParsed.kind === "iconify" || iconParsed.kind === "upload-path") {
    iconValue = iconParsed.value;
  }

  // Calcula posição = última + 1 dentro da categoria
  const last = await prisma.ingredient.findFirst({
    where: { category: body.category },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const nextPosition = (last?.position ?? -1) + 1;

  try {
    const ingredient = await prisma.ingredient.create({
      data: {
        name,
        category: body.category,
        icon: iconValue,
        available: true,
        position: nextPosition,
      },
    });
    broadcast("ingredient:updated", {
      id: ingredient.id,
      name: ingredient.name,
      category: ingredient.category,
      available: ingredient.available,
      stock: ingredient.stock,
      lowStockThreshold: ingredient.lowStockThreshold,
    });
    return NextResponse.json(ingredient, { status: 201 });
  } catch (err) {
    // Unique constraint (category, name) — nome já existe nessa categoria
    if (typeof err === "object" && err && "code" in err && (err as { code: string }).code === "P2002") {
      return NextResponse.json(
        { error: `Já existe um ingrediente "${name}" nessa categoria.` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Falha ao criar ingrediente." }, { status: 500 });
  }
}
