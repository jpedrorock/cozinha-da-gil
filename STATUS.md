# STATUS — Pastel da Gil

> Atualizar este arquivo no fim de toda sessão.

**Última atualização:** 2026-05-28
**Atualizado por:** `claude-pastel`

---

## Fase atual

Fase 6 entregue. Pós-fase: hardening + observabilidade.

## O que rolou desde a última sessão

- Auditoria UX crítica (4º pass) — Fases A (5/5 críticos), B (9/14 importantes), C (4/5 polish + a11y) shipped em 18 commits
- Follow-ups do audit externo: preview comprovante 80mm, atalhos teclado cozinha, áudio escalonado, PDF com delta vs período anterior, TV breathe intermitente
- Página `/guia` criada — manual por papel (atendente/cozinha/admin/geral) com tabs, busca, accordion, hero gradient, steps numerados, callouts. Reescrito 2x: primeiro inspirado no `Help.tsx` do cultivo-server, depois sem jargão técnico pra família ler
- Header com nome do operador sempre visível (mobile + desktop)
- Cozinha em 2 colunas quando pedido tem qty>1 + botnav inferior com labels (acessibilidade)
- ESLint cleanup completa: 115 erros → 0, reativado check no build
- Migração `Product.imageDataUrl` base64 → filesystem (`/api/uploads/products/<file>`), com script idempotente no entrypoint Docker
- Caixa virou primeiro item do menu admin (rename "Operação" → "Caixa", default tab também)
- Bump de patches/minors (`lucide-react`, `tsx`, `vitest`, `@types/react`) — majors deferidos com razão
- PIN do Gil resetado pra 2699 (local) + script `scripts/reset-gil-password.ts` reusável
- Backlog replanejado: 9 novos itens aprovados pelo João

## Bloqueios ativos

- **PR #4 aguardando merge** — backup automático do dev.db. Implementação testada local; precisa review + merge do João pra subir pra Coolify.
- **2 PRs abertas pendentes review** (P3): `claude-pastel/iconify-sw-cache` + `claude-pastel/docker-health-endpoint`.

## Próximo passo recomendado

**Migração Next 15 + next-pwa EXECUTADA** na branch `claude-pastel/next15-pwa` — validada (tsc/lint/163 testes/build/12 e2e em dev). **PR aberto, aguardando review.**

