/**
 * Reseta a senha do admin Gil pra '2699'.
 *
 * Uso (local):  npx tsx scripts/reset-gil-password.ts
 * Uso (prod):   docker exec -e DATABASE_URL=file:/app/data/dev.db <container> npx tsx scripts/reset-gil-password.ts
 *
 * Idempotente: cria Gil se não existir, atualiza passwordHash se existir.
 */

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma-client";

const NAME = "Gil";
const ROLE = "admin";
const PIN = "2699";

async function main() {
  const passwordHash = await bcrypt.hash(PIN, 10);
  const existing = await prisma.user.findUnique({ where: { name: NAME } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, role: ROLE },
    });
    console.log(`✓ Senha de ${NAME} atualizada pra ${PIN} (id=${existing.id}).`);
  } else {
    const u = await prisma.user.create({
      data: { name: NAME, role: ROLE, passwordHash },
    });
    console.log(`✓ ${NAME} criado (id=${u.id}, role=${ROLE}, PIN=${PIN}).`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
