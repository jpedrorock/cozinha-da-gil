# Fase 6 — Cardápio expandido (bebidas, macarrão, combos, promoções)

> **Status: ✅ ENTREGUE.** Este doc é o **plano original** da Fase 6, mantido como
> referência histórica. A fase está implementada: `Product`, `ProductSize`,
> `Promotion`, `EventSession` e `Customer` estão no `prisma/schema.prisma`; o
> cardápio é CRUD dirigido por dados (bebida/macarrão/combo/promoção), pricing
> vem do banco (`computeUnitPrice`), bebida bypassa a cozinha, relatórios são por
> evento (`EventSession`). Detalhes de implementação divergem do plano em pontos —
> o código é a fonte de verdade.

---

## O que vai entrar

1. **Bebidas** — Coca, Suco, Água (e o que mais a Gil quiser cadastrar)
2. **Macarrão** — preço fixo + ingredientes selecionáveis (mesma mecânica do pastel grande, mas é macarrão)
3. **Combos de 4 sabores** — cliente escolhe 4 sabores diferentes num pacote único
4. **Promoções editáveis** — admin cria desconto/oferta, aplica a produtos específicos

---

## Decisão grande: refatorar pra `Product` genérico

Hoje `OrderItem.kind` é hardcoded `"salgado" | "doce"` e o tamanho/preço sai de `lib/pricing.ts` (PRICE constante). Isso quebra rápido com 4 categorias novas.

**Proposta:** migrar pra entidade `Product` dirigida por dados. Admin cadastra produtos no banco; cardápio vira CRUD em vez de constante no código.

### Schema novo

```prisma
model Product {
  id                 String        @id @default(cuid())
  name               String        // "Pastel Grande", "Coca-Cola Lata", "Macarrão"
  type               String        // 'salgado' | 'doce' | 'bebida' | 'macarrao' | 'combo'
  pricingMode        String        // 'fixed' | 'by_size'
  basePriceCents     Int?          // usado se pricingMode = 'fixed' (bebida, macarrão)
  available          Boolean       @default(true)
  position           Int           @default(0)
  emoji              String?       // ícone visual no atendente
  // Configuração de ingredientes
  allowsIngredients  Boolean       @default(false)
  ingredientCategory String?       // 'topping' | 'macarrao_topping' | 'doce' etc
  maxIngredients     Int?          // null = ilimitado; 2 = pastel pequeno; 4 = combo
  minIngredients     Int?          // null/0 = opcional; 4 = combo exige 4 sabores
  allowsSauces       Boolean       @default(false)
  sizes              ProductSize[]

  @@index([type])
  @@index([position])
}

model ProductSize {
  id           String  @id @default(cuid())
  productId    String
  product      Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  name         String  // "Pequeno", "Grande", "Lata 350ml", "Garrafa 600ml"
  description  String? // "2 ingredientes" / "Monte o seu"
  priceCents   Int
  position     Int     @default(0)

  @@index([productId])
}
```

### OrderItem reformado

Snapshot do que foi vendido — preserva história mesmo se admin renomear/apagar produto depois.

```prisma
model OrderItem {
  id          String  @id @default(cuid())
  orderId     Int
  order       Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  // Refs (opcional, pra analytics)
  productId   String?
  productSizeId String?
  // Snapshot textual (sempre preenchido — é o que mostra no histórico)
  productName String  // "Pastel Grande"
  productType String  // 'salgado' | 'doce' | 'bebida' | 'macarrao' | 'combo'
  sizeName    String? // "Grande" / "Lata 350ml"
  // Conteúdo (substitui toppings/flavor/sauces antigos)
  ingredients String  @default("[]") // JSON array de nomes
  sauces      String  @default("[]") // JSON array de nomes (molhos extras)
  notes       String?
  unitPrice   Int     // centavos por unidade no momento da venda
  quantity    Int     @default(1)

  @@index([orderId])
}
```

`Ingredient.category` ganha valores novos: `'macarrao_topping'`, `'bebida_extra'` (opcional, se a Gil quiser limão na água). Hoje tem só `topping | doce | molho`.

