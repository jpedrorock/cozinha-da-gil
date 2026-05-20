# Background Sync no Service Worker — decisão

> **Status: NÃO IMPLEMENTAR (por enquanto).**
> Este doc registra a decisão, o tradeoff, e como reverter caso o cenário mude.

## O que seria

Background Sync API permite o Service Worker **enfileirar requests** que falharam por falta de rede e **reenviar** quando a conexão volta. Workbox tem plugin pronto (`BackgroundSyncPlugin`).

No nosso contexto: se o atendente confirmar pedido sem wifi, o SW guarda o `POST /api/orders` na queue local; quando wifi voltar, retransmite automaticamente. Cliente "vê" sucesso e segue trabalhando.

## Por que NÃO implementar agora

### 1. Risco de pedidos duplicados

Cenário típico:
- Atendente clica "Confirmar" → wifi cai meio-segundo depois
- SW enfileira o request
- Atendente acha que falhou e clica de novo → outro request enfileirado
- Wifi volta → **2 pedidos idênticos** entram no banco

Pra evitar isso, precisaríamos de:
- **Idempotency key** no POST (cliente gera UUID, servidor rejeita duplicatas)
- UI que mostra estado "enfileirado offline" claramente
- Conflict resolution se a primeira tentativa tiver chegado e a segunda também enfileirar

Isso é trabalho real (1–2 dias) e introduz superfície de bug.

### 2. Confusão de timestamps

`createdAt` é gravado no servidor no momento que o request chega. Se enfileirar 5min e retransmitir, o `createdAt` é o do retry, não do clique original. Isso bagunça:
- Histórico do pedido ("foi feito 5min antes do que mostra")
- Ordenação na cozinha (pode aparecer fora de ordem)
- Reports por hora do dia

Solução: cliente envia `clientCreatedAt` e servidor respeita. Mais um campo, mais um caminho de dado.

### 3. Estado mental confuso pro operador

Atendente clica → tela fica em loading → "Pedido enviado" → ... mas pedido ainda está na queue offline, cozinha não vê. Atendente já chamou o cliente: "Próximo!"

Sem feedback claro do estado da queue, o operador acha que o pedido foi cozinha quando não foi. Mais erro humano que ganho de robustez.

### 4. Para uma barraca pequena, o tradeoff não compensa

A wifi local da barraca tipicamente é de um roteador único na faixa de 5–10m de raio. Se cair:
- Provável que TODOS os devices caiam (mesma rede)
- Tempo médio de outage: segundos, ou re-conecta sozinha
- Frequência: <1x por evento na maioria dos casos

A mensagem "Sem conexão. Tente de novo" — já implementada — funciona bem nesse cenário. Atendente espera 5s, clica de novo, segue. Sem riscar duplicata.

## Quando reconsiderar

- Eventos em locais com wifi muito instável (varios drops por hora)
- Múltiplos atendentes em locais diferentes do mesmo evento (raio maior de wifi)
- Pedidos por celular do cliente (vai aumentar variabilidade)
- Migração pra cloud (servidor remoto = mais latência, mais janelas de falha)

Nesses casos, vale o investimento.

## Como implementar quando for hora

### 1. Idempotency key no POST `/api/orders`

```ts
// cliente
const idempotencyKey = crypto.randomUUID();
fetch("/api/orders", {
  headers: { "Idempotency-Key": idempotencyKey, ... },
  body: JSON.stringify({ ..., idempotencyKey }),
});
```

```prisma
// schema
model Order {
  ...
  idempotencyKey String? @unique
}
```

```ts
// route
const existing = await prisma.order.findUnique({ where: { idempotencyKey } });
if (existing) return NextResponse.json(serializeOrder(existing));
// ... continua com create normal
```

### 2. Workbox plugin

```ts
// next.config.mjs ou public/sw.js custom
import { BackgroundSyncPlugin } from "workbox-background-sync";

const bgSyncPlugin = new BackgroundSyncPlugin("orders-queue", {
  maxRetentionTime: 60, // minutos
});

registerRoute(
  /\/api\/orders$/,
  new NetworkOnly({
    plugins: [bgSyncPlugin],
  }),
  "POST"
);
```

### 3. UI

- Indicador "📡 Aguardando rede — pedido vai sair quando voltar"
- Sino/notificação quando o request retransmite com sucesso
- Botão "Ver fila offline" pra ver pedidos pendentes

### 4. Testes

Playwright pode simular offline:
```ts
await context.setOffline(true);
// ... ação
await context.setOffline(false);
// ... espera processar
```

**Estimativa total:** 2 dias de trabalho + 1 dia testando em condição real de wifi ruim.
