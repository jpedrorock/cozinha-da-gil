# BACKLOG — Pastel da Gil

> Fila priorizada de trabalho. O comando `/trabalhar` puxa daqui de cima pra baixo.

**Convenção de prefixos:**
- `[P0]` — quebrado em produção / bloqueia evento próximo
- `[P1]` — alta prioridade (fechar fase atual)
- `[P2]` — útil, pode esperar
- `[P3]` — ideia / nice-to-have

**Convenção de tags:**
- `#atendente` `#cozinha` `#cliente` `#admin` — fluxo afetado
- `#api` — rotas `app/api`
- `#sse` — server-sent events (real-time)
- `#db` — Prisma schema, migrations, seed
- `#auth` — iron-session, login, papéis
- `#pwa` — service worker, manifest, install
- `#impressora` — impressora térmica, comprovante PDF
- `#test` — Vitest unit ou Playwright e2e
- `#docs` — markdown
- `#chore` — manutenção, refactor, deps
- `#evento` — preparação direta pra um evento específico

---

## 🔥 Em progresso

_Idealmente 0–1 item por vez nesse repo (single-Claude)._

- [ ] **[P1] #chore** Backup automático do `dev.db` no volume Coolify — **PR #4 aberto, aguardando merge** [claude-pastel 2026-05-22]
- [ ] **[P2] #chore #pwa** Migração Next 14 → 15 + `@ducanh2912/next-pwa` — **PR aberto (branch `claude-pastel/next15-pwa`), aguardando review + teste manual de PWA/SSE em device** [claude-pastel 2026-05-28]
  - Feito + validado: next 15.5.18, react 19.2.6, fork PWA, codemod async params (14 rotas), override serialize-javascript. tsc/lint/163 testes/build/12 e2e em dev verdes. `fallbacks: /offline` reativado. `npm audit` 10 (9 high) → 3 moderate (postcss interno do Next, build-time, não-bloqueante).
  - Antes do merge em prod: teste manual da PWA (install/offline/splash) + SSE 3 abas (§4.8 de `docs/UPGRADE-NEXT-15.md`). Rollback: Coolify 1-clique ou `git revert`.

---

## ⏭️ Próximos (prontos pra executar)

### Pós-Fase 7 — manutenção

- [ ] **[P3] #chore #docs** Bookkeeping pós-merge de Fase 7
  - **Pronto quando:** depois dos PRs #4/#30/#31 mergearem: `docs/FASE-7.md` marca #1 e #4 como ✅; `STATUS.md` reflete Fase 7 completa + Next 15 em prod + módulos atualizados; `BACKLOG.md` "Em progresso" zerado.
  - **Autonomia:** OK fazer direto.

- [ ] **[P3] #chore #infra** Limpar 4 branches `routine-pastel-*` obsoletas
  - **Pronto quando:** branches geradas pela routine durante a sessão de 2026-05-29 deletadas do origin (mesma classificação log-only/superseded da limpeza de 27/05).
  - **Autonomia:** **Confirmar antes** (op destrutiva em refs).

### A11y

- [ ] **[P2] #a11y** Auditoria de acessibilidade WCAG 2.1 AA — primeira dedicada
  - **Pronto quando:** `docs/AUDIT-A11Y-2026.md` cobrindo contraste (cliente TV em sol forte), touch targets (atendente em tablet), navegação por teclado (admin desktop), labels/roles ARIA, foco visível. Lista de issues priorizada.
  - **Contexto:** app é internet-facing com display público (cliente TV). UX audits foram feitas; a11y dedicada nunca. Skill `accessibility-review` existe.
  - **Autonomia:** OK fazer direto (relatório, não muda código).

### PWA

---

## 🔮 Backlog (precisa refinar antes de executar)

_Itens com critério vago OU bloqueados por dependência externa._

- [ ] **[P2] #impressora** Comprovante térmico — checar margens / overflow com impressora real
  - **Blocked:** precisa impressora térmica 80mm pra testar. Hoje `@page size: 80mm auto; margin: 0` + CSS print rules já está implementado em `app/comprovante/[id]/ComprovanteClient.tsx`. Sem hardware, não dá pra confirmar se algo corta.
  - **Próximo passo quando hardware existir:** imprimir 5 pedidos variados (curto/longo, com/sem nota, com/sem promo) → verificar se nome cliente longo, lista grande de toppings ou rodapé do total cortam → ajustar `max-width`/`padding` específicos.

