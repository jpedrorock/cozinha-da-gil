import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { broadcast } from "@/lib/sse";
import { isAllowedCategory } from "@/lib/ingredients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ingredients/reorder
 *
 * Reordena ingredientes dentro de uma categoria. Body:
 *   { category: "topping" | ..., orderedIds: string[] }
 *
 * Aceita os IDs na ordem desejada e seta `position = índice` em cada
 * um, em transação. IDs que não existem ou pertencem a outra categoria
 * são ignorados silenciosamente (defensa-em-profundidade: cliente pode
 * estar com snapshot stale após uma exclusão concorrente).
 *
 * Broadcast `ingredient:reordered` pro atendente atualizar a ordem
 * das chips do stepper em tempo real.
 */
export async function POST(request: Request) {
  const auth = await requireRole(["admin"]);
  if (auth instanceof NextResponse) return auth;

  let body: { category?: unknown; orderedIds?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!isAllowedCategory(body.category)) {
    return NextResponse.json({ error: "Categoria inválida." }, { status: 400 });
  }
  const category = body.category as string;

  if (
    !Array.isArray(body.orderedIds) ||
    body.orderedIds.some((id) => typeof id !== "string")
  ) {
    return NextResponse.json(
      { error: "orderedIds deve ser array de strings." },
      { status: 400 },
    );
  }
  const orderedIds = body.orderedIds as string[];

  // Pega só os IDs que realmente são dessa categoria. Se cliente mandar
  // ID stale (deletado) ou de outra categoria, ignora — não falha o batch.
  const existing = await prisma.ingredient.findMany({
    where: { category, id: { in: orderedIds } },
    select: { id: true },
  });
  const validIds = new Set(existing.map((e) => e.id));
  const filteredOrder = orderedIds.filter((id) => validIds.has(id));

  if (filteredOrder.length === 0) {
    return NextResponse.json({ updated: 0 });
  }

  // Update batch dentro de uma transação — ou todos ganham nova
  // posição ou nada muda (consistência sob concorrência).
  await prisma.$transaction(
    filteredOrder.map((id, index) =>
      prisma.ingredient.update({
        where: { id },
        data: { position: index },
      }),
    ),
  );

  broadcast("ingredient:reordered", {
    category,
    orderedIds: filteredOrder,
  });

  return NextResponse.json({ updated: filteredOrder.length });
}
