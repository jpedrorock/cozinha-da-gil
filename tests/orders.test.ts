import { describe, expect, it } from "vitest";
import {
  asKind,
  asSize,
  formatPhoneDisplay,
  normalizePhone,
  parseExtras,
} from "@/lib/orders";

describe("parseExtras", () => {
  it("parses valid JSON array of strings", () => {
    expect(parseExtras('["Frango","Bacon"]')).toEqual(["Frango", "Bacon"]);
  });

  it("filters non-string elements", () => {
    expect(parseExtras('["Frango",123,null]')).toEqual(["Frango"]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseExtras("not json")).toEqual([]);
    expect(parseExtras("")).toEqual([]);
  });

  it("returns empty array for non-array JSON", () => {
    expect(parseExtras('{"foo":"bar"}')).toEqual([]);
    expect(parseExtras("123")).toEqual([]);
  });
});

describe("normalizePhone", () => {
  it("normalizes 11-digit mobile to +55XXXXXXXXXXX", () => {
    expect(normalizePhone("(11) 99999-9999")).toBe("+5511999999999");
    expect(normalizePhone("11999999999")).toBe("+5511999999999");
  });

  it("normalizes 10-digit landline to +55XXXXXXXXXX", () => {
    expect(normalizePhone("(11) 9999-9999")).toBe("+551199999999");
  });

  it("accepts already-prefixed +55 numbers", () => {
    expect(normalizePhone("+5511999999999")).toBe("+5511999999999");
    expect(normalizePhone("5511999999999")).toBe("+5511999999999");
  });

  it("returns null for too-short input", () => {
    expect(normalizePhone("999")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });

  it("returns null for 12-digit without 55 prefix", () => {
    expect(normalizePhone("111111111111")).toBeNull();
  });

  it("returns null for non-string", () => {
    expect(normalizePhone(123 as unknown as string)).toBeNull();
  });
});

describe("formatPhoneDisplay", () => {
  it("formats 11-digit number as (XX) XXXXX-XXXX", () => {
    expect(formatPhoneDisplay("+5511999999999")).toBe("(11) 99999-9999");
  });

  it("formats 10-digit number as (XX) XXXX-XXXX", () => {
    expect(formatPhoneDisplay("+551199999999")).toBe("(11) 9999-9999");
  });

  it("returns empty string for null/undefined", () => {
    expect(formatPhoneDisplay(null)).toBe("");
    expect(formatPhoneDisplay(undefined)).toBe("");
    expect(formatPhoneDisplay("")).toBe("");
  });

  it("returns input unchanged when format unexpected", () => {
    expect(formatPhoneDisplay("abc")).toBe("abc");
  });
});

describe("asKind", () => {
  it("accepts salgado and doce", () => {
    expect(asKind("salgado")).toBe("salgado");
    expect(asKind("doce")).toBe("doce");
  });
  it("rejects everything else", () => {
    expect(asKind("bebida")).toBeNull();
    expect(asKind("")).toBeNull();
    expect(asKind(null)).toBeNull();
    expect(asKind(42)).toBeNull();
  });
});

describe("asSize", () => {
  it("accepts pequeno/grande/normal/mini", () => {
    expect(asSize("pequeno")).toBe("pequeno");
    expect(asSize("grande")).toBe("grande");
    expect(asSize("normal")).toBe("normal");
    expect(asSize("mini")).toBe("mini");
  });
  it("rejects everything else", () => {
    expect(asSize("xl")).toBeNull();
    expect(asSize("")).toBeNull();
    expect(asSize(null)).toBeNull();
  });
});