- [ ] **[P3] #pwa #sw** Reativar `fallbacks: { document: "/offline" }` quando migrar pro `@ducanh2912/next-pwa`
  - **Blocked:** depende da migração de `next-pwa@5.6.0` → `@ducanh2912/next-pwa` (plano em `docs/UPGRADE-NEXT-15.md`). Hoje next-pwa@5.6.0 tem bug que quebra build com runtimeCaching customizado + fallbacks; `/offline` existe mas só serve navegação manual.
- [ ] **[P3] #pwa #admin** Cachear `api.iconify.design` no Service Worker pra ícones já vistos renderizarem offline
  - **Pronto quando:** `next.config.mjs` ganha regra de runtimeCaching `CacheFirst` (ou `StaleWhileRevalidate`) pro domínio `api.iconify.design`; após visitar admin Cardápio com wifi e voltar pra revisitar offline, os ícones já vistos no IconPicker e nas linhas de ingrediente renderizam normalmente.
  - **Contexto:** Hoje sem rede o `<Icon icon="...">` do `@iconify/react` exibe placeholder vazio (fetch falha no client). Esse cache deixa "memória" dos ícones vistos. PR conforme PLAYBOOK (mexe em PWA config).
  - **Autonomia:** Abrir PR.

- [ ] **[P3] #chore #infra** Apontar health check do `docker-compose.yml` pra `/api/health` em vez de `/`
  - **Pronto quando:** linha do healthcheck no docker-compose.yml usa `wget --spider http://localhost:3000/api/health` em vez de `/`; Coolify (que reusa o docker-compose) passa a detectar DB caído via 503 e reinicia container.
  - **Contexto:** PR conforme PLAYBOOK (mexer em docker-compose.yml é PR). Trivial mas precisa revisão de janela.
  - **Autonomia:** Abrir PR.

- [ ] **[P3] #auth** (idea — baixa prio) Login desambiguar por nome quando PIN duplicado em vez de travar 409
  - **Contexto:** o incidente de 27/05 (Gil + João admin mesmo PIN) travou com 409 cego — admin não conseguia entrar pra corrigir. Prevenção na CRIAÇÃO de user já existe (POST/PATCH validam via `isPinDuplicateInRole`), então duplicata só surge de users legados (pré-validação) ou de mudança de role sem reenviar senha (gap conhecido no PATCH linha 60-62). Decisão consciente 27/05: NÃO implementar agora — caso é raro e o código atual previve no caminho normal. SE voltar a acontecer: quando login acha N>1 matches, retornar `{ ambiguous: true, names: [...] }` e a UI mostra "qual é você?" pra desambiguar (em vez de 409). Resolve o catch-22 do admin travado.

---

## ✅ Concluídos recentemente

