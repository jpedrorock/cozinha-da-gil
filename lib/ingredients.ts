/**
 * Lógica pura de validação de ingredientes — sem I/O, sem Prisma.
 * Compartilhada entre os route handlers e os testes unitários.
 */

export const ALLOWED_CATEGORIES = [
  "topping",
  "doce",
  "molho",
  "macarrao_topping",
  "macarrao_molho",
  "bebida_extra",
] as const;

export type IngredientCategory = (typeof ALLOWED_CATEGORIES)[number];

export function isAllowedCategory(v: unknown): v is IngredientCategory {
  return typeof v === "string" && (ALLOWED_CATEGORIES as readonly string[]).includes(v);
}

export type IngredientNameResult =
  | { ok: true; name: string }
  | { ok: false; error: string };

export function validateIngredientName(raw: unknown): IngredientNameResult {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (name.length < 1 || name.length > 60) {
    return { ok: false, error: "Nome deve ter 1–60 caracteres." };
  }
  return { ok: true, name };
}

export type IconParseResult =
  | { kind: "none" }
  | { kind: "iconify"; value: string }
  | { kind: "data-uri"; value: string }
  | { kind: "upload-path"; value: string }
  | { kind: "invalid" };

/**
 * Analisa o campo `icon` de um body de ingrediente:
 *   - null / undefined / "" → none
 *   - "prefix:name" Iconify ID (até 80 chars)  → iconify
 *   - "data:image/(svg+xml|png);base64,..."     → data-uri
 *   - "/api/uploads/ingredients/<hash>.<ext>"   → upload-path
 *   - qualquer outra coisa                      → invalid
 */
export function parseIconValue(icon: unknown): IconParseResult {
  if (icon === null || icon === undefined || icon === "") {
    return { kind: "none" };
  }
  if (typeof icon !== "string") {
    return { kind: "invalid" };
  }
  const trimmed = icon.trim();
  if (trimmed === "") return { kind: "none" };

  if (trimmed.startsWith("data:image/")) {
    return { kind: "data-uri", value: trimmed };
  }
  if (trimmed.startsWith("/api/uploads/ingredients/")) {
    return { kind: "upload-path", value: trimmed };
  }
  if (/^[a-z0-9-]+:[a-z0-9-]+$/i.test(trimmed) && trimmed.length <= 80) {
    return { kind: "iconify", value: trimmed };
  }
  return { kind: "invalid" };
}
