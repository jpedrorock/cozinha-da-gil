import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pruneBackupFiles } from "../lib/backup-rotation";

describe("pruneBackupFiles", () => {
  let tmpDir: string;

  beforeAll(() => {
    vi.useFakeTimers();
    // "hoje" = 2026-06-15T00:00:00Z (meia-noite, para boundary previsível)
    vi.setSystemTime(new Date("2026-06-15T00:00:00Z"));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "pdg-rotation-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function create(dateStr: string) {
    writeFileSync(join(tmpDir, `dev-${dateStr}.db`), "FAKE");
  }

  function exists(dateStr: string) {
    return existsSync(join(tmpDir, `dev-${dateStr}.db`));
  }

  it("remove arquivo com 15 dias (passado o limite de 14)", async () => {
    create("2026-05-31"); // 15 dias atrás
    const removed = await pruneBackupFiles(tmpDir, 14);
    expect(removed).toBe(1);
    expect(exists("2026-05-31")).toBe(false);
  });

  it("mantém arquivo com exatamente 14 dias (boundary = não remove)", async () => {
    // cutoff = 2026-06-15T00:00Z − 14d = 2026-06-01T00:00Z
    // fileDate("2026-06-01") = 2026-06-01T00:00Z
    // condição fileDate < cutoff → false → mantém
    create("2026-06-01");
    const removed = await pruneBackupFiles(tmpDir, 14);
    expect(removed).toBe(0);
    expect(exists("2026-06-01")).toBe(true);
  });

  it("mantém arquivo de hoje", async () => {
    create("2026-06-15");
    const removed = await pruneBackupFiles(tmpDir, 14);
    expect(removed).toBe(0);
    expect(exists("2026-06-15")).toBe(true);
  });

  it("remove só os arquivos antigos, preserva recentes", async () => {
    create("2026-05-01"); // 45 dias — remove
    create("2026-05-31"); // 15 dias — remove
    create("2026-06-01"); // 14 dias — mantém (boundary)
    create("2026-06-10"); // 5 dias — mantém
    create("2026-06-15"); // hoje — mantém

    const removed = await pruneBackupFiles(tmpDir, 14);
    expect(removed).toBe(2);
    expect(exists("2026-05-01")).toBe(false);
    expect(exists("2026-05-31")).toBe(false);
    expect(exists("2026-06-01")).toBe(true);
    expect(exists("2026-06-10")).toBe(true);
    expect(exists("2026-06-15")).toBe(true);
  });

  it("ignora arquivos com nome fora do padrão dev-YYYY-MM-DD.db", async () => {
    writeFileSync(join(tmpDir, "backup.log"), "log");
    writeFileSync(join(tmpDir, "wipe-2026-01-01T10-00-00.db"), "wipe");
    writeFileSync(join(tmpDir, "dev-2026-06-15-extra.db"), "extra");
    writeFileSync(join(tmpDir, "dev-2026-05-01.bak"), "bak");

    const removed = await pruneBackupFiles(tmpDir, 14);
    expect(removed).toBe(0);
    expect(existsSync(join(tmpDir, "backup.log"))).toBe(true);
    expect(existsSync(join(tmpDir, "wipe-2026-01-01T10-00-00.db"))).toBe(true);
  });

  it("retorna 0 quando dir não existe (sem lançar exceção)", async () => {
    const missing = join(tmpDir, "nao-existe");
    await expect(pruneBackupFiles(missing, 14)).resolves.toBe(0);
  });

  it("retorna 0 quando diretório está vazio", async () => {
    const removed = await pruneBackupFiles(tmpDir, 14);
    expect(removed).toBe(0);
  });

  it("respeita keepDays customizado (30 dias)", async () => {
    // cutoff com 30d = 2026-05-16T00:00Z
    create("2026-05-01"); // 45 dias — remove
    create("2026-05-15"); // 31 dias — remove
    create("2026-05-16"); // 30 dias — mantém (boundary)
    create("2026-05-31"); // 15 dias — mantém

    const removed = await pruneBackupFiles(tmpDir, 30);
    expect(removed).toBe(2);
    expect(exists("2026-05-01")).toBe(false);
    expect(exists("2026-05-15")).toBe(false);
    expect(exists("2026-05-16")).toBe(true);
    expect(exists("2026-05-31")).toBe(true);
  });

  it("remove 10 arquivos antigos em um único passe", async () => {
    for (let d = 1; d <= 10; d++) {
      create(`2026-04-${String(d).padStart(2, "0")}`); // todos >60 dias
    }
    const removed = await pruneBackupFiles(tmpDir, 14);
    expect(removed).toBe(10);
  });
});
