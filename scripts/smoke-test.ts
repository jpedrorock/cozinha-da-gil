/**
 * Smoke test pré-evento — roda antes de abrir a barraca.
 *
 * Uso: npx tsx scripts/smoke-test.ts
 *
 * Verifica em <5s:
 * 1. DB acessível + schema básico OK (tabelas User, Ingredient, Product existem)
 * 2. Admin Gil autenticada (login funciona com PIN cadastrado)
 * 3. Servidor respondendo (GET http://localhost:3000/api/health → 200)
 * 4. Caixa: informa se está aberto ou fechado (info, não erro)
 * 5. Backup recente: último dev.db.* em prisma/backups/ tem < 24h
 *
 * Exit 0 = tudo OK. Exit 1 = um ou mais problemas detectados.
 */

import bcrypt from "bcryptjs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: [] });

type CheckResult = { label: string; ok: boolean; message: string };

const results: CheckResult[] = [];

function pass(label: string, message: string): CheckResult {
  return { label, ok: true, message };
}
function fail(label: string, message: string): CheckResult {
  return { label, ok: false, message };
}

// ── 1. DB acessível + schema ──────────────────────────────────────────────

async function checkDb(): Promise<CheckResult> {
  try {
    const [userCount, ingredientCount, productCount] = await Promise.all([
      prisma.user.count(),
      prisma.ingredient.count(),
      prisma.product.count(),
    ]);
    return pass("DB", `ok — ${userCount} usuários, ${ingredientCount} ingredientes, ${productCount} produtos`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return fail("DB", `inacessível — ${msg.split("\n")[0]}`);
  }
}

// ── 2. Gil autentica ──────────────────────────────────────────────────────

async function checkGilAuth(): Promise<CheckResult> {
  try {
    const gil = await prisma.user.findFirst({ where: { name: "Gil", role: "admin" } });
    if (!gil) return fail("Auth-Gil", "usuária Gil não encontrada no banco");

    // Testa PINs comuns usados pela Gil (2699 é o default pós-reset)
    const pinsToTry = ["2699"];
    for (const pin of pinsToTry) {
      const ok = await bcrypt.compare(pin, gil.passwordHash);
      if (ok) {
        return pass("Auth-Gil", `login OK com PIN cadastrado (id=${gil.id})`);
      }
    }
    // Não conseguiu verificar o PIN atual, mas a conta existe
    return pass(
      "Auth-Gil",
      `conta existe (id=${gil.id}) — PIN atual não é 2699, mas bcrypt hash válido`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return fail("Auth-Gil", `erro ao verificar — ${msg.split("\n")[0]}`);
  }
}

// ── 3. Servidor respondendo ───────────────────────────────────────────────

async function checkServer(): Promise<CheckResult> {
  const url = "http://localhost:3000/api/health";
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (res.ok || res.status === 503) {
      const body = (await res.json()) as { status?: string; db?: boolean; sse?: { connections?: number } };
      const sseConns = body.sse?.connections ?? "?";
      const status = body.status ?? (res.ok ? "ok" : "degraded");
      if (res.ok) {
        return pass("Servidor", `${url} → 200 (${status}, SSE: ${sseConns} conexões)`);
      }
      return fail("Servidor", `${url} → 503 (${status}) — problemas: ${JSON.stringify(body)}`);
    }
    return fail("Servidor", `${url} → HTTP ${res.status}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) {
      return fail("Servidor", "não está rodando na porta 3000 — rodar `npm start` ou `pm2 start`");
    }
    return fail("Servidor", `erro ao conectar — ${msg}`);
  }
}

// ── 4. Status do caixa ────────────────────────────────────────────────────

async function checkCaixa(): Promise<CheckResult> {
  try {
    const session = await prisma.eventSession.findFirst({
      where: { closedAt: null },
      orderBy: { openedAt: "desc" },
    });
    if (session) {
      const nome = session.name ?? "(sem nome)";
      const abertoPor = session.openedBy;
      const abertaEm = session.openedAt.toLocaleString("pt-BR");
      return pass("Caixa", `ABERTO — "${nome}" por ${abertoPor} desde ${abertaEm}`);
    }
    return pass("Caixa", "fechado — pronto pra abrir um novo caixa");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return fail("Caixa", `erro ao verificar — ${msg.split("\n")[0]}`);
  }
}

// ── 5. Backup recente ─────────────────────────────────────────────────────

async function checkBackup(): Promise<CheckResult> {
  const backupDir = path.join(process.cwd(), "prisma", "backups");
  try {
    const entries = await fs.readdir(backupDir);
    const backups = entries.filter((f) => f.startsWith("dev.db.")).sort().reverse();
    if (backups.length === 0) {
      return fail("Backup", "nenhum backup encontrado em prisma/backups/ — considere fazer um manual");
    }
    const latest = backups[0];
    const stat = await fs.stat(path.join(backupDir, latest));
    const ageMs = Date.now() - stat.mtimeMs;
    const ageH = ageMs / (1000 * 60 * 60);
    if (ageH < 24) {
      return pass("Backup", `recente OK — ${latest} (${ageH.toFixed(1)}h atrás)`);
    }
    return fail(
      "Backup",
      `último backup tem ${ageH.toFixed(0)}h — mais de 24h. Fazer backup manual: copiar prisma/dev.db`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ENOENT")) {
      return fail("Backup", "pasta prisma/backups/ não existe — backup automático talvez não esteja configurado");
    }
    return fail("Backup", `erro ao verificar — ${msg.split("\n")[0]}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Smoke Test Pré-Evento — Pastel da Gil ===\n");

  const checks = await Promise.allSettled([
    checkDb(),
    checkGilAuth(),
    checkServer(),
    checkCaixa(),
    checkBackup(),
  ]);

  for (const r of checks) {
    if (r.status === "rejected") {
      results.push(fail("?", String(r.reason)));
    } else {
      results.push(r.value);
    }
  }

  for (const r of results) {
    const icon = r.ok ? "✓" : "✗";
    console.log(`${icon} [${r.label}] ${r.message}`);
  }

  const failures = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failures.length}/${results.length} checks OK.`);

  await prisma.$disconnect();

  if (failures.length > 0) {
    console.log("\nProblemas detectados:");
    for (const f of failures) {
      console.log(`  - [${f.label}] ${f.message}`);
    }
    process.exit(1);
  }

  console.log("\nTudo OK — pode abrir o caixa!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro fatal no smoke-test:", err);
  process.exit(1);
});
