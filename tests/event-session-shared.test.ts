import { afterEach, describe, expect, it, vi } from "vitest";
import { isStaleEventSession } from "@/lib/event-session-shared";

// Caixa órfão: Gil esqueceu de fechar ontem, abre hoje e pedidos novos
// agregam no caixa errado. `isStaleEventSession` decide o banner de alerta.
describe("isStaleEventSession", () => {
  afterEach(() => vi.useRealTimers());

  it("sem caixa aberto (null/undefined/'') → false", () => {
    expect(isStaleEventSession(null)).toBe(false);
    expect(isStaleEventSession(undefined)).toBe(false);
    expect(isStaleEventSession("")).toBe(false);
  });

  it("data inválida → false (não quebra o banner)", () => {
    expect(isStaleEventSession("não é data")).toBe(false);
    expect(isStaleEventSession("2026-13-99")).toBe(false);
  });

  it("aberto agora → false", () => {
    vi.useFakeTimers();
    const now = new Date("2026-05-28T12:00:00Z");
    vi.setSystemTime(now);
    expect(isStaleEventSession(now)).toBe(false);
  });

  it("aberto há 11h → false (abaixo do limite de 12h)", () => {
    vi.useFakeTimers();
    const now = new Date("2026-05-28T12:00:00Z");
    vi.setSystemTime(now);
    const opened = new Date(now.getTime() - 11 * 3600 * 1000);
    expect(isStaleEventSession(opened)).toBe(false);
  });

  it("aberto há exatamente 12h → true (limite é >=)", () => {
    vi.useFakeTimers();
    const now = new Date("2026-05-28T12:00:00Z");
    vi.setSystemTime(now);
    const opened = new Date(now.getTime() - 12 * 3600 * 1000);
    expect(isStaleEventSession(opened)).toBe(true);
  });

  it("aberto há 13h → true (órfão)", () => {
    vi.useFakeTimers();
    const now = new Date("2026-05-28T12:00:00Z");
    vi.setSystemTime(now);
    const opened = new Date(now.getTime() - 13 * 3600 * 1000);
    expect(isStaleEventSession(opened)).toBe(true);
  });

  it("aceita string ISO (status serializado do client)", () => {
    vi.useFakeTimers();
    const now = new Date("2026-05-28T12:00:00Z");
    vi.setSystemTime(now);
    const openedIso = new Date(now.getTime() - 13 * 3600 * 1000).toISOString();
    expect(isStaleEventSession(openedIso)).toBe(true);
  });

  it("respeita staleHours customizado", () => {
    vi.useFakeTimers();
    const now = new Date("2026-05-28T12:00:00Z");
    vi.setSystemTime(now);
    const opened = new Date(now.getTime() - 2 * 3600 * 1000); // 2h atrás
    expect(isStaleEventSession(opened, 1)).toBe(true); // limite 1h → órfão
    expect(isStaleEventSession(opened, 3)).toBe(false); // limite 3h → ok
  });

  it("data no futuro → false (idade negativa, não é órfão)", () => {
    vi.useFakeTimers();
    const now = new Date("2026-05-28T12:00:00Z");
    vi.setSystemTime(now);
    const future = new Date(now.getTime() + 3600 * 1000);
    expect(isStaleEventSession(future)).toBe(false);
  });
});
