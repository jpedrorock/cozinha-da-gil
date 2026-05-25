# Plano de Upgrade: Next 14 → 15

> Doc-only — nenhuma mudança de código aqui. Serve como roadmap quando João abrir janela de upgrade.
> Criado em: 2026-05-25 | Status: planejado, não iniciado

---

## Por que fazer

Next 14.x acumula CVEs declaradas (ver `npm audit`) que não se aplicam aos patterns atuais do app (sem `remotePatterns`, sem `rewrites`, sem CSP nonces), mas eventualmente acumularão. Next 15 traz React 19 e melhoras de performance (Turbopack estável, compilação parcial).

**Urgência:** baixa. Não há vuln ativa que afete o app. Agendar quando tiver evento sem data próxima e testes e2e verdes.

---

## Breaking changes que afetam este projeto

### 1. `params` e `searchParams` viram Promises (IMPACTO ALTO)

Em Next 15, todos os `params` de Route Handlers e Page Components são `Promise`:

**Antes (Next 14):**
```ts
// app/api/orders/[id]/route.ts
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const id = params.id; // síncrono
}
```

**Depois (Next 15):**
```ts
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params; // precisa await
}
```

**Arquivos afetados (13):**

| Arquivo | Handlers | Params |
|---------|----------|--------|
| `app/api/users/[id]/route.ts` | GET, DELETE | `id` |
| `app/api/orders/[id]/route.ts` | GET, PATCH | `id` |
| `app/api/orders/[id]/items/route.ts` | POST | `id` |
| `app/api/orders/[id]/notify-ready/route.ts` | POST | `id` |
| `app/api/customers/[id]/route.ts` | GET, PATCH, DELETE | `id` |
| `app/api/customers/[id]/broadcast-log/route.ts` | GET | `id` |
| `app/api/uploads/products/[filename]/route.ts` | GET | `filename` |
| `app/api/promotions/[id]/route.ts` | PATCH, DELETE | `id` |
| `app/api/products/[id]/route.ts` | PATCH, DELETE | `id` |
| `app/api/products/[id]/sizes/route.ts` | GET, POST | `id` |
| `app/api/products/[id]/sizes/[sizeId]/route.ts` | PATCH, DELETE | `id`, `sizeId` |
| `app/api/ingredients/[id]/route.ts` | DELETE | `id` |
| `app/comprovante/[id]/page.tsx` | — (page) | `id` |

**Estratégia:** o Next fornece codemod oficial para isso:
```bash
npx @next/codemod@canary next-async-request-api .
```
Rodar na raiz do repo, revisar diff, rodar `npm test` depois.

---

### 2. `cookies()` e `headers()` — já OK

`lib/session.ts:36` já usa `await cookies()` (padrão async).
Nenhuma mudança necessária aqui.

---

### 3. Fetch caching invertido (IMPACTO BAIXO)

Next 14: `fetch()` é cached por default (como `cache: 'force-cache'`).
Next 15: `fetch()` não é cached por default (como `cache: 'no-store'`).

Para este app: todos os `fetch()` em Client Components (`AtendenteClient.tsx`, `CozinhaClient.tsx`, `AdminClient.tsx`) já são chamadas de API que intencionalmente não devem ser cached. O comportamento em Next 15 fica mais correto por default.

**Verificar:** se algum Server Component fizer `fetch()` esperando cache, vai quebrar silenciosamente (dados desatualizados não, dados re-fetchados a cada render — impacto é performance, não corretude). Hoje não há Server Components com fetch custoso, então baixo risco.

---

### 4. `serverComponentsExternalPackages` renomeado (IMPACTO BAIXO)

Em `next.config.mjs` linha 62:
```js
// Antes (Next 14):
experimental: {
  serverComponentsExternalPackages: ["pdfkit"],
}

// Depois (Next 15):
serverExternalPackages: ["pdfkit"],  // saiu do experimental, virou raiz
```

**Arquivo:** `next.config.mjs` (requer PR — vide PLAYBOOK).

