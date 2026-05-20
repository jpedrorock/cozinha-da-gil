import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidRole, verifyPassword } from "@/lib/auth-server";
import { getSession, type Role } from "@/lib/session";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rate limit por nome: 5 tentativas em 60s → 429.
// Defesa contra brute-force de PIN 4 dígitos em rede local.
const RL_MAX_ATTEMPTS = 5;
const RL_WINDOW_MS = 60_000;

function rateLimitKey(name: string, request: Request): string {
  // Combina name + IP (forwarded-for ou fallback) pra evitar que um cliente
  // só bloqueie outros — e que múltiplos clientes acumulem no mesmo bucket.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  return `login:${name.toLowerCase()}:${ip}`;
}

export async function POST(request: Request) {
  let body: { name?: unknown; password?: unknown; role?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const expectedRole = body.role;

  if (!name || !password) {
    return NextResponse.json({ error: "Nome e senha são obrigatórios." }, { status: 400 });
  }

  // Rate limit ANTES do bcrypt (que é caro)
  const rlKey = rateLimitKey(name, request);
  const rl = checkRateLimit(rlKey, { max: RL_MAX_ATTEMPTS, windowMs: RL_WINDOW_MS });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Muitas tentativas. Tente de novo em ${rl.retryAfterSec}s.` },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSec) },
      },
    );
  }

  const user = await prisma.user.findUnique({ where: { name } });
  if (!user) {
    return NextResponse.json({ error: "Usuário ou senha incorretos." }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Usuário ou senha incorretos." }, { status: 401 });
  }

  if (expectedRole && isValidRole(expectedRole) && expectedRole !== user.role) {
    return NextResponse.json(
      { error: `Esse usuário é ${user.role}, não ${expectedRole}.` },
      { status: 403 },
    );
  }

  // Senha OK → reset rate limit + grava cookie de sessão
  resetRateLimit(rlKey);
  const session = await getSession();
  session.userId = user.id;
  session.role = user.role as Role;
  session.name = user.name;
  await session.save();

  return NextResponse.json({ id: user.id, name: user.name, role: user.role });
}
