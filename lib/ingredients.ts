/**
 * Helpers puros pra validação de payloads de ingrediente.
 *
 * Extraídos de app/api/ingredients/* pra serem testáveis em Vitest sem
 * precisar subir handler do Next. As rotas chamam essas funções no início
 * pra validar input antes de tocar no Prisma.
 */

/**
 * Lista canônica das categorias permitidas. Coincide com seed.ts e com
 * a referência em prisma/schema.prisma (Ingredient.category — string
 * livre, mas só esses valores são aceitos no input público).
 *
 * Adicionar nova categoria exige seed/admin UI saberem dela.
 * `bebida_extra` reservado mas não seedado hoje.
 */
export const INGREDIENT_CATEGORIES = [
  "topping",
  "doce",
  "molho",
  "macarrao_topping",
  "macarrao_molho",
  // Categoria nova pra Penne/Espaguete (atualização cardápio 06/06/2026).
  // Stepper estruturado pra escolha de massa fica em backlog (item P3) —
  // por enquanto admin pode adicionar ingredientes aqui pra Cardápio
  // refletir o que existe, e atendente usa Observações do pedido pra
  // marcar qual massa o cliente quer.
  "macarrao_massa",
  "bebida_extra",
] as const;

export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];

export function isAllowedCategory(v: unknown): v is IngredientCategory {
  return (
    typeof v === "string" &&
    (INGREDIENT_CATEGORIES as readonly string[]).includes(v)
  );
}

/** Resultado discriminado pra erros de parse com mensagem em pt-BR. */
export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/**
 * Valida o nome do ingrediente. Trim, exige 1–60 caracteres.
 * Limite 60 chars cobre nomes longos tipo "Frango com requeijão derretido"
 * sem deixar campo virar storage de descrição.
 */
export function parseIngredientName(v: unknown): ParseResult<string> {
  if (typeof v !== "string") {
    return { ok: false, error: "Nome deve ser texto." };
  }
  const trimmed = v.trim();
  if (trimmed.length < 1) {
    return { ok: false, error: "Nome deve ter 1–60 caracteres." };
  }
  if (trimmed.length > 60) {
    return { ok: false, error: "Nome deve ter 1–60 caracteres." };
  }
  return { ok: true, value: trimmed };
}

/**
 * Classifica o valor de `icon`. Aceita 4 formatos:
 *   - null / undefined / ""  → "null" (limpa)
 *   - "data:image/(svg|png);base64,..." → "dataUri" (decode + save downstream)
 *   - "/api/uploads/ingredients/..."    → "uploadedPath" (já-uploaded)
 *   - "prefix:name" (Iconify ID)        → "iconify"
 *
 * Resto: "invalid" com mensagem clara.
 *
 * Por que validar formato de Iconify ID superficialmente:
 * é renderizado por @iconify/react que faz fetch da API pública —
 * formato malformado gera 404 silencioso no client. Validar cedo
 * dá erro 400 com mensagem útil.
 */
export type IconValue =
  | { kind: "null" }
  | { kind: "iconify"; value: string }
  | { kind: "dataUri"; value: string }
  | { kind: "uploadedPath"; value: string };

export function parseIconValue(v: unknown): ParseResult<IconValue> {
  if (v === null || v === undefined) {
    return { ok: true, value: { kind: "null" } };
  }
  if (typeof v !== "string") {
    return { ok: false, error: "Ícone deve ser texto ou null." };
  }
  const trimmed = v.trim();
  if (trimmed === "") {
    return { ok: true, value: { kind: "null" } };
  }
  if (trimmed.startsWith("data:image/")) {
    return { ok: true, value: { kind: "dataUri", value: trimmed } };
  }
  if (trimmed.startsWith("/api/uploads/ingredients/")) {
    return { ok: true, value: { kind: "uploadedPath", value: trimmed } };
  }
  // Iconify: "prefix:name" — alfanum+hífen, ambos lados, total ≤ 80 chars
  if (/^[a-z0-9-]+:[a-z0-9-]+$/i.test(trimmed) && trimmed.length <= 80) {
    return { ok: true, value: { kind: "iconify", value: trimmed } };
  }
  return { ok: false, error: "Formato de ícone inválido." };
}
