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

- [ ] **[P2] #test** E2E Playwright: fluxo completo de 1 pedido (atendente → cozinha → entregue)
  - **Pronto quando:** `e2e/order-flow.spec.ts` faz login Gil, abre caixa, troca pra atendente (PIN), cria pedido com 2 itens, troca pra cozinha, marca pronto, volta atendente, marca entregue, valida row final no DB. `npm run test:e2e` verde.
  - **Contexto:** se algo quebrar SSE/auth/schema, esse teste captura antes de chegar em prod.
  - **Autonomia:** OK fazer direto.

### Hardening pra barraca real

### UX / desktop & cardápio

- [ ] **[P2] #ux #admin #atendente #cozinha #cliente** Auditoria UX desktop — paridade com mobile + botões de voltar
  - **Pronto quando:** revisar as 4 telas (atendente, cozinha, cliente, admin) no desktop (>= 1024px) e gerar relatório com gaps: (1) botões de voltar presentes onde mobile tem (header, drawer, dialogs), (2) navegação consistente, (3) hierarquia visual proporcional pra telas maiores (largura cards, hover states, atalhos de teclado), (4) sem regressões do mobile-first audit recente. Gaps viram itens P3 separados se >5.
  - **Contexto:** sprint recente focou mobile-first; design ficou ótimo mobile mas pode ter ficado órfão no desktop. Algumas telas tinham botão voltar antes que sumiu na refatoração.
  - **Autonomia:** OK fazer direto (auditoria-relatório; correções viram outros items).

- [ ] **[P3] #admin** Drag-and-drop pra reordenar ingredientes dentro de categoria
  - **Pronto quando:** arrastar ingrediente reordena dentro da categoria; nova ordem persiste em `Ingredient.position` via PATCH em batch; atendente reflete via SSE (`ingredient:updated`). Usa `@dnd-kit`.
  - **Contexto:** hoje ordem vem do seed e admin não controla. Útil pra Gil botar topping mais popular no topo do stepper.
  - **Autonomia:** OK fazer direto.


- [ ] **[P3] #admin** Busca rápida no Cardápio → Ingredientes
  - **Pronto quando:** input de busca acima das categorias filtra ingredientes pelo nome em tempo real; categorias vazias somem; conta resultado total. Padrão visual igual ao do IconPicker.
  - **Contexto:** se Gil chegar a 40+ ingredientes (provável após a feature de add), scroll fica chato.
  - **Autonomia:** OK fazer direto.

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
- [ ] **[P3] #pwa** Screenshots no manifest pra rich install UI no Chrome Android
  - **Pronto quando:** 2-3 screenshots reais em `/public/screenshots/` (atendente, cozinha, cliente), declarados em `app/manifest.ts` com `form_factor: "narrow"` e/ou `"wide"`.
  - **Contexto:** rodar `npm run dev`, abrir cada tela em viewport mobile, capturar via DevTools, otimizar com sharp. Audit PWA #6.
- [ ] **[P3] #pwa #sw** Reativar `fallbacks: { document: "/offline" }` quando migrar pro `@ducanh2912/next-pwa`
  - **Contexto:** next-pwa@5.6.0 tem bug que quebra build com runtimeCaching customizado + fallbacks. Hoje `/offline` existe mas só serve navegação manual.

---

## ✅ Concluídos recentemente

### 2026-05-27
- [claude-pastel 2026-05-27 background] **Testes unitários endpoints ingrediente** — `lib/ingredients.ts` com funções puras de validação (`validateIngredientName`, `parseIconValue`, `isAllowedCategory`); `tests/ingredients-api.test.ts` com 25 casos cobrindo todos os caminhos. Endpoints `POST/PATCH/DELETE /api/ingredients` refatorados pra usar lib pura. 82/82 testes passando.
- [claude-pastel 2026-05-27 background] **Smoke test pré-evento** — `scripts/smoke-test.ts` verifica DB, auth Gil, servidor (GET /api/health), status caixa, backup recente. Exit 0 = OK, exit 1 = problemas listados. Roda `npx tsx scripts/smoke-test.ts`.
- [claude-pastel 2026-05-27 background] **Health check `/api/health`** — ajustado pra retornar 503 + lista `problems` quando DB falha; body inclui `status: "ok"|"degraded"`, `db`, `sse: { connections }`, `uptimeSec`. Formato alinhado ao critério do BACKLOG.
- [claude-pastel 2026-05-27 background] **Iconify offline fallback** — `IconPicker` detecta `navigator.onLine` + event listeners `online/offline`; quando offline ou fetch falha, exibe banner "Sem internet — só dá pra subir SVG/PNG ou usar ícone já escolhido" com atalho pra aba upload. Input de busca fica disabled. Aba "Subir arquivo" 100% funcional offline.
- [claude-pastel 2026-05-27 background] **Contagem por categoria no header de Ingredientes** — Cardápio → Ingredientes mostra "Toppings (12)" / "Doces (3)" no header de cada seção.

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
