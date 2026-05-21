import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export type Role = "atendente" | "cozinha" | "admin";

export function isValidRole(v: unknown): v is Role {
  return v === "atendente" || v === "cozinha" || v === "admin";
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Verifica se já existe outro user no MESMO role com o PIN proposto.
 *
 * Por que: o login agora identifica o user pelo {role + PIN} (sem pedir nome).
 * Se 2 atendentes tivessem o mesmo PIN, o server não saberia qual logar.
 * Validamos na criação/edição pra que essa situação NUNCA aconteça.
 *
 * `excludeUserId` ignora o próprio user no caso de PATCH (manter o mesmo PIN
 * não é "duplicado", é "não-mudou"). PINs entre roles diferentes podem repetir
 * sem problema — cada role tem seu próprio search space no login.
 */
export async function isPinDuplicateInRole(
  pin: string,
  role: Role,
  excludeUserId?: string,
): Promise<boolean> {
  const candidates = await prisma.user.findMany({
    where: {
      role,
      ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
    },
  });
  for (const u of candidates) {
    if (await verifyPassword(pin, u.passwordHash)) {
      return true;
    }
  }
  return false;
}
