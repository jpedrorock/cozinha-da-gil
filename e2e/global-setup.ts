/**
 * Global setup do Playwright — roda UMA vez antes de todos os tests.
 *
 * Garante users de teste (Maria atendente + José cozinha) existem no DB,
 * com PINs conhecidos. Gil admin já vem do seed.ts.
 *
 * Idempotente: se Maria/José já existem com PIN errado, atualiza. Se
 * não existem, cria.
 *
 * Por que não usar seed.ts: ele só cria Gil (decisão do produto após
 * reset 2026-05-22). Pra E2E precisamos dos 3 roles. Setup do teste
 * escapa esse constraint sem mexer no comportamento padrão de dev.
 */

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma-client";

// PINs específicos pra E2E — usar valores fáceis de lembrar mas
// diferentes do PIN da Gil pra não confundir.
const E2E_USERS = [
  { name: "Maria", role: "atendente", password: "1111" },
  { name: "José", role: "cozinha", password: "2222" },
];

async function main() {
  for (const u of E2E_USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    // upsert por (role + name) — tabela User não tem unique nessa combo
    // mas o admin UI evita duplicates. Aqui forçamos atualização do
    // PIN se já existir.
    const existing = await prisma.user.findFirst({
      where: { name: u.name, role: u.role },
    });
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash: hash },
      });
    } else {
      await prisma.user.create({
        data: { name: u.name, role: u.role, passwordHash: hash },
      });
    }
  }
}

export default async function globalSetup() {
  await main();
  await prisma.$disconnect();
}
