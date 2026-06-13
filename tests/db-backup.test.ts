import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { backupDatabase, cleanupOldBackups } from "../lib/db-backup";

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

describe("cleanupOldBackups", () => {
  let backupDir: string;

  beforeEach(() => {
    backupDir = mkdtempSync(join(tmpdir(), "pdg-cleanup-test-"));
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    rmSync(backupDir, { recursive: true, force: true });
  });

  function seedFile(name: string) {
    writeFileSync(join(backupDir, name), "FAKE");
  }

  it("remove arquivos mais velhos que retentionDays", async () => {
    // "agora" = 2026-06-13
    vi.setSystemTime(new Date("2026-06-13T12:00:00Z"));
    // old: 30 dias atrás — deve deletar
    seedFile("dev-2026-05-14.db");
    // recent: 1 dia atrás — deve manter
    seedFile("dev-2026-06-12.db");

    const pruned = await cleanupOldBackups(backupDir, 14);

    expect(pruned).toBe(1);
    expect(existsSync(join(backupDir, "dev-2026-05-14.db"))).toBe(false);
    expect(existsSync(join(backupDir, "dev-2026-06-12.db"))).toBe(true);
  });

  it("mantém arquivos exatamente no limite (14d)", async () => {
    vi.setSystemTime(new Date("2026-06-13T00:00:00Z"));
    // exatamente 14 dias atrás = 2026-05-30 — cutoff é estritamente menor, então mantém
    seedFile("dev-2026-05-30.db");
    seedFile("dev-2026-05-29.db"); // 15d — remove

    const pruned = await cleanupOldBackups(backupDir, 14);

    expect(pruned).toBe(1);
    expect(existsSync(join(backupDir, "dev-2026-05-30.db"))).toBe(true);
    expect(existsSync(join(backupDir, "dev-2026-05-29.db"))).toBe(false);
  });

  it("ignora arquivos fora do padrão dev-YYYY-MM-DD.db", async () => {
    vi.setSystemTime(new Date("2026-06-13T12:00:00Z"));
    seedFile("wipe-2026-01-01-abc.db"); // backup manual (wipe) — ignorar
    seedFile("backup.log");             // log — ignorar
    seedFile("dev-2026-05-01.db");      // old — remove

    const pruned = await cleanupOldBackups(backupDir, 14);

    expect(pruned).toBe(1);
    expect(existsSync(join(backupDir, "wipe-2026-01-01-abc.db"))).toBe(true);
    expect(existsSync(join(backupDir, "backup.log"))).toBe(true);
  });

  it("retorna 0 se todos os arquivos são recentes", async () => {
    vi.setSystemTime(new Date("2026-06-13T12:00:00Z"));
    seedFile("dev-2026-06-10.db"); // 3 dias
    seedFile("dev-2026-06-11.db"); // 2 dias

    const pruned = await cleanupOldBackups(backupDir, 14);
    expect(pruned).toBe(0);
    expect(readdirSync(backupDir).length).toBe(2);
  });

  it("retorna 0 se o diretório não existe", async () => {
    const noDir = join(tmpdir(), "pdg-nonexistent-9999");
    const pruned = await cleanupOldBackups(noDir, 14);
    expect(pruned).toBe(0);
  });

  it("remove múltiplos arquivos antigos", async () => {
    vi.setSystemTime(new Date("2026-06-13T12:00:00Z"));
    seedFile("dev-2026-05-01.db"); // 43d
    seedFile("dev-2026-04-01.db"); // 73d
    seedFile("dev-2026-03-01.db"); // 104d
    seedFile("dev-2026-06-12.db"); // 1d — manter

    const pruned = await cleanupOldBackups(backupDir, 14);
    expect(pruned).toBe(3);
    expect(readdirSync(backupDir).length).toBe(1);
  });
});
