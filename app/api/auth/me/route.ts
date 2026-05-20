import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Retorna a sessão atual (lida do cookie). Cliente usa pra revalidar
 * que ainda está logado quando entra numa página protegida.
 */
export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
  return NextResponse.json({
    authenticated: true,
    id: session.userId,
    name: session.name,
    role: session.role,
  });
}