João, antes de mergear em prod: (1) **teste manual da PWA** — instalar no celular, abrir offline, ver splash/cache/fallback `/offline`; SSE em 3 abas (§4.8 do doc); (2) confirmar `dev.db` com backup (PR #4). Depois: mergear → Coolify rebuilda → smoke test em prod.

Outros pendentes do João: mergear PR #4 (backup) + 2 PRs P3 (iconify-sw-cache, docker-health-endpoint); **Redeploy Coolify** pros 5 ajustes de UX + testes que já estão no `main`.

---

## Saúde dos módulos

| Módulo | Status | Notas |
|---|---|---|
| `app/atendente` | 🟢 | Stepper completo, dedup server-side, undo, banner caixa órfão. "Adicionar outro item" (não só pastel). "Marcar todos" some no pastel pequeno. |
| `app/cozinha` (SSE) | 🟢 | Busca + ordenação + alarme escalonado + botnav + atalhos teclado + **smart checklist** (mostra "menos X" quando maioria vai) + **drawer Prontos** (histórico do dia). |
| `app/cliente` | 🟢 | TV breathe intermitente, painel ao vivo. |
| `app/admin` | 🟢 | Caixa primeiro, Vendas com revenue por ingrediente, comparativo no PDF, sidebar com Guia + Monitor + **Sair**. |
| `app/admin/monitor` | 🟢 | KPIs gigantes ao vivo (Receita/Pedidos/Ticket/Preparo) + lista live de pedidos em preparo. Mobile-first, fundo escuro. |
| `app/comprovante` (PDF) | 🟢 | Preview 80mm inline + impressão térmica. WhatsApp via `<a>` deep link (fix window.open bloqueado em PWA). |
| `app/guia` | 🟢 | Manual completo por papel. |
| `app/api` (endpoints + SSE) | 🟢 | Codes estruturados (DUPLICATE_SUSPECTED, CAIXA_FECHADO, INVALID_TRANSITION, ORDER_LOCKED). |
| `prisma/schema` | 🟢 | imageUrl + imageDataUrl (legacy) coexistem; migração roda no boot. |
| Impressora térmica | 🟡 | window.print() funcional; integração ESC/POS espera hardware. |
| PWA (@ducanh2912/next-pwa, manifest, service worker) | 🟢 | Standalone, 15 splashes (iPhone+iPad), install prompts, update prompt, CacheFirst pra assets imutáveis, shortcuts no long-press, **fallback offline automático** (`fallbacks: document` reativado no fork), 3 screenshots no manifest. _Migrado pra fork na branch `claude-pastel/next15-pwa` (PR)._ |
| Auth (iron-session) | 🟢 | PIN único por role, identificação por {role + PIN}. |
| Testes Vitest | 🟢 | 163/163 passando (ingredientes, uploads, kitchen-display, whatsapp URLs, + caixa órfão, idempotency/TTL, i18n de ícones, formatBRL). |
| Testes Playwright e2e | 🟢 | 12/12 passando em `npm run dev` (auth UI + API smoke + fluxo de pedido + bypass de bebida). Nota: auth UI falha em build de produção por causa do service worker — rodar e2e contra `npm run dev`. |

---

## Eventos próximos (operacional)

_Lista de eventos que o app vai rodar — datas e nível de criticidade. Se tem evento amanhã, congele mudanças de risco hoje._

- Nenhum agendado no momento.

---

## Métricas vivas

- Tests passando: **163/163** ✅
- Type-check: **ok** ✅
- ESLint: **0 erros** ✅ (check ativo no build)
- DB schema: **sincronizado** ✅ (imageUrl adicionado)
- PWA: **instalável** ✅ (iOS Safari + Android Chrome)
- Vulns npm audit: **3 moderate** (postcss interno do Next, build-time) na branch Next 15 — era 10 (9 high) no main Next 14. PR aberto.
- Next/React: **15.5.18 / 19.2.6** na branch `claude-pastel/next15-pwa` (main ainda 14.2.35 até merge)

---

## Histórico recente (últimos 5 dias)

### 2026-05-28
- **Migração Next 14 → 15 + `@ducanh2912/next-pwa` EXECUTADA** (branch `claude-pastel/next15-pwa`, PR) — next 14.2.35→15.5.18, react 18→19.2.6, fork PWA (10.2.9), codemod async `params` nas 14 rotas dinâmicas, override `serialize-javascript@7.0.5`. **`fallbacks: document:/offline` reativado** (bug do 5.6 sumiu no fork). Validação: tsc 0 erros, lint limpo, vitest 163/163, build OK, **e2e 12/12 em dev**, SW gerado certo (precache /offline + skipWaiting:false preservado p/ PWAUpdatePrompt). **npm audit 10 (9 high) → 3 moderate** (postcss interno do Next, build-time, input confiável — não-bloqueante). Falta teste manual de PWA/SSE em device antes do merge em prod. Registro completo em `docs/UPGRADE-NEXT-15.md`.
- **Backlog replanejado de novo: 1 item aprovado** (`/planejar` 2º) — migração Next 14 → 15 + `@ducanh2912/next-pwa` [P2, Confirmar antes + PR]. Resolve os 10 vulns do `npm audit` (todos do next-pwa) e desbloqueia fallback offline. Propostos mas não escolhidos: instrumentar latência SSE, doc FASE-6 entregue, bump lucide 1.17 (seguem válidos). Diagnóstico: gaps de teste já fechados; sem TODO/bug real; app 🟢.
- **[P3] E2E bypass de bebida shipado (2/2 do replanejamento — fila zerada)** — `e2e/beverage-bypass.spec.ts`: pedido só-de-bebida nasce PRONTO (pula cozinha), pedido misto NÃO bypassa. E2E 10 → **12**. Descoberta colateral: as 4 falhas de `auth.spec.ts` só aparecem rodando e2e contra build de **produção** (`next start`, service worker do next-pwa ativo); em `npm run dev` passam 12/12. Registrado na tabela de módulos.
- **[P2] Cobertura de testes pra libs puras shipada (1/2 do replanejamento)** — 4 arquivos novos, suite 125 → **163** (+38): `isStaleEventSession` (caixa órfão, fake timers no limite 12h), cache de idempotency (TTL 10min via `setSystemTime`, `isValidIdempotencyKey`), `translateForIconSearch` (case/acent-insensitive + fallback), `formatBRL`/`SIZE_LABEL` (normaliza NBSP do Intl). tsc + eslint limpos. Resta o item [P3] e2e de bypass de bebida.
- **Backlog replanejado: 2 novos itens aprovados** (`/planejar`) — (1) [P2] ampliar cobertura de libs puras não testadas: `isStaleEventSession` (caixa órfão), cache de idempotency (dedup de pedido), `ingredient-i18n` (PT→EN normalize), `formatBRL`/`SIZE_LABEL` (dinheiro); (2) [P3] e2e do bypass de bebida (vai direto pra PRONTO, não passa pela cozinha). Diagnóstico: app em ótimo estado (125 testes, módulos 🟢, sem evento agendado, fase = hardening). Sem TODOs reais no código. 10 vulns do `npm audit` são todas do next-pwa (já cobertas pelo plano `docs/UPGRADE-NEXT-15.md`). Itens propostos mas NÃO aprovados agora: instrumentar latência SSE, marcar FASE-6.md entregue, bump lucide 1.17.
- **5 ajustes de UX shipados** (commits `d9d3d26` + `c90ab67`) — "Adicionar novo item" (não só pastel); "Marcar todos" some no pastel pequeno; cozinha smart checklist (`lib/kitchen-display.ts` — "Vai tudo, menos: X"); drawer "Prontos" na cozinha; fix WhatsApp recibo (`window.open` → `<a href>`). Cobertura nova: `tests/kitchen-display.test.ts` (11) + `tests/whatsapp-templates.test.ts` (7). Suite 107 → 125.
- **Fix: botão "Sair" na sidebar admin desktop** (`9b9bcd9`) — admin ficava preso logado no desktop (≥1024px usa sidebar, AppHeader com sair fica `lg:hidden`).

### 2026-05-26
- Caixa (admin) — `CaixaSection` (abrir/fechar evento) movido pro topo da aba "Caixa" (`Operacao`). Antes ficava enterrado embaixo dos KPIs da Vendas; agora é a primeira coisa que aparece. Stats + kanban Trello (Novos → Em preparo → Prontos → Entregues) continuam abaixo, sempre visíveis.
- Caixa aberto vira **faixa slim** (1 linha, ~52px) com bolinha pulsando + nome + operador + botão "Fechar caixa" pequeno no canto. Antes era card preto grande que tomava 1/3 da tela e competia com o Trello.
- **Gestão completa de ingredientes** (CRUD + upload SVG/PNG):
  - `POST /api/ingredients`, `DELETE /api/ingredients/[id]`, `PATCH` agora aceita nome+categoria além de toggle/icon
  - `POST` em `/api/uploads/ingredients/[filename]` — espelha o de produtos, hash do conteúdo como filename, immutable cache
  - `IconPicker` ganhou aba "Subir arquivo" — drag-and-drop ou file input, preview antes de confirmar, valida SVG/PNG ≤ 512KB
  - Novo componente `<IngredientIcon>` detecta path `/api/uploads/...` (renderiza `<img>`) vs Iconify ID (renderiza `<Icon>`)
  - Cardápio → Ingredientes ganhou botão "**+ Novo ingrediente**" geral + "**+ Adicionar**" por categoria, **rename inline** (clica no nome → input), **botão lixeira** com confirma. Toast pra feedback.
  - Schema NÃO mudou — `Ingredient.icon` continua String? que aceita ambos formatos.
- **Vendas + Histórico fundidos** numa aba só "Vendas" com sub-tabs "Resumo" / "Pedidos" (padrão do Cardápio):
  - Antes: aba Histórico (#5 no menu, distante de Vendas no #2)
  - Agora: 1 aba Vendas com sub-switcher; sub-tab persiste em localStorage
  - "Resumo" = KPIs/gráficos/top toppings/fechamento; "Pedidos" = lista detalhada com busca + filtro por evento
  - Menu admin cai de 7 → 6 itens
  - Guia atualizado pra refletir nova hierarquia
- **BACKLOG replanejado: 8 novos itens aprovados** — auditoria UX desktop, testes unitários endpoints ingrediente, smoke test pré-evento, health check `/api/health`, Iconify offline fallback, drag-and-drop reordenar ingredientes, contagem por categoria, busca rápida no Cardápio. Detalhes no BACKLOG.
- **Testes ingredientes shipados (1/8 do replanejamento)** — `lib/ingredients.ts` (helpers puros extraídos), `tests/ingredients.test.ts` (29), `tests/uploads-ingredients.test.ts` (21). Suite Vitest: 57 → 107. Hardening implícito: POST/PATCH rejeitam tipos não-string em `name`/`icon`.
- **Smoke test pré-evento shipado (2/8)** — `npm run smoke` (~60ms) valida DB+admin+servidor+caixa+backup com saída colorida. Cheatsheet do README atualizado. **Bug regressão consertado:** `import "server-only"` em `lib/prisma.ts` quebrava todos os scripts; split em `lib/prisma-client.ts` (sem guard, pra scripts) + `lib/prisma.ts` (com guard, pra app code). Bonus: PRAGMAs `busy_timeout`/`synchronous` no init do Prisma trocados pra `$queryRawUnsafe` (sumiu o erro "Execute returned results" que aparecia em dev).
- **`/api/health` retorna 503 quando DB cai (3/8)** — endpoint que já existia agora distingue saudável (200) de DB inacessível (503), permitindo Coolify monitorar e reiniciar automaticamente. Campo `problems[]` lista descritores legíveis. Shape do response preservado pra não quebrar consumers. README sugere config Coolify (3× 503 = restart). Follow-up P3 criado pra apontar `docker-compose.yml` healthcheck pra `/api/health` (PR por PLAYBOOK).
- **Iconify offline fallback (4/8)** — banner amarelo `<WifiOff>` no IconPicker quando offline ou fetch falha; input de busca disabled; default já vai pra aba "Subir arquivo" (que funciona 100% local). Listeners de `online`/`offline` events refletem retorno de wifi ao vivo. Follow-up P3 criado pra cachear `api.iconify.design` no SW (PR — PWA config).
- **Auditoria UX Desktop (5/8)** — relatório em `docs/AUDIT-DESKTOP-2026-05.md`. 2 gaps críticos (stepper espremido, ticket cozinha sem max-w em TV) + 1 menor + observações OK. 3 items P3 abertos pros fixes. Sprint mobile-first não deixou regressões críticas, só "espremidas" em desktop large.
- **3 follow-ups do audit desktop fechados** — Stepper atendente expandido pra `md:max-w-4xl` (4 wrappers); Ticket cozinha com `max-w-screen-2xl` (não estica em TV 4K); EditDrawer confirmado OK (já tem 4 formas de fechar). Audit completo de ponta a ponta.
- **Cardápio → Ingredientes ganhou contagem por categoria + busca rápida** — header de categoria mostra "(N)"; input de busca client-side filtra por substring; categorias vazias somem; X limpa. Útil agora que Gil pode chegar a 40+ ingredientes.
- **Drag-and-drop reordenar ingredientes** — `@dnd-kit` no Cardápio (handle `<GripVertical>`); novo `POST /api/ingredients/reorder` faz batch update em transação; atendente reflete via `ingredient:reordered` SSE. DnD suspenso quando busca ativa.
- **E2E Playwright fluxo de pedido completo** — `e2e/order-flow.spec.ts` valida ciclo PEDIDO_FEITO → ENTREGUE + auth por role. globalSetup cria Maria + José via Prisma idempotente. auth.spec.ts atualizado pra UI atual. **10/10 E2E verde** (18s).
- **HTTPS local** — decisão registrada em `docs/HTTPS-LOCAL.md`: app já roda em domínio público com HTTPS via Coolify/Let's Encrypt; mkcert desnecessário. Roteiro antigo fica histórico.
- **2 PRs abertas pra revisão do João:** docker-compose healthcheck → `/api/health` (branch `claude-pastel/docker-health-endpoint`) + Iconify SW cache (branch `claude-pastel/iconify-sw-cache`). GitHub API tava com timeout durante a sessão; abrir via UI pelos URLs.

### 2026-05-22
- 25 commits — auditoria crítica + guia + housekeeping + reorganização admin + estoque simplificado
- BACKLOG replanejado: 9 itens novos aprovados; 1 fechado (sincronizar STATUS); 1 em PR (backup #4)
- PIN do Gil resetado pra 2699
- Estoque numérico removido — só toggle "Disponível / Esgotou" (decisão de produto: meio pastel de cada recheio inviabiliza contagem)
- Toggle de produto também filtra no atendente (bug encontrado e corrigido)
- **PR #4 aberto:** backup automático diário do dev.db (instrumentation hook do Next 14, WAL checkpoint, retenção 14 dias, scheduler in-process)

### 2026-05-22 (instalação)
- Sistema STATUS/BACKLOG/PLAYBOOK instalado pelo claude-orchestrator (Cowork).
