import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Ingredient } from "@prisma/client";

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
