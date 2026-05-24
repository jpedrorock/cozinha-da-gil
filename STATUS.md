# STATUS — Pastel da Gil

> Atualizar este arquivo no fim de toda sessão.

**Última atualização:** 2026-05-24
**Atualizado por:** `claude-pastel` (background routine)

---

## Fase atual

Fase 6 entregue. Pós-fase: hardening + observabilidade.

## O que rolou desde a última sessão (2026-05-24 — routine background)

- Routine background 2026-05-24: 3 itens do BACKLOG (ver seção abaixo)
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
- **Branch `routine-pastel-20260524-2101` aguardando merge** — 3 itens concluídos pela routine (ver abaixo). Mergear quando conveniente — sem urgência, sem risco.

## Próximo passo recomendado

João: mergear PR #4 (backup) + planejar janela pro redeploy Coolify (P1 do BACKLOG). Depois, mergear branch da routine de 2026-05-24.

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
| PWA (next-pwa, manifest, service worker) | 🟢 | Standalone, splash, install prompts. |
| Auth (iron-session) | 🟢 | PIN único por role, identificação por {role + PIN}. |
| Testes Vitest | 🟢 | 57/57 passando. |
| Testes Playwright e2e | 🟡 | `order-flow.spec.ts` escrito; e2e inconclusivo sem dev server (validar rodando `npm run test:e2e` com server ativo). |

---

## Eventos próximos (operacional)

_Lista de eventos que o app vai rodar — datas e nível de criticidade. Se tem evento amanhã, congele mudanças de risco hoje._

- Nenhum agendado no momento.

---

## Métricas vivas

- Tests passando: **57/57** ✅
- Type-check: **ok** ✅
- ESLint: **0 erros** ✅ (check ativo no build)
- DB schema: **sincronizado** ✅ (imageUrl adicionado)
- PWA: **instalável** ✅ (iOS Safari + Android Chrome)
- Vulns npm audit: 10 (Next 14.x — não aplicam aos patterns atuais, plano de upgrade no BACKLOG)

---

## Histórico recente (últimos 5 dias)

### 2026-05-24 (routine background)

3 itens concluídos na branch `routine-pastel-20260524-2101`:
- **Fix PRAGMA log**: `lib/prisma.ts` — `$queryRawUnsafe` em vez de `$executeRawUnsafe` pro `PRAGMA journal_mode = WAL` (eliminado erro cosmético "Execute returned results" nos logs de scripts CLI). 57/57 testes verdes.
- **Doc Next 14→15**: `docs/UPGRADE-NEXT-15.md` criado — breaking changes mapeados (13 route handlers + 1 page com async params, fetch cache invertido, React 19), passos de migração em 3 dias, estimativa 8h. Serve de roadmap pra quando tiver janela.
- **E2E fluxo completo**: `e2e/order-flow.spec.ts` — testa login/switch de roles, criação de pedido com 2 itens, transições EM_PREPARO→PRONTO→ENTREGUE, valida status final via GET /api/orders, rejeição de transição inválida. e2e inconclusivo nesta sessão (sem dev server; mesmo comportamento dos tests auth/api-smoke legados).

### 2026-05-22 (hoje)
- 25 commits — auditoria crítica + guia + housekeeping + reorganização admin + estoque simplificado
- BACKLOG replanejado: 9 itens novos aprovados; 1 fechado (sincronizar STATUS); 1 em PR (backup #4)
- PIN do Gil resetado pra 2699
- Estoque numérico removido — só toggle "Disponível / Esgotou" (decisão de produto: meio pastel de cada recheio inviabiliza contagem)
- Toggle de produto também filtra no atendente (bug encontrado e corrigido)
- **PR #4 aberto:** backup automático diário do dev.db (instrumentation hook do Next 14, WAL checkpoint, retenção 14 dias, scheduler in-process)

### 2026-05-22 (instalação)
- Sistema STATUS/BACKLOG/PLAYBOOK instalado pelo claude-orchestrator (Cowork).
