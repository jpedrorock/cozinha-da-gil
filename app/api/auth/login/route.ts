import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidRole, verifyPassword } from "@/lib/auth-server";
import { getSession, type Role } from "@/lib/session";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rate limit: 5 tentativas em 60s → 429.
// Defesa contra brute-force de PIN 4 dígitos em rede local.
const RL_MAX_ATTEMPTS = 5;
const RL_WINDOW_MS = 60_000;

function ipFromRequest(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
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
  const roleInput = body.role;

  if (!password) {
    return NextResponse.json({ error: "Senha é obrigatória." }, { status: 400 });
  }

  const ip = ipFromRequest(request);

  // === Fluxo SEM nome (PIN identifica o user dentro do role) ===
  // UX simplificada: atendente escolhe role + digita PIN. Server procura
  // qual user dentro do role tem aquele PIN. Sem precisar selecionar nome.
  // Requer: PINs únicos por role (admin deve garantir na criação de user).
  if (!name) {
    if (!isValidRole(roleInput)) {
      return NextResponse.json({ error: "Função inválida." }, { status: 400 });
    }
    const role = roleInput as Role;

    // Rate limit por role+ip (não tem name pra incluir)
    const rlKey = `login:role:${role}:${ip}`;
    const rl = checkRateLimit(rlKey, { max: RL_MAX_ATTEMPTS, windowMs: RL_WINDOW_MS });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Muitas tentativas. Tente de novo em ${rl.retryAfterSec}s.` },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      );
    }

    // Busca todos do role e tenta verify em cada (bcrypt é caro mas N usuários
    // por barraca de família é ~3-10, aceitável).
    const candidates = await prisma.user.findMany({ where: { role } });
    const matches: typeof candidates = [];
    for (const u of candidates) {
      if (await verifyPassword(password, u.passwordHash)) {
        matches.push(u);
      }
    }
    if (matches.length === 0) {
      return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
    }
    if (matches.length > 1) {
      // Conflito de PIN dentro do role — admin precisa garantir unicidade.
      // Por segurança, recusa em vez de adivinhar.
      return NextResponse.json(
        { error: "PIN duplicado entre usuários. Peça pra Gil ajustar." },
        { status: 409 },
      );
    }

    const user = matches[0];
    resetRateLimit(rlKey);
    const session = await getSession();
    session.userId = user.id;
    session.role = user.role as Role;
    session.name = user.name;
    await session.save();

    return NextResponse.json({ id: user.id, name: user.name, role: user.role });
  }

  // === Fluxo COM nome (back-compat — fluxo antigo) ===
  // Rate limit ANTES do bcrypt (que é caro)
  const rlKey = `login:${name.toLowerCase()}:${ip}`;
  const rl = checkRateLimit(rlKey, { max: RL_MAX_ATTEMPTS, windowMs: RL_WINDOW_MS });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Muitas tentativas. Tente de novo em ${rl.retryAfterSec}s.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
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

  if (roleInput && isValidRole(roleInput) && roleInput !== user.role) {
    return NextResponse.json(
      { error: `Esse usuário é ${user.role}, não ${roleInput}.` },
      { status: 403 },
    );
  }

  resetRateLimit(rlKey);
  const session = await getSession();
  session.userId = user.id;
  session.role = user.role as Role;
  session.name = user.name;
  await session.save();

  return NextResponse.json({ id: user.id, name: user.name, role: user.role });
}
