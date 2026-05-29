/**
 * PrismaClient singleton com tuning de SQLite.
 *
 * IMPORTAÇÃO ÚNICA: o resto da app importa de `@/lib/prisma` (que
 * adiciona `import "server-only"` como defesa contra leak Server →
 * Client). Scripts em `scripts/*.ts` rodam fora do bundler do Next
 * e importam DAQUI direto (sem `server-only` que lança em runtime
 * Node puro).
 *
 * Não importe esse módulo de Client Components — sempre use
 * `@/lib/prisma`. O ESLint não pega, mas o build do Next pega
 * imediatamente via `server-only` lá.
 */

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
  // Todos esses PRAGMAs em "SET" retornam o novo valor como linha no
  // SQLite — precisam de `$queryRawUnsafe`. Com `$executeRawUnsafe`
  // levanta "Execute returned results, which is not allowed in SQLite".
  // (O comentário antigo dizia que busy_timeout e synchronous eram
  // setters puros, mas na prática não são — verificado em SQLite 3.45+.)
  prisma
    .$queryRawUnsafe("PRAGMA journal_mode = WAL;")
    .then(() => prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000;"))
    .then(() => prisma.$queryRawUnsafe("PRAGMA synchronous = NORMAL;"))
    .then(() => {
      if (process.env.NODE_ENV !== "production") {
        console.log("[Prisma] SQLite: WAL + busy_timeout=5000 + synchronous=NORMAL");
      }
    })
    .catch((err) => {
      console.error("[Prisma] Falha ao configurar PRAGMAs:", err);
    });
}
