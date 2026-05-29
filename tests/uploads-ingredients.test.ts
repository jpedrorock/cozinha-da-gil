import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

// Tmp dir único por run — set ANTES do import de lib/uploads pra
// getUploadsRoot() ler o env var correto.
const TMP_ROOT = path.join(
  os.tmpdir(),
  `pdg-uploads-test-${process.pid}-${Date.now()}`,
);
process.env.UPLOADS_DIR = TMP_ROOT;

// Imports DEPOIS de setar env var
import {
  deleteIngredientImage,
  getIngredientsDir,
  isUploadedIngredientIcon,
  readIngredientImage,
  saveIngredientImage,
} from "@/lib/uploads";

// SVG mínimo (válido) + PNG mínimo (1x1 transparente)
const SVG_BYTES = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>`);
const SVG_DATA_URI = `data:image/svg+xml;base64,${SVG_BYTES.toString("base64")}`;

// PNG 1x1 transparente (mínimo viable PNG ~67 bytes)
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);
const PNG_DATA_URI = `data:image/png;base64,${PNG_BYTES.toString("base64")}`;

beforeAll(async () => {
  await fs.mkdir(TMP_ROOT, { recursive: true });
});

afterAll(async () => {
  await fs.rm(TMP_ROOT, { recursive: true, force: true });
});

describe("isUploadedIngredientIcon", () => {
  it("detecta path do uploads/ingredients/", () => {
    expect(isUploadedIngredientIcon("/api/uploads/ingredients/abc.svg")).toBe(true);
  });

  it("rejeita path de produtos (caminho diferente)", () => {
    expect(isUploadedIngredientIcon("/api/uploads/products/abc.svg")).toBe(false);
  });

  it("rejeita Iconify ID", () => {
    expect(isUploadedIngredientIcon("mdi:bacon")).toBe(false);
  });

  it("rejeita null", () => {
    expect(isUploadedIngredientIcon(null)).toBe(false);
  });

  it("rejeita string vazia", () => {
    expect(isUploadedIngredientIcon("")).toBe(false);
  });
});

describe("saveIngredientImage", () => {
  it("salva SVG e devolve URL /api/uploads/ingredients/<hash>.svg", async () => {
    const url = await saveIngredientImage(SVG_DATA_URI, null);
    expect(url).toMatch(/^\/api\/uploads\/ingredients\/[a-f0-9]{12}\.svg$/);

    // arquivo existe fisicamente?
    const filename = url!.split("/").pop()!;
    const filePath = path.join(getIngredientsDir(), filename);
    const exists = await fs
      .access(filePath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });

  it("salva PNG e devolve URL com extensão .png", async () => {
    const url = await saveIngredientImage(PNG_DATA_URI, null);
    expect(url).toMatch(/^\/api\/uploads\/ingredients\/[a-f0-9]{12}\.png$/);
  });

  it("dedupe — mesmo conteúdo gera mesma URL (hash determinístico)", async () => {
    const url1 = await saveIngredientImage(SVG_DATA_URI, null);
    const url2 = await saveIngredientImage(SVG_DATA_URI, null);
    expect(url1).toBe(url2);
  });

  it("retorna null pra data URI mal-formado", async () => {
    expect(await saveIngredientImage("not a data uri", null)).toBeNull();
    expect(await saveIngredientImage("data:image/jpeg;base64,foo", null)).toBeNull(); // gif/jpeg não aceito
    expect(await saveIngredientImage("data:image/svg+xml;base64,!!!invalid", null)).toBeNull();
  });

  it("deleta arquivo antigo quando oldUrl tem hash diferente", async () => {
    // 1. salva PNG com conteúdo A
    const urlA = await saveIngredientImage(PNG_DATA_URI, null);
    const filenameA = urlA!.split("/").pop()!;
    const pathA = path.join(getIngredientsDir(), filenameA);

    // 2. salva SVG diferente, dizendo que substitui o A
    const urlB = await saveIngredientImage(SVG_DATA_URI, urlA);
    expect(urlB).not.toBe(urlA);

    // arquivo antigo (A) deve ter sido deletado
    const aExists = await fs
      .access(pathA)
      .then(() => true)
      .catch(() => false);
    expect(aExists).toBe(false);

    // arquivo novo (B) existe
    const filenameB = urlB!.split("/").pop()!;
    const pathB = path.join(getIngredientsDir(), filenameB);
    const bExists = await fs
      .access(pathB)
      .then(() => true)
      .catch(() => false);
    expect(bExists).toBe(true);
  });

  it("não deleta nada quando oldUrl é o mesmo hash (idempotente)", async () => {
    const url = await saveIngredientImage(SVG_DATA_URI, null);
    // Sobrescreve com mesma imagem (mesmo hash)
    const url2 = await saveIngredientImage(SVG_DATA_URI, url);
    expect(url2).toBe(url);

    const filename = url!.split("/").pop()!;
    const filePath = path.join(getIngredientsDir(), filename);
    const exists = await fs
      .access(filePath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });
});

describe("readIngredientImage", () => {
  it("lê SVG salvo", async () => {
    const url = await saveIngredientImage(SVG_DATA_URI, null);
    const filename = url!.split("/").pop()!;
    const result = await readIngredientImage(filename);
    expect(result).not.toBeNull();
    expect(result!.contentType).toBe("image/svg+xml");
    expect(result!.bytes.equals(SVG_BYTES)).toBe(true);
  });

  it("lê PNG salvo com content-type correto", async () => {
    const url = await saveIngredientImage(PNG_DATA_URI, null);
    const filename = url!.split("/").pop()!;
    const result = await readIngredientImage(filename);
    expect(result).not.toBeNull();
    expect(result!.contentType).toBe("image/png");
  });

  it("retorna null pra filename inexistente", async () => {
    expect(await readIngredientImage("nao-existe.svg")).toBeNull();
  });

  it("rejeita filename com path traversal (..)", async () => {
    expect(await readIngredientImage("../etc/passwd")).toBeNull();
    expect(await readIngredientImage("../../../../etc/passwd")).toBeNull();
  });

  it("rejeita filename com slash", async () => {
    expect(await readIngredientImage("subdir/file.svg")).toBeNull();
  });

  it("rejeita filename com chars proibidos", async () => {
    expect(await readIngredientImage("file with spaces.svg")).toBeNull();
    expect(await readIngredientImage("file;cmd.svg")).toBeNull();
    expect(await readIngredientImage("$filename.svg")).toBeNull();
  });
});

describe("deleteIngredientImage", () => {
  it("apaga arquivo existente", async () => {
    const url = await saveIngredientImage(SVG_DATA_URI, null);
    await deleteIngredientImage(url);
    const filename = url!.split("/").pop()!;
    const exists = await fs
      .access(path.join(getIngredientsDir(), filename))
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });

  it("é idempotente — não falha se arquivo já não existe", async () => {
    await expect(
      deleteIngredientImage("/api/uploads/ingredients/inexistente.svg"),
    ).resolves.toBeUndefined();
  });

  it("ignora URL null", async () => {
    await expect(deleteIngredientImage(null)).resolves.toBeUndefined();
  });

  it("ignora URL que não é de ingredient (path inválido)", async () => {
    await expect(
      deleteIngredientImage("/api/uploads/products/abc.svg"),
    ).resolves.toBeUndefined();
  });
});
