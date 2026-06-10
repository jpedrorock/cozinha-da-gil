# STATUS — Pastel da Gil

> Atualizar este arquivo no fim de toda sessão.

**Última atualização:** 2026-06-10
**Atualizado por:** `claude-pastel` (routine background)

---

## Fase atual

Fase 6 entregue. Pós-fase: hardening + observabilidade.

## O que rolou nesta sessão (routine 2026-06-10)

- **[P3] Bookkeeping pós-merge de Fase 7** — `docs/FASE-7.md` marcado ✅ ENTREGUE; itens 3 (Comparativo #29), 4 (WhatsApp #31), 5 ("Acabou" verificado) receberam entradas de entrega. `STATUS.md` atualizado com métricas corretas (216/216). `BACKLOG.md`: item PR #4 movido para Concluídos, SW #59 marcado como concluído, "Em progresso" zerado exceto migração Next 15 (aguardando review manual).
- 216/216 testes, lint limpo.
- Branch: `routine-pastel-20260610-1109`. PR aberta.
- Itens pulados (aguardam João): aplicar cardápio em prod (admin UI), smoke test prod, limpar branches routine-* (#Confirmar antes), stepper massa macarrão (#Confirmar antes).

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

- **2 PRs abertas (ambas DIRTY)** — #26 emoji→lucide e #35 contraste "Caixa aberto". Precisam rebase em outra sessão. **5 PRs mergeadas hoje em sequência**: #74 (cardápio), #75 (Zona de Perigo), #4 (backup), #59 (SW cache /p), #41 (a11y bundle).
- ~~Backfill `publicToken` em prod não confirmado~~ — verificação técnica feita 05/06 (endpoint funciona, POST gera token, backfill rodou 2× no entrypoint). Monitorar empiricamente: se pedido legado mandar WhatsApp sem linha "Acompanhe:", abrir endpoint admin pra rodar backfill on-demand.

## Próximo passo recomendado

**Fase 7 fechada (5/5)** — 3 itens mergeados (#23 Next 15 já no main, #28 troco, #29 comparativo), 3 PRs aguardando merge (**#4 backup desconflictado**, **#30 PIX**, **#31 WhatsApp auto-surface**), e #5 "Acabou" já existia. Coolify deployou Next 15 em prod na sessão de 29/05.

João: (1) mergear **#4 + #30 + #31** (todos validados: tsc/lint/testes/build); (2) **configurar chave PIX** (admin → Caixa → "Pagamento (PIX)") — 1 vez só; (3) **teste manual da PWA no celular** (install/offline/splash) agora que Next 15 está em prod; rollback Coolify 1-clique se algo quebrar.

BACKLOG "Próximos" reabastecido com **5 itens de manutenção pós-Fase 7** (replan 2026-05-29): bookkeeping, smoke prod, limpar 4 routine-* novas, auditoria a11y dedicada, reavaliar Background Sync.

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
| Testes Vitest | 🟢 | 216/216 passando (ingredientes, uploads, kitchen-display, whatsapp URLs, caixa órfão, idempotency/TTL, i18n de ícones, formatBRL, PIX BR Code, db-backup, troco). |
| Testes Playwright e2e | 🟢 | 12/12 passando em `npm run dev` (auth UI + API smoke + fluxo de pedido + bypass de bebida). Nota: auth UI falha em build de produção por causa do service worker — rodar e2e contra `npm run dev`. |

---

## Eventos próximos (operacional)

_Lista de eventos que o app vai rodar — datas e nível de criticidade. Se tem evento amanhã, congele mudanças de risco hoje._

- Nenhum agendado no momento.

---

## Métricas vivas

- Tests passando: **216/216** ✅
- Type-check: **ok** ✅
- ESLint: **0 erros** ✅ (check ativo no build)
- DB schema: **sincronizado** ✅ (imageUrl adicionado)
- PWA: **instalável** ✅ (iOS Safari + Android Chrome)
- Vulns npm audit: **3 moderate** (postcss interno do Next, build-time) na branch Next 15 — era 10 (9 high) no main Next 14. PR aberto.
- Next/React: **15.5.18 / 19.2.6** na branch `claude-pastel/next15-pwa` (main ainda 14.2.35 até merge)

---

## Histórico recente (últimos 5 dias)

### 2026-06-09
- **Guia atualizado — PR #76 mergeada** (`6a21be6`) — audit do `/guia` vs estado atual achou 11 features adicionadas que não tinham doc: tela do recibo pós-pedido, link `/p/<token>`, smart checklist cozinha, drawer Prontos, produtos pré-montados (Churrasqueiro/Tortas), categoria `macarrao_massa`, **3 seções inteiras novas em Admin (PIX, Monitor KPIs, Zona de Perigo)** e 4 regras automáticas. CRÍTICO documentar a Zona de Perigo pra Gil entender. Bonus: fix do teste flaky no `db-backup` (do PR #75) — colisão de filename em chamadas <1ms apart, resolvido com suffix random 4 chars hex.

### 2026-06-09
- **🚀 5 PRs mergeadas em sequência** — João autorizou ("nao precisa revisar pode seguir"). Squash-merged: #74 cardápio junho 2026 (`26f5346`), #75 Zona de Perigo (`3af76c1`), #4 backup automático dev.db (`2fcd1b6`), #59 SW cache /p (`9290942`), #41 a11y bundle (`26757a0`). Mais 2 routine logs (#72, #73) fechados na triagem padrão. Fila caiu de 7 → 2 (#26, #35 ambos DIRTY pra rebase futura). Coolify deploya automaticamente.

### 2026-06-06
- **Zona de Perigo (apagar dados de operação) — PR #75 aberta** — Gil pediu botão "escondido + difícil" pra resetar operação. Implementado pattern GitHub-like: bloco colapsado no fim da aba Usuários, cooldown 3s, modal exigindo digitar frase EXATA "APAGAR TUDO NA COZINHA DA GIL" (validada client+server), backup automático do dev.db em `backups/wipe-<timestamp>.db` ANTES de apagar (aborta se backup falhar), DELETE em transação Prisma. Escopo: apaga Order/OrderItem/EventSession/BroadcastLog; mantém Product/Ingredient/User/Customer/PaymentConfig/Promotion. Arquivos novos: `lib/db-backup.ts` + 2 endpoints + `app/admin/DangerZone.tsx` + `tests/db-backup.test.ts` (6 testes). tsc + lint + 216/216 + build verdes. Aguarda checker + review pra merge.
- **Atualização cardápio junho 2026 — PR #74 aberta** — Gil mandou cardápio impresso novo (Pastel/Macarrão) + 3 produtos novos via WhatsApp. Coletei decisões via AskUserQuestion e implementei: preços Pastel Salgado Pequeno R$15→10 e Grande R$20→15, 4 produtos novos (Pastel Churrasqueiro R$20 combo fixo, Torta de Frango R$15, Torta de Alho Poró e Bacon R$15, Guaraná Antártica R$6), 6 ingredientes novos (Carne desfiada, Barbecue, Pimentão, Alho e óleo, Penne, Espaguete) em 5 categorias (incluindo nova `macarrao_massa`), 1 remoção (Bolonhesa). Atualizei `prisma/seed.ts` + `lib/ingredients.ts` + `tests/ingredients.test.ts`. **Seed só roda em DB zerado — não afeta prod.** João aplica em prod via Admin → Cardápio seguindo checklist do PR. tsc + lint + 210/210 + build verdes. Item de backlog separado pra escolha estruturada de massa no stepper (por enquanto atendente usa Observações).

### 2026-06-05
- **Rebase + merge PR #30 PIX** (`/trabalhar`) — branch `claude-pastel/pix-config` rebaseada em main atual. Conflito real só em ComprovanteClient.tsx (imports lucide + whatsapp-templates) — resolvido fundindo PIX + publicToken. Schema (Order.publicToken + PaymentConfig) auto-merged sem conflito. Validação pós-rebase: `npm install` + `prisma generate` + tsc + lint + **210/210 testes** (+13 PIX) + build verdes. Force-push `c784e68 → 7a7883e`. Checker aprovou. Squash-merged `12f205f`. Próximo passo do João: **configurar chave PIX no admin → Caixa** pra recurso ficar funcional pro cliente final.
- **Triagem de PRs concluída — 22 → 5 abertas** (`/trabalhar`) — fechei 17 PRs em batch: 5 log-only "sem itens", 10 docs/STATUS superseded em sequência, 2 duplicatas do PR #41 a11y. Cada uma com comentário explicativo. Restantes: #4 backup CLEAN, #26 emoji→lucide DIRTY, #30 PIX DIRTY (rebase é o próximo item P1), #35 contraste DIRTY, #41 a11y CLEAN. Bonus: PR #55 mergeada — implementou 2 itens do BACKLOG hoje (Avisar auto-volta + indicador "ao vivo" em /p/<token>) via routine background paralela ao /planejar.
- **Backlog replanejado: 8 novos itens em "Próximos"** (`/planejar`) — diagnóstico achou (a) fila de 21 PRs com 10+ routine logs duplicadas/superseded, (b) PR #30 PIX DIRTY/CONFLITANTE, (c) backfill `publicToken` em prod não confirmado, (d) feature `/p/<token>` e fixes de scroll do dia 01/06 ainda sem smoke test prod. Aprovados pelo João: triagem PRs [P1], rebase PIX [P1], verificar backfill [P1], botão Avisar auto-volta [P2], smoke prod [P2], indicador "ao vivo" em /p [P3], SW cache pra /p [P3], limpar branches routine [P3]. Total: 8 itens.

### 2026-06-01
- **🆕 PR #42 mergeada — link público de acompanhamento do pedido** — Gil pediu "criar um link pro cliente acompanhar tb". Implementado: schema `Order.publicToken` (10 chars base62, ~59 bits entropia), backfill idempotente no entrypoint (86 pedidos legados preenchidos), endpoint público `GET /api/p/[token]`, página `/p/[token]` com status grande colorido (preparing/ready com pulso/delivered/cancelled), atualiza ao vivo via SSE. WhatsApp templates `templateReceipt`/`templateOrderReady` ganharam param `baseUrl` que anexa linha "Acompanhe: <url>". Comprovante ganhou botão "Copiar link". Validação: tsc + lint + **197/197 testes** (+18 novos) + build. Squash-merged como `182c30e`.
- **🩹 Fix follow-up `c556d20` — atendente navega pro comprovante** — Gil reportou "faço meu pedido e nada acontece". O auto-abre wa.me que tentei antes era silenciosamente bloqueado por popup blocker / iOS PWA. Trocado por navegação direta `/comprovante/[id]` depois do POST — atendente vê recibo bonitinho + botão WhatsApp gigante (click humano sempre funciona).
- **🚀 PR #39 + #31 mergeadas — WhatsApp ponta-a-ponta liberado em prod** — Gil reportou que pedido novo não abria janela do WhatsApp e não tinha botão pra avisar pronto. Investigação rápida: as 2 implementações já estavam em PRs CLEAN+MERGEABLE há dias, só faltou clicar merge. Squash-merged ambas — `0f403dd` (auto-abrir wa.me pós-pedido + botão Comprovante em todo card do atendente) e `f0133ad` (banner "Avisar" 1-toque quando vira PRONTO + tem telefone). Coolify deploya em ~2min. Bloqueio "fila de PRs" passou de 8 → 6.
- **`/trabalhar`: bundle A11y completo — PR #41 aberta** — 3 commits cobrindo 5 itens do audit: A11Y-02 (contraste status-ready/delivered nas posições texto → `-ink`), A11Y-03 (touch targets ≥44px: AppHeader operator chip, troco icon, "Dispensar aviso", "Cancelar pedido" cozinha), A11Y-04 (novo hook `lib/use-focus-trap.ts` aplicado em ConfirmDialog/CancelDialog/TrocoCalculator/IconPicker), A11Y-05 (3 inputs Nome do AdminClient ganharam wrap `<label>`), A11Y-06 (`@media (prefers-reduced-motion: reduce)` global em globals.css). Bundle único em vez de 3 PRs separadas pra não inflar a queue (7→8 abertas em vez de 7→10). Validação: tsc + lint + 179/179 testes verdes. Decisão consciente: filter chips e botões absolute em layout denso ficam — 44px lá desproporciona o row.
- **Backlog replanejado: 3 novos itens em Próximos** (`/planejar`) — todos do `docs/AUDIT-A11Y-2026.md`: (a) [P2] quick wins (A11Y-02/05/06: inputs sem label, prefers-reduced-motion, contraste status-ready/delivered) ~1h; (b) [P2] touch targets ≥44px nas telas operacionais (A11Y-03) ~1-2h; (c) [P3] focus trap em modais (A11Y-04) ~1-2h. Mais 1 housekeeping fechado: routine log-only `20260531-0110` deletada. **Nota:** 7 PRs continuam abertos aguardando review do João.
- **Bug-fix: recibo WhatsApp não-existente — fix em PR #39** — atendente prometia "manda direto no WhatsApp" ao preencher telefone, mas não havia mecanismo (zero links pra `/comprovante/[id]` no `OrderCard`, zero auto-envio em `submitOrder`). Fix em 2 frentes: (A) `submitOrder` auto-abre wa.me com `templateReceipt` quando pedido novo tem telefone; (B) `OrderCard` ganha botão "Comprovante" (FileText link) em todos status != CANCELADO. tsc/lint/179/build verdes. Commit `ad97a24`.

### 2026-05-29
- **`/trabalhar`: 4 itens pós-Fase 7 fechados** (smoke prod + reavaliação BG sync + limpeza de 7 routine branches + **a11y audit dedicada**). Detalhes: (a) a11y audit produziu `docs/AUDIT-A11Y-2026.md` — app passa boa parte do WCAG 2.1 AA; 3 gaps P2 (contraste `status-preparing`, ~10 touch targets sub-44px, ~4-5 inputs sem `<label>` no AdminClient) + 3 P3, esforço total 4-6h. (b) Limpeza de routine: 7/8 deletadas (log-only); **1 mantida** (`routine-pastel-20260529-1110`) — carrega trabalho de FASE-6 §6.A (emoji→lucide em 4-5 arquivos não-tocados no main), decisão pendente do João.
- **`/trabalhar`: 2 itens pós-Fase 7 fechados (smoke prod + reavaliação BG sync)** — (1) `/api/health` em prod respondendo saudável no Next 15 (`dbOk:true, dbLatencyMs:2, problems:[], uptimeSec:46`), todas as rotas chave 200; (2) `docs/BACKGROUND-SYNC.md` ganhou seção "Reavaliação 2026-05-29" — decisão revisada: continuar fora de escopo, gatilho ficou mais sensível, esforço caiu pra ~1 dia (idempotency-key já implementada mitiga o risco principal). **Detalhe operacional:** smoke flagou caixa órfão (`"Teste Fred"`, 28/05) ainda aberto em prod — banner de stale deve estar visível pra Gil. Restam em "Próximos": bookkeeping pós-merge (bloqueado pelos PRs #4/#30/#31), limpar 4 routine-* (confirmar antes), a11y audit WCAG (P2 substancial).
- **Backlog replanejado: 5 novos itens aprovados** (`/planejar`) — bookkeeping pós-merge, smoke test prod pós-Next 15, limpar 4 branches routine-* novas, **auditoria a11y WCAG dedicada (P2)** e reavaliar Background Sync. Detalhes no BACKLOG.
- **Fase 7 fechada (5/5)** — sessão maratona: (1) mergei #23 Next 15, #28 troco, #29 comparativo no main; (2) construí o **#1 PIX (PR #30)** — schema `PaymentConfig`, `lib/pix.ts` (BR Code EMV-MPM + CRC16 + 13 testes), endpoints `/api/settings/payment`, card admin `PagamentoSettings`, `<PixCheckout>` no comprovante com QR offline + copia-e-cola; (3) construí o **#4 WhatsApp auto-surface (PR #31)** — banner fixed-bottom 1-toque quando vira PRONTO + tem telefone, reusa `notifyReady()` existente; (4) **destravei PR #4** (backup dev.db) — conflito só em `next.config.mjs` (flag `instrumentationHook` virou obsoleto no Next 15); (5) **#5 "Acabou"** verificado — já existia (PATCH ingrediente → broadcast `ingredient:updated` → atendente aplica `available` ao vivo).
- **Coolify deployou Next 15 em prod** (auto-deploy após merge do #23). Pendente: teste manual de PWA no celular (rollback 1-clique se necessário).
- Testes neste branch (whatsapp-pronto): 179/179. Suite cresce conforme PRs mergeiam (PR #30 adiciona +13 do PIX).

### 2026-05-28
- **[P2] Security review do PR #23** — skill `security-review` no diff da migração: **nenhuma vuln nova** (async params idêntico downstream + auth intacta; path-traversal dos uploads é pré-existente; cache PWA só mudou de lugar; sse-debug só lê localStorage). Safe to merge.
- **[P3] Limpeza de 20 branches `routine-pastel-*`** — artefatos da routine de background, todas com commits não-mergeados mas superseded no `main`. Confirmado com João (op destrutiva). Origin ficou só com `main` + 4 feature branches.
- **[P3] Housekeeping no PR #23 (`/planejar` 3º)** — (1) **gate dos logs `[SSE-LAT]`**: a instrumentação de latência SSE já existia mas spammava o console do navegador em prod; novo `lib/sse-debug.ts` deixa os 3 logs do client opt-in via `localStorage["pdg:sse-debug"]` (server logs ficam, são telemetria de stdout). (2) **bump lucide 1.16→1.17**. (3) README atualizado pra Next 15 + @ducanh2912/next-pwa (gap da migração). Tudo na branch da migração → entra junto no PR #23. tsc/lint/163 testes/build verdes.
- **[P3] `docs/FASE-6.md` marcado como entregue** — banner "✅ ENTREGUE" no topo + corrigida a nota "pricing.ts vira dead code" (segue vivo pra display/legacy, coberto por `tests/pricing.test.ts`). Doc-only, feito na branch da migração pra não divergir do PR #23.
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
