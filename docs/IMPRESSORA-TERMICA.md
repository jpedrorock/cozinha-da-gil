# Impressora térmica — plano

> Ainda não implementado (espera hardware). Este doc descreve as opções e como integrar quando você comprar a impressora.

## Por que não usar `window.print()` direto?

Hoje o botão "Imprimir" no comprovante usa `window.print()`, que abre o dialog nativo do OS. Funciona, mas:
- Margem do papel térmico (~58mm/80mm) precisa ser configurada no driver
- Cada device tem que ser pareado individualmente
- Não imprime de uma rota do servidor — só do browser local

Pra evento real com impressora térmica, vale ter uma rota `/api/print/:orderId` que mande direto pra impressora via rede ou USB.

## Opções de hardware

| Tipo | Preço típico | Como conecta | Esforço de integração |
|---|---|---|---|
| **USB direta** (Epson, Bematech) | R$300–600 | USB no laptop servidor | Médio — driver no OS + biblioteca node-thermal-printer |
| **Wifi ethernet** (Epson TM-T20, MP-4200 TH) | R$700–1500 | IP fixo na rede local | Baixo — ESC/POS via TCP socket |
| **Bluetooth térmica portátil** (Munbyn, RoadStar) | R$200–400 | Bluetooth no tablet | Alto — Web Bluetooth API limitada, melhor usar app nativo |

**Recomendação:** wifi com IP fixo. Conecta direto pelo Node sem driver do OS, qualquer device da rede pode mandar.

## Esquema sugerido (wifi/ethernet)

### 1. Dependência

```bash
npm install node-thermal-printer
```

### 2. Configuração `.env`

```
PRINTER_TYPE="epson"           # ou "star"
PRINTER_INTERFACE="tcp://192.168.1.100"
PRINTER_WIDTH="48"             # caracteres por linha (48 = 80mm, 32 = 58mm)
```

### 3. Helper `lib/printer.ts`

```ts
import { ThermalPrinter, PrinterTypes } from "node-thermal-printer";
import type { OrderView } from "@/lib/orders";
import { formatBRL, SIZE_LABEL } from "@/lib/pricing";

export async function printOrder(order: OrderView): Promise<{ ok: boolean; error?: string }> {
  const printer = new ThermalPrinter({
    type: process.env.PRINTER_TYPE === "star" ? PrinterTypes.STAR : PrinterTypes.EPSON,
    interface: process.env.PRINTER_INTERFACE ?? "tcp://192.168.1.100",
    width: Number(process.env.PRINTER_WIDTH ?? 48),
  });

  const connected = await printer.isPrinterConnected();
  if (!connected) return { ok: false, error: "Impressora não responde." };

  printer.alignCenter();
  printer.bold(true);
  printer.println("COZINHA DA GIL");
  printer.bold(false);
  printer.println(`Pedido #${String(order.id).padStart(3, "0")}`);
  printer.println(new Date(order.createdAt).toLocaleString("pt-BR"));
  printer.drawLine();
  printer.alignLeft();
  printer.println(`Cliente: ${order.clientName}`);
  if (order.clientPhone) printer.println(`Fone: ${order.clientPhone}`);
  printer.drawLine();

  for (const item of order.items) {
    const productName = item.productName || (item.kind === "doce" ? "Pastel Doce" : "Pastel Salgado");
    const sizeLabel = item.size && SIZE_LABEL[item.size as keyof typeof SIZE_LABEL]
      ? SIZE_LABEL[item.size as keyof typeof SIZE_LABEL]
      : item.size;
    const qty = item.quantity > 1 ? `${item.quantity}x ` : "";
    printer.bold(true);
    printer.println(`${qty}${productName}${sizeLabel ? ` (${sizeLabel})` : ""}`);
    printer.bold(false);
    if (item.flavor) printer.println(`  ${item.flavor}`);
    else if (item.toppings.length > 0) printer.println(`  ${item.toppings.join(", ")}`);
    if (item.sauces.length > 0) printer.println(`  Molhos: ${item.sauces.join(", ")}`);
    if (item.notes) printer.println(`  "${item.notes}"`);
    printer.leftRight("", formatBRL(item.unitPrice * item.quantity));
  }

  printer.drawLine();
  if (order.discountCents && order.discountCents > 0) {
    printer.leftRight("Subtotal", formatBRL(order.totalCents));
    printer.leftRight(`Desc. ${order.promotionName ?? ""}`, `-${formatBRL(order.discountCents)}`);
  }
  printer.alignRight();
  printer.bold(true);
  printer.println(`TOTAL ${formatBRL(order.finalCents)}`);
  printer.bold(false);
  printer.alignCenter();
  printer.println("Obrigado pela visita!");
  printer.cut();

  try {
    await printer.execute();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
```

### 4. Rota `app/api/print/[id]/route.ts`

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeOrder } from "@/lib/orders";
import { printOrder } from "@/lib/printer";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(["atendente", "cozinha", "admin"]);
  if (auth instanceof NextResponse) return auth;

  const id = Number.parseInt(params.id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });

  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

  const result = await printOrder(serializeOrder(order));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

### 5. UI — botão "Imprimir cozinha"

No `app/atendente/AtendenteClient.tsx`, depois do submit:

```ts
await fetch(`/api/print/${order.id}`, { method: "POST" });
```

Fire-and-forget (não bloquear UX se impressora travar).

Botão manual no `/comprovante/[id]/ComprovanteClient.tsx`:

```tsx
<button onClick={() => fetch(`/api/print/${order.id}`, { method: "POST" })}>
  Imprimir cozinha
</button>
```

## Considerações operacionais

- **Backup do papel:** ter rolo reserva, troca em 30s, não pánico
- **Calor/quebra:** impressora térmica é frágil, evitar quedas e calor extremo
- **Cabo de força:** usar nobreak (mesmo o mais barato R$300) — evento sem energia = evento perdido
- **Auto-print no cozinha:** quando pedido vira `PEDIDO_FEITO`, dispara print automático. Cozinheira pega o papel sem clicar nada.
- **Fila de print offline:** se impressora cai, manter ordem em memória pra retry quando voltar. Complexidade extra — começar sem.

## Plano de teste quando comprar

1. Conectar impressora no roteador, anotar IP (recomendado IP fixo via DHCP reservation)
2. `ping <ip>` confirma rede
3. Instalar `node-thermal-printer`, criar `lib/printer.ts` conforme acima
4. Criar `app/api/print/[id]/route.ts`
5. Disparar manualmente: `curl -X POST -b cookies http://localhost:3000/api/print/123`
6. Ajustar layout, font, cut spacing
7. Adicionar botão na UI (1 dia)
8. Auto-print no `order:created` (mais 0.5 dia)

**Estimativa total:** 1.5 dias depois que o hardware chegar.
