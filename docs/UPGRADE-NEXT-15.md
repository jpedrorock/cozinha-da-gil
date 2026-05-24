# Plano de upgrade: Next 14 → 15

> **Status:** doc-only, não executar. Serve de roadmap pra quando tiver janela confortável fora de evento.
>
> Versão atual: `next@14.2.35`, `react@18`. Alvo: `next@15.x`, `react@19`.

---

## Por que fazer

Next 14.x acumula CVEs. Nenhuma aplica aos patterns do app hoje (sem `remotePatterns`, sem `rewrites`, sem CSP nonces), mas com o tempo a pressão aumenta. Melhor migrar antes de um CVE crítico forçar a mão às vésperas de evento.

---

## Breaking changes que afetam este app

### 1. `params` e `searchParams` viram Promises (impacto alto)

Next 15 torna `params` e `searchParams` assíncronos em Page e Route Handlers. O código que acessa `params.id` diretamente vai precisar de `await`.

**Padrão atual (Next 14):**
```ts
export default async function ComprovantePage({ params }: { params: { id: string } }) {
  const id = Number.parseInt(params.id, 10);
```

**Padrão Next 15:**
```ts
export default async function ComprovantePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number.parseInt(rawId, 10);
```

**Arquivos de página afetados (1):**

| Arquivo | Param | Notas |
|---|---|---|
| `app/comprovante/[id]/page.tsx` | `params.id` (Order ID) | Único page com params dinâmico |

**Route Handlers afetados (13):**

| Arquivo | Param | Notas |
|---|---|---|
| `app/api/orders/[id]/route.ts` | `params.id` | GET, PATCH, DELETE |
| `app/api/orders/[id]/items/route.ts` | `params.id` | GET |
| `app/api/orders/[id]/notify-ready/route.ts` | `params.id` | POST |
| `app/api/customers/[id]/route.ts` | `params.id` | GET, PATCH, DELETE |
| `app/api/customers/[id]/broadcast-log/route.ts` | `params.id` | GET |
| `app/api/users/[id]/route.ts` | `params.id` | GET, PATCH, DELETE |
| `app/api/products/[id]/route.ts` | `params.id` | GET, PATCH, DELETE |
| `app/api/products/[id]/sizes/route.ts` | `params.id` | GET, POST |
| `app/api/products/[id]/sizes/[sizeId]/route.ts` | `params.id`, `params.sizeId` | GET, PATCH, DELETE |
| `app/api/promotions/[id]/route.ts` | `params.id` | GET, PATCH, DELETE |
| `app/api/ingredients/[id]/route.ts` | `params.id` | PATCH, DELETE |
| `app/api/uploads/products/[filename]/route.ts` | `params.filename` | GET (serve imagem) |
| `app/api/reports/pdf/route.ts` | usa `searchParams` | ver seção abaixo |

**`searchParams` em Route Handlers (9 arquivos):**

Em route handlers `searchParams` já vem via `request.nextUrl.searchParams` (que é síncrono) — esses não mudam. A mudança de Promise afeta só os page components e layouts que recebem `searchParams` como prop. Confirmar que nenhum page usa `searchParams` como prop antes de declarar livre.

```bash
grep -rn "searchParams" app --include="*.tsx" | grep -v "api/"
```

### 2. `fetch` não é mais cacheado por default (impacto médio)

Next 14: `fetch(url)` = cacheado (equivalente a `cache: 'force-cache'`).
Next 15: `fetch(url)` = sem cache (equivalente a `cache: 'no-store'`).

**Impacto aqui:** O app usa `fetch` principalmente no client-side (`'use client'`) para chamar as próprias APIs. Server Components que fazem fetch (se houver) precisam de auditoria.

```bash
grep -rn "fetch(" app --include="*.tsx" --include="*.ts" | grep -v "'use client'\|api/\|node_modules"
```

Suspeita: impacto baixo porque a maioria dos fetches é client-side ou já tem `force-dynamic`.

### 3. React 19 como padrão (impacto médio)

Next 15 usa React 19 por default. React 19 tem mudanças em:
- **Ref como prop**: `forwardRef` deprecado — mas o app não tem muitos componentes com `forwardRef`.
- **`useEffect` cleanup**: ligeiramente diferente. Testar com `React.StrictMode` ativo.
- **Suspense behavior**: pequenas mudanças em como Suspense resolve.
- **`act()`** warnings em testes podem aparecer.

