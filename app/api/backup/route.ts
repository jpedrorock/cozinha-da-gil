import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import { backupDatabase, backupFilePath, listBackups } from "@/lib/backup";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/backup           — lista backups existentes (admin only)
 * GET /api/backup?file=X.db — baixa um backup específico (admin only)
 */
export async function GET(request: Request) {
  const auth = await requireRole(["admin"]);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const file = url.searchParams.get("file");

  if (file) {
    try {
      const filepath = backupFilePath(file);
      const data = await fs.readFile(filepath);
      return new NextResponse(data as unknown as BodyInit, {
        status: 200,
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${file}"`,
          "Content-Length": String(data.length),
        },
      });
    } catch {
      return NextResponse.json({ error: "Backup não encontrado." }, { status: 404 });
    }
  }

  const list = await listBackups();
  return NextResponse.json(list);
}

/**
 * POST /api/backup — força um backup manual (admin only)
 * Body: { label?: string }
 */
export async function POST(request: Request) {
  const auth = await requireRole(["admin"]);
  if (auth instanceof NextResponse) return auth;

  let label: string | undefined;
  try {
    const body = (await request.json()) as { label?: unknown };
    if (typeof body.label === "string" && body.label.trim()) label = body.label.trim();
  } catch {
    // sem body, ok
  }
  const result = await backupDatabase(label ?? "manual");
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json(result);
}
