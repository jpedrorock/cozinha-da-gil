// Helpers de display + tipos legacy do pastel.
// Pricing real agora vem do DB via lib/products.ts (computeUnitPrice).
// Esse arquivo é só pra:
// - SIZE_LABEL (fallback de display quando produto não tem sizeName preenchido)
// - SAUCE_PRICE_CENTS (preço único de molho, usado no UI do atendente)
// - MAX_TOPPINGS_PEQUENO (regra UX do pastel pequeno)
// - formatBRL (helper de formatação)
// - Kind/Size types (back-compat com OrderItem.kind/.size legacy)

export type Kind = "salgado" | "doce";
export type SalgadoSize = "pequeno" | "grande";
export type DoceSize = "normal" | "mini";
export type Size = SalgadoSize | DoceSize;

/**
 * Preço único de molho extra. Single source of truth — também referenciado
 * em lib/products.ts (SAUCE_PRICE_CENTS) e usado no display do atendente.
 */
export const PRICE = {
  sauce: 150,
} as const;

export const SIZE_LABEL: Record<Size, string> = {
  pequeno: "2 ingredientes",
  grande: "Monte o seu",
  normal: "Normal",
  mini: "Mini Pack",
};

export const MAX_TOPPINGS_PEQUENO = 2;

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
