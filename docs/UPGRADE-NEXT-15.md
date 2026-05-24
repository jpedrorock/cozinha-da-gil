# Plano de upgrade: Next.js 14 → 15

> Doc-only. Não implementar sem janela planejada e testes de regressão completos.
> Estado atual: Next `14.2.35` + React `18`. Última revisão: 2026-05-24.

---

## Por que fazer

Next 14.x acumula CVEs no npm audit (10 hoje). As vulns conhecidas não aplicam ao app atual (sem `remotePatterns`, sem `rewrites`, sem CSP nonces), mas com o tempo podem aparecer novas que aplicam. Next 15 + React 19 também trazem melhorias de performance e Turbopack estável.

**Urgência: baixa.** Fazer quando tiver 1-2 dias de folga sem evento próximo.

---

## Breaking changes que afetam este app

### 1. `params` e `searchParams` agora são Promises

**O que muda:** Em Next 15, `params` e `searchParams` passados para Server Components e route handlers são `Promise<...>` — precisam de `await`.

**Arquivos afetados (20 route handlers + 1 page):**

| Arquivo | Params |
|---|---|
| `app/api/users/[id]/route.ts` | `params.id` (×2 handlers) |
| `app/api/orders/[id]/route.ts` | `params.id` |
| `app/api/orders/[id]/items/route.ts` | `params.id` |
| `app/api/orders/[id]/notify-ready/route.ts` | `params.id` |
| `app/api/customers/[id]/route.ts` | `params.id` (×3 handlers) |
| `app/api/customers/[id]/broadcast-log/route.ts` | `params.id` |
| `app/api/products/[id]/route.ts` | `params.id` (×2 handlers) |
| `app/api/products/[id]/sizes/route.ts` | `params.id` |
| `app/api/products/[id]/sizes/[sizeId]/route.ts` | `params.id`, `params.sizeId` (×2 handlers) |
| `app/api/promotions/[id]/route.ts` | `params.id` (×2 handlers) |
| `app/api/ingredients/[id]/route.ts` | `params.id` |
| `app/api/uploads/products/[filename]/route.ts` | `params.filename` |
| `app/comprovante/[id]/page.tsx` | `params.id` |

**Padrão de migração** (antes → depois):

```ts
// ANTES (Next 14)
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  ...
}

// DEPOIS (Next 15)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  ...
}
```

**Estimativa:** ~30 min com busca+replace guiada. Erro de tipo do TypeScript aponta cada ocorrência.

### 2. Fetch caching invertido

**O que muda:** Em Next 14, `fetch()` em Server Components cacheia por padrão (`force-cache`). Em Next 15, o default vira `no-store`.

**Impacto neste app:** Baixo. O app usa `export const dynamic = "force-dynamic"` em todas as páginas que fazem fetch de dados dinâmicos, e os fetches em Client Components (`cache: "no-store"` explícito) não são afetados. Nenhum Server Component faz `fetch()` sem configuração explícita — todos usam Prisma direto.

**Ação:** Auditar após upgrade se algum Server Component usa `fetch()` sem `cache` explícito. Hoje: nenhum encontrado.

### 3. React 19 por padrão

**O que muda:** Next 15 usa React 19. Principais diferenças:

- `forwardRef` deprecado — usar `ref` como prop direto (não afeta este app, não usamos `forwardRef`)
- `useFormState` → `useActionState` (não usamos Server Actions)
- Melhorias de performance em re-renders (sem breaking change)
- `use()` hook para Promises e Context (novo, não necessário migrar)

**Impacto neste app:** Mínimo. Nenhum `forwardRef`, nenhum `useFormState`, nenhuma Server Action.

### 4. Turbopack como default em `next dev`

**O que muda:** `next dev` usa Turbopack por padrão (antes era webpack). `next build` ainda usa webpack.

**Impacto:** Nenhum em produção. Em dev, pode ter diferenças de comportamento com `next-pwa` (que injeta service worker). Testar `npm run dev` depois do upgrade e confirmar que o app carrega normalmente.

**Fallback:** `next dev --turbopack=false` se houver problema.

### 5. `next-pwa` (dependência crítica)

`next-pwa@^5` foi feito para Next 13/14. Para Next 15 pode precisar trocar por `@ducanh2912/next-pwa` ou `@serwist/next` (fork mantido). **Pesquisar compatibilidade antes de subir.**

---

## Passos de migração

1. **Branch dedicada:** `upgrade/next-15` — não fazer em main
2. `npm install next@15 react@19 react-dom@19`
3. `npm run build` — ver quais erros de tipo aparecem (esperado: `params` async)
4. Migrar todos os route handlers afetados (seção 1 acima)
5. Verificar `next-pwa` — se quebrar, avaliar `@serwist/next`
6. `npm run lint && npm test`
7. `npm run build && npm start` — testar fluxo completo manualmente (atendente → cozinha → entregue)
8. `npm run test:e2e` — Playwright suite
9. Abrir PR, review antes de merge

---

## Riscos e mitigações

| Risco | Probabilidade | Mitigação |
|---|---|---|
| `next-pwa` incompatível com Next 15 | Média | Trocar por `@serwist/next` (API similar, mantido) |
| Params async quebra todos os handlers | Alta (proposital) | TypeScript aponta tudo; fix mecânico |
| Service worker cacheia versão velha | Média | Bump de versão no manifest.json após deploy |
| SSE quebra com Turbopack | Baixa | Testar `npm run dev`; fallback `--turbopack=false` |

---

## Estimativa

| Etapa | Horas |
|---|---|
| Migrar `params` async (20 arquivos) | 1h |
| Verificar/trocar `next-pwa` | 1-3h |
| Testes manuais + e2e | 1h |
| Buffer / surpresas | 1h |
| **Total** | **4-6h** |

**Janela ideal:** Dia sem evento próximo (≥72h de margem). Não fazer em véspera de festa.
