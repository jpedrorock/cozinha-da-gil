# Upgrade Plano — Next 14 → 15

> **Status:** ✅ **EXECUTADO 2026-05-28** na branch `claude-pastel/next15-pwa` (PR). Abaixo vira registro do que foi feito.
> **Última revisão:** 2026-05-22 — Next 14.2.35 atual, Next 15.x latest.

---

## ✅ Execução (2026-05-28) — `claude-pastel/next15-pwa`

**Feito:**
- `next` 14.2.35 → **15.5.18**; `react`/`react-dom` 18 → **19.2.6**; `eslint-config-next` → 15.5.18; `@types/react(-dom)` → 19.
- `next-pwa@5.6` → **`@ducanh2912/next-pwa@10.2.9`**. Config migrada: `runtimeCaching` + `skipWaiting:false` → dentro de `workboxOptions`; `serverExternalPackages` (pdfkit) na raiz; **`fallbacks: { document: "/offline" }` reativado** (bug do 5.6 sumiu no fork).
- Codemod oficial `next-async-request-api` aplicado nas **14 rotas dinâmicas** (`params` → `Promise<>` + `await`). Padrão `const params = await props.params`.
- Override `serialize-javascript@7.0.5` pra fechar a vuln **high** do `workbox-build`.

**Validação:** `tsc` 0 erros · `eslint` limpo · `vitest` 163/163 · `next build` OK · **e2e 12/12 em `npm run dev`** · SW gerado correto (precache `/offline`, `self.skipWaiting()` só via msg `SKIP_WAITING` → `PWAUpdatePrompt` intacto).

**Residual (não-bloqueante):** `npm audit` caiu de **10 (9 high) → 3 moderate**. As 3 restantes são `postcss@8.4.31` **interno do Next** (advisory de XSS no stringify de CSS — build-time, input confiável: nosso próprio CSS). Não forçadas via override porque mexer no postcss interno do Next é arriscado pra ~zero ganho prático. Some quando o Next bumpar o postcss bundlado.

**Pendente de teste manual antes do merge em prod (§4.8):** instalar a PWA no celular + abrir offline (testar splash + cache + fallback `/offline`); SSE cross-screen (3 abas, criar pedido, ver propagar). E2E de UI roda só em `npm run dev` (em build de prod o service worker derruba os testes de `auth.spec.ts` — conhecido).

---

## 1. Por que considerar o upgrade

- **Patches de segurança**: 10 CVEs reportadas em Next 14.x. A maioria **não aplica ao nosso código** (sem `remotePatterns`, sem `rewrites`, sem middleware redirects, sem CSP nonces, sem `beforeInteractive` scripts). Mas acumulam.
- **React 19 ganhos**: melhores hooks (`useOptimistic`, `useFormStatus`), Server Actions estabilizadas, performance.
- **Instrumentation estável**: nosso `instrumentation.ts` (backup-scheduler) deixa de precisar de `experimental.instrumentationHook: true`.
- **Turbopack** como default em dev — build local 2-3x mais rápido.

## 2. Por que NÃO fazer ainda

- **Quebra real esperada em ~14 arquivos** (ver §3). Não dá pra fatiar — é all-or-nothing.
- **next-pwa@5.6 NÃO suporta Next 15 oficialmente** (último release 2024). Tem fork mantido (`@ducanh2912/next-pwa`) que suporta, mas migração precisa testar PWA inteiro de novo.
- **App tá em uso real pela família** — janela de teste pré-upgrade obrigatória.
- **Sem CI/CD bonito** — quebra = `git revert` manual + redeploy Coolify.

---

## 3. Breaking changes que afetam ESTE repo

### 3.1 `params` virou `Promise<>` em routes API e pages

**Mudança:** segundo argumento dos handlers de route + prop `params` em pages async dynamic = `Promise<{...}>` em vez de `{...}` direto.

**Codemod faz tudo:** `npx @next/codemod@canary upgrade latest` adiciona `await` nos sites.

**Arquivos afetados** (14 — todos sob `app/api/*/[id]/route.ts` + 1 page):

```
app/api/customers/[id]/route.ts                            (3 handlers)
app/api/customers/[id]/broadcast-log/route.ts              (1 handler)
app/api/ingredients/[id]/route.ts                          (1 handler)
app/api/orders/[id]/route.ts                               (1 handler)
app/api/orders/[id]/items/route.ts                         (1 handler)
app/api/orders/[id]/notify-ready/route.ts                  (1 handler)
app/api/products/[id]/route.ts                             (2 handlers)
app/api/products/[id]/sizes/route.ts                       (1 handler)
app/api/products/[id]/sizes/[sizeId]/route.ts              (2 handlers)
app/api/promotions/[id]/route.ts                           (2 handlers)
app/api/uploads/products/[filename]/route.ts               (1 handler — GET)
app/api/users/[id]/route.ts                                (2 handlers)
app/comprovante/[id]/page.tsx                              (1 page)
```

**Padrão de mudança:**

```diff
- export async function PATCH(
-   request: Request,
-   { params }: { params: { id: string } },
- ) {
-   const id = params.id;
+ export async function PATCH(
+   request: Request,
+   { params }: { params: Promise<{ id: string }> },
+ ) {
+   const { id } = await params;
```

**Risco:** baixo se codemod rodar tudo. Médio se algum handler tiver multi-step early returns ou destructuring complexo (revisar manualmente).

### 3.2 `cookies()` / `headers()` async

**Status no nosso código:** `lib/session.ts:36` **já tá** com `await cookies()`. Sem trabalho extra.

### 3.3 `serverComponentsExternalPackages` renomeado

**Mudança:** vira `serverExternalPackages` direto na raiz do `next.config` (não mais sob `experimental`).

**Arquivo:** `next.config.mjs`

