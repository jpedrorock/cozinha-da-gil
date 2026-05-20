import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

/**
 * POST /api/products/[id]/sizes — adiciona um tamanho ao produto.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole(["admin"]);
  if (auth instanceof NextResponse) return auth;

  let body: { name?: unknown; description?: unknown; priceCents?: unknown; position?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const name = asStr(body.name);
  const priceCents = asInt(body.priceCents);
  if (!name || priceCents === null) {
    return NextResponse.json({ error: "name e priceCents obrigatórios." }, { status: 400 });
  }

  try {
    const size = await prisma.productSize.create({
      data: {
        productId: params.id,
        name,
        description: asStr(body.description),
        priceCents,
        position: asInt(body.position) ?? 0,
      },
    });
    return NextResponse.json(size, { status: 201 });
  } catch (err) {
    const msg =
      err instanceof Error && err.message.includes("Unique constraint")
        ? `Já existe tamanho "${name}" nesse produto.`
        : "Erro ao criar tamanho.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
