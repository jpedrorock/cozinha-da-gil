# Plano de upgrade: Next.js 14 → 15

> Doc-only por agora. Executar quando houver janela fora de período de evento.
> Criado por `claude-pastel` em 2026-05-25 (BACKLOG: plano major bump Next 14 → 15).

---

## Por que fazer

Next.js 14.x acumula CVEs que não se aplicam ao app atual (sem `remotePatterns`, sem `rewrites` com inputs externos, sem CSP nonces). Mas o acúmulo vai crescer. O upgrade para Next 15 resolve as vulns e mantém o projeto na linha de suporte ativa.

`npm audit` atual: 10 alertas no Next 14.2.35, todos moderados/altos em paths não usados.

---

## Resumo dos breaking changes relevantes pra este app

### 1. `params` e `searchParams` viram Promises (ALTO impacto)

No Next 15, props de páginas e route handlers têm `params` e `searchParams` como objetos Promise que precisam ser `await`-ados.

**Padrão atual (Next 14):**
```ts
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const id = Number.parseInt(params.id, 10); // sync, funciona em Next 14
}
```

**Padrão Next 15:**
```ts
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const id = Number.parseInt(rawId, 10);
}
```

**Arquivos afetados (15 no total):**

| Arquivo | Prop | Param |
|---------|------|-------|
| `app/comprovante/[id]/page.tsx` | page props | `id` |
| `app/api/orders/[id]/route.ts` | handler | `id` |
| `app/api/orders/[id]/items/route.ts` | handler | `id` |
| `app/api/orders/[id]/notify-ready/route.ts` | handler | `id` |
| `app/api/users/[id]/route.ts` | handler | `id` |
| `app/api/customers/[id]/route.ts` | handler | `id` |
| `app/api/customers/[id]/broadcast-log/route.ts` | handler | `id` |
| `app/api/uploads/products/[filename]/route.ts` | handler | `filename` |
| `app/api/promotions/[id]/route.ts` | handler | `id` |
| `app/api/products/[id]/route.ts` | handler | `id` |
| `app/api/products/[id]/sizes/route.ts` | handler | `id` |
| `app/api/products/[id]/sizes/[sizeId]/route.ts` | handler | `id`, `sizeId` |
| `app/api/ingredients/[id]/route.ts` | handler | `id` |

`searchParams` em route handlers (`app/api/orders/route.ts`, `app/api/users/route.ts`, etc.) também passam a ser Promise — mas esses já leem via `new URL(request.url).searchParams`, não via prop, então **não são afetados**.

> Dica: Next 15 lança um warning de deprecação se você acessar `params` de forma síncrona — dá pra usar o codemod antes de fazer o upgrade real.

---

### 2. Fetch caching invertido (BAIXO impacto neste app)

No Next 14, `fetch()` em Server Components cacheia por padrão (`cache: 'force-cache'`).
No Next 15, o padrão passa a ser sem cache (`cache: 'no-store'`).

**Neste app:** todo fetch de dados usa Prisma diretamente nos Server Components — não há `fetch()` pra dados internos em server-side. Os `fetch()` existentes são todos em `'use client'` components ou em `app/page.tsx` (login POST). **Impacto: zero.**

---

### 3. `experimental.serverComponentsExternalPackages` → `serverExternalPackages` (BAIXO impacto)

No Next 15, a key saiu de `experimental` pra raiz do config.

**Arquivo:** `next.config.mjs`

**Mudança necessária:**
```js
// Next 14 (atual)
experimental: {
  serverComponentsExternalPackages: ["pdfkit"],
}

// Next 15
serverExternalPackages: ["pdfkit"],
```

---

### 4. React 19 como padrão (MÉDIO impacto — avaliar)

Next 15 vem com React 19. Breaking changes relevantes:

- **`ref` como prop direta** (sem `forwardRef`): `forwardRef` ainda funciona mas será deprecado. Baixo impacto agora, mas o linter vai reclamar no futuro.
- **`useEffect` com cleanup antes de execução** em Strict Mode no dev: pode expor bugs latentes nos `useSSE`, `useEffect` de audio, polling de status. Testar em dev antes de subir.
- **`use()` hook** disponível — nenhuma migração obrigatória, mas `params` como Promise se integra bem com ele.
- **`ReactDOM.render` removido**: não usamos, sem impacto.
- **Transitions e `startTransition`**: API estável, sem breaking change.

