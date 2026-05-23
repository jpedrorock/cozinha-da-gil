# Plano de upgrade: Next.js 14 → 15

> Doc-only por enquanto. Executar quando tiver janela entre eventos (estimativa: 4–6h de trabalho + testes).

**Versão atual:** `next@14.2.35`, `react@18`
**Alvo:** `next@15`, `react@19` (recomendado junto)

---

## Por que upgradar (e por que esperar)

As vulnerabilidades conhecidas no Next 14.x **não se aplicam a este app**: não há `remotePatterns` não sanitizados, nem `rewrites`, nem uso de `x-forwarded-host` em contextos perigosos. Dá pra continuar em 14 com segurança por enquanto.

Motivos pra fazer quando tiver janela:
- Acumulo de vuln reports cansa o `npm audit`
- React 19 traz melhorias de performance relevantes (Server Components, form actions)
- Next 15 estabiliza Partial Prerendering (ainda experimental no 14)

---

## Breaking changes que afetam este projeto

### 1. `params` e `searchParams` viram Promises (mudança mais impactante)

No Next 15, `params` e `searchParams` nas page/route functions são assíncronos:

```ts
// Next 14 (atual)
export default async function Page({ params }: { params: { id: string } }) {
  const { id } = params; // sync
}

// Next 15
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // precisa de await
}
```

**Arquivos afetados (18 ocorrências):**

| Arquivo | Tipo |
|---|---|
| `app/comprovante/[id]/page.tsx` | Page |
| `app/api/users/[id]/route.ts` | Route (GET + PATCH) |
| `app/api/orders/[id]/route.ts` | Route |
| `app/api/orders/[id]/items/route.ts` | Route |
| `app/api/orders/[id]/notify-ready/route.ts` | Route |
| `app/api/uploads/products/[filename]/route.ts` | Route |
| `app/api/customers/[id]/route.ts` | Route (GET + PATCH + DELETE) |
| `app/api/customers/[id]/broadcast-log/route.ts` | Route |
| `app/api/products/[id]/route.ts` | Route (PATCH + DELETE) |
| `app/api/products/[id]/sizes/route.ts` | Route |
| `app/api/products/[id]/sizes/[sizeId]/route.ts` | Route (PATCH + DELETE) |
| `app/api/ingredients/[id]/route.ts` | Route |
| `app/api/promotions/[id]/route.ts` | Route (GET + PATCH) |

**Como migrar:**
```ts
// Antes
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  // ...
}

// Depois
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // ...
}
```

O codemod oficial cobre a maioria: `npx @next/codemod@latest next-async-request-api .`

### 2. Fetch caching invertido

No Next 14, `fetch()` em Server Components faz cache por default. No 15, **não faz cache por default** — precisa ser explícito com `{ cache: "force-cache" }`.

**Impacto neste projeto:** baixo. Todas as páginas sensíveis já têm `export const dynamic = "force-dynamic"`. Os fetches nas páginas SSR usam Prisma diretamente (não `fetch`), então não são afetados.

Revisar: qualquer `fetch()` em Server Component sem opção de cache explícita.

### 3. React 19 (mudança de peer dependency)

Next 15 requer React 19 por default (ou `--legacy-peer-deps` pra manter React 18).

**Impacto:** `react-swipeable` (usado em `AtendenteClient.tsx`) precisa ser verificado contra React 19. Versão atual: checar `npm info react-swipeable peerDependencies`.

`iron-session`, `next-pwa`, `@prisma/client` são compatíveis com React 19 em suas versões recentes.

### 4. `next-pwa` e service worker

`next-pwa` na versão atual (`^5.6.0`) pode precisar de atualização para compatibilidade com Next 15. Verificar changelog do `next-pwa` antes de aplicar. Alternativa: migrar para `@ducanh2912/next-pwa` (fork mais ativo).

**Não mexer em `next.config.mjs` e `ecosystem.config.js` sem PR.**

---

## Passos de migração (ordem)

1. **Branch dedicada** `upgrade/next-15` — nunca direto em main
2. Rodar codemod: `npx @next/codemod@latest next-async-request-api .`
3. `npm install next@15 react@19 react-dom@19 @types/react@19`
4. Corrigir erros de type que o codemod não pegou (principalmente params em routes)
5. `npm run lint && npm test` — verde antes de avançar
6. `npm run build` — verificar warnings de deprecação
7. `npm run test:e2e` — cobrir fluxo completo de pedido
8. Testar PWA: `npm run build && npm start`, instalar no celular, validar service worker
9. Verificar `next-pwa` — se quebrar, atualizar ou trocar por fork
10. **PR com screenshots** das 4 telas (atendente/cozinha/cliente/admin)

---

## Riscos por área

| Área | Risco | Mitigação |
|---|---|---|
| Routes `[id]` (18 arquivos) | Params sync → async quebra silenciosamente se não migrar | Codemod + grep de verificação |
| `next-pwa` service worker | Incompatibilidade com Next 15 build | Testar em dev antes; ter fallback de versão anterior |
| `react-swipeable` | Pode não suportar React 19 | Checar peerDeps; alternativa: `@use-gesture/react` |
| SSE (`app/api/sse/`) | Recomendação do Next 15 de usar `ReadableStream` nativo | Testar reconexão com throttling antes de commitar |
| Prisma 6 | Já compatível com Next 15 | — |

---

## Estimativa

- Codemod + fixes manuais: ~2h
- Testes e validação: ~2h  
- PWA + e2e: ~1–2h
- **Total: 5–6h em janela tranquila (sem evento no dia seguinte)**
