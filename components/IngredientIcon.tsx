"use client";

import { Icon } from "@iconify/react";

/**
 * Renderer único pra `Ingredient.icon`. Detecta o formato:
 *
 *   - null / undefined          → não renderiza nada
 *   - "/api/uploads/..."        → <img src> (SVG/PNG personalizado)
 *   - "prefix:name" (Iconify)   → <Icon icon> via @iconify/react
 *
 * Encapsula a lógica num único componente pra não duplicar `if`
 * em toda tela que mostra ícone de ingrediente.
 */
export function IngredientIcon({
  icon,
  size = 22,
  className,
  alt = "",
}: {
  icon: string | null | undefined;
  size?: number;
  className?: string;
  alt?: string;
}) {
  if (!icon) return null;

  // Path absoluto → arquivo no volume servido por /api/uploads/...
  // next/image não otimiza SVG estático servido por API route customizada
  // e força width/height inferiveis; <img> direto resolve bem pra ícones
  // de 22-28px. Cache header (immutable) já tá no GET route.
  if (icon.startsWith("/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={icon}
        alt={alt}
        width={size}
        height={size}
        className={className}
        // SVG inline scaling — não estica nem trunca
        style={{ objectFit: "contain" }}
      />
    );
  }

  // Iconify ID (formato "prefix:name")
  return <Icon icon={icon} width={size} height={size} className={className} />;
}
