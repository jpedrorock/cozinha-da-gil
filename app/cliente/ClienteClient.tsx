"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, WifiOff } from "lucide-react";
import { useSSE } from "@/lib/use-sse";
import { BrandIcon, PastelIcon } from "@/components/icons";
import type { OrderView } from "@/lib/orders";

export function ClienteClient({ initialOrders }: { initialOrders: OrderView[] }) {
  const [orders, setOrders] = useState<OrderView[]>(initialOrders);
  const [clock, setClock] = useState<Date | null>(null);

  useEffect(() => {
    setClock(new Date());
    const t = setInterval(() => setClock(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const sseStatus = useSSE("/api/sse", {
    "order:created": (data) => {
      const order = data as OrderView;
      if (["PEDIDO_FEITO", "EM_PREPARO", "PRONTO"].includes(order.status)) {
        setOrders((prev) => [...prev.filter((o) => o.id !== order.id), order]);
      }
    },
    "order:updated": (data) => {
      const order = data as OrderView;
      setOrders((prev) => {
        const without = prev.filter((o) => o.id !== order.id);
        if (["PEDIDO_FEITO", "EM_PREPARO", "PRONTO"].includes(order.status)) {
          return [...without, order];
        }
        return without;
      });
    },
  });

  const prontos = orders.filter((o) => o.status === "PRONTO");
  const emPreparo = orders.filter(
    (o) => o.status === "PEDIDO_FEITO" || o.status === "EM_PREPARO",
  );

  return (
    <div className="min-h-dvh flex flex-col bg-surface">
      <header className="bg-surface-elevated border-b border-line">
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            {/* Voltar pro login — discreto pra não competir com a marca,
                mas presente pra Gil/atendente sair do painel quando precisar.
                Cliente comum nem nota; quem quer voltar acha rapidinho. */}
            <Link
              href="/"
              className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-surface text-ink-3 hover:bg-surface-sunken hover:text-ink transition-colors"
              aria-label="Voltar pro login"
              title="Voltar pro login"
            >
              <ArrowLeft size={20} strokeWidth={2.25} />
            </Link>
            <BrandIcon size={48} />
            <div className="flex flex-col leading-tight">
              <span className="t-label tracking-[0.1em]">Cozinha da</span>
              <span className="text-2xl md:text-3xl font-bold -tracking-[0.01em]">Gil</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {sseStatus !== "open" && (
              <span
                role="status"
                aria-live="polite"
                className="inline-flex items-center gap-1.5 bg-danger text-white text-sm md:text-base font-bold uppercase tracking-[0.06em] px-3 py-1.5 rounded-full"
              >
                <WifiOff size={16} strokeWidth={2.5} aria-hidden />
                <span>Reconectando…</span>
              </span>
            )}
            <div className="font-mono text-2xl md:text-3xl font-bold t-num text-ink-2">
              {clock ? clock.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 md:px-10 py-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Ordem segue o fluxo temporal do pedido:
            esquerda = "Em preparo" (entrou agora) → direita = "Pronto" (sair).
            Cliente acompanha o nome dele "andando" da esquerda pra direita. */}
        <Column
          title="Em preparo"
          empty="Sem pedidos no momento"
          accent="bg-status-preparing"
          textAccent="text-status-preparing-ink"
          orders={emPreparo}
        />
        <Column
          title="Pronto pra retirar"
          empty="Aguardando..."
          accent="bg-status-ready"
          textAccent="text-status-ready-ink"
          orders={prontos}
          pulse
          announce
        />
      </main>

      <footer className="border-t border-line py-3 text-center t-body-sm">
        Quando seu nome aparecer em <span className="text-status-ready-ink font-bold">PRONTO</span>, é só vir buscar.
      </footer>
    </div>
  );
}

function Column({
  title,
  empty,
  accent,
  textAccent,
  orders,
  pulse,
  announce,
}: {
  title: string;
  empty: string;
  accent: string;
  textAccent: string;
  orders: OrderView[];
  pulse?: boolean;
  /** Anuncia adições pra screen reader (cliente cego no painel público).
   *  Só pra coluna PRONTO — sem isso, cliente com TalkBack/VoiceOver
   *  nunca sabe quando seu pedido apareceu. */
  announce?: boolean;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className={`rounded-lg ${accent} px-4 py-2.5`}>
        <h2 className="text-white text-xl md:text-2xl font-bold uppercase tracking-[0.05em] text-center">
          {title}
        </h2>
      </div>

      {orders.length === 0 ? (
        <div className="card p-10 md:p-16 text-center">
          <div className="flex justify-center mb-3 opacity-30 animate-empty-breathe">
            <PastelIcon size={96} className="md:w-32 md:h-32" />
          </div>
          <div className="text-2xl md:text-4xl font-bold italic text-ink-2">{empty}</div>
        </div>
      ) : (
        <ul
          className="flex flex-col gap-3"
          {...(announce
            ? { role: "status", "aria-live": "polite", "aria-relevant": "additions" }
            : {})}
        >
          {orders.map((o) => (
            <li
              key={o.id}
              className={`card-lg p-5 md:p-6 animate-tv-card-in ${
                pulse ? "ring-2 ring-status-ready ring-offset-2 ring-offset-surface animate-flash-ring-once" : ""
              }`}
            >
              <div className={`font-mono text-sm md:text-base t-num ${textAccent}`}>
                #{String(o.id).padStart(3, "0")}
              </div>
              {/* Nome em 2 linhas (line-clamp-2) com break-words pra
                  evitar truncamento silencioso de "Marina Aparecida".
                  text-balance distribui o quebra equilibrado.
                  Escala em xl/2xl pra TV 4K (cliente lê de 4-5m de distância
                  no painel da barraca — em md tava muito pequeno em 65"). */}
              <div
                className="text-2xl md:text-5xl xl:text-7xl 2xl:text-8xl font-bold -tracking-[0.015em] leading-[0.95] mt-1 break-words text-balance line-clamp-2 min-h-[1.1em]"
                style={{ overflowWrap: "anywhere" }}
              >
                {o.clientName}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