### Promotion

```prisma
model Promotion {
  id                  String   @id @default(cuid())
  name                String   // "Família feliz", "Sexta da Gil"
  description         String?  // texto livre — mostra no atendente
  // Tipo de desconto
  discountType        String   // 'percent' | 'fixed_cents' | 'free_item'
  discountValue       Int      // 10 (= 10% ou R$0,10 ou ID do item brinde)
  // Validade
  active              Boolean  @default(true)
  validFromDate       DateTime?
  validUntilDate      DateTime?
  // Restrições
  appliesToProductIds String   @default("[]") // JSON array; vazio = todos
  minItems            Int?     // ex: 4 pastéis
  minTotalCents       Int?     // ex: R$60
  // Audit
  createdBy           String
  createdAt           DateTime @default(now())
}
```

---

## Migração (não-trivial — tem dados em produção)

A Gil já tem `Ingredient` cadastrado e (eventualmente) histórico de pedidos. Migração precisa ser cuidadosa:

1. **Adicionar tabelas novas** (`Product`, `ProductSize`, `Promotion`) sem mexer nas antigas
2. **Seed** dos produtos atuais a partir de `lib/pricing.ts`:
   - `Pastel Salgado` (type=salgado) com sizes `Pequeno` (R$15) e `Grande` (R$20)
   - `Pastel Doce` (type=doce) com sizes `Normal` (R$15) e `Mini Pack` (R$30)
   - Mantém `Ingredient` como está
3. **Adicionar colunas novas** em `OrderItem`: `productId?`, `productSizeId?`, `productName`, `productType`, `sizeName?`, `ingredients`, `sauces` (mantém `toppings`, `flavor`, `sauces` antigas durante transição)
4. **Backfill** dos items existentes: copiar `kind → productType`, `size → sizeName`, `toppings → ingredients`, etc. Olhar `productName` por lookup do tipo+tamanho
5. **Deprecar** colunas antigas em migração futura quando código não usar mais
6. **Pricing.ts** — todo preço de venda passou a sair do banco (`computeUnitPrice` em `lib/products.ts`). `lib/pricing.ts` **não virou dead code**: segue vivo pra display/legacy (`formatBRL`, `SIZE_LABEL`, `PRICE.sauce`, `MAX_TOPPINGS_PEQUENO`, tipos `Kind`/`Size`) — coberto por `tests/pricing.test.ts`.

---

## UI — onde mexe

### Atendente
- Stepper começa com **escolha do tipo de produto** (cards com ícones: PastelIcon · Coffee · Utensils · Package — ver 6.A)
- Bebida: lista de bebidas cadastradas → tamanho (se houver) → quantidade. Sem ingredientes.
- Macarrão: escolhe ingredientes (mesma UI do pastel grande, mas categoria diferente) → notas → quantidade
- Combo: tela especial pra escolher 4 sabores (4 slots numerados, cada slot abre lista de toppings)
- No final do pedido, banner se houver promoção aplicável: "Esse pedido se enquadra na promoção X — aplicar?"

### Cozinha
- Cards diferenciados por tipo:
  - Pastel: como está hoje
  - Bebida: card mais simples (só nome + qty) — geralmente vai pro balcão direto, não pra cozinha
  - Macarrão: como pastel grande, mas com cabeçalho usando ícone `Utensils`
  - Combo: 4 mini-cards de sabor dentro do card grande
- **Decisão:** bebidas talvez nem apareçam pra cozinha (vão direto pra PRONTO). Confirmar com a Gil.

### Admin Cardápio
- Vira CRUD completo: lista de produtos com botão "+ Novo produto"
- Modal de produto: nome, tipo, modo de preço, sizes (sub-tabela), ingredientes permitidos
- Promoções: nova aba "Promoções" com lista + CRUD
- Ingredientes: continua como hoje, mas categoria vira dropdown com valores novos

### Comprovante
- Linhas refletem o snapshot — produto+tamanho na esquerda, qty×preço na direita
- Promoção aparece como linha de desconto antes do total

---

## Sequência de implementação

