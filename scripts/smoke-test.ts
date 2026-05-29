/**
 * Smoke test pré-evento.
 *
 * Roda em <5s e valida que o app tá pronto pra subir a barraca.
 * Use ANTES de começar um evento real — se algo aqui falhar, conserta
 * antes do cliente chegar.
 *
 * Uso (local):
 *   npx tsx scripts/smoke-test.ts
 *
 * Saída: tabela colorida com ✅/⚠️/❌ por check.
 * Exit code 0 = tudo OK (pode subir a barraca).
 * Exit code 1 = pelo menos um erro (corrigir antes).
 *
 * Warnings (⚠️) não falham o exit — são heads-ups (ex: backup velho mas
 * existe; SSE não testado porque servidor não tava rodando).
 *
 * Checks:
 *   1. DB acessível — abre conexão Prisma e roda queries nos models
 *      críticos (User, Product, Ingredient, EventSession, Order).
 *   2. Pelo menos 1 user admin existe (Gil ou outro).
 *   3. Servidor HTTP — tenta fetch / com timeout 1.5s; se ECONNREFUSED,
 *      vira warning sugerindo `npm run dev`.
 *   4. Status do caixa atual (info; aberto ou fechado é OK).
 *   5. Último backup do dev.db — erro se nenhum; warning se > 7d;
 *      info se OK. Pega de lib/backup.ts (listBackups).
 */

import { prisma } from "@/lib/prisma-client";
import { listBackups } from "@/lib/backup";

type Level = "ok" | "warn" | "error" | "info";
type CheckResult = {
  name: string;
  level: Level;
  message: string;
};

const ICONS: Record<Level, string> = {
  ok: "✅",
  warn: "⚠️ ",
  error: "❌",
  info: "ℹ️ ",
};

// ANSI cores (sem dep, só TTY)
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[36m",
};

function colorFor(level: Level): string {
  return level === "ok" ? C.green : level === "warn" ? C.yellow : level === "error" ? C.red : C.blue;
}

