# Plano de Upgrade: Next 14 → 15

> Status: **rascunho / roadmap**. Não iniciar sem janela de manutenção + ambiente de staging.
> Revisitar quando Next 15 estiver estável há ≥ 3 meses ou quando vulnerabilidades do 14.x afetarem nossos patterns.

---

## Situação atual

- `next`: 14.2.35
- `react` / `react-dom`: ^18
- `next-pwa`: 5.6.0 (suporta Next ≤ 14)

As vulnerabilidades conhecidas no Next 14.x **não afetam este app** (nenhum `remotePatterns`, `rewrites`, CSP nonces, nem Server Actions expostos). Upgrade é preventivo — sem urgência.

---

## Breaking changes que impactam este repo

### 1. `params` e `searchParams` viram Promises — ALTO IMPACTO

No Next 15, `params` e `searchParams` em Route Handlers e Page components **são Promises**. Acessar `params.id` diretamente causa erro de tipo e pode retornar `undefined` em runtime.

**Padrão anterior (Next 14):**
```typescript
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const id = Number.parseInt(params.id, 10);
```

**Padrão Next 15:**
```typescript
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const id = Number.parseInt(rawId, 10);
```

**Arquivos afetados (19 handlers):**

| Arquivo | Params |
|---|---|
| `app/api/orders/[id]/route.ts` | `id` |
| `app/api/orders/[id]/items/route.ts` | `id` |
| `app/api/orders/[id]/notify-ready/route.ts` | `id` |
| `app/api/products/[id]/route.ts` | `id` |
| `app/api/products/[id]/sizes/route.ts` | `id` |
| `app/api/products/[id]/sizes/[sizeId]/route.ts` | `id`, `sizeId` |
| `app/api/promotions/[id]/route.ts` | `id` |
| `app/api/customers/[id]/route.ts` | `id` |
| `app/api/customers/[id]/broadcast-log/route.ts` | `id` |
| `app/api/ingredients/[id]/route.ts` | `id` |
| `app/api/users/[id]/route.ts` | `id` |
| `app/api/uploads/products/[filename]/route.ts` | `filename` |
| `app/comprovante/[id]/page.tsx` | `id` |

**Estimativa:** 1–2h (codemod disponível: `npx @next/codemod@latest next-async-request-api .`)

---

### 2. Fetch caching invertido — BAIXO IMPACTO

No Next 14, `fetch()` em Server Components usava `force-cache` por padrão.
No Next 15, o padrão é `no-store` (sem cache).

**Por que baixo impacto aqui:** todos os route handlers já declaram `export const dynamic = "force-dynamic"` e `export const runtime = "nodejs"`. Server Components que fazem fetch (ex: `app/comprovante/[id]/page.tsx`) fazem chamadas internas que também passam a ser uncached — comportamento correto para um sistema de pedidos ao vivo.

Revisar `app/comprovante/[id]/page.tsx` para confirmar que nenhum dado precisa de cache.

---

### 3. React 18 → 19 — IMPACTO MODERADO

Next 15 usa React 19 por padrão.

**Mudanças relevantes:**
- **`use()` hook**: novo hook para Promises/Context. Não quebramos nada existente.
- **Server Actions formalizados**: `"use server"` muda semanticamente. Este app não usa Server Actions (usa route handlers) — sem impacto direto.
- **Strictmode duplo-render no dev**: se houver efeitos colaterais em `useEffect`, podem aparecer bugs que estavam mascarados. Testar com atenção os SSE hooks (`useSSE`).
- **Tipos `@types/react`**: versão 19 tem tipos novos — `children` não é mais implícito em `FC`. Pode gerar erros de tipo em componentes que recebem `children` sem declarar.

**Arquivos para revisar:**
- `lib/useSSE.ts` — verificar se duplo-mount causa double-subscribe em SSE
- Qualquer componente que passe `children` sem tipar — `grep -r "FC\b\|FunctionComponent\b" app/`

---

### 4. `next-pwa` — BLOQUEADOR CRÍTICO

`next-pwa@5.6.0` não tem suporte oficial a Next 15. As opções são:

| Opção | Custo | Risco |
|---|---|---|
| Migrar pra `@ducanh2912/next-pwa` (fork ativo) | ~2h | Baixo — API similar |
| Usar `next-pwa` v6 (beta) | ~1h | Médio — ainda beta |
| Remover PWA temporariamente | ~1h | Família perde install prompt |

**Recomendação:** migrar para `@ducanh2912/next-pwa` que mantém Next 15 e tem API compatível. Confirmar com João antes — mexe em `next.config.mjs` (requer PR).

---

### 5. Turbopack estável — neutro / positivo

Next 15 inclui Turbopack estável para `next dev`. Dev mais rápido. Não há breaking change, mas se scripts de CI ou hooks assumirem webpack no dev, verificar.

---

## Passos de migração (ordem recomendada)

1. **Branch de upgrade**: `upgrade/next-15`
2. **Rodar codemod de params**: `npx @next/codemod@latest next-async-request-api .` — resolve ~90% do item 1 automaticamente
3. **Bump deps**:
   ```bash
   npm install next@15 react@19 react-dom@19 @types/react@19 @types/react-dom@19
   npm install @ducanh2912/next-pwa   # substituir next-pwa
   npm uninstall next-pwa
   ```
4. **Ajustar `next.config.mjs`**: migrar config do PWA pro `@ducanh2912/next-pwa`
5. **Rodar `npm run build`** e corrigir erros de tipo (principalmente `children` implícito)
6. **Testar manualmente**:
   - Login Gil, abrir caixa, criar pedido, ver na cozinha (SSE), marcar pronto, comprovante PDF
   - Instalar PWA no Chrome/Safari e verificar service worker
7. **`npm test` + `npm run test:e2e`** — verde antes de mergear
8. **Deploy em staging** (Coolify com banco novo) antes de produção

---

## Estimativa total

| Etapa | Horas |
|---|---|
| Codemod params | 1–2h |
| Bump deps + ajuste next-pwa | 1h |
| Corrigir erros de tipo | 1–2h |
| Testes manuais SSE + PDF + PWA | 2h |
| Buffer para surpresas | 2h |
| **Total** | **7–9h** |

Janela recomendada: fim de semana sem evento agendado.

---

## Não fazer agora

- Migrar para Server Actions (não há ganho real para este app)
- Adotar `use()` + Suspense (adiciona complexidade sem necessidade)
- Ativar Turbopack em prod (`next start` sempre usa webpack build)