| Etapa | Conteúdo | Risco |
|-------|----------|-------|
| 6.1 | Schema novo + migration + seed dos produtos atuais | Médio — precisa não quebrar histórico |
| 6.2 | Refactor `OrderItem` pra usar snapshot + backfill | Alto — toca em vários lugares |
| 6.3 | Admin Cardápio vira CRUD de Product | Médio |
| 6.4 | Atendente stepper aceita escolha de tipo (mas só pastel ainda) | Baixo |
| 6.5 | Cadastrar Bebidas (Coca/Suco/Água) e habilitar no stepper | Baixo |
| 6.6 | Cadastrar Macarrão + categoria de ingrediente nova | Baixo |
| 6.7 | Combo 4 sabores (UI especial) | Médio |
| 6.8 | Promoções (model + admin CRUD + aplicação no atendente) | Médio |

**Estimativa total:** ~5-7 dias. Etapas 6.1 e 6.2 são as travas — depois disso o resto é repetitivo.

---

## Lote 2 — Itens adicionais (mandados depois)

### 6.A — Sem emoji em lugar nenhum (regra global)

Auditoria + substituição. Hoje tem emoji em:
- Cliente display: `🥟` no estado vazio (`app/cliente/ClienteClient.tsx`)
- Cozinha: `🥟`/`🍩` nos cards de pastel
- Admin: `🏆` (badge top), `⚠`/`✕` no estoque, `🥤`/`🍝`/`📦` planejados pra Fase 6
- Login: nenhum (já tá limpo)

Substituir tudo por:
- `lucide-react` (já é dependência) — `Croissant`, `Cookie`, `Coffee`, `Utensils`, `Trophy`, `AlertTriangle`, `XCircle`
- Ou SVG custom em `components/icons.tsx` (já tem `BrandIcon`, `PastelIcon`, `DoceIcon`)

**Aplicar TAMBÉM neste doc** — substituir os emoji do plano original (linha "🥟 Pastel · 🥤 Bebida · 🍝 Macarrão · 📦 Combo" etc) por nomes de ícones.

### 6.B — Latência DB ↔ atendente ↔ cozinha (investigação + ajuste)

Preocupação: pedido criado no atendente demora pra aparecer na cozinha. Hoje o fluxo é:
1. `POST /api/orders` → Prisma INSERT no SQLite (~5ms local, talvez 20-50ms em produção)
2. `broadcast("order:created", order)` em `lib/sse.ts` → empurra pra todos os clientes SSE conectados
3. Cozinha recebe no listener `useSSE` → setState → re-render

**Medir antes de otimizar:**
- Logar timestamp no `POST /api/orders` (entrada e saída do handler)
- Logar timestamp no `broadcast()` antes do `controller.enqueue`
- Logar timestamp no `useSSE` handler na cozinha
- Ver onde o tempo realmente vai

**Riscos prováveis:**
- SSE pode estar reconectando muito (a cada N segundos se houver proxy/firewall) — checar headers `keepalive`
- SQLite write-lock em escrita concorrente — pouco provável com 1 atendente, mas se virar multi-atendente vira problema
- `revalidatePath` ou cache do Next pode estar segurando — confirmar que rotas SSE usam `dynamic = "force-dynamic"` e `runtime = "nodejs"`
- Quando perde wifi e volta, SSE pode levar até 30s pra reconectar (timeout default) — adicionar reconnect mais agressivo no `useSSE`

**Sem otimização cega.** Primeiro instrumentar, depois decidir.

### 6.C — Cliente display: só nome + senha, sem item

Em `app/cliente/ClienteClient.tsx`, remover o badge "1× pastel" (linha 130-132). Card fica:
- `#XXX` (senha — o número do pedido)
- Nome do cliente (grande)

Sem contagem de item. O cliente já sabe o que pediu — display público é só pra ele saber QUANDO retirar. Quanto mais limpo, melhor pra leitura à distância.

**Mexe em:** `app/cliente/ClienteClient.tsx` — remover bloco `<div>{o.items.length}× pastel</div>`. Ajustar layout do card (sem o item à direita, o nome pode ocupar tudo).

