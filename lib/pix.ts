/**
 * Gera o BR Code do PIX (formato EMV-MPM padrão BACEN) — Fase 7 #1.
 *
 * Pure: sem deps server-only. Testável sem Prisma.
 * Saída: string "copia e cola" que vai virar QR no comprovante.
 *
 * Cada campo segue TLV: <id 2 digits><len 2 digits><value>. Campo 26
 * (conta do recebedor) e 62 (dados adicionais) são TLV aninhados.
 * Termina com CRC16-CCITT-FALSE de tudo + "6304" (campo do CRC).
 */

export type PixPayloadInput = {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  /** Em centavos. Omitido/0 → QR sem valor (cliente digita na hora). */
  amountCents?: number;
  /** Identificador da transação. Sem informar → "***" (estático genérico). */
  txid?: string;
};

/** CRC16-CCITT-FALSE: poli 0x1021, init 0xFFFF, sem reflect, sem XorOut. */
export function crc16ccitt(s: string): number {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

/** TLV: id (2) + length (2 zero-pad) + value. */
function tlv(id: string, value: string): string {
  const len = String(value.length).padStart(2, "0");
  return id + len + value;
}

/**
 * Normaliza pra ASCII básico maiúsculo. EMV-MPM aceita só ASCII —
 * acento quebra o reader. Mantém letras/números/espaço/pontuação curta.
 */
export function sanitizeAscii(s: string, maxLen: number): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9 .,'-]/gi, "")
    .toUpperCase()
    .trim()
    .slice(0, maxLen);
}

/** Sanitiza o txid pro EMV — só alfanumérico, max 25. */
function sanitizeTxid(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 25);
}

export function buildPixPayload(input: PixPayloadInput): string {
  const name = sanitizeAscii(input.merchantName, 25) || "RECEBEDOR";
  const city = sanitizeAscii(input.merchantCity, 15) || "BRASIL";
  const key = input.pixKey.trim();

  // Campo 26 — Merchant Account Info (nested)
  const merchantAccount = tlv("00", "br.gov.bcb.pix") + tlv("01", key);

  // Campo 62 — Additional Data (txid — obrigatório, "***" = estático)
  const txidValue = input.txid && sanitizeTxid(input.txid) !== ""
    ? sanitizeTxid(input.txid)
    : "***";
  const additionalData = tlv("05", txidValue);

  // Amount (opcional). 0 → omite (cliente digita).
  const amountField =
    input.amountCents && input.amountCents > 0
      ? tlv("54", (input.amountCents / 100).toFixed(2))
      : "";

  // Monta tudo na ordem EMV
  let payload =
    tlv("00", "01") + // Payload Format Indicator
    tlv("01", "11") + // Point of Initiation (11 = estático, reusável)
    tlv("26", merchantAccount) + // Merchant Account
    tlv("52", "0000") + // Merchant Category Code
    tlv("53", "986") + // Currency (BRL)
    amountField +
    tlv("58", "BR") + // Country
    tlv("59", name) + // Merchant Name
    tlv("60", city) + // Merchant City
    tlv("62", additionalData);

  // CRC16 do payload + "6304" (id 63 + len 04)
  payload += "6304";
  const crcHex = crc16ccitt(payload).toString(16).toUpperCase().padStart(4, "0");

  return payload + crcHex;
}
