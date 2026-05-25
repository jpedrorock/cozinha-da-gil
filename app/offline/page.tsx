"use client";

import Link from "next/link";
import { WifiOff } from "lucide-react";
import { BrandIcon } from "@/components/icons";

/**
 * Página servida pelo Service Worker quando o user tenta acessar uma
 * rota sem cache e SEM internet.
 *
 * Cenário real: wifi da barraca cai (router pendura), atendente toca
 * em algum link → SW intercepta, tenta network → falha → entrega aqui.
 *
 * Mensagem objetiva: "olha o wifi" + botão pra tentar de novo.
 */
export default function OfflinePage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-surface px-6 text-center">
      <div className="mb-6 opacity-90">
        <BrandIcon size={88} />
      </div>
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-danger-bg text-danger mb-4">
        <WifiOff size={28} strokeWidth={2.5} aria-hidden />
      </div>
      <h1 className="t-h1 mb-2">Sem conexão</h1>
      <p className="t-body text-ink-2 max-w-md mb-6">
        Verifique o wifi da barraca. O app volta sozinho quando o sinal
        voltar — não precisa fechar.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => window.location.reload()}
          className="btn btn-primary"
        >
          Tentar de novo
        </button>
        <Link href="/" className="btn btn-ghost">
          Voltar pro início
        </Link>
      </div>
    </div>
  );
}
