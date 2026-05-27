# STATUS — Pastel da Gil

> Atualizar este arquivo no fim de toda sessão.

**Última atualização:** 2026-05-27
**Atualizado por:** `claude-pastel` (routine background)

---

## Fase atual

Fase 6 entregue. Pós-fase: hardening + observabilidade.

## O que rolou desde a última sessão

### 2026-05-27 (routine background)
- `lib/ingredients.ts` criado com funções puras de validação (extraídas dos endpoints); `tests/ingredients-api.test.ts` com 25 casos — testes sobem de 57 → 82
- `scripts/smoke-test.ts` — checklist pré-evento objetivo (DB, auth, servidor, caixa, backup)
- `GET /api/health` corrigido: retorna 503 + `problems[]` quando DB falha; shape alinhado ao critério
- `IconPicker` com offline fallback: detecta `navigator.onLine`, banner de aviso, input desabilitado offline
- Contagem de itens por categoria no header de Ingredientes no admin (`"Toppings (4)"`)
- Branch `routine-pastel-20260527-1611` → PR aberto



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

## Próximo passo recomendado

João: mergear PR #4 (backup) + PR routine (5 melhorias de hardening/tests/UX) + planejar janela pro redeploy Coolify (P1 do BACKLOG).

---

## Saúde dos módulos

| Módulo | Status | Notas |
|---|---|---|
| `app/atendente` | 🟢 | Stepper completo, dedup server-side, undo, banner caixa órfão. 1 TODO conhecido (promotions via SSR). |
| `app/cozinha` (SSE) | 🟢 | Busca + ordenação + alarme escalonado + botnav + atalhos teclado. |
| `app/cliente` | 🟢 | TV breathe intermitente, painel ao vivo. |
| `app/admin` | 🟢 | Caixa primeiro, Vendas com revenue por ingrediente, comparativo no PDF, sidebar com link pro Guia. |
| `app/comprovante` (PDF) | 🟢 | Preview 80mm inline + impressão térmica. |
| `app/guia` | 🟢 | Manual completo por papel. |
| `app/api` (endpoints + SSE) | 🟢 | Codes estruturados (DUPLICATE_SUSPECTED, CAIXA_FECHADO, INVALID_TRANSITION, ORDER_LOCKED). |
| `prisma/schema` | 🟢 | imageUrl + imageDataUrl (legacy) coexistem; migração roda no boot. |
| Impressora térmica | 🟡 | window.print() funcional; integração ESC/POS espera hardware. |
| PWA (next-pwa, manifest, service worker) | 🟢 | Standalone, 15 splashes (iPhone+iPad), install prompts, update prompt, CacheFirst pra assets imutáveis, shortcuts no long-press, página offline. |
| Auth (iron-session) | 🟢 | PIN único por role, identificação por {role + PIN}. |
| Testes Vitest | 🟢 | 82/82 passando (25 novos: ingredientes). |
| Testes Playwright e2e | 🟡 | Suite existe mas falta cobrir fluxo completo de pedido (item no BACKLOG). |

---

## Eventos próximos (operacional)

_Lista de eventos que o app vai rodar — datas e nível de criticidade. Se tem evento amanhã, congele mudanças de risco hoje._

- Nenhum agendado no momento.

---

## Métricas vivas

- Tests passando: **82/82** ✅
- Type-check: **ok** ✅
- ESLint: **0 erros** ✅ (check ativo no build)
- DB schema: **sincronizado** ✅ (imageUrl adicionado)
- PWA: **instalável** ✅ (iOS Safari + Android Chrome)
- Vulns npm audit: 10 (Next 14.x — não aplicam aos patterns atuais, plano de upgrade no BACKLOG)

---

## Histórico recente (últimos 5 dias)

### 2026-05-26 (hoje)
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

### 2026-05-22
- 25 commits — auditoria crítica + guia + housekeeping + reorganização admin + estoque simplificado
- BACKLOG replanejado: 9 itens novos aprovados; 1 fechado (sincronizar STATUS); 1 em PR (backup #4)
- PIN do Gil resetado pra 2699
- Estoque numérico removido — só toggle "Disponível / Esgotou" (decisão de produto: meio pastel de cada recheio inviabiliza contagem)
- Toggle de produto também filtra no atendente (bug encontrado e corrigido)
- **PR #4 aberto:** backup automático diário do dev.db (instrumentation hook do Next 14, WAL checkpoint, retenção 14 dias, scheduler in-process)

### 2026-05-22 (instalação)
- Sistema STATUS/BACKLOG/PLAYBOOK instalado pelo claude-orchestrator (Cowork).
