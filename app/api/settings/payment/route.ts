import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/settings/payment — lê a config do PIX (chave + nome + cidade).
 *
 * Público (sem auth): o comprovante e a tela do cliente precisam ler isso
 * pra gerar o QR. Os 3 campos são meant-to-be-shown-to-customers (a chave
 * PIX é o que vai no QR pro cliente pagar) — não é segredo.
 *
 * Retorna null em cada campo se a config não foi preenchida ainda; nesse
 * caso o QR simplesmente não aparece no comprovante.
 */
export async function GET() {
  const config = await prisma.paymentConfig.findFirst();
  return NextResponse.json({
    pixKey: config?.pixKey ?? null,
    merchantName: config?.merchantName ?? null,
    merchantCity: config?.merchantCity ?? null,
  });
}

/** PATCH /api/settings/payment — atualiza a config. Admin only. */
export async function PATCH(request: Request) {
  const auth = await requireRole(["admin"]);
  if (auth instanceof NextResponse) return auth;

  let body: { pixKey?: unknown; merchantName?: unknown; merchantCity?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const norm = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t === "" ? null : t;
  };

  const data = {
    pixKey: norm(body.pixKey),
    merchantName: norm(body.merchantName),
    merchantCity: norm(body.merchantCity),
    updatedBy: "admin",
  };

  const existing = await prisma.paymentConfig.findFirst();
  const config = existing
    ? await prisma.paymentConfig.update({ where: { id: existing.id }, data })
    : await prisma.paymentConfig.create({ data });

  return NextResponse.json({
    pixKey: config.pixKey,
    merchantName: config.merchantName,
    merchantCity: config.merchantCity,
  });
}