### 6.D — Cozinha: duplicar item em vez de mostrar `×N` quantity

**Comportamento:** se Maria pede 3 Pastéis Grande de Frango idênticos, a cozinha vê 3 cards/linhas iguais (não 1 card com badge "×3").

**Why:** badge `×3` fica pequeno e cozinheira na pressa pode ler como `×1` e fazer só 1. Repetição visual = alarme natural, não tem como ignorar.

**Onde aplicar (cozinha apenas):**
- Em `app/cozinha/CozinhaClient.tsx`, no render dos `items` do `Ticket`: substituir `order.items.map(item => ...)` por `order.items.flatMap(item => Array(item.quantity).fill(item).map((it, n) => ...))` — gerando key composta tipo `${item.id}-${n}`

**Onde MANTER agrupado com `×N`:**
- Atendente cart (leitura calma, sem risco)
- Comprovante (cliente lê uma vez)
- Admin relatórios (KPIs e top contam multiplicando por quantity)

Conflita com o instinto de "agrupar" — explicitamente queremos desagrupar pra cozinha.

### 6.E — Histórico/relatórios por EVENTO, não por data

Hoje admin agrupa por dia (`startOfToday()`, range Hoje/Semana/Mês). Gil não trabalha por data — trabalha por **evento** (abre caixa → vende → fecha caixa). Pode ter múltiplos eventos por dia, ou um evento que atravessa meia-noite.

**Schema:** `DayClose` vira `EventSession`:

```prisma
model EventSession {
  id          String    @id @default(cuid())
  name        String?   // "Festa Junina", "Sexta normal" — opcional
  openedAt    DateTime  @default(now())
  openedBy    String
  closedAt    DateTime?
  closedBy    String?
  totalCents  Int?      // gravado no fechamento (snapshot)
  orders      Order[]
}

model Order {
  // ... existente
  eventSessionId String?
  eventSession   EventSession? @relation(fields: [eventSessionId], references: [id])
  @@index([eventSessionId])
}
```

**Fluxo:**
- Admin abre caixa → cria `EventSession` (pode pedir nome opcional)
- Todo `POST /api/orders` lê a sessão aberta atual e grava `eventSessionId`
- Se nenhuma sessão aberta → 423 (mesma lógica do `getDayStatus` hoje, mas baseada em sessão em vez de data)
- Admin fecha caixa → grava `closedAt`, `closedBy`, calcula e grava `totalCents`
- Histórico admin: dropdown "Evento: [Festa Junina · 12/05] ▾" filtra tudo por aquele `eventSessionId`
- Relatórios mantém range de datas como filtro **secundário** (pra agregar cross-event)

**Migração:** dados existentes (com `DayClose` por data) viram `EventSession` retroativo — 1 por dia que teve fechamento. `Order` sem evento ainda funciona, só não aparece no filtro.

**Substitui:** itens 4 (fechar dia) e 5 (relatórios semana/mês) do plano Fase 5 original — eventos absorvem as duas necessidades.

---

## Perguntas a fazer pra Gil quando voltar

1. Bebidas vendem em quais tamanhos? (lata, garrafa pequena, garrafa grande?)
2. Bebida passa pela cozinha ou vai direto pro balcão? (afeta SSE/filtro de status)
3. Macarrão usa os mesmos ingredientes do pastel ou tem lista própria? (ex: queijo ralado, manjericão)
4. Combo de 4 sabores: preço fixo único ou varia com os sabores escolhidos?
5. Promoções: vai querer cupom (cliente digita código) ou só auto-aplicação (sistema detecta e oferece)?
6. Estoque: bebida tem estoque rastreado mesmo (vs. ingrediente)? Hoje só Ingredient tem `stock`.

---

## Fora do escopo de Fase 6

- **Pagamento integrado** (PIX, cartão) — continua manual
- **Delivery** — só retirada por enquanto
- **Múltiplas filiais** — uma barraca só
- **Loyalty/cashback** — promoção simples chega

Voltar quando Gil pedir.
