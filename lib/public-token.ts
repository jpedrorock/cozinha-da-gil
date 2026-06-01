import { randomBytes } from "node:crypto";

/**
 * Token aleatório pro link público de acompanhamento de pedido.
 *
 * 10 chars base62 (0-9, a-z, A-Z) = log2(62^10) ≈ 59.5 bits de entropia.
 * Pra contexto de barraca de pastel (uns 100 pedidos por evento), prob
 * de colisão é desprezível (aniversário ~1 em 10^11 com 100 pedidos).
 * O `@unique` no schema garante hard-fail se colidir mesmo assim — o
 * código que chama deve retry, mas na prática nunca vai entrar.
 *
 * Por que NÃO usar cuid()/uuid(): URLs ficariam muito longas pra caber
 * confortavelmente em mensagem WhatsApp ("Acompanhe: https://.../p/clx..."
 * vs "Acompanhe: https://.../p/abc7x9k2"). Curto e legível ganha aqui.
 */
export function generatePublicToken(): string {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  // Pega bytes extras pra evitar bias modular (256 % 62 != 0).
  // 16 bytes >> 10 chars, sobra de sobra.
  const bytes = randomBytes(16);
  let out = "";
  for (let i = 0; i < 16 && out.length < 10; i++) {
    const b = bytes[i];
    // Rejection sampling: ignora bytes >= 248 (último múltiplo de 62 ≤ 255).
    // 248/256 ≈ 96.8% de aceitação, então 16 bytes dão >10 chars na prática.
    if (b < 248) out += alphabet[b % 62];
  }
  if (out.length < 10) {
    // Fallback extremamente improvável: refaz com mais bytes.
    return generatePublicToken();
  }
  return out;
}

/** Valida formato sem fazer query no DB. Cheap pra rejeitar URLs ruins cedo. */
export function isValidPublicTokenFormat(token: string): boolean {
  return /^[0-9a-zA-Z]{10}$/.test(token);
}
