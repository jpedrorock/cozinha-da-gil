import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, isPinDuplicateInRole, isValidRole, type Role } from "@/lib/auth-server";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireRole(["admin"]);
  if (auth instanceof NextResponse) return auth;

  let body: { name?: unknown; role?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const data: { name?: string; role?: string; passwordHash?: string } = {};
  // Pra validar PIN único, precisamos saber o role efetivo após o update.
  // Se mudou role, usa o novo; senão usa o atual do user no DB.
  let effectiveRole: Role | null = null;
  let plainPassword: string | null = null;

  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }
  if (body.role !== undefined) {
    if (!isValidRole(body.role)) {
      return NextResponse.json({ error: "Função inválida." }, { status: 400 });
    }
    data.role = body.role;
    effectiveRole = body.role;
  }
  if (typeof body.password === "string" && body.password.length > 0) {
    if (body.password.length < 4) {
      return NextResponse.json({ error: "Senha precisa ter pelo menos 4 caracteres." }, { status: 400 });
    }
    plainPassword = body.password;
    data.passwordHash = await hashPassword(body.password);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada pra atualizar." }, { status: 400 });
  }

  // Valida PIN único dentro do role efetivo. Precisa fazer ANTES do update
  // pra retornar 409 limpo. Considera tanto mudança de senha quanto de role
  // (que pode jogar o PIN atual em outro search space).
  if (plainPassword || effectiveRole) {
    const current = await prisma.user.findUnique({ where: { id: params.id } });
    if (!current) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }
    const roleToCheck = (effectiveRole ?? (current.role as Role)) as Role;
    // Se senha não mudou mas role mudou, precisa do PIN atual — mas não temos
    // ele em plain text. Nesse caso pulamos a verificação (admin assume
    // responsabilidade da mudança de role; se conflitar, login retorna 409).
    if (plainPassword) {
      if (await isPinDuplicateInRole(plainPassword, roleToCheck, params.id)) {
        return NextResponse.json(
          {
            error: `Já existe outro ${roleToCheck} com esse PIN. Escolhe um diferente.`,
          },
          { status: 409 },
        );
      }
    }
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

export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