**Verificar:** se `react@19` introduz tipo incompatível com `@types/react@18` — é uma troca de versão explícita.

### 4. `cookies()`, `headers()`, `draftMode()` são async (impacto baixo aqui)

`lib/session.ts` já usa `await cookies()` — está preparado. Confirmar ao fazer upgrade que a versão do `iron-session` suporta Next 15.

```ts
// lib/session.ts linha 36 — JÁ correto:
const cookieStore = await cookies();
```

### 5. Remoção de `@next/font` (sem impacto)

O app não usa `@next/font` — usa `next/font` (já a API estável). Sem ação.

### 6. Turbopack como bundler default em `next dev` (impacto baixo)

Next 15 liga Turbopack por padrão em `next dev`. Se houver plugin webpack customizado em `next.config.mjs`, pode quebrar. O app não tem plugins webpack customizados — só `next-pwa`. Verificar compatibilidade do `next-pwa` com Turbopack antes de migrar.

---

## Riscos por área

| Área | Risco | Detalhe |
|---|---|---|
| Route Handlers `[id]` | Alto | 13 arquivos precisam de `await params` |
| Page `comprovante/[id]` | Alto | Único page com params dinâmico |
| SSE (`app/api/sse/route.ts`) | Médio | Não usa params, mas é crítico — testar isolado |
| Auth (`lib/session.ts`) | Baixo | Já usa `await cookies()` |
| `next-pwa` | Médio | Verificar compat com Next 15 + Turbopack |
| Vitest unit tests | Baixo | Pode precisar bump de `@testing-library/react` |
| Playwright e2e | Baixo | Agnóstico de versão Next |

---

## Passos de migração

### Pré-requisitos
- [ ] PR #4 (backup automático) mergado — proteção do `dev.db` antes de qualquer mudança grande.
- [ ] Janela fora de evento (mínimo 3 dias de folga).
- [ ] Branch dedicada: `upgrade/next-15`.

### Sequência

**Dia 1 — Deps e tipos**
```bash
npm install next@15 react@19 react-dom@19 @types/react@19 @types/react-dom@19
npm install                  # resolve peer deps
npm run build                # ver todos os erros de tipo de uma vez
```

**Dia 1 — Fix `params` assíncrono (maior volume)**

Busca e substitui em cada Route Handler:
```ts
// De:
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { id } = params;

// Para:
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
```

E no único page:
```ts
// app/comprovante/[id]/page.tsx
export default async function ComprovantePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number.parseInt(rawId, 10);
```

**Dia 1 — Verificar `next-pwa` compat**
```bash
npm ls next-pwa             # ver versão atual
# Se não tiver Next 15 support → avaliar @ducanh2912/next-pwa ou sitecore-jss/next-pwa
```

**Dia 2 — Testes**
```bash
npm run lint
npm test                    # 57 unit tests
npm run build               # type-check implícito
npm run test:e2e            # fluxo completo de pedido
```

**Dia 2 — Smoke test manual**
- [ ] Login como Gil (PIN 2699), admin abre caixa
- [ ] Atendente cria pedido com 2 itens
- [ ] Cozinha recebe em tempo real (SSE)
- [ ] Cozinha marca pronto, atendente marca entregue
- [ ] Comprovante `/comprovante/[id]` abre e imprime
- [ ] Admin fecha caixa, gera PDF

**Dia 3 — Deploy staging (Coolify)**
- Testar em `cozinhadagil.evapro.cloud` antes de confirmar como main.

---

## Estimativa de horas

| Tarefa | Estimativa |
|---|---|
| Upgrade deps + primeiros erros de build | 1h |
| Fix `await params` nos 13 route handlers + 1 page | 2h |
| Fix tipagem React 19 (se houver) | 1h |
| Verificar/atualizar `next-pwa` | 1h |
| Testes (lint + unit + e2e) | 1h |
| Smoke test manual + ajustes | 1h |
| Deploy staging + validação | 1h |
| **Total** | **~8h** |

---

## Quando fazer

Janela ideal: após evento confirmado como bem-sucedido, com pelo menos 2 semanas antes do próximo evento. Nunca na semana de evento.

---

_Documento gerado em 2026-05-24 com base no estado do app em Next 14.2.35._
