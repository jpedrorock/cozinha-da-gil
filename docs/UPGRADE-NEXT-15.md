# Plano de upgrade: Next.js 14 → 15

> Doc-only. Nenhum código mudado aqui. Executar numa janela de manutenção (sem evento em ≤ 72h).
>
> Versão atual: `next@14.2.35`, `react@18`. Alvo: `next@15.x`, `react@19`.
> Estimativa: 3–5h de trabalho, 1–2h de testes.

---

## Por que fazer

`next@14.x` acumulou CVEs de baixa criticidade que não afetam o app hoje (sem `remotePatterns`, sem `rewrites`, sem CSP nonces), mas o score vai subir com o tempo. Next 15 + React 19 trazem melhorias de performance no App Router que beneficiam os Server Components do admin.

---

## Breaking changes relevantes pra este projeto

### 1. `params` e `searchParams` viram Promises (alto impacto)

**O que muda:** Em Next 15, os handlers de rota e page components recebem `params` como `Promise<{ id: string }>` em vez de `{ id: string }` diretamente. Acessar `params.id` sem `await` passa a emitir warning e futuramente quebra.

**Impacto neste projeto:** **12 route handlers** + 1 page component.

Arquivos afetados (todos com `{ params }: { params: { id: ... } }`):
```
app/api/orders/[id]/route.ts
app/api/orders/[id]/items/route.ts
app/api/orders/[id]/notify-ready/route.ts
app/api/customers/[id]/route.ts
app/api/customers/[id]/broadcast-log/route.ts
app/api/uploads/products/[filename]/route.ts
app/api/users/[id]/route.ts
app/api/products/[id]/route.ts
app/api/products/[id]/sizes/route.ts
app/api/products/[id]/sizes/[sizeId]/route.ts
app/api/promotions/[id]/route.ts
app/api/ingredients/[id]/route.ts
app/comprovante/[id]/page.tsx
```

**Padrão de migração** (exemplo com `orders/[id]/route.ts`):

```typescript
// Antes (Next 14)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const id = Number.parseInt(params.id, 10);

// Depois (Next 15)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const id = Number.parseInt(rawId, 10);
```

Para o nested route (`products/[id]/sizes/[sizeId]`), ambos `id` e `sizeId` saem de um único `await params`:

```typescript
// Depois (Next 15)
{ params }: { params: Promise<{ id: string; sizeId: string }> },
...
const { id, sizeId } = await params;
```

**Estratégia:** Fazer tudo num único commit. São mudanças mecânicas e repetitivas — candidato a um único PR com `sed` ou script de codemods (`npx @next/codemod@latest async-request-api .`).

---

### 2. `cookies()` e `headers()` — já migrado

**O que muda:** Em Next 15, `cookies()` e `headers()` retornam Promises.

**Status neste projeto:** `lib/session.ts` já usa `await cookies()` — **nenhuma mudança necessária**. Verificar antes do upgrade que não há outros locais que chamem `cookies()` ou `headers()` sem `await`.

---

### 3. `experimental.serverComponentsExternalPackages` → `serverExternalPackages` (baixo impacto)

**O que muda:** A chave `experimental.serverComponentsExternalPackages` em `next.config.mjs` passa a ser top-level `serverExternalPackages`.

**Impacto:** 1 linha em `next.config.mjs`. Sem essa mudança o build emite um warning mas não quebra. Corrigir no mesmo commit do `next` bump.

```js
// Antes
experimental: {
  serverComponentsExternalPackages: ["pdfkit"],
},

// Depois (Next 15)
serverExternalPackages: ["pdfkit"],
```

> `next.config.mjs` está na lista de arquivos sensíveis do PLAYBOOK — **abrir PR, não commitar direto em main**.

---

### 4. `next-pwa@5` não é compatível com Next 15 (médio impacto)

**O que muda:** `next-pwa@5.6.x` (versão atual) não tem suporte oficial ao Next 15. O build costuma passar mas o service worker pode não ser gerado corretamente ou emitir erros de runtime.

**Opções:**