/** Check 1 — DB acessível + schema OK. */
async function checkDatabase(): Promise<CheckResult> {
  try {
    // 5 queries em paralelo: se schema falta um model, falha aqui.
    const [users, products, ingredients, sessions, orders] = await Promise.all([
      prisma.user.count(),
      prisma.product.count(),
      prisma.ingredient.count(),
      prisma.eventSession.count(),
      prisma.order.count(),
    ]);
    return {
      name: "DB acessível + schema",
      level: "ok",
      message: `${users} users, ${products} produtos, ${ingredients} ingredientes, ${sessions} eventos, ${orders} pedidos`,
    };
  } catch (err) {
    return {
      name: "DB acessível + schema",
      level: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Check 2 — Pelo menos 1 admin. */
async function checkAdmin(): Promise<CheckResult> {
  try {
    const admin = await prisma.user.findFirst({
      where: { role: "admin" },
      select: { name: true },
    });
    if (!admin) {
      return {
        name: "Admin existe",
        level: "error",
        message: 'Nenhum user com role="admin" — rode `npx tsx scripts/reset-users.ts`',
      };
    }
    return {
      name: "Admin existe",
      level: "ok",
      message: `${admin.name} (admin)`,
    };
  } catch (err) {
    return {
      name: "Admin existe",
      level: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Check 3 — Servidor HTTP. Opcional: vira warning se ECONNREFUSED. */
async function checkServer(): Promise<CheckResult> {
  const url = process.env.SMOKE_URL || "http://localhost:3000/";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1500);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok || res.status === 307) {
      // 307 = redirect pra /login (esperado se não logado)
      return {
        name: "Servidor HTTP respondendo",
        level: "ok",
        message: `${url} → ${res.status}`,
      };
    }
    return {
      name: "Servidor HTTP respondendo",
      level: "warn",
      message: `${url} → ${res.status} (esperado 200 ou 307)`,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed") || msg.includes("aborted")) {
      return {
        name: "Servidor HTTP respondendo",
        level: "warn",
        message: "Servidor não tá rodando. Rode `npm run dev` ou `pm2 start ecosystem.config.js`",
      };
    }
    return {
      name: "Servidor HTTP respondendo",
      level: "error",
      message: msg,
    };
  }
}

/** Check 4 — Status do caixa (info). */
async function checkCaixa(): Promise<CheckResult> {
  try {
    const open = await prisma.eventSession.findFirst({
      where: { closedAt: null },
      orderBy: { openedAt: "desc" },
      select: { name: true, openedBy: true, openedAt: true },
    });
    if (!open) {
      return {
        name: "Status do caixa",
        level: "info",
        message: "Nenhum caixa aberto — Gil precisa abrir no admin antes de receber pedido",
      };
    }
    const sinceMin = Math.round((Date.now() - new Date(open.openedAt).getTime()) / 60000);
    return {
      name: "Status do caixa",
      level: "info",
      message: `Aberto: ${open.name ?? "(sem nome)"} por ${open.openedBy} há ${sinceMin}min`,
    };
  } catch (err) {
    return {
      name: "Status do caixa",
      level: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Check 5 — Último backup. */
async function checkBackup(): Promise<CheckResult> {
  try {
    const backups = await listBackups();
    if (backups.length === 0) {
      return {
        name: "Backup do DB",
        level: "error",
        message: "Nenhum backup encontrado em prisma/backups/. Rode backup manual antes do evento.",
      };
    }
    const latest = backups[0];
    const ageMs = Date.now() - new Date(latest.mtime).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    const ageDays = ageHours / 24;
    const mb = (latest.bytes / (1024 * 1024)).toFixed(2);

    if (ageDays > 7) {
      return {
        name: "Backup do DB",
        level: "warn",
        message: `Último backup tem ${Math.round(ageDays)} dias (${mb} MB). Considere ativar backup automático.`,
      };
    }
    const ageLabel =
      ageHours < 1
        ? `${Math.round(ageMs / 60000)}min atrás`
        : ageHours < 24
          ? `${Math.round(ageHours)}h atrás`
          : `${Math.round(ageDays)} dia(s) atrás`;
    return {
      name: "Backup do DB",
      level: "ok",
      message: `${backups.length} backup(s); último ${ageLabel} (${mb} MB)`,
    };
  } catch (err) {
    return {
      name: "Backup do DB",
      level: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main() {
  const t0 = Date.now();
  console.log(`\n${C.bold}🥧 Smoke test — Cozinha da Gil${C.reset}`);
  console.log(`${C.dim}${new Date().toLocaleString("pt-BR")}${C.reset}\n`);

  // Roda em paralelo — todos checks são independentes
  const results = await Promise.all([
    checkDatabase(),
    checkAdmin(),
    checkServer(),
    checkCaixa(),
    checkBackup(),
  ]);

  // Imprime tabela
  const maxNameLen = Math.max(...results.map((r) => r.name.length));
  for (const r of results) {
    const padded = r.name.padEnd(maxNameLen + 2);
    const color = colorFor(r.level);
    console.log(`  ${ICONS[r.level]} ${color}${padded}${C.reset} ${C.dim}${r.message}${C.reset}`);
  }

  const errors = results.filter((r) => r.level === "error");
  const warns = results.filter((r) => r.level === "warn");
  const dt = Date.now() - t0;

  console.log("");
  if (errors.length > 0) {
    console.log(`${C.bold}${C.red}❌ ${errors.length} problema(s) encontrado(s) — corrige antes do evento.${C.reset}`);
  } else if (warns.length > 0) {
    console.log(`${C.bold}${C.yellow}⚠️  ${warns.length} aviso(s) — não bloqueia, mas vale conferir.${C.reset}`);
  } else {
    console.log(`${C.bold}${C.green}✅ Tudo OK — pode subir a barraca.${C.reset}`);
  }
  console.log(`${C.dim}(${dt}ms)${C.reset}\n`);

  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`${C.red}Erro fatal no smoke test:${C.reset}`, err);
  process.exit(2);
});
