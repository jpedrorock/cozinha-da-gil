import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export type Role = "atendente" | "cozinha" | "admin";

export type SessionData = {
  userId?: string;
  role?: Role;
  name?: string;
};

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  // Fallback dev-only com aviso. Em produção, .env DEVE estar setado.
  "DEV_INSECURE_FALLBACK_DO_NOT_USE_IN_PROD_______";

if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  // Não trava o servidor, mas grita no log.
  console.error("[SESSION] SESSION_SECRET não setado em produção — auth não é segura.");
}

const sessionOptions: SessionOptions = {
  password: SESSION_SECRET,
  cookieName: "cdg_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 dias
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

/**
 * Lê a sessão e valida que o usuário tem um dos roles permitidos.
 * Se OK → retorna SessionData (com userId/role/name garantidos).
 * Se NÃO → retorna NextResponse 401 pronta pra retornar do handler.
 *
 * Uso típico em route handlers:
 *   const auth = await requireRole(["admin"]);
 *   if (auth instanceof NextResponse) return auth;
 *   // aqui auth.userId, auth.role, auth.name garantidos
 */
export async function requireRole(allowedRoles: Role[]) {
  const session = await getSession();
  if (!session.userId || !session.role || !allowedRoles.includes(session.role)) {
    return NextResponse.json(
      { error: "Não autorizado. Faça login novamente." },
      { status: 401 },
    );
  }
  return session as Required<SessionData>;
}
