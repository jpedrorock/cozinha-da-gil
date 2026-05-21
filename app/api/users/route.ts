import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, isPinDuplicateInRole, isValidRole, type Role } from "@/lib/auth-server";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/users — lista usuários pro seletor de login.
 * Pública porque o login precisa popular o dropdown antes do auth.
 * Threat model: rate-limit (5/min) defende contra brute-force; saber o
 * nome do Gil é aceitável pro modelo "primo curioso na wifi".
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const role = url.searchParams.get("role");

  const users = await prisma.user.findMany({
    where: role && isValidRole(role) ? { role } : undefined,
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, role: true, createdAt: true },
  });
  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const auth = await requireRole(["admin"]);
  if (auth instanceof NextResponse) return auth;

  let body: { name?: unknown; role?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const role = body.role;
  const password = typeof body.password === "string" ? body.password : "";

  if (!name) return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
  if (!isValidRole(role)) return NextResponse.json({ error: "Função inválida." }, { status: 400 });
  if (password.length < 4) {
    return NextResponse.json({ error: "Senha precisa ter pelo menos 4 caracteres." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json({ error: `Já existe um usuário "${name}".` }, { status: 409 });
  }

  // PIN único por role — o login identifica o user pelo {role + PIN} sem
  // pedir nome. PINs entre roles diferentes podem repetir (não há conflito).
  if (await isPinDuplicateInRole(password, role as Role)) {
    return NextResponse.json(
      {
        error: `Já existe outro ${role} com esse PIN. Escolhe um diferente — PINs no mesmo papel não podem repetir.`,
      },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, role, passwordHash },
    select: { id: true, name: true, role: true, createdAt: true },
  });
  return NextResponse.json(user, { status: 201 });
}
