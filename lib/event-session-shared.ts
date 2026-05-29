/**
 * Tipos e helpers PUROS de event-session — sem dependências de prisma.
 *
 * Existe pra resolver o leak Server → Client: componentes 'use client'
 * (AdminClient, AtendenteClient) precisam do tipo `EventSessionStatus`
 * + função `isStaleEventSession`, mas o arquivo `lib/event-session.ts`
 * importa prisma (pra `getCurrentEventSession`, `computeSessionTotal`).
 *
 * Webpack do Next bundla o arquivo inteiro quando vê QUALQUER import
 * (incluindo `import type`) e arrasta prisma pra dentro do client bundle.
 * Resultado: PrismaClient tenta iniciar no browser → erro.
 *
 * Regra: client components → IMPORT DAQUI. Server pages/routes →
 * podem usar `@/lib/event-session` direto (re-exporta tudo).
 */

export type EventSessionStatus = {
  open: boolean;
  id: string | null;
  name: string | null;
  eventDate: string | null;
  openedAt: string | null;
  openedBy: string | null;
};

/**
 * Detecta caixa órfão — aberto há mais de N horas (default 12h).
 * Cenário real: Gil esqueceu de fechar ontem à noite, abre app hoje e
 * pedidos novos agregam no caixa errado. Banner de alerta convida fechar.
 *
 * Usa `openedAt` (string ISO ou Date) — funciona tanto no client (com a
 * `EventSessionStatus` serializada) quanto no server.
 */
export function isStaleEventSession(
  openedAt: string | Date | null | undefined,
  staleHours = 12,
): boolean {
  if (!openedAt) return false;
  const opened = typeof openedAt === "string" ? new Date(openedAt) : openedAt;
  if (isNaN(opened.getTime())) return false;
  const ageHours = (Date.now() - opened.getTime()) / (1000 * 60 * 60);
  return ageHours >= staleHours;
}