### 2026-05-29
- [claude-pastel 2026-05-29] **[P3] Smoke test em prod pós-Next 15** — `/api/health` retorna 200 com `dbOk:true, problems:[], dbLatencyMs:2`; todas as rotas chave (`/`, `/atendente`, `/cliente`, `/admin`, `/api/products`, `/api/sse`, `/manifest.webmanifest`) respondem 200; `uptimeSec:46` confirma que Coolify acabou de subir o deploy do Next 15. **Detalhe operacional:** o response mostra um **caixa órfão** aberto desde 28/05 (`"Teste Fred"`, Gil) — `isStaleEventSession` deve estar mostrando banner pra Gil fechar.
- [claude-pastel 2026-05-29] **[P3] Reavaliação Background Sync pós-Fase 7** — `docs/BACKGROUND-SYNC.md` ganhou seção "Reavaliação 2026-05-29". O que mudou desde 22/05: (1) idempotency-key já em prod (mitiga risco #1 de duplicata), (2) app migrou pra cloud (Coolify) — condição "Quando reconsiderar" #4 já aconteceu, (3) PWA agora em `@ducanh2912/next-pwa@10` com Workbox moderno (`BackgroundSyncPlugin` disponível). **Decisão revisada: continuar fora de escopo**, mas gatilho ficou mais sensível (construir se Gil reportar pedido sumido em >1 evento, ou se ganhar múltiplos atendentes / auto-pedido cliente). Esforço pra construir caiu pra ~1 dia (em vez de 1-2) porque idempotency está pronto.

### 2026-05-28
- [claude-pastel 2026-05-28] **[P3] #chore Limpeza de 20 branches `routine-pastel-*` obsoletas** — a routine de background criava uma branch por run e nunca limpava. Todas tinham commits não-mergeados, mas o trabalho real já estava no `main` por outro caminho (ex: features da `routine-20260527-1611` estão todas no Concluídos de 27/05) — superseded, não perdido. Confirmado com João antes (op destrutiva em refs não-mergeados). `git push -d` nas 20; origin ficou só com `main` + 4 feature branches.
- [claude-pastel 2026-05-28] **[P2] Security review do PR #23 (migração Next 15)** — skill `security-review` no diff completo (deps major + 14 rotas async params + PWA config + sse-debug). **Nenhuma vuln nova introduzida** (confiança: sub-task de identificação retornou zero candidatos). Async params é byte-a-byte idêntico downstream (validação + `requireRole` intactos); path-traversal dos uploads é pré-existente (lib/uploads.ts não está no diff); regra de cache PWA só mudou de lugar; `sseDebugEnabled` só lê localStorage. Safe to merge.
- [claude-pastel 2026-05-28] **[P3] #chore Gate logs `[SSE-LAT]` do client** — a instrumentação de latência SSE **já existia** (mede lag createdAt→cozinha + tempo de fetch no atendente), mas era `console.log` cru sempre-ligado → spammava o console do navegador em prod. Novo `lib/sse-debug.ts` (`sseDebugEnabled()` via `localStorage["pdg:sse-debug"]`); os 3 logs do client (CozinhaClient x2, AtendenteClient x1) agora são opt-in. Logs server-side (`orders/route.ts`, `lib/sse.ts`) ficam — são stdout/telemetria de ops, não spam. Feito no PR #23 pra não divergir.
- [claude-pastel 2026-05-28] **[P3] #chore Bump `lucide-react` 1.16 → 1.17** — único minor seguro disponível. Feito no PR #23 (evita conflito de `package.json`). tsc/lint/163 testes/build verdes.
- [claude-pastel 2026-05-28] **[P3] #docs Marcar `FASE-6.md` como entregue** — banner "✅ ENTREGUE" no topo (Fase 6 está no schema: Product/ProductSize/Promotion/EventSession/Customer + CRUD dirigido por dados + pricing do banco + bebida bypass + relatórios por evento) e corrigida a nota "pricing.ts vira dead code" (não é — `formatBRL`/`SIZE_LABEL`/`PRICE`/`MAX_TOPPINGS_PEQUENO` seguem usados, cobertos por `tests/pricing.test.ts`). Doc-only. Feito na branch da migração (`claude-pastel/next15-pwa`) pra não divergir do PR #23.
- [claude-pastel 2026-05-28] **[P3] E2E: bypass de bebida** — `e2e/beverage-bypass.spec.ts` (2 testes) cobre a regra `allBebida ? "PRONTO" : "PEDIDO_FEITO"` (`app/api/orders/route.ts`): (1) pedido só de bebida nasce **PRONTO** (pula a cozinha — atendente pega da geladeira); (2) pedido **misto** (pastel + bebida) NÃO bypassa → nasce PEDIDO_FEITO. Via API direta, mesmo padrão robusto do `order-flow.spec.ts`. Caminho tinha perdido cobertura quando o teste de Coca foi trocado por pastel. **E2E 10 → 12** (validado em `npm run dev`; as 4 falhas de `auth.spec.ts` no build de produção são o service worker do next-pwa, não regressão — passam em dev).
- [claude-pastel 2026-05-28] **[P2] Cobertura de testes pra libs puras (hardening)** — 4 novos arquivos, suite 125 → **163** (+38). `tests/event-session-shared.test.ts` (10): `isStaleEventSession` com fake timers — limite 12h exato (>=), 11h/13h, string ISO vs Date, data inválida, futuro, `staleHours` custom. `tests/idempotency.test.ts` (13): roundtrip set/get, miss, expiração TTL 10min (fake timers via `setSystemTime`), preserva status de erro, `isValidIdempotencyKey` (16–64 chars, UUID, regex). `tests/ingredient-i18n.test.ts` (12): `translateForIconSearch` case/acent-insensitive, frase inteira vs palavra-a-palavra, fallback raw, `ICON_CATEGORIES`. `tests/pricing.test.ts` (8): `formatBRL` (normaliza NBSP/NNBSP do Intl), separador de milhar, negativo, `SIZE_LABEL`/`PRICE`/`MAX_TOPPINGS_PEQUENO`. tsc + eslint limpos.

### 2026-05-27
- [claude-pastel 2026-05-27] **5 ajustes de UX (atendente/cozinha/recibo)** — (1) Resumo do atendente: "+ Adicionar outro **pastel**" → "+ Adicionar outro **item**" (vende macarrão/bebida/combo também). (2) "Marcar todos" some no pastel pequeno (legacyMax ≤ 2 não economiza — esconde). (3) **Cozinha smart checklist**: pastel grande adapta — maioria vai → mostra só "Vai tudo, menos: X" (laranja atenção); minoria vai → mostra só os ✓; todos → "Tudo (N)". Ticket nunca infla com 12 toppings riscados. (4) **Drawer "Prontos"** na cozinha: 4º botão na botnav, fetch on-demand dos finalizados de hoje (PRONTO+ENTREGUE), read-only — cook confere sem refazer por engano. (5) **🐛 Fix WhatsApp**: `handleWhatsApp` usava `window.open()` (bloqueado em PWA/popup) → trocado por `<a href>` com `wa.me`. Telefone já vinha normalizado +55; o problema era só o método de abertura.
- [claude-pastel 2026-05-27] **Fix: botão "Sair" na sidebar admin desktop** — no desktop (≥1024px) o admin usa sidebar e o `AppHeader` (que tem o botão trocar-operador/sair) fica `lg:hidden`. Sem isso, Gil logava e ficava presa sem deslogar. Adicionado botão "Sair · {nome}" na sidebar (entre Guia e Recolher) com ConfirmDialog "Sair do admin?". Atendente/cozinha não tinham o bug (usam AppHeader em toda viewport). Cobertura: <lg via AppHeader, ≥lg via sidebar.
- [claude-pastel 2026-05-27] **Cleanup: removido endpoint bootstrap-reset + doc** — tech debt declarado fechado. `app/api/admin/bootstrap-reset/` + `docs/EMERGENCY-RESET.md` deletados (dir `app/api/admin/` ficou vazio, removido também). Endpoint nunca foi usado — incidente resolvido via APIs existentes. Build limpo, sem mais `/api/admin/*` nas rotas. 107/107 testes verdes.
- [claude-pastel 2026-05-27] **Incidente prod resolvido — duplicata de admin causando 409 no login** — debug mostrou 6 users em prod (Gil/admin, **João/admin**, Maria/atendente, Vivi/atendente, "Gil 1"/cozinha, José/cozinha), com Gil + João ambos com PIN 1234. UI moderno manda `{password, role}` sem nome → backend (`/api/auth/login` fluxo sem nome) tenta cada user do role → 2 matches → 409 "PIN duplicado". Resolução via curl direto: login com nome (fluxo legacy `findUnique({where:{name}})`) pega session admin, daí PATCH PIN do Gil pra 2699 + DELETE dos 5 outros users via APIs existentes. Sem precisar de SSH/shell.
- [claude-pastel 2026-05-27] **Screenshots PWA manifest shipados** — `scripts/gen-screenshots.ts` (novo, usa Playwright) gera 3 PNGs 780×1688 em `/public/screenshots/`: atendente (com fila autenticada como Maria), cozinha (com pedidos via José), cliente (TV pública). Script abre caixa + cria 2 pedidos demo automaticamente pra cenas terem contexto realista. `app/manifest.ts` declara as 3 screenshots com `form_factor: "narrow"` e labels. Chrome Android usa no rich install dialog (mostra prévia em vez de só ícone). Idempotente. Cast `as unknown as MetadataRoute.Manifest["screenshots"]` porque Next 14 type não tem `form_factor` ainda, mas spec W3C aceita e Chrome respeita.
- [claude-pastel 2026-05-27] **Dashboard `/admin/monitor` shipado** — view mobile-first (fundo escuro pra menos brilho à distância) com header curto + 4 KPIs gigantes (Receita / Pedidos / Ticket médio / Preparo médio dos últimos 5) + 2 seções live (Em preparo / Novos) ordenadas por urgência. Pedidos em preparo > 15min ganham ring vermelho. Indicador SSE no header. Link adicionado na sidebar admin + atalho no AppHeader mobile. Auth: admin only.
- [claude-pastel 2026-05-27] **Redeploy Coolify reavaliado — não é mais necessário** — debug em produção mostrou app saudável: schema atualizado (`Ingredient.icon`/`stock`/`lowStockThreshold` presentes), produtos+ingredientes seedados (criados 20/05), `/api/health` retorna 200 com `dbOk: true`. Único ajuste pendente: trocar PIN do Gil de **1234** (legado do seed antigo) pra **2699** — feito via UI Admin → Usuários, sem precisar de reset destrutivo do volume.
- [claude-pastel 2026-05-27] **E2E Playwright fluxo de pedido completo** — `e2e/order-flow.spec.ts` cobre ciclo PEDIDO_FEITO → EM_PREPARO → PRONTO → ENTREGUE via API direta (UI cozinha tem flakiness com splash/SW; HTTP é robusto e valida regras de transição + auth por role). Inclui teste negativo: cozinha tentando marcar ENTREGUE falha com 4xx. `e2e/global-setup.ts` (novo) cria Maria atendente (PIN 1111) + José cozinha (PIN 2222) via Prisma direto, idempotente. Atualizei `auth.spec.ts` pra refletir UI atual (login via role+PIN sem cards de usuário). **10/10 E2E verde** em 18s.
- [claude-pastel 2026-05-27] **HTTPS local — decisão registrada** — `docs/HTTPS-LOCAL.md` atualizado: app hospedado em `cozinhadagil.evapro.cloud` (Coolify) com HTTPS automático via Let's Encrypt. mkcert/HTTPS local não é mais necessário. Roteiro antigo fica como histórico caso volte pra LAN privada.
- [claude-pastel 2026-05-27] **PR aberta:** docker-compose healthcheck pra `/api/health` (branch `claude-pastel/docker-health-endpoint`).
- [claude-pastel 2026-05-27] **PR aberta:** Iconify SW cache (branch `claude-pastel/iconify-sw-cache`).
- [claude-pastel 2026-05-27] **Drag-and-drop pra reordenar ingredientes** — `@dnd-kit/core` + `sortable` + `utilities`. Drag handle `<GripVertical>` aparece no início de cada IngredientRow com `cursor: grab` (activationConstraint 8px pra não conflitar com clicks normais). `POST /api/ingredients/reorder` (novo) faz update batch em transação (idempotente, ignora IDs stale). Broadcast SSE `ingredient:reordered` → atendente recoloca chips do stepper em tempo real. Quando busca ativa, DnD suspenso (não faz sentido reordenar lista filtrada).
- [claude-pastel 2026-05-27] **Cardápio → Ingredientes: contagem por categoria + busca rápida** — header de cada categoria mostra "(N)" do count atual (ex: "Toppings (12)"). Input de busca acima das categorias filtra client-side por nome (substring, case-insensitive); categorias vazias somem; mensagem "X de Y ingredientes" quando ativo. Botão X limpa busca. Reset automático quando troca de sub-tab. Útil agora que Gil pode chegar a 40+ ingredientes depois da feature de add livre.
- [claude-pastel 2026-05-27] **3 follow-ups do audit desktop fechados:** (1) Stepper atendente: `md:max-w-4xl` (896px) em 4 wrappers (passo cliente, passo cart, container genérico, BottomBar) — desktop 1440px agora usa ~62% em vez de 47%. (2) Ticket cozinha: `max-w-screen-2xl mx-auto` (1536px) no grid — TV 4K ultra-wide não estica cards. (3) EditDrawer: **falso-positivo do audit** — já tem 4 formas de fechar (X header com hover, Cancelar footer, Esc, clique no backdrop). Nada a mexer.
- [claude-pastel 2026-05-27] **Auditoria UX Desktop** — relatório em `docs/AUDIT-DESKTOP-2026-05.md` cobrindo 4 telas (atendente, cozinha, cliente, admin). Achados: 2 gaps críticos (stepper `max-w-2xl` espremido em desktop; ticket cozinha sem `max-w` em TV), 1 menor (verificar EditDrawer close button), 3 padrões transversais OK (header sticky, sem breadcrumb intencional, hovers em ~85%). 3 items P3 criados pra fixes (stepper width, ticket max-w, EditDrawer close). Estado geral OK — sprint mobile-first não deixou regressões críticas, só "espremidas" em desktop large.
- [claude-pastel 2026-05-27] **Iconify offline fallback no IconPicker** — banner amarelo de `<WifiOff>` na aba "Buscar ícone" quando `navigator.onLine = false` OU quando último fetch pra `api.iconify.design` falhou (network error, captive portal). Banner inclui link rápido pra "Subir arquivo" (100% local, funciona offline). Input de busca disabled + opacity-50 quando offline. Listeners pra `online`/`offline` events refletem retorno de wifi ao vivo (limpa o erro). Quando o modal abre offline, default já vai pra aba "Subir arquivo" pra não frustrar. Follow-up P3 criado pra adicionar regra de cache no SW (`api.iconify.design` em `next.config.mjs` PWA config — PR conforme PLAYBOOK) que permitiria render de ícones já vistos mesmo após reload offline.
- [claude-pastel 2026-05-27] **Health check `/api/health` retorna 503 quando DB cai** — endpoint já existia mas sempre retornava 200 mesmo com DB inacessível. Agora retorna HTTP 503 + lista de `problems[]` quando DB falha, mantendo 200 + `problems: []` no caso saudável. Shape do response preservado (`ok`, `dbOk`, `dbLatencyMs`, `sse`, `session`, `uptimeSec`) pra não quebrar `e2e/api-smoke.spec.ts` nem o bookmark da Gil. README atualizado com sugestão de Coolify config (interval 30s, timeout 5s, restart em 3× 503). Follow-up P3 criado pra apontar health check do `docker-compose.yml` pra `/api/health` em vez de `/` (PR per PLAYBOOK).
- [claude-pastel 2026-05-27] **Smoke test pré-evento** — `scripts/smoke-test.ts` + `npm run smoke`. Valida em ~60ms: DB acessível (5 queries em paralelo), admin existe, servidor HTTP responde, status do caixa (info), backup recente. Exit 0 = OK; exit 1 = erro; warnings (⚠️) não bloqueiam. Saída colorida ANSI. Cheatsheet de evento no README atualizado. **Bug regressão consertado:** `import "server-only"` no `lib/prisma.ts` quebrava TODOS os scripts (`reset-users`, `cleanup-orphan-images`, etc) — split em `lib/prisma-client.ts` (lógica + tuning, sem guard) e `lib/prisma.ts` (re-export com `server-only`). Bonus fix: PRAGMAs `busy_timeout` e `synchronous` também retornam linha no SQLite — trocados pra `$queryRawUnsafe`, sumiu o erro barulhento no console.
- [claude-pastel 2026-05-27] **Testes unitários endpoints de ingrediente** — extraído `lib/ingredients.ts` (novo, helpers puros: `INGREDIENT_CATEGORIES`, `isAllowedCategory`, `parseIngredientName`, `parseIconValue`) das validações inline em `app/api/ingredients/*`. `tests/ingredients.test.ts` (29 testes) cobre validação de nome/categoria/icon. `tests/uploads-ingredients.test.ts` (21 testes) cobre `saveIngredientImage`/`deleteIngredientImage`/`readIngredientImage`/`isUploadedIngredientIcon` com tmp dir via `UPLOADS_DIR` env. Hardening implícito: POST/PATCH agora retornam 400 em tipos inválidos em `name`/`icon` em vez de ignorar silenciosamente (admin UI normal só manda string, sem impacto prático). Total: 57 → 107 testes (+50).

### 2026-05-22
- [claude-pastel 2026-05-22] **PWA audit: 7/8 melhorias shipped** — shortcuts no manifest (long-press iOS/Android), página offline + not-found + global-error, fix categories spec W3C, dir: ltr, **PWA Update Prompt** (toast "Nova versão pronta" em vez de reload silencioso), CacheFirst pra `_next/static + /api/uploads + /icons + /splash`, 7 splash screens novos (iPhone 17 Pro Max + iPads). Script `gen-splashes.ts` reusável. #6 (screenshots reais) ficou no BACKLOG.
- [claude-pastel 2026-05-22] **Fix leak Server → Client em `lib/event-session.ts`** — separado `lib/event-session-shared.ts` (puro) do server-only. AdminClient/AtendenteClient agora importam do shared. Causava erro "PrismaClient unable to run in browser environment". `import "server-only"` adicionado em `lib/prisma.ts` pra prevenir regressão (build trava se voltar).
- [claude-pastel 2026-05-22] Fix log barulhento PRAGMA — `lib/prisma.ts` usa `$queryRawUnsafe` no `journal_mode = WAL`.
- [claude-pastel 2026-05-22] Doc `docs/UPGRADE-NEXT-15.md` — plano completo de breaking changes (14 arquivos afetados), passos de migração (codemod oficial + next-pwa fork), estimativa 3-6h, rollback plan.
- [claude-pastel 2026-05-22] Promotions via SSR — `app/atendente/page.tsx` passa `initialPromotions`, eliminado useEffect+fetch no mount. TODO antigo resolvido.
- [claude-pastel 2026-05-22] Limpeza de imagens órfãs em `uploads/products/` — `scripts/cleanup-orphan-images.ts` com dry-run default + flag `--delete`. Idempotente.
- [claude-pastel 2026-05-22] Sincronizar STATUS.md com estado atual do projeto (módulos 🟢, histórico do dia, próximo passo recomendado, métricas vivas)
- Toggle "Disponível / Esgotou" também filtra produtos no atendente (bug pós-remoção do estoque numérico)
- Remover estoque numérico — só "tem ou não tem" (feedback Gil)
- Reset PIN do Gil pra 2699 + script reusável
- Auditoria UX crítica 4º pass — Fases A (5/5), B (9/14), C (4/5)
- Follow-ups audit externo: preview comprovante (#74), atalhos teclado (#75), PDF comparativo (#77), TV breathe intermitente (#78), áudio escalonado (#76)
- `/guia` criado: manual completo por papel, hero gradient, steps numerados, callouts, reescrito pra família (zero jargão)
- Header com nome do operador sempre visível (mobile + desktop)
- Cozinha em 2 colunas (densidade) + botnav inferior com labels
- ESLint cleanup (#67): 115 → 0 erros, reativado no build
- Migração imageDataUrl base64 → filesystem (#63): novo helper, rota /api/uploads, script idempotente no entrypoint
- Caixa vira primeiro item do menu admin (rename "Operação" → "Caixa")
- Bump patches/minors: lucide-react, tsx, vitest, @types/react
- PIN do Gil resetado pra 2699 + script reusável
- Upload route: force-static → force-dynamic (corrigia erro Prisma in browser)

### 2026-05-22 (instalação)
- Sistema STATUS/BACKLOG/PLAYBOOK instalado pelo claude-orchestrator (Cowork).

---

## 📝 Regras

1. Puxar do topo de "Próximos".
2. Mover pra "Em progresso" com `[claude-pastel YYYY-MM-DD]` no fim do bullet.
3. **Antes de fechar item que toca em SSE, auth, ou schema: rodar `npm test` e `npm run test:e2e` (se afeta fluxo de pedido).**
4. **Em véspera de evento (ver STATUS → "Eventos próximos"): só commitar mudanças P2/P3 baixo risco. P0/P1 viram PR pra revisar com calma.**
5. Item sem critério de pronto claro → mover pra "Backlog" e rodar `/planejar`.
