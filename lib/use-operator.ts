"use client";
import { useEffect, useState } from "react";

export type Role = "atendente" | "cozinha" | "admin";
export type Operator = { id?: string; role: Role; name: string };

const KEY = "pdg:operator";
const STORAGE_KIND_KEY = "pdg:operator-persistent";

function getStorage(persistent: boolean): Storage | null {
  if (typeof window === "undefined") return null;
  return persistent ? window.localStorage : window.sessionStorage;
}

function readFrom(storage: Storage | null): Operator | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Operator>;
    if (
      (parsed.role === "atendente" || parsed.role === "cozinha" || parsed.role === "admin") &&
      typeof parsed.name === "string" &&
      parsed.name.trim().length > 0
    ) {
      return { id: parsed.id, role: parsed.role, name: parsed.name };
    }
  } catch {}
  return null;
}

export function getStoredOperator(): Operator | null {
  if (typeof window === "undefined") return null;
  // sessionStorage tem prioridade (sessão atual). Se não, tenta localStorage (persistent).
  return readFrom(window.sessionStorage) ?? readFrom(window.localStorage);
}

export function setStoredOperator(op: Operator, persistent: boolean) {
  if (typeof window === "undefined") return;
  // Limpa ambos os storages antes de salvar
  window.sessionStorage.removeItem(KEY);
  window.localStorage.removeItem(KEY);
  const storage = getStorage(persistent);
  if (!storage) return;
  storage.setItem(KEY, JSON.stringify(op));
  window.localStorage.setItem(STORAGE_KIND_KEY, persistent ? "persistent" : "session");
}

export function clearStoredOperator() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(KEY);
  window.localStorage.removeItem(KEY);
  window.localStorage.removeItem(STORAGE_KIND_KEY);
}

export function useOperator() {
  const [operator, setOperator] = useState<Operator | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setOperator(getStoredOperator());
    setReady(true);
  }, []);

  return {
    operator,
    ready,
    save(op: Operator, persistent: boolean) {
      setStoredOperator(op, persistent);
      setOperator(op);
    },
    clear() {
      clearStoredOperator();
      setOperator(null);
      // Limpa também o cookie de sessão no servidor
      fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    },
  };
}
