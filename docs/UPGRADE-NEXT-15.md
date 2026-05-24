# Plano de Upgrade: Next.js 14 → 15

> Doc-only por enquanto. Executar quando João liberar janela. Sem evento agendado próximo.
>
> Última revisão: 2026-05-24 por `claude-pastel`

---

## Por que fazer

Next.js 14.x acumula CVEs na faixa de fetch caching e `rewrites`. Nenhuma aplica ao app hoje (não usamos `remotePatterns`, `rewrites`, nem CSP nonces), mas o número vai crescer. Melhor migrar numa janela tranquila do que em véspera de evento.

---

## Breaking changes relevantes para este app

### 1. `params` e `searchParams` viraram Promise (impacto: **alto**)

Em Next.js 15, `params` e `searchParams` recebidos por pages e route handlers são agora `Promise`. Acesso direto quebra sem `await`.

**Antes (Next 14):**
```typescript
// app/api/orders/[id]/route.ts
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = Number.parseInt(params.id, 10);
  // ...
}
```

**Depois (Next 15):**
```typescript
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number.parseInt(rawId, 10);
  // ...
}
```

### 2. `cookies()` e `headers()` viraram async (impacto: **baixo — já ok**)

`lib/session.ts` já faz `await cookies()` desde a refatoração recente. Nenhuma mudança necessária nesse arquivo.

### 3. `fetch` não é mais cacheado por default (impacto: **baixo**)

Next.js 14 cacheava `fetch` por default (opt-out com `cache: 'no-store'`). Next.js 15 inverte: sem cache por default, opt-in com `cache: 'force-cache'`.

Este app usa `dynamic = "force-dynamic"` em todos os route handlers, então nenhum fetch interno sofre. Afeta apenas se alguém adicionar fetch a Server Components sem especificar cache.

### 4. `serverComponentsExternalPackages` renomeado (impacto: **baixo — 1 linha**)

Em `next.config.mjs`, a chave `experimental.serverComponentsExternalPackages` foi movida para `serverExternalPackages` no topo do config (fora de `experimental`).

**Antes:**
```js
experimental: {
  serverComponentsExternalPackages: ["pdfkit"],
},
```

**Depois:**
```js
serverExternalPackages: ["pdfkit"],
```

> ⚠️ `next.config.mjs` requer PR por regra do PLAYBOOK — não alterar direto.

### 5. React 19 por default (impacto: **médio**)

Next.js 15 usa React 19 RC ou estável dependendo da versão. Principais mudanças visíveis neste app:

- `useFormStatus` e `useOptimistic` movidos de `react-dom` pra `react` — não usamos hoje.
- `ref` como prop direta em componentes funcionais (sem `forwardRef`) — não afeta imediatamente.
- Hidratação mais estrita: erros que eram warnings no React 18 viram erros no 19. Pode revelar bugs latentes.

### 6. Turbopack estável (impacto: **baixo**)

`next dev --turbo` agora é equivalente ao webpack. Sem breaking change, mas pode alterar tempos de build e comportamento de cache.

---

## Arquivos com risco confirmado

| Arquivo | Problema | Esforço |
|---------|----------|---------|
| `app/comprovante/[id]/page.tsx` | `params.id` sem await | 5min |
| `app/api/orders/[id]/route.ts` | `params.id` sem await (PATCH) | 5min |
| `app/api/orders/[id]/items/route.ts` | `params.id` sem await | 5min |
| `app/api/orders/[id]/notify-ready/route.ts` | `params.id` sem await | 5min |
| `app/api/products/[id]/route.ts` | `params.id` sem await | 5min |
| `app/api/products/[id]/sizes/route.ts` | `params.id` sem await | 5min |
| `app/api/products/[id]/sizes/[sizeId]/route.ts` | `params.id` + `params.sizeId` sem await | 5min |
| `app/api/users/[id]/route.ts` | `params.id` sem await | 5min |
| `app/api/customers/[id]/route.ts` | `params.id` sem await | 5min |
| `app/api/customers/[id]/broadcast-log/route.ts` | `params.id` sem await | 5min |
| `app/api/promotions/[id]/route.ts` | `params.id` sem await | 5min |
| `app/api/ingredients/[id]/route.ts` | `params.id` sem await | 5min |
| `app/api/uploads/products/[filename]/route.ts` | `params.filename` sem await | 5min |
| `next.config.mjs` | `serverComponentsExternalPackages` → `serverExternalPackages` | 2min |
| `lib/session.ts` | ✅ já ok — `await cookies()` | — |

**Total estimado:** 13 arquivos × ~5min = ~70min de edição pura + ~2h de teste/validação = **~3–4h no total**.

---

## Passos de migração

1. **Criar branch `upgrade/next-15`** — nunca mexer em main direto.

2. **Bump deps:**
   ```bash
   npm install next@15 react@19 react-dom@19
   npm install --save-dev @types/react@19
   ```
   Verificar peerDeps: `next-pwa`, `iron-session`, `@prisma/client`, `lucide-react`.

3. **Corrigir `next.config.mjs`** (requer PR):
   - Mover `serverComponentsExternalPackages` pra fora de `experimental`.
   - Verificar se `next-pwa` tem versão compatível com Next 15.

4. **Atualizar todos os route handlers com `params`:**
   - Busca: `grep -r "{ params }: { params: {" app/`
   - Para cada um: `params` vira `Promise<{...}>`, acesso vira `await params`.

5. **Rodar build local:**
   ```bash
   npm run build
   ```
   Observar warnings/erros de hidratação React 19.

6. **Rodar testes:**
   ```bash
   npm test
   npm run test:e2e
   ```

7. **Testar manualmente os 4 papéis** (atendente, cozinha, cliente, admin) antes de mergear.

---

## Riscos adicionais

- **`next-pwa`**: última versão testada com Next 14. Verificar se há versão compatível com Next 15 antes de mergear. Se não houver, avaliar alternativa (`@ducanh2912/next-pwa`).
- **iron-session**: depende de `next/headers` internamente — verificar compatibilidade com a versão nova.
- **PDFKit + `serverExternalPackages`**: a renomeação pode fazer o build falhar em silêncio se esquecer de atualizar.

---

## Quando executar

- ✅ Sem evento nos próximos 7 dias
- ✅ PR #4 (backup) já mergeado
- ✅ Suite e2e completa passando (inclusive `order-flow.spec.ts`)
- ✅ João disponível para review do PR
