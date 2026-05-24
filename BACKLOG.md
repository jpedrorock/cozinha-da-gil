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

---

## ⏭️ Próximos (prontos pra executar)

### Deploy & ops

- [ ] **[P1] #chore #evento** Redeploy Coolify com volume resetado + `SEED_ON_BOOT=true`
  - **Pronto quando:** prod responde em `cozinhadagil.evapro.cloud` com schema novo (imageUrl, dedup, etc), Gil consegue logar com PIN 2699, primeiro caixa pode ser aberto.
  - **Contexto:** depois das mudanças de schema dos commits recentes, volume antigo do Coolify pode ter rows incompatíveis.
  - **Autonomia:** Confirmar antes (mexe em produção real).

### Tech debt com critério

### Cobertura de testes

### Decisão de produto pendente

- [ ] **[P3] #pwa** Decidir se liga HTTPS local
  - **Pronto quando:** `docs/HTTPS-LOCAL.md` atualizado com decisão: ligar com mkcert quando atender festa com convidados externos (não só família); enquanto for evento de família, fica HTTP plano.
  - **Contexto:** PIN trafega em claro na LAN. Pra família 3 devices é OK; pra evento com visitantes não.
  - **Autonomia:** Confirmar antes (decisão de produto).

---

## 🔮 Backlog (precisa refinar antes de executar)

_Itens sem critério de pronto claro ainda._

- [ ] **[P2] #impressora** Melhorar layout do comprovante térmico (margens cortando)
- [ ] **[P2] #pwa** Resolver bug do background sync em offline prolongado (ver docs/BACKGROUND-SYNC.md — decisão atual é NÃO implementar)
- [ ] **[P3] #admin** Dashboard de vendas em tempo real durante evento

---

## ✅ Concluídos recentemente

### 2026-05-24
- [claude-pastel 2026-05-24 background] Fix PRAGMA log barulhento — `lib/prisma.ts` usa `$queryRawUnsafe` pra `journal_mode = WAL` (retorna 1 row; `$executeRawUnsafe` jogava erro cosmético nos logs de CLI).
- [claude-pastel 2026-05-24 background] `docs/UPGRADE-NEXT-15.md` criado — breaking changes (async params/searchParams, fetch caching, React 19, config renomeada), 14 arquivos em risco mapeados, passos de migração, estimativa 3–4h.
- [claude-pastel 2026-05-24 background] E2E Playwright: `e2e/order-flow.spec.ts` — fluxo completo (atendente cria pedido 2 itens → cozinha EM_PREPARO → PRONTO → atendente ENTREGUE → valida DB) + teste de transição inválida. Ambos passando. Fix bônus: senha stale "1234" → "2699" em `e2e/api-smoke.spec.ts` (Gil teve PIN resetado em 22/05).

### 2026-05-22
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
