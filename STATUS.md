# STATUS — Pastel da Gil

> Atualizar este arquivo no fim de toda sessão.

**Última atualização:** 2026-05-23
**Atualizado por:** `claude-pastel` (routine background)

---

## Fase atual

Fase 6 entregue. Pós-fase: hardening + observabilidade.

## O que rolou desde a última sessão

- Routine background 2026-05-23: 4 itens do BACKLOG entregues (promotions SSR, script imagens órfãs, doc Next 15, E2E fluxo completo)
- `promotions` via SSR — eliminado fetch+useEffect em `AtendenteClient`; page.tsx passa `initialPromotions`
- `scripts/cleanup-orphan-images.ts` — dry-run por default, --delete pra apagar arquivos não referenciados no DB
- `docs/UPGRADE-NEXT-15.md` — plano detalhado de upgrade Next 14→15: 18 arquivos, codemod oficial, estimativa 4,5h
- `e2e/order-flow.spec.ts` — fluxo completo API + smoke de páginas UI com operador injetado via localStorage

## Bloqueios ativos

- Nenhum.

## Próximo passo recomendado

Redeploy do Coolify com volume resetado + `SEED_ON_BOOT=true` (P1 do BACKLOG, "Confirmar antes") — só assim o schema novo (imageUrl, dedup, etc) sobe pra prod. Requer João presente. Segundo item prioritário: backup automático do dev.db (P1, "Abrir PR").

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

- Tests passando: **57/57** ✅
- Type-check: **ok** ✅
- ESLint: **0 erros** ✅ (check ativo no build)
- DB schema: **sincronizado** ✅ (imageUrl adicionado)
- PWA: **instalável** ✅ (iOS Safari + Android Chrome)
- Vulns npm audit: 10 (Next 14.x — não aplicam aos patterns atuais, plano de upgrade no BACKLOG)

---

## Histórico recente (últimos 5 dias)

### 2026-05-23 (routine background)
- Promotions via SSR: `app/atendente/page.tsx` busca promoções ativas no servidor, passa `initialPromotions` ao Client
- Script `scripts/cleanup-orphan-images.ts`: lista/apaga imagens de produtos sem referência no DB (dry-run por default)
- Doc `docs/UPGRADE-NEXT-15.md`: plano de migração Next 14→15 completo, 18 arquivos identificados
- E2E `e2e/order-flow.spec.ts`: cobre fluxo completo atendente→cozinha→entregue + smoke UI das páginas

### 2026-05-22
- 22 commits — auditoria crítica + guia + housekeeping + reorganização admin
- BACKLOG replanejado: 9 itens novos aprovados (higiene, deploy, tech debt, testes, decisão produto)
- PIN do Gil resetado pra 2699

### 2026-05-22 (instalação)
- Sistema STATUS/BACKLOG/PLAYBOOK instalado pelo claude-orchestrator (Cowork).
