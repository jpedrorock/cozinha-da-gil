import type { Product, ProductSize } from "@prisma/client";

const SAUCE_PRICE_CENTS = 150;

export type ProductView = Omit<Product, "createdAt" | "updatedAt"> & {
  sizes: Pick<ProductSize, "id" | "name" | "description" | "priceCents" | "position">[];
};

export function serializeProduct(
  product: Product & { sizes: ProductSize[] },
): ProductView {
  const { createdAt: _c, updatedAt: _u, ...rest } = product;
  return {
    ...rest,
    sizes: product.sizes
      .sort((a, b) => a.position - b.position)
      .map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        priceCents: s.priceCents,
        position: s.position,
      })),
  };
}

/**
 * Calcula preço unitário a partir do produto + size escolhido + qtd de molhos.
 * Substitui a função antiga `unitPriceCents(kind, size, sauceCount)` que
 * lia constantes hardcoded em pricing.ts.
 *
 * Regras:
 * - pricingMode='fixed' → basePriceCents do produto
 * - pricingMode='by_size' → priceCents do ProductSize escolhido
 * - Cada molho adiciona SAUCE_PRICE_CENTS (150) ao total
 */
export function computeUnitPrice(
  product: Product,
  productSize: ProductSize | null,
  sauceCount: number,
): number {
  let base = 0;
  if (product.pricingMode === "fixed") {
    base = product.basePriceCents ?? 0;
  } else {
    base = productSize?.priceCents ?? 0;
  }
  return base + sauceCount * SAUCE_PRICE_CENTS;
}

/**
 * Valida que a seleção de ingredientes respeita min/max do produto.
 * Retorna mensagem de erro ou null se OK.
 */
export function validateIngredientSelection(
  product: Product,
  ingredients: string[],
): string | null {
  if (!product.allowsIngredients) {
    if (ingredients.length > 0) {
      return `${product.name} não aceita ingredientes.`;
    }
    return null;
  }
  if (product.minIngredients !== null && ingredients.length < product.minIngredients) {
    return `${product.name} precisa de pelo menos ${product.minIngredients} ingrediente${product.minIngredients === 1 ? "" : "s"}.`;
  }
  if (product.maxIngredients !== null && ingredients.length > product.maxIngredients) {
    return `${product.name} aceita no máximo ${product.maxIngredients} ingrediente${product.maxIngredients === 1 ? "" : "s"}.`;
  }
  return null;
}

/**
 * Mapeia type → kind antigo pro back-compat com OrderItem.kind.
 * No futuro (quando legacy fields forem removidos) isso some.
 */
export function productTypeToLegacyKind(type: string): string {
  return type; // mesma string — salgado/doce/bebida/macarrao/combo
}

/**
 * "Express product" = não precisa configurar nada. Bebidas (Coca, Suco, Água)
 * são o caso clássico: preço fixo, sem ingredientes, sem molhos extras, sem
 * variação de tamanho. Atendente clica e adiciona direto.
 *
 * UX: esses produtos aparecem num carrossel "Adicionar rápido" no topo do
 * passo Produto. 1 toque = 1 item no cart. Sem entrar em configure.
 */
export function isExpressProduct(p: Pick<Product, "pricingMode" | "allowsIngredients" | "allowsSauces"> & { sizes?: { id: string }[] }): boolean {
  if (p.pricingMode !== "fixed") return false;
  if (p.allowsIngredients) return false;
  if (p.allowsSauces) return false;
  // Tem sizes diferentes — força escolha de tamanho
  if (p.sizes && p.sizes.length > 0) return false;
  return true;
}
