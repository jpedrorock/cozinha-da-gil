/**
 * Reseta a tabela User: apaga tudo, recria apenas o admin Gil com
 * a senha definida.
 *
 * Uso (local):
 *   npx tsx scripts/reset-users.ts
 *
 * Uso (prod via Coolify):
 *   docker exec <container> npx tsx scripts/reset-users.ts
 *
 * Idempotente: sempre termina com 1 usuário (Gil admin, PIN definido).
 *
 * Seguro porque User.* não tem FK pra outras tabelas — Order.createdBy
 * e similares armazenam o NOME do operador como string snapshot.
 * Apagar User histórico NÃO afeta pedidos passados.
 */

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma-client";

const NAME = "Gil";
const ROLE = "admin";
const PIN = "2699";

async function main() {
  const before = await prisma.user.count();
  console.log(`Apagando ${before} usuário(s) existente(s)...`);

  // deleteMany em vez de truncate — Prisma não suporta truncate em SQLite
  // direto e essa abordagem é portável pra Postgres no futuro.
  const deleted = await prisma.user.deleteMany({});
  console.log(`✓ ${deleted.count} usuário(s) deletado(s).`);

  const passwordHash = await bcrypt.hash(PIN, 10);
  const u = await prisma.user.create({
    data: { name: NAME, role: ROLE, passwordHash },
  });
  console.log(`✓ Criado: ${u.name} (id=${u.id}, role=${ROLE}, PIN=${PIN}).`);

  const after = await prisma.user.count();
  console.log(`\nTotal final: ${after} usuário(s).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
