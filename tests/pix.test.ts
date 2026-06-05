import { describe, expect, it } from "vitest";
import { buildPixPayload, crc16ccitt, sanitizeAscii } from "@/lib/pix";

describe("crc16ccitt (CRC16-CCITT-FALSE)", () => {
  it("vetor padrão '123456789' = 0x29B1", () => {
    expect(crc16ccitt("123456789").toString(16).toUpperCase()).toBe("29B1");
  });
  it("string vazia = 0xFFFF (valor inicial)", () => {
    expect(crc16ccitt("").toString(16).toUpperCase()).toBe("FFFF");
  });
});

describe("sanitizeAscii", () => {
  it("tira acento, vira uppercase, trunca", () => {
    expect(sanitizeAscii("Gil Pastéis", 25)).toBe("GIL PASTEIS");
    expect(sanitizeAscii("São Paulo", 15)).toBe("SAO PAULO");
  });
  it("descarta caractere não-ASCII", () => {
    expect(sanitizeAscii("Loja 🥟 Da Gil", 25)).toBe("LOJA  DA GIL");
  });
  it("respeita maxLen", () => {
    expect(sanitizeAscii("NOME MUITO LONGO PRA CABER NO QR", 10)).toBe("NOME MUITO");
  });
});

describe("buildPixPayload", () => {
  function decodeTLVs(s: string): Map<string, string> {
    const m = new Map<string, string>();
    let i = 0;
    while (i < s.length) {
      const id = s.slice(i, i + 2);
      const len = parseInt(s.slice(i + 2, i + 4), 10);
      const val = s.slice(i + 4, i + 4 + len);
      m.set(id, val);
      i += 4 + len;
    }
    return m;
  }

  const baseInput = {
    pixKey: "joao@evapro.cloud",
    merchantName: "Gil Pasteis",
    merchantCity: "Sao Paulo",
    amountCents: 1500,
    txid: "PDG42",
  };

  it("começa com Payload Format Indicator (0002)01 + Static (0102)11", () => {
    const out = buildPixPayload(baseInput);
    expect(out.startsWith("000201010211")).toBe(true);
  });

  it("termina com CRC16 hex válido (4 chars maiúsculos)", () => {
    const out = buildPixPayload(baseInput);
    expect(out.slice(-4)).toMatch(/^[0-9A-F]{4}$/);
    // E o CRC bate com o resto do payload
    const body = out.slice(0, -4);
    const expected = crc16ccitt(body).toString(16).toUpperCase().padStart(4, "0");
    expect(out.slice(-4)).toBe(expected);
  });

  it("contém todos os campos obrigatórios do EMV", () => {
    const out = buildPixPayload(baseInput);
    const m = decodeTLVs(out.slice(0, -8)); // ignora "6304XXXX" final
    expect(m.get("00")).toBe("01");
    expect(m.get("01")).toBe("11");
    expect(m.get("52")).toBe("0000");
    expect(m.get("53")).toBe("986");
    expect(m.get("58")).toBe("BR");
    expect(m.get("59")).toBe("GIL PASTEIS");
    expect(m.get("60")).toBe("SAO PAULO");
    // Campo 26 (merchant account) é TLV aninhado
    const mAccount = m.get("26");
    expect(mAccount).toBeDefined();
    expect(mAccount).toContain("br.gov.bcb.pix");
    expect(mAccount).toContain("joao@evapro.cloud");
  });

  it("inclui valor (campo 54) com 2 casas decimais quando amountCents > 0", () => {
    const out = buildPixPayload(baseInput);
    const m = decodeTLVs(out.slice(0, -8));
    expect(m.get("54")).toBe("15.00");
  });

  it("OMITE campo 54 quando amountCents é 0 ou undefined (cliente digita)", () => {
    const sem = buildPixPayload({ ...baseInput, amountCents: 0 });
    const mSem = decodeTLVs(sem.slice(0, -8));
    expect(mSem.has("54")).toBe(false);

    const semUndef = buildPixPayload({ ...baseInput, amountCents: undefined });
    expect(decodeTLVs(semUndef.slice(0, -8)).has("54")).toBe(false);
  });

  it("txid 'PDG42' aparece no campo 62 (sub-05)", () => {
    const out = buildPixPayload(baseInput);
    const m = decodeTLVs(out.slice(0, -8));
    expect(m.get("62")).toBe("0505PDG42");
  });

  it("sem txid → '***' (estático)", () => {
    const out = buildPixPayload({ ...baseInput, txid: undefined });
    const m = decodeTLVs(out.slice(0, -8));
    expect(m.get("62")).toBe("0503***");
  });

  it("fallback de nome/cidade quando vazios (EMV não aceita campo vazio)", () => {
    const out = buildPixPayload({ ...baseInput, merchantName: "", merchantCity: "" });
    const m = decodeTLVs(out.slice(0, -8));
    expect(m.get("59")).toBe("RECEBEDOR");
    expect(m.get("60")).toBe("BRASIL");
  });
});
