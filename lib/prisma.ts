import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaInitialized?: boolean;
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ["error", "warn"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * SQLite tuning — roda uma vez por processo.
 *
 * - **WAL mode**: leituras não bloqueiam writes (e vice-versa). Pra esse
 *   workload de admin que faz 8 queries paralelas + atendente criando pedidos
 *   + cozinha atualizando status, reduz SQLITE_BUSY em ordem de magnitude.
 * - **busy_timeout=5000**: se ainda houver lock, espera até 5s em vez de
 *   falhar imediatamente. Suaviza picos.
 * - **synchronous=NORMAL**: padrão é FULL (fsync após cada commit). NORMAL
 *   é seguro com WAL e ~3x mais rápido. Risco real só em crash do OS sem
 *   bateria — pra barraca aceitável.
 */
if (!globalForPrisma.prismaInitialized) {
  globalForPrisma.prismaInitialized = true;
  prisma
    .$queryRawUnsafe("PRAGMA journal_mode = WAL;") // retorna 1 row, precisa de queryRaw
    .then(() => prisma.$executeRawUnsafe("PRAGMA busy_timeout = 5000;"))
    .then(() => prisma.$executeRawUnsafe("PRAGMA synchronous = NORMAL;"))
    .then(() => {
      if (process.env.NODE_ENV !== "production") {
        console.log("[Prisma] SQLite: WAL + busy_timeout=5000 + synchronous=NORMAL");
      }
    })
    .catch((err) => {
      console.error("[Prisma] Falha ao configurar PRAGMAs:", err);
    });
}
