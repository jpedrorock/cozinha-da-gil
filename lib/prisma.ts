/**
 * Re-export do PrismaClient com guard contra import em Client Components.
 *
 * `server-only` faz Next falhar no BUILD se algum client component
 * importar esse módulo — defesa em profundidade contra o erro
 * "PrismaClient is unable to run in this browser environment" que já
 * aconteceu várias vezes (geralmente por cache stale do .next, mas
 * se um dia for leak real, esse import expõe na hora).
 *
 * Scripts em `scripts/*.ts` rodam fora do bundler do Next e o pacote
 * `server-only` lança em runtime Node puro. Eles importam de
 * `@/lib/prisma-client` direto (sem o guard).
 */

import "server-only";

export { prisma } from "./prisma-client";
