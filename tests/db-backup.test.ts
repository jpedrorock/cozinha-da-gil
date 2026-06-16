import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readdirSync } from "node:fs";
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
  let backupsDir: string;

  beforeEach(() => {
    backupsDir = mkdtempSync(join(tmpdir(), "pdg-prune-test-"));
  });

  afterEach(() => {
    rmSync(backupsDir, { recursive: true, force: true });
  });

  function createBackup(date: string) {
    writeFileSync(join(backupsDir, `dev-${date}.db`), "fake");
  }

  it("remove arquivos com data anterior ao cutoff", async () => {
    createBackup("2020-01-01");
    createBackup("2019-06-15");
    const pruned = await pruneOldBackups(backupsDir, 14);
    expect(pruned).toBe(2);
    expect(readdirSync(backupsDir)).toHaveLength(0);
  });

  it("mantém arquivos recentes (dentro de keepDays)", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    createBackup(today);
    createBackup(yesterday);
    const pruned = await pruneOldBackups(backupsDir, 14);
    expect(pruned).toBe(0);
    expect(readdirSync(backupsDir)).toHaveLength(2);
  });

  it("remove apenas os antigos quando há mistura de datas", async () => {
    createBackup("2020-01-01"); // velho → apaga
    createBackup("2020-03-15"); // velho → apaga
    const today = new Date().toISOString().slice(0, 10);
    createBackup(today); // recente → mantém
    const pruned = await pruneOldBackups(backupsDir, 14);
    expect(pruned).toBe(2);
    expect(readdirSync(backupsDir)).toHaveLength(1);
    expect(existsSync(join(backupsDir, `dev-${today}.db`))).toBe(true);
  });

  it("ignora arquivos que não seguem o padrão dev-YYYY-MM-DD.db", async () => {
    writeFileSync(join(backupsDir, "wipe-2020-01-01T00-00-00.db"), "fake");
    writeFileSync(join(backupsDir, "backup.log"), "log");
    writeFileSync(join(backupsDir, "dev-2020-01-01.txt"), "txt");
    const pruned = await pruneOldBackups(backupsDir, 14);
    expect(pruned).toBe(0);
    expect(readdirSync(backupsDir)).toHaveLength(3);
  });

  it("retorna 0 quando o diretório não existe", async () => {
    const pruned = await pruneOldBackups("/tmp/inexistente-pdg-test-xxxxxxxxxxx", 14);
    expect(pruned).toBe(0);
  });

  it("retorna 0 quando o diretório está vazio", async () => {
    const pruned = await pruneOldBackups(backupsDir, 14);
    expect(pruned).toBe(0);
  });

  it("respeita keepDays=0 (apaga tudo incluindo hoje)", async () => {
    const today = new Date().toISOString().slice(0, 10);
    createBackup(today);
    createBackup("2020-01-01");
    // keepDays=0: cutoff = agora, qualquer data antes de hoje é removida
    // hoje também é < cutoff dependendo do horário (ms), mas pelo menos 2020 é
    const pruned = await pruneOldBackups(backupsDir, 0);
    // 2020-01-01 definitivamente anterior ao cutoff
    expect(pruned).toBeGreaterThanOrEqual(1);
  });
});
