import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, isValidRole } from "@/lib/auth-server";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole(["admin"]);
  if (auth instanceof NextResponse) return auth;

  let body: { name?: unknown; role?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const data: { name?: string; role?: string; passwordHash?: string } = {};

  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }
  if (body.role !== undefined) {
    if (!isValidRole(body.role)) {
      return NextResponse.json({ error: "Função inválida." }, { status: 400 });
    }
    data.role = body.role;
  }
  if (typeof body.password === "string" && body.password.length > 0) {
    if (body.password.length < 4) {
      return NextResponse.json({ error: "Senha precisa ter pelo menos 4 caracteres." }, { status: 400 });
    }
    data.passwordHash = await hashPassword(body.password);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada pra atualizar." }, { status: 400 });
  }

  try {
    const user = await prisma.user.update({
      where: { id: params.id },
      data,
      select: { id: true, name: true, role: true, createdAt: true },
    });
    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole(["admin"]);
  if (auth instanceof NextResponse) return auth;

  // Não deixa admin deletar a si mesmo (lockout)
  if (auth.userId === params.id) {
    return NextResponse.json({ error: "Não pode deletar o próprio usuário." }, { status: 400 });
  }

  try {
    await prisma.user.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }
}
