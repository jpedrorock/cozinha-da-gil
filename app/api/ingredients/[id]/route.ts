import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

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
  // icon: aceita string "prefix:name" (formato Iconify) ou null pra limpar.
  // Valida formato superficial; nada de XSS porque é renderizado pelo @iconify/react.
  if (body.icon === null) {
    data.icon = null;
  } else if (typeof body.icon === "string") {
    const trimmed = body.icon.trim();
    if (trimmed === "") {
      data.icon = null;
    } else if (/^[a-z0-9-]+:[a-z0-9-]+$/i.test(trimmed) && trimmed.length <= 80) {
      data.icon = trimmed;
    } else {
      return NextResponse.json({ error: "Formato de ícone inválido." }, { status: 400 });
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
    return NextResponse.json(ingredient);
  } catch {
    return NextResponse.json({ error: "Ingrediente não encontrado." }, { status: 404 });
  }
}
