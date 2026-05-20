import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/customers?filter=...&q=...
 *
 * Lista de clientes do CRM. Filtros:
 *   - active30      : pediram nos últimos 30 dias
 *   - frequent      : 3+ pedidos no total
 *   - vip           : gastaram ≥ R$ 100 (10000 cents)
 *   - marketing     : optInMarketing = true
 *   - (none)        : todos (não-deletados)
 *
 * Busca `q` filtra nome OU telefone (parcial).
 * Soft-deletados (deletedAt != null) nunca aparecem.
 * Ordenação: último pedido desc (mais recente primeiro).
 */
export async function GET(request: Request) {
  const auth = await requireRole(["admin"]);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const filter = url.searchParams.get("filter") ?? "";
  const q = url.searchParams.get("q")?.trim() ?? "";

  const where: {
    deletedAt: null;
    lastOrderAt?: { gte: Date };
    totalOrders?: { gte: number };
    totalSpentCents?: { gte: number };
    optInMarketing?: boolean;
    OR?: Array<{ name?: { contains: string }; phone?: { contains: string } }>;
  } = { deletedAt: null };

  if (filter === "active30") {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    where.lastOrderAt = { gte: cutoff };
  } else if (filter === "frequent") {
    where.totalOrders = { gte: 3 };
  } else if (filter === "vip") {
    where.totalSpentCents = { gte: 10000 };
  } else if (filter === "marketing") {
    where.optInMarketing = true;
  }

  if (q.length > 0) {
    where.OR = [{ name: { contains: q } }, { phone: { contains: q.replace(/\D/g, "") } }];
  }

  const customers = await prisma.customer.findMany({
    where,
    orderBy: [{ lastOrderAt: "desc" }, { createdAt: "desc" }],
    take: 500,
  });

  return NextResponse.json(customers);
}
