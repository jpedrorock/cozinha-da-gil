import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { broadcast } from "@/lib/sse";
import {
  deleteIngredientImage,
  isUploadedIngredientIcon,
  saveIngredientImage,
} from "@/lib/uploads";
import {
  INGREDIENT_CATEGORIES,
  isAllowedCategory,
  parseIconValue,
  parseIngredientName,
} from "@/lib/ingredients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asNullableInt(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.floor(n));
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole(["admin"]);
  if (auth instanceof NextResponse) return auth;

  let body: {
    available?: unknown;
    stock?: unknown;
    lowStockThreshold?: unknown;
    icon?: unknown;
    name?: unknown;
    category?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const data: {
    available?: boolean;
    stock?: number | null;
    lowStockThreshold?: number | null;
    icon?: string | null;
    name?: string;
    category?: string;
  } = {};

  if (typeof body.available === "boolean") {
    data.available = body.available;
  }
  const stockParsed = asNullableInt(body.stock);
  if (stockParsed !== undefined) {
    data.stock = stockParsed;
  }
  const thresholdParsed = asNullableInt(body.lowStockThreshold);
  if (thresholdParsed !== undefined) {
    data.lowStockThreshold = thresholdParsed;
  }

  // Nome — rename inline
  if (body.name !== undefined) {
    const nameResult = parseIngredientName(body.name);
    if (!nameResult.ok) {
      return NextResponse.json({ error: nameResult.error }, { status: 400 });
    }
    data.name = nameResult.value;
  }

  // Categoria — mover ingrediente entre categorias
  if (body.category !== undefined) {
    if (!isAllowedCategory(body.category)) {
      return NextResponse.json(
        { error: `Categoria inválida. Use uma de: ${INGREDIENT_CATEGORIES.join(", ")}.` },
        { status: 400 },
      );
    }
    data.category = body.category;
  }

  // Ícone — aceita: null (limpa), Iconify ID, data URI (decode+save),
  // ou path /api/uploads/ingredients/... (já-uploaded).
  // Quando substitui ícone de upload por outro, deleta arquivo antigo.
  let oldUploadedIcon: string | null = null;
  if (body.icon !== undefined) {
    const iconParsed = parseIconValue(body.icon);
    if (!iconParsed.ok) {
      return NextResponse.json({ error: iconParsed.error }, { status: 400 });
    }

    // Busca ícone atual pra cleanup se trocar
    const existing = await prisma.ingredient.findUnique({
      where: { id: params.id },
      select: { icon: true },
    });
    if (existing && isUploadedIngredientIcon(existing.icon)) {
      oldUploadedIcon = existing.icon;
    }

    if (iconParsed.value.kind === "null") {
      data.icon = null;
    } else if (iconParsed.value.kind === "dataUri") {
      const url = await saveIngredientImage(iconParsed.value.value, oldUploadedIcon);
      if (!url) {
        return NextResponse.json(
          { error: "Imagem inválida — use SVG ou PNG." },
          { status: 400 },
        );
      }
      data.icon = url;
      // Já deletou o antigo dentro de saveIngredientImage — limpa flag
      // pra não tentar deletar de novo no finalizer.
      oldUploadedIcon = null;
    } else {
      // iconify ou uploadedPath — usa direto
      data.icon = iconParsed.value.value;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada pra atualizar." }, { status: 400 });
  }

  try {
    const ingredient = await prisma.ingredient.update({
      where: { id: params.id },
      data,
    });

    // Cleanup do arquivo antigo se trocou de upload pra Iconify/null,
    // ou se removeu o ícone (não cobertos pelo saveIngredientImage).
    if (oldUploadedIcon && ingredient.icon !== oldUploadedIcon) {
      await deleteIngredientImage(oldUploadedIcon);
    }

    // Audit-Crit B #25: atendente vê toggle "Acabou bacon" em tempo real,
    // chip vira disabled sem precisar reload. Cozinha não precisa
    // (não monta pedido).
    broadcast("ingredient:updated", {
      id: ingredient.id,
      name: ingredient.name,
      category: ingredient.category,
      available: ingredient.available,
      stock: ingredient.stock,
      lowStockThreshold: ingredient.lowStockThreshold,
    });
    return NextResponse.json(ingredient);
  } catch (err) {
    // Unique constraint na combinação (category, name)
    if (typeof err === "object" && err && "code" in err && (err as { code: string }).code === "P2002") {
      return NextResponse.json(
        { error: "Já existe outro ingrediente com esse nome nessa categoria." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Ingrediente não encontrado." }, { status: 404 });
  }
}

/**
 * DELETE /api/ingredients/[id]
 *
 * Remove ingrediente do catálogo. Como OrderItem guarda toppings/sauces/flavor
 * como strings desnormalizadas, não há FK pra checar — mesmo se o ingrediente
 * já apareceu em pedido antigo, deletar do catálogo NÃO quebra histórico
 * (o nome continua escrito no OrderItem.toppings/sauces/flavor).
 *
 * Por segurança, deleta também o arquivo de upload se houver.
 * Retorna 404 se já não existe (idempotente).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole(["admin"]);
  if (auth instanceof NextResponse) return auth;

  // Captura icon antes de deletar pra fazer cleanup do arquivo
  const existing = await prisma.ingredient.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, category: true, icon: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Ingrediente não encontrado." }, { status: 404 });
  }

  try {
    await prisma.ingredient.delete({ where: { id: params.id } });
  } catch {
    return NextResponse.json({ error: "Falha ao remover ingrediente." }, { status: 500 });
  }

  // Best-effort cleanup do arquivo no disco
  if (isUploadedIngredientIcon(existing.icon)) {
    await deleteIngredientImage(existing.icon);
  }

  broadcast("ingredient:deleted", {
    id: existing.id,
    name: existing.name,
    category: existing.category,
  });

  return NextResponse.json({ ok: true, id: existing.id });
}
