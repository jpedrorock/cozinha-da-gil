# Plano de upgrade: Next.js 14 → 15

> Doc-only por agora. Atualizar quando houver janela de manutenção sem evento próximo.
>
> Estimativa: 4–6h de trabalho focado. Etapa mais trabalhosa: `params` async (18+ arquivos).

---

## Por que fazer

- Next 14.x acumula CVEs que não afetam o app hoje (sem `remotePatterns`, `rewrites` ou CSP nonces), mas a lista vai crescer.
- React 19 (default no Next 15) traz melhorias de performance em Server Components.
- O codemod oficial cobre ~80% das mudanças automaticamente.

## Por que NÃO fazer agora

- Next 15 requer mudanças em 18+ arquivos de rotas (params async).
- Prisma 6.x já é compatível — essa parte não bloqueia.
- Fazer em véspera de evento é proibido (PLAYBOOK.md).

---

## Breaking changes que afetam este projeto

### 1. `params` e `searchParams` viram Promises (obrigatório)

Em Next 15, `params` e `searchParams` passados a Page e Route Handlers são `Promise<...>`.

**Arquivos afetados (18 arquivos):**

| Arquivo | Mudança |
|---------|---------|
| `app/comprovante/[id]/page.tsx` | `params: { id: string }` → `params: Promise<{ id: string }>` + `await` |
| `app/api/orders/[id]/route.ts` | idem |
| `app/api/orders/[id]/items/route.ts` | idem |
| `app/api/orders/[id]/notify-ready/route.ts` | idem |
| `app/api/users/[id]/route.ts` | idem |
| `app/api/customers/[id]/route.ts` | idem |
| `app/api/customers/[id]/broadcast-log/route.ts` | idem |
| `app/api/uploads/products/[filename]/route.ts` | idem |
| `app/api/promotions/[id]/route.ts` | idem |
| `app/api/products/[id]/route.ts` | idem |
| `app/api/products/[id]/sizes/route.ts` | idem |
| `app/api/products/[id]/sizes/[sizeId]/route.ts` | idem (dois params: `id` + `sizeId`) |
| `app/api/ingredients/[id]/route.ts` | idem |

**Padrão de migração por arquivo:**

```ts
// ANTES (Next 14)
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  ...
}

// DEPOIS (Next 15)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  ...
}
```

O codemod `npx @next/codemod@latest next-async-request-api .` cobre isso automaticamente para Route Handlers e Pages.

### 2. Fetch caching invertido

Em Next 14, `fetch()` em Server Components faz cache por padrão (`force-cache`). Em Next 15, o default é `no-store`.

**Afeta este projeto?** Todas as rotas relevantes já usam `export const dynamic = "force-dynamic"` — não afeta. O único ponto a verificar é se algum Server Component faz fetch externo sem `dynamic` explícito.

**Verificar:**
```bash
grep -rn "fetch(" app/ --include="*.tsx" --include="*.ts" | grep -v "use client\|api/" | grep -v "node_modules"
```

### 3. React 19 por padrão

Next 15 usa React 19. As mudanças que podem afetar este app:

- `useFormState` → `useActionState` (renomeado). Não usamos `useFormState` — OK.
- Refs como props (sem `forwardRef`). Não usamos `forwardRef` ativamente — OK.
- Strict Mode duplo-render em dev (já habilitado). Sem efeito colateral conhecido.

### 4. `<Image>` — `layout` prop removida

Não usamos a prop `layout` em nenhuma `<Image>` — OK.

### 5. Turbopack estável (dev server)

Next 15 usa Turbopack por padrão no `next dev`. Pode mudar comportamento de hot-reload.

**Ação:** testar `npm run dev` após upgrade e verificar se SSE, PWA dev mode, e uploads continuam funcionando.

---

## Passos de migração

```bash
# 1. Bump da versão
npm install next@15 react@19 react-dom@19

# 2. Codemod official (cobre params async + outras mudanças)
npx @next/codemod@latest upgrade latest

# 3. Verificar TypeScript
npm run lint
npx tsc --noEmit

# 4. Testes
npm test
npm run test:e2e

# 5. Build completo
npm run build

# 6. Smoke test local
npm start
# Testar: atendente → criar pedido → cozinha recebe → fechar caixa → comprovante
```

---

## Riscos por área

| Área | Risco | Mitigação |
|------|-------|-----------|
| SSE (`app/api/sse/`) | Turbopack pode mudar comportamento de streaming | Testar `test:e2e` fluxo completo |
| Auth (iron-session) | Cookie/session API não muda em Next 15 | Baixo risco |
| Prisma | Compatível com Next 15 desde Prisma 5.x | OK (já em 6.x) |
| PWA (next-pwa) | `next-pwa` pode precisar atualização | Checar releases do `next-pwa` antes |
| Comprovante (PDFKit) | Não depende de Next diretamente | Baixo risco |

---

## Estimativa de horas

| Etapa | Horas |
|-------|-------|
| Bump + codemod | 0,5h |
| Revisão manual dos 18 arquivos de params | 1,5h |
| Fix de TypeScript e lint | 0,5h |
| Testes + smoke test | 1h |
| Buffer / surpresas | 1h |
| **Total** | **~4,5h** |

---

## Quando fazer

- Sem evento nos próximos 7 dias (margem de segurança).
- Sessão presencial (João disponível pra revisar PR antes de fechar).
- Abrir PR separado, não commitar direto em main.
- Testar com `dev.db` de staging (não o arquivo de produção da barraca).
