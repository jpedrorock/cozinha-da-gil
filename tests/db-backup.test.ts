import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "pdg-prune-test-"));
  });

  afterEach(() => {
    vi.useRealTimers();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("remove backup com data anterior ao corte", async () => {
    // "hoje" = 2026-06-14, keepDays = 14 → corte em 2026-05-31
    const now = new Date("2026-06-14T03:00:00Z");
    writeFileSync(join(tmpDir, "dev-2026-05-30.db"), "OLD"); // 15 dias atrás → prune
    const pruned = await pruneOldBackups(tmpDir, 14, now);
    expect(pruned).toBe(1);
    expect(existsSync(join(tmpDir, "dev-2026-05-30.db"))).toBe(false);
  });

  it("preserva backup recente", async () => {
    const now = new Date("2026-06-14T03:00:00Z");
    writeFileSync(join(tmpDir, "dev-2026-06-13.db"), "RECENT"); // 1 dia atrás → manter
    const pruned = await pruneOldBackups(tmpDir, 14, now);
    expect(pruned).toBe(0);
    expect(existsSync(join(tmpDir, "dev-2026-06-13.db"))).toBe(true);
  });

  it("prune seletivo: remove antigos, mantém recentes", async () => {
    const now = new Date("2026-06-14T03:00:00Z");
    writeFileSync(join(tmpDir, "dev-2026-05-29.db"), "OLD1"); // 16 dias → prune
    writeFileSync(join(tmpDir, "dev-2026-05-30.db"), "OLD2"); // 15 dias → prune
    writeFileSync(join(tmpDir, "dev-2026-06-01.db"), "RECENT"); // 13 dias → manter
    const pruned = await pruneOldBackups(tmpDir, 14, now);
    expect(pruned).toBe(2);
    expect(existsSync(join(tmpDir, "dev-2026-06-01.db"))).toBe(true);
    expect(existsSync(join(tmpDir, "dev-2026-05-29.db"))).toBe(false);
    expect(existsSync(join(tmpDir, "dev-2026-05-30.db"))).toBe(false);
  });

  it("ignora arquivos fora do padrão dev-YYYY-MM-DD.db", async () => {
    const now = new Date("2026-06-14T03:00:00Z");
    writeFileSync(join(tmpDir, "wipe-2025-01-01.db"), "WIPE");
    writeFileSync(join(tmpDir, "backup.log"), "LOG");
    writeFileSync(join(tmpDir, "dev-2025-01-01.db.bak"), "BAK");
    const pruned = await pruneOldBackups(tmpDir, 14, now);
    expect(pruned).toBe(0);
    expect(existsSync(join(tmpDir, "wipe-2025-01-01.db"))).toBe(true);
    expect(existsSync(join(tmpDir, "backup.log"))).toBe(true);
  });

  it("retorna 0 se pasta não existe", async () => {
    const pruned = await pruneOldBackups(join(tmpDir, "nao-existe"), 14);
    expect(pruned).toBe(0);
  });

  it("retorna 0 se pasta vazia", async () => {
    mkdirSync(join(tmpDir, "vazio"));
    const pruned = await pruneOldBackups(join(tmpDir, "vazio"), 14, new Date());
    expect(pruned).toBe(0);
  });

  it("usa Date.now() como padrão de 'now'", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-14T03:00:00Z"));
    writeFileSync(join(tmpDir, "dev-2026-05-30.db"), "OLD");
    const pruned = await pruneOldBackups(tmpDir, 14);
    expect(pruned).toBe(1);
    vi.useRealTimers();
  });
});
