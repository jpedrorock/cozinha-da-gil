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
  let backupsDir: string;

  // "agora" fixado em meia-noite UTC pra que dayOffset(-14) coincida
  // exatamente com o cutoff (fileDate == cutoff → NOT deleted).
  const NOW = new Date("2026-06-15T00:00:00Z").getTime();
  const DAY_MS = 24 * 60 * 60 * 1000;

  function dayOffset(days: number) {
    return new Date(NOW + days * DAY_MS).toISOString().slice(0, 10);
  }

  function touch(filename: string) {
    writeFileSync(join(backupsDir, filename), "DB");
  }

  beforeEach(() => {
    backupsDir = mkdtempSync(join(tmpdir(), "pdg-prune-test-"));
  });

  afterEach(() => {
    rmSync(backupsDir, { recursive: true, force: true });
  });

  it("retorna 0 se diretório não existe", async () => {
    const count = await pruneBackups("/tmp/nao-existe-pdg-prune", 14, NOW);
    expect(count).toBe(0);
  });

  it("retorna 0 se diretório vazio", async () => {
    expect(await pruneBackups(backupsDir, 14, NOW)).toBe(0);
  });

  it("deleta arquivo com 15 dias (> keepDays=14)", async () => {
    touch(`dev-${dayOffset(-15)}.db`);
    const count = await pruneBackups(backupsDir, 14, NOW);
    expect(count).toBe(1);
    expect(readdirSync(backupsDir)).toHaveLength(0);
  });

  it("mantém arquivo com exatamente 14 dias", async () => {
    const name = `dev-${dayOffset(-14)}.db`;
    touch(name);
    const count = await pruneBackups(backupsDir, 14, NOW);
    expect(count).toBe(0);
    expect(existsSync(join(backupsDir, name))).toBe(true);
  });

  it("mantém arquivo recente (1 dia atrás)", async () => {
    touch(`dev-${dayOffset(-1)}.db`);
    expect(await pruneBackups(backupsDir, 14, NOW)).toBe(0);
  });

  it("deleta múltiplos arquivos antigos de uma vez", async () => {
    touch(`dev-${dayOffset(-30)}.db`);
    touch(`dev-${dayOffset(-20)}.db`);
    touch(`dev-${dayOffset(-15)}.db`);
    touch(`dev-${dayOffset(-5)}.db`);
    touch(`dev-${dayOffset(-1)}.db`);
    const count = await pruneBackups(backupsDir, 14, NOW);
    expect(count).toBe(3);
    expect(readdirSync(backupsDir)).toHaveLength(2);
  });

  it("ignora arquivos wipe-*.db (backups de Zona de Perigo)", async () => {
    touch("wipe-2026-01-01T00-00-00-000-abcd.db");
    const count = await pruneBackups(backupsDir, 14, NOW);
    expect(count).toBe(0);
    expect(readdirSync(backupsDir)).toHaveLength(1);
  });

  it("ignora backup.log e outros arquivos não-db", async () => {
    touch("backup.log");
    touch("other-file.txt");
    expect(await pruneBackups(backupsDir, 14, NOW)).toBe(0);
  });

  it("respeita keepDays customizado (7 dias)", async () => {
    touch(`dev-${dayOffset(-8)}.db`);
    touch(`dev-${dayOffset(-6)}.db`);
    const count = await pruneBackups(backupsDir, 7, NOW);
    expect(count).toBe(1);
  });

  it("ignora arquivo com data inválida no nome", async () => {
    touch("dev-9999-99-99.db");
    const count = await pruneBackups(backupsDir, 14, NOW);
    // new Date('9999-99-99') é Invalid Date (NaN) — isFinite falha
    expect(count).toBe(0);
  });
});