Verificar em dev após upgrade: `app/cozinha/CozinhaClient.tsx` (SSE + audio), `app/atendente/AtendenteClient.tsx` (stepper com estado complexo).

---

### 5. `cookies()` e `headers()` (SEM impacto — já migrado)

`lib/session.ts` já usa `await cookies()`, padrão do Next 15. Nenhuma mudança necessária.

---

### 6. `next-pwa` (VERIFICAR compatibilidade)

`next-pwa` v5.x não tem suporte oficial ao Next 15 ainda (a partir de 2025). Alternativas:
- `@ducanh2912/next-pwa` (fork mantido, suporta Next 15)
- `next-pwa` v6+ (se sair antes do upgrade)
- Migrar pra `serwist` (substituto mais moderno)

**Ação:** antes de fazer o upgrade, verificar se `next-pwa` tem versão compatível com Next 15. Se não tiver, planejar migração pro `@ducanh2912/next-pwa` junto com o upgrade.

---

## Passos de migração

### Pré-upgrade (pode fazer antes, em Next 14)

1. Rodar o codemod oficial do Next 15 em modo preview:
   ```bash
   npx @next/codemod@latest upgrade latest --dry-run
   ```
2. Verificar output do codemod — ele migra automaticamente os `params` síncronos.
3. Checar compatibilidade do `next-pwa` com Next 15 no npm.

### Upgrade

```bash
npm install next@15 react@19 react-dom@19 @types/react@19 @types/react-dom@19
```

Se `next-pwa` não suportar Next 15:
```bash
npm install @ducanh2912/next-pwa
# ajustar import em next.config.mjs: import nextPWA from "@ducanh2912/next-pwa"
```

### Pós-upgrade

1. Aplicar codemod de `params`:
   ```bash
   npx @next/codemod@latest next-async-request-api .
   ```
2. Atualizar `next.config.mjs`: mover `serverComponentsExternalPackages` pra fora de `experimental`.
3. Rodar `npm run lint` — corrigir warnings novos.
4. Rodar `npm test` — 57/57 devem passar.
5. Rodar `npm run build` — checar warnings de React 19.
6. Testar manualmente em `npm run dev`:
   - Login de cada papel (atendente, cozinha, admin)
   - Criar pedido ponta-a-ponta
   - SSE na cozinha (pedido novo aparece ao vivo)
   - Comprovante PDF
7. Rodar `npm run test:e2e` — suite Playwright.
8. Build de produção + teste PWA:
   ```bash
   npm run build && npm start
   # abrir em browser, checar service worker, instalar como PWA
   ```

---

## Riscos por área

| Área | Risco | Ação |
|------|-------|------|
| Route handlers (15 arquivos) | `params` async quebra em runtime | Codemod cobre; revisar manualmente |
| `next-pwa` | Versão incompatível | Verificar/migrar fork antes do upgrade |
| SSE (`app/api/sse/route.ts`) | React 19 Strict Mode pode re-executar effects | Testar em dev; já tem `runtime = "nodejs"` |
| PDF (`app/comprovante/`) | `pdfkit` como external — key de config muda | 1 linha em `next.config.mjs` |
| Auth (`lib/session.ts`) | Já usa `await cookies()` | Sem ação necessária |
| PWA service worker | Cache agressivo pode segurar versão antiga | Bump de versão do manifest após upgrade |

---

## Estimativa de horas

| Etapa | Horas |
|-------|-------|
| Verificar compatibilidade `next-pwa` / trocar fork | 1-2h |
| Rodar codemod + revisar diffs (15 arquivos) | 1h |
| Resolver warnings de React 19 (Strict Mode, ref) | 1-2h |
| Testes manuais dos 4 papéis + SSE + PDF | 1h |
| `npm run test:e2e` + correções eventuais | 1h |
| **Total** | **5-7h** |

Fazer em uma janela sem evento próximo. Criar branch `upgrade/next-15`, abrir PR pra revisão antes de mergear.