```diff
- experimental: {
-   serverComponentsExternalPackages: ["pdfkit"],
-   instrumentationHook: true,
- },
+ serverExternalPackages: ["pdfkit"],
+ // instrumentationHook não precisa mais — estável em Next 15
```

### 3.4 fetch caching default invertido

**Antes (14):** `fetch()` no Server Component cacheia por default (`force-cache`).
**Agora (15):** `fetch()` no Server Component **não** cacheia (`no-store`).

**Nosso impacto:** ZERO. As pages SSR usam `prisma.*` direto (não fetch), e os `fetch()` no client são pra mutations (sempre `no-store` explícito).

Confirmação: `grep -rn "fetch(" app/` — 47 chamadas em 6 arquivos, todas client-side com `cache: "no-store"` explícito.

### 3.5 `next-pwa` incompatibilidade

**Problema:** `next-pwa@5.6.0` não recebeu updates pra Next 15. Build pode falhar ou SW gerado pode ter regressões.

**Solução:** migrar pra `@ducanh2912/next-pwa` (fork mantido, mesma API).

```bash
npm uninstall next-pwa
npm install @ducanh2912/next-pwa
```

E em `next.config.mjs`:
```diff
- import withPWA from "next-pwa";
+ import withPWA from "@ducanh2912/next-pwa";
```

**Risco:** médio. Testar PWA install + offline cache + SSE através do SW depois.

### 3.6 React 19

**APIs que mudaram (não usamos):**
- `forwardRef` deprecado pra novos componentes. ❌ Não usamos.
- `useFormState` → `useActionState`. ❌ Não usamos.
- `experimental_useFormState` → `useActionState`. ❌ Não usamos.
- Refs como prop direta (não precisa mais forwardRef). ✅ Bem-vindo, nada quebra.

**Tipos:**
- `@types/react` precisa subir pra `^19`. `npm install @types/react@^19 @types/react-dom@^19`.
- Pequenas mudanças em tipos (ex: `ReactElement<P, T>` agora exige props explicit em alguns lugares). Codemod resolve.

**Risco:** baixo se nosso código não usa APIs deprecadas.

---

## 4. Ordem de migração sugerida

1. **Branch dedicada**: `claude-pastel/next-15-upgrade`
2. **Snapshot do estado**: rodar `npm test` + `npm run build` em main pra ter baseline verde
3. **Codemod oficial**:
   ```bash
   npx @next/codemod@canary upgrade latest
   ```
   Aceita "yes" em tudo — vai bumpar `next`, `react`, `react-dom`, `eslint-config-next`, e aplicar transformações de código.
4. **next-pwa fork**:
   ```bash
   npm uninstall next-pwa
   npm install @ducanh2912/next-pwa
   ```
5. **Manual review** dos arquivos do §3.1 — confirmar codemod acertou tudo (especialmente os com 2+ handlers).
6. **next.config.mjs**: aplicar §3.3 (mover `serverExternalPackages`).
7. **Testes**:
   - `npx tsc --noEmit` — esperar 5-15 errors residuais, fixar manual
   - `npx eslint .` — pode aparecer regra nova, ajustar
   - `npm test` — vitest deve passar
   - `npm run build` — esperar 1-2 warnings novos
   - `npm run dev` — abrir todas as rotas e clicar em tudo
8. **Teste manual da PWA**:
   - Build prod → instalar no celular → abrir offline → testar splash + cache
   - SSE: abrir 3 abas (atendente + cozinha + admin), criar pedido, ver propagando
9. **Deploy**:
   - PR no GitHub
   - Mergear em horário de baixa atividade (madrugada)
   - Coolify rebuilda — monitorar logs por 10min
   - Smoke test em prod: login Gil → abrir caixa → fazer pedido teste → cancelar

## 5. Estimativa de tempo

| Etapa | Tempo |
|-------|-------|
| Codemod + manual review (§3.1) | 45min |
| next-pwa migration + teste PWA | 60min |
| Testes locais completos (§3.7) | 30min |
| Teste manual cross-screen | 30min |
| PR + review + deploy + smoke test | 30min |
| **Total** | **~3-4h** |

Adicionar **buffer de 50%** pra surpresas (especialmente next-pwa). Total realista: **~5-6h** numa tarde dedicada.

## 6. Rollback plan

Se algo der ruim em prod:

```bash
# No Coolify, voltar pro último deploy bem-sucedido (1 clique)
# OU manualmente:
git revert <commit-do-merge>
git push origin main
# Coolify rebuilda automaticamente
```

Volume Coolify (`/app/data`) não é afetado por upgrade de versão — só código. Dados de venda/cliente intactos mesmo se rollback for full.

## 7. Quando fazer?

**Gatilhos pra agendar:**
- Janela de pelo menos uma semana SEM evento programado na barraca
- Nova CVE no Next 14 que aplique aos patterns que usamos (raro)
- Necessidade de feature do Next 15+ (ex: Server Actions mais maduras)

**NÃO fazer:**
- Em véspera de evento (mesmo P0)
- Sem ter `dev.db` backup atualizado (PR #4 garante isso)
- Sem tempo de pelo menos 1 dia pra revisar/testar/deploy

---

## 8. Apêndice — comando completo do codemod oficial

```bash
# Tudo de uma vez (sobe pra latest 15.x, aplica transformações,
# bumpa react/react-dom, atualiza eslint-config-next)
npx @next/codemod@canary upgrade latest

# Se quiser CONTROLE manual de quais transformações aplicar:
npx @next/codemod@canary next-async-request-api .
npx @next/codemod@canary metadata-to-viewport-export .
npx @next/codemod@canary built-in-next-font .
```

Lista completa de codemods: https://nextjs.org/docs/app/building-your-application/upgrading/codemods