---

### 5. `next-pwa` v5.6 não suporta Next 15 (IMPACTO ALTO)

`next-pwa` v5.6 (Workbox-based) não é compatível com Next 15 / Turbopack. Opções:

**Opção A — `@ducanh2912/next-pwa`** (fork ativo do next-pwa, drop-in replacement):
```bash
npm remove next-pwa
npm install @ducanh2912/next-pwa
```
Mudança em `next.config.mjs`: `import nextPWA from "@ducanh2912/next-pwa"`.
Config `runtimeCaching` permanece idêntica. Risco: baixo.

**Opção B — `@serwist/next`** (mais moderno, mais config):
Requer reescrever a config. Risco: médio. Documentação: serwist.pages.dev.

**Recomendação:** Opção A (drop-in). Testar PWA após upgrade: `npm run build && npm start`, instalar no celular e verificar service worker no DevTools.

**Arquivo afetado:** `next.config.mjs` (requer PR).

---

### 6. React 18 → 19 (IMPACTO BAIXO a MÉDIO)

Next 15 usa React 19 por default. Principais mudanças que podem afetar este app:

- **`forwardRef` deprecated** — refs agora são props diretas. Nenhum componente no projeto usa `forwardRef` atualmente (verificado em 2026-05-25).
- **`use()` hook** — novo hook para Promises. Não afeta código existente.
- **Context providers** — `<Context>` em vez de `<Context.Provider>`. Nenhum context customizado neste projeto.
- **Hydration errors mais verbosos** — podem revelar bugs existentes de mismatch server/client.

**Ação:** rodar `npm run build` e observar warnings de deprecation no output.

---

### 7. ESLint 9 flat config (IMPACTO BAIXO)

Next 15 recomenda ESLint 9 com flat config (`eslint.config.mjs` em vez de `.eslintrc.json`). Não é obrigatório — ESLint 8 ainda funciona via compat layer.

**Adiar** até que o time queira atualizar o tooling de lint separadamente.

---

## Passos de migração

Execute nessa ordem:

```
1. [ ] Criar branch: git checkout -b upgrade/next-15
2. [ ] npm install next@15 react@19 react-dom@19 eslint-config-next@15
3. [ ] npm remove next-pwa && npm install @ducanh2912/next-pwa
4. [ ] next.config.mjs:
       - Trocar import de next-pwa para @ducanh2912/next-pwa
       - Mover serverComponentsExternalPackages para serverExternalPackages (raiz)
5. [ ] npx @next/codemod@canary next-async-request-api . (codemod params async)
6. [ ] Revisar diff do codemod (foco: app/api/**/ e app/comprovante/)
7. [ ] npm run lint (corrigir warnings novos)
8. [ ] npm test (57 testes devem passar)
9. [ ] npm run test:e2e (fluxo completo de pedido)
10. [ ] npm run build (verificar warnings React 19)
11. [ ] npm start + testar PWA no celular (service worker)
12. [ ] Abrir PR com checklist de testes
```

---

## Estimativa de horas

| Etapa | Horas |
|-------|-------|
| Troca de deps + config (steps 2–4) | 0,5h |
| Codemod + revisão (steps 5–6) | 1h |
| Fix de lint/type-check (step 7) | 0,5–1h |
| Testes e debug (steps 8–11) | 1–2h |
| PWA smoke test em celular real | 0,5h |
| **Total estimado** | **3,5–5h** |

Risco de surpresa: baixo. A mudança mais trabalhosa (params async) tem codemod oficial. O maior wild-card é o PWA — `@ducanh2912/next-pwa` tem comportamento ~idêntico, mas testar em device real é obrigatório antes de ir pra evento.

---

## Pré-requisito antes de iniciar

- [ ] PR #4 (backup automático) mergeado e rodando em produção
- [ ] Testes e2e cobrindo fluxo completo de pedido (item BACKLOG: E2E Playwright)
- [ ] Nenhum evento nos próximos 7 dias após o upgrade (janela de rollback)