| Opção | Prós | Contras |
|-------|------|---------|
| `@ducanh2912/next-pwa` | Fork ativo, compatível com Next 15, API similar | Mudança de pacote, testar config do PWA do zero |
| Aguardar `next-pwa` v6 | Sem retrabalho | Sem previsão de lançamento |
| Remover PWA temporariamente | Desbloqueador rápido | Perde install prompt nos tablets |

**Recomendação:** Migrar para `@ducanh2912/next-pwa`. A API de configuração é ~90% igual — principais diferenças:

```js
// next.config.mjs com @ducanh2912/next-pwa
import withPWA from "@ducanh2912/next-pwa";

const withPWAConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  // runtimeCaching: idêntico ao atual
});
```

**Risco:** testar install prompt em iOS Safari + Android Chrome após migração. O `runtimeCaching` para bypassar SSE é crítico — verificar que continua funcionando.

---

### 5. React 18 → React 19 (baixo impacto)

**O que muda:** `react@19` remove APIs legadas (class components, `ReactDOM.render`, `findDOMNode`). Este projeto não usa nenhuma delas.

**Mudanças implícitas:**
- `useFormStatus`, `useOptimistic`, `use()` viram estáveis — já estamos usando `useActionState` que é o novo `useFormState`. Verificar se algum import usa o nome antigo.
- `ref` pode ser passado como prop em function components sem `forwardRef` — simplificação opcional, não obrigatória.

**Ação:** bump `react` e `react-dom` para `^19`. Rodar `npm test` + `npm run lint`. Testar o formulário de login (iron-session + form submit é o fluxo mais sensível).

---

### 6. Fetch caching: sem impacto

Em Next 15, `fetch()` no servidor muda o default de `force-cache` para `no-store`. Porém todos os `fetch()` neste projeto são client-side (em componentes com `'use client'`), então **nenhuma mudança necessária**.

---

## Sequência de migração

| Passo | Ação | Risco | Quem |
|-------|------|-------|------|
| 1 | Rodar `npx @next/codemod@latest async-request-api .` — migra params/searchParams automaticamente | Baixo | claude-pastel |
| 2 | Revisar diff do codemod nos 13 arquivos, ajustar manualmente onde necessário | Baixo | claude-pastel |
| 3 | Migrar `next-pwa` → `@ducanh2912/next-pwa`, ajustar `next.config.mjs` | Médio | claude-pastel + revisão João |
| 4 | Bump `next`, `react`, `react-dom`, `@types/react` | Médio | claude-pastel |
| 5 | `npm run build` local — verificar 0 erros e 0 warnings críticos | - | claude-pastel |
| 6 | `npm test` (57 Vitest) | - | claude-pastel |
| 7 | `npm run test:e2e` (Playwright) | - | claude-pastel |
| 8 | Testar PWA manualmente: instalar em Android Chrome + iOS Safari | Médio | João / Gil |
| 9 | Deploy em Coolify (mesma janela do Passo 1 do BACKLOG — redeploy com volume novo) | Alto | João |

Passos 3–9 num único PR. Não merge sem teste de PWA manual (passo 8).

---

## Estimativa

- Código: ~2–3h (codemod + revisão + next-pwa + bump)
- Testes: ~1h
- Deploy + validação PWA: ~1h (depende de hardware disponível)
- **Total: 4–5h em janela sem evento.**

---

## Riscos residuais

- **PWA install prompt**: é a funcionalidade mais difícil de testar sem hardware real. Se o service worker não registrar no iOS Safari, os tablets perdem a instalação — impacto operacional baixo (app funciona como web app), mas experiência degradada.
- **PDFKit em React 19**: `pdfkit` usa algumas APIs de buffer que interagem com o runtime Node.js. `serverExternalPackages: ["pdfkit"]` isola isso, mas testar geração de comprovante é obrigatório antes de ir pra produção.
- **iron-session + Next 15**: biblioteca está em v8.x com suporte ativo ao App Router. Sem breaking changes conhecidos, mas o fluxo de login deve ser testado end-to-end.

---

## Quando NÃO fazer

- Com evento em ≤ 72h.
- Se PR #4 (backup do dev.db) ainda não tiver sido mergeado e deployed — fazer o redeploy junto (otimiza a janela de downtime).
- Sem João disponível pra validar PWA em hardware real.
