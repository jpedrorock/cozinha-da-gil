import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { backupDatabase } from "../lib/db-backup";

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
