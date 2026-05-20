import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; sizeId: string } },
) {
  const auth = await requireRole(["admin"]);
  if (auth instanceof NextResponse) return auth;

  let body: { name?: unknown; description?: unknown; priceCents?: unknown; position?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  const n = asStr(body.name);
  if (n !== undefined) data.name = n;
  const d = asStr(body.description);
  if (d !== undefined) data.description = d;
  const p = asInt(body.priceCents);
  if (p !== undefined) data.priceCents = p;
  const pos = asInt(body.position);
  if (pos !== undefined) data.position = pos;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada pra atualizar." }, { status: 400 });
  }

  try {
    const size = await prisma.productSize.update({
      where: { id: params.sizeId },
      data,
    });
    return NextResponse.json(size);
  } catch {
    return NextResponse.json({ error: "Tamanho não encontrado." }, { status: 404 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; sizeId: string } },
) {
  const auth = await requireRole(["admin"]);
  if (auth instanceof NextResponse) return auth;

  const referenced = await prisma.orderItem.count({ where: { productSizeId: params.sizeId } });
  if (referenced > 0) {
    return NextResponse.json(
      { error: `Não dá pra apagar — ${referenced} pedido(s) usaram esse tamanho.` },
      { status: 409 },
    );
  }
  try {
    await prisma.productSize.delete({ where: { id: params.sizeId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Tamanho não encontrado." }, { status: 404 });
  }
}
