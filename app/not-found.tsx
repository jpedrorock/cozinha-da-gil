"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { BrandIcon } from "@/components/icons";

/**
 * 404 — URL digitada ou link quebrado.
 *
 * No app interno isso é raro (todas as rotas vêm de links no menu),
 * mas se acontecer (ex: comprovante de ID que sumiu), explica claro.
 */
export default function NotFound() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-surface px-6 text-center">
      <div className="mb-6 opacity-90">
        <BrandIcon size={88} />
      </div>
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-surface-sunken text-ink-2 mb-4">
        <Search size={28} strokeWidth={2.5} aria-hidden />
      </div>
      <h1 className="t-h1 mb-2">Página não encontrada</h1>
      <p className="t-body text-ink-2 max-w-md mb-6">
        Esse endereço não existe ou o pedido foi removido.
      </p>
      <Link href="/" className="btn btn-primary">
        Voltar pro início
      </Link>
    </div>
  );
}
