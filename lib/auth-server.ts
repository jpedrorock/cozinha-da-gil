import bcrypt from "bcryptjs";

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
