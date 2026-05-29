/**
 * Helpers pra storage de imagens (produtos e ingredientes).
 *
 * Diretório: $UPLOADS_DIR ou ./data/uploads (dev) — em produção (Coolify),
 * `/app/data/uploads` cai no mesmo volume montado pro SQLite.
 *
 * Servido via /api/uploads/{products,ingredients}/<filename>. URLs salvas no
 * DB são apenas relativas pra serem portáveis entre domínios (dev, produção,
 * preview, etc).
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/** Raiz do storage de uploads. Cria se não existir. */
export function getUploadsRoot(): string {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), "data", "uploads");
}

export function getProductsDir(): string {
  return path.join(getUploadsRoot(), "products");
}

export function getIngredientsDir(): string {
  return path.join(getUploadsRoot(), "ingredients");
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

/** Extrai mime + bytes de um data URI `data:image/(svg+xml|png);base64,...` */
function decodeDataUrl(dataUrl: string): { ext: "svg" | "png"; bytes: Buffer } | null {
  const m = /^data:image\/(svg\+xml|png);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  const ext = m[1] === "svg+xml" ? "svg" : "png";
  try {
    return { ext, bytes: Buffer.from(m[2], "base64") };
  } catch {
    return null;
  }
}

/**
 * Salva um data URI no filesystem e retorna URL relativa.
 * Filename é `<productId>-<hash>.<ext>` — hash do conteúdo evita
 * cache poluído quando admin re-envia mesma imagem.
 *
 * Se já existia arquivo pra esse productId com hash DIFERENTE, deleta
 * o antigo. Caller é responsável por passar oldUrl quando souber.
 */
export async function saveProductImage(
  productId: string,
  dataUrl: string,
  oldUrl: string | null = null,
): Promise<string | null> {
  const decoded = decodeDataUrl(dataUrl);
  if (!decoded) return null;
  const { ext, bytes } = decoded;
  const hash = crypto.createHash("sha1").update(bytes).digest("hex").slice(0, 10);
  const filename = `${productId}-${hash}.${ext}`;
  const dir = getProductsDir();
  await ensureDir(dir);
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, bytes);
  // Limpa imagem antiga se for diferente da nova
  if (oldUrl) {
    const oldFile = filenameFromUrl(oldUrl);
    if (oldFile && oldFile !== filename) {
      await fs.unlink(path.join(dir, oldFile)).catch(() => {});
    }
  }
  return `/api/uploads/products/${filename}`;
}

/** Deleta o arquivo de imagem associado a uma URL (best-effort). */
export async function deleteProductImage(url: string | null) {
  if (!url) return;
  const filename = filenameFromUrl(url);
  if (!filename) return;
  await fs.unlink(path.join(getProductsDir(), filename)).catch(() => {});
}

/** Lê arquivo do uploads/products/. Retorna null se não existir. */
export async function readProductImage(
  filename: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  // Hardening: rejeita filename com `..`, `/`, `\` — só base64 + extensão
  if (!/^[A-Za-z0-9._-]+$/.test(filename)) return null;
  const filePath = path.join(getProductsDir(), filename);
  // Garante que o path resolvido fica DENTRO do uploads dir
  // (defesa em profundidade contra path traversal)
  const resolved = path.resolve(filePath);
  const root = path.resolve(getProductsDir());
  if (!resolved.startsWith(root + path.sep) && resolved !== root) return null;
  try {
    const bytes = await fs.readFile(filePath);
    const contentType = filename.endsWith(".svg")
      ? "image/svg+xml"
      : filename.endsWith(".png")
        ? "image/png"
        : "application/octet-stream";
    return { bytes, contentType };
  } catch {
    return null;
  }
}

/** Extrai filename de URL do tipo /api/uploads/products/<filename>. */
function filenameFromUrl(url: string): string | null {
  const prefix = "/api/uploads/products/";
  if (!url.startsWith(prefix)) return null;
  const filename = url.slice(prefix.length);
  if (!/^[A-Za-z0-9._-]+$/.test(filename)) return null;
  return filename;
}

// ============================================================
// INGREDIENTES — espelho do fluxo de produtos.
// Diferença: filename usa hash do conteúdo (sem id prefixo) porque
// no fluxo de CRIAÇÃO o ingrediente ainda não tem ID. Cleanup
// best-effort quando admin troca/remove a imagem.
// ============================================================

/**
 * Salva data URI de ícone de ingrediente no filesystem. Retorna URL
 * relativa `/api/uploads/ingredients/<hash>.<ext>` ou null se inválido.
 *
 * Se `oldUrl` informado e hash diferente, deleta o arquivo antigo
 * (best-effort, ignora erro).
 */
export async function saveIngredientImage(
  dataUrl: string,
  oldUrl: string | null = null,
): Promise<string | null> {
  const decoded = decodeDataUrl(dataUrl);
  if (!decoded) return null;
  const { ext, bytes } = decoded;
  // Hash do conteúdo é suficiente — não tem productId pra prefixar.
  // Mesmos bytes = mesmo arquivo (dedupe automático entre ingredientes).
  const hash = crypto.createHash("sha1").update(bytes).digest("hex").slice(0, 12);
  const filename = `${hash}.${ext}`;
  const dir = getIngredientsDir();
  await ensureDir(dir);
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, bytes);
  if (oldUrl) {
    const oldFile = ingredientFilenameFromUrl(oldUrl);
    if (oldFile && oldFile !== filename) {
      await fs.unlink(path.join(dir, oldFile)).catch(() => {});
    }
  }
  return `/api/uploads/ingredients/${filename}`;
}

/** Deleta o arquivo associado a URL de ingrediente (best-effort). */
export async function deleteIngredientImage(url: string | null) {
  if (!url) return;
  const filename = ingredientFilenameFromUrl(url);
  if (!filename) return;
  await fs.unlink(path.join(getIngredientsDir(), filename)).catch(() => {});
}

/** Lê arquivo do uploads/ingredients/. Retorna null se não existir. */
export async function readIngredientImage(
  filename: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  if (!/^[A-Za-z0-9._-]+$/.test(filename)) return null;
  const filePath = path.join(getIngredientsDir(), filename);
  const resolved = path.resolve(filePath);
  const root = path.resolve(getIngredientsDir());
  if (!resolved.startsWith(root + path.sep) && resolved !== root) return null;
  try {
    const bytes = await fs.readFile(filePath);
    const contentType = filename.endsWith(".svg")
      ? "image/svg+xml"
      : filename.endsWith(".png")
        ? "image/png"
        : "application/octet-stream";
    return { bytes, contentType };
  } catch {
    return null;
  }
}

function ingredientFilenameFromUrl(url: string): string | null {
  const prefix = "/api/uploads/ingredients/";
  if (!url.startsWith(prefix)) return null;
  const filename = url.slice(prefix.length);
  if (!/^[A-Za-z0-9._-]+$/.test(filename)) return null;
  return filename;
}

/** Detecta se um valor de `icon` é caminho pra arquivo no uploads. */
export function isUploadedIngredientIcon(icon: string | null): icon is string {
  return typeof icon === "string" && icon.startsWith("/api/uploads/ingredients/");
}
