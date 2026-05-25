# STATUS — Pastel da Gil

> Atualizar este arquivo no fim de toda sessão.

**Última atualização:** 2026-05-25
**Atualizado por:** `claude-pastel` (background routine)

---

## Fase atual

Fase 6 entregue. Pós-fase: hardening + observabilidade.

## O que rolou desde a última sessão (routine 2026-05-25)

- Fix PRAGMA: `lib/prisma.ts` usa `$queryRawUnsafe` pra `journal_mode = WAL` (retorna row), silencia "Execute returned results" em scripts CLI.
- Doc `docs/UPGRADE-NEXT-15.md`: plano de upgrade Next 14→15 com 15 arquivos afetados por `params` async, risco `next-pwa`, React 19, estimativa 5-7h.
- Teste `e2e/order-flow.spec.ts`: fluxo completo PEDIDO_FEITO→EM_PREPARO→PRONTO→ENTREGUE com login via UI real (PIN atendente/cozinha) + validação de timestamps. Inconclusivo no container (sem Chromium); validar localmente.

## O que rolou desde a última sessão (presencial 2026-05-22)

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

João: mergear PR #4 (backup) + planejar janela pro redeploy Coolify (P1 do BACKLOG). Também mergeará PR desta routine (fixes + doc + e2e) — rodar `npx playwright install chromium && npm run test:e2e` pra confirmar o order-flow verde.

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
| Testes Playwright e2e | 🟡 | Suite existe mas falta cobrir fluxo completo de pedido (item no BACKLOG). |

---

## Eventos próximos (operacional)

_Lista de eventos que o app vai rodar — datas e nível de criticidade. Se tem evento amanhã, congele mudanças de risco hoje._

- Nenhum agendado no momento.

---

## Métricas vivas

- Tests passando: **57/57** ✅ (Vitest unit)
- Type-check: **ok** ✅
- ESLint: **0 erros** ✅ (check ativo no build)
- DB schema: **sincronizado** ✅ (imageUrl adicionado)
- PWA: **instalável** ✅ (iOS Safari + Android Chrome)
- Vulns npm audit: 10 (Next 14.x — não aplicam aos patterns atuais, plano de upgrade no BACKLOG)

---

## Histórico recente (últimos 5 dias)

### 2026-05-25 (routine background)
- Fix PRAGMA `journal_mode = WAL` em `lib/prisma.ts`: `$queryRawUnsafe` pra silenciar erro nos logs
- Doc `docs/UPGRADE-NEXT-15.md`: plano de upgrade com breaking changes, arquivos afetados, estimativa
- `e2e/order-flow.spec.ts`: fluxo completo de pedido (login PIN → criação → ENTREGUE), inconclusivo no container

### 2026-05-22 (hoje)
- 25 commits — auditoria crítica + guia + housekeeping + reorganização admin + estoque simplificado
- BACKLOG replanejado: 9 itens novos aprovados; 1 fechado (sincronizar STATUS); 1 em PR (backup #4)
- PIN do Gil resetado pra 2699
- Estoque numérico removido — só toggle "Disponível / Esgotou" (decisão de produto: meio pastel de cada recheio inviabiliza contagem)
- Toggle de produto também filtra no atendente (bug encontrado e corrigido)
- **PR #4 aberto:** backup automático diário do dev.db (instrumentation hook do Next 14, WAL checkpoint, retenção 14 dias, scheduler in-process)

### 2026-05-22 (instalação)
- Sistema STATUS/BACKLOG/PLAYBOOK instalado pelo claude-orchestrator (Cowork).
