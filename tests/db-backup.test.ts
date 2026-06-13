import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readdirSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { backupDatabase, pruneOldBackups } from "../lib/db-backup";

describe("backupDatabase", () => {
  let tmpDir: string;
  let dbPath: string;
  let originalUrl: string | undefined;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "pdg-backup-test-"));
    dbPath = join(tmpDir, "dev.db");
    writeFileSync(dbPath, "FAKE SQLITE CONTENT");
    originalUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = `file:${dbPath}`;
  });

  afterEach(() => {
    process.env.DATABASE_URL = originalUrl;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("cria backup com nome timestamped dentro de backups/", async () => {
    const out = await backupDatabase("wipe");
    expect(out).toContain("/backups/");
    expect(out).toContain("wipe-");
    expect(out.endsWith(".db")).toBe(true);
    expect(existsSync(out)).toBe(true);
  });

  it("copia o conteúdo do dev.db", async () => {
    const out = await backupDatabase("wipe");
    const { readFileSync } = await import("node:fs");
    expect(readFileSync(out, "utf-8")).toBe("FAKE SQLITE CONTENT");
  });

  it("aceita reasons múltiplos pra rodar em sequência sem conflito", async () => {
    const a = await backupDatabase("wipe");
    const b = await backupDatabase("wipe");
    expect(a).not.toBe(b); // timestamps diferentes
    const files = readdirSync(join(tmpDir, "backups"));
    expect(files.length).toBe(2);
  });

  it("sanitiza reason pra evitar path traversal", async () => {
    const out = await backupDatabase("../../../etc/passwd");
    // Tudo virou hífen na regex. Reason sanitizada não sai da pasta backups/.
    expect(out).toContain("/backups/");
    expect(out).not.toContain("etc/passwd");
    expect(out).not.toMatch(/\.\.\//);
  });

  it("falha se DATABASE_URL não é file:", async () => {
    process.env.DATABASE_URL = "postgres://localhost/x";
    await expect(backupDatabase("wipe")).rejects.toThrow(/sqlite file:/);
  });

  it("falha se DATABASE_URL ausente", async () => {
    delete process.env.DATABASE_URL;
    await expect(backupDatabase("wipe")).rejects.toThrow();
  });
});

describe("pruneOldBackups", () => {
  let tmpDir: string;

  function touch(filename: string, daysAgo: number) {
    const p = join(tmpDir, filename);
    writeFileSync(p, "");
    const mtime = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    utimesSync(p, mtime, mtime);
    return p;
  }

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "pdg-prune-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.useRealTimers();
  });

  it("não remove arquivos dentro do período de retenção", async () => {
    touch("dev-2026-06-10.db", 3); // 3 dias atrás → dentro de 14d
    const pruned = await pruneOldBackups(tmpDir, 14);
    expect(pruned).toBe(0);
    expect(readdirSync(tmpDir).length).toBe(1);
  });

  it("remove backups diários com mais de 14 dias", async () => {
    touch("dev-2026-05-01.db", 20); // 20 dias → fora
    touch("dev-2026-06-10.db", 3);  // 3 dias → dentro
    const pruned = await pruneOldBackups(tmpDir, 14);
    expect(pruned).toBe(1);
    const remaining = readdirSync(tmpDir);
    expect(remaining).toEqual(["dev-2026-06-10.db"]);
  });

  it("remove wipe-*.db fora do período", async () => {
    touch("wipe-2026-05-01T00-00-00-000-abcd.db", 20);
    touch("wipe-2026-06-10T10-00-00-000-cafe.db", 2);
    const pruned = await pruneOldBackups(tmpDir, 14);
    expect(pruned).toBe(1);
  });

  it("não remove backup.log nem outros arquivos irrelevantes", async () => {
    touch("backup.log", 30);
    touch("readme.txt", 30);
    const pruned = await pruneOldBackups(tmpDir, 14);
    expect(pruned).toBe(0);
    expect(readdirSync(tmpDir).length).toBe(2);
  });

  it("retorna 0 se o diretório não existe", async () => {
    const pruned = await pruneOldBackups(join(tmpDir, "inexistente"), 14);
    expect(pruned).toBe(0);
  });

  it("limite exato: arquivo no cutoff exato não é removido", async () => {
    // 14 dias exatos — mtime = cutoff: comparação < cutoffMs → não remove
    touch("dev-2026-05-30.db", 14);
    const pruned = await pruneOldBackups(tmpDir, 14);
    expect(pruned).toBe(0);
  });

  it("limite exato: arquivo 1ms além do cutoff é removido", async () => {
    // Usa fake timers pra controle preciso
    vi.useFakeTimers();
    const now = new Date("2026-06-13T12:00:00Z");
    vi.setSystemTime(now);

    const p = join(tmpDir, "dev-2026-05-29.db");
    writeFileSync(p, "");
    // mtime = exatamente 14 dias + 1ms atrás → deve remover
    const mtime = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000 - 1);
    utimesSync(p, mtime, mtime);

    const pruned = await pruneOldBackups(tmpDir, 14);
    expect(pruned).toBe(1);
    expect(existsSync(p)).toBe(false);
  });

  it("remove múltiplos arquivos antigos de uma vez", async () => {
    touch("dev-2026-04-01.db", 50);
    touch("dev-2026-04-15.db", 36);
    touch("dev-2026-05-01.db", 20);
    touch("dev-2026-06-10.db", 3);
    const pruned = await pruneOldBackups(tmpDir, 14);
    expect(pruned).toBe(3);
    expect(readdirSync(tmpDir)).toEqual(["dev-2026-06-10.db"]);
  });
});
