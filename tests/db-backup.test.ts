import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { backupDatabase, pruneBackups } from "../lib/db-backup";

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

describe("pruneBackups", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "pdg-prune-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  const NOW = new Date("2026-06-16T12:00:00Z").getTime();

  it("remove backups com data anterior ao cutoff (>14 dias)", async () => {
    writeFileSync(join(tmpDir, "dev-2026-06-01.db"), "");
    writeFileSync(join(tmpDir, "dev-2026-05-20.db"), "");
    writeFileSync(join(tmpDir, "dev-2026-06-15.db"), "");

    const pruned = await pruneBackups(tmpDir, 14, NOW);
    expect(pruned).toBe(2);
    expect(existsSync(join(tmpDir, "dev-2026-06-01.db"))).toBe(false);
    expect(existsSync(join(tmpDir, "dev-2026-05-20.db"))).toBe(false);
    expect(existsSync(join(tmpDir, "dev-2026-06-15.db"))).toBe(true);
  });

  it("não remove backups dentro do período de retenção", async () => {
    writeFileSync(join(tmpDir, "dev-2026-06-10.db"), "");
    writeFileSync(join(tmpDir, "dev-2026-06-14.db"), "");

    const pruned = await pruneBackups(tmpDir, 14, NOW);
    expect(pruned).toBe(0);
    expect(readdirSync(tmpDir)).toHaveLength(2);
  });

  it("ignora arquivos que não seguem o padrão dev-YYYY-MM-DD.db", async () => {
    writeFileSync(join(tmpDir, "wipe-2026-01-01T00-00-00-000-ab12.db"), "");
    writeFileSync(join(tmpDir, "backup.log"), "some log");
    writeFileSync(join(tmpDir, "dev-2026-01-01.db"), "");

    const pruned = await pruneBackups(tmpDir, 14, NOW);
    expect(pruned).toBe(1);
    expect(existsSync(join(tmpDir, "wipe-2026-01-01T00-00-00-000-ab12.db"))).toBe(true);
    expect(existsSync(join(tmpDir, "backup.log"))).toBe(true);
  });

  it("retorna 0 se o diretório não existe (ainda não foi criado)", async () => {
    const missing = join(tmpDir, "nonexistent");
    const pruned = await pruneBackups(missing, 14, NOW);
    expect(pruned).toBe(0);
  });

  it("retorna 0 se não há arquivos para remover", async () => {
    const pruned = await pruneBackups(tmpDir, 14, NOW);
    expect(pruned).toBe(0);
  });

  it("respeita keepDays customizado", async () => {
    // NOW = 2026-06-16T12:00Z; cutoff (2 dias) = 2026-06-14T12:00Z
    // 2026-06-13 00:00 < cutoff → remove; 2026-06-15 00:00 > cutoff → mantém
    writeFileSync(join(tmpDir, "dev-2026-06-13.db"), "");
    writeFileSync(join(tmpDir, "dev-2026-06-15.db"), "");

    const pruned = await pruneBackups(tmpDir, 2, NOW);
    expect(pruned).toBe(1);
    expect(existsSync(join(tmpDir, "dev-2026-06-13.db"))).toBe(false);
    expect(existsSync(join(tmpDir, "dev-2026-06-15.db"))).toBe(true);
  });
});
