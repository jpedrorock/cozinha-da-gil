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

-

---

## ⏭️ Próximos (prontos pra executar)

_Adicione itens reais aqui na primeira sessão. Templates abaixo pra você começar:_

### Da Fase 6 (ver docs/FASE-6.md)
- [ ] _adicione conforme docs/FASE-6.md_

### Bugs conhecidos
- [ ] _adicione aqui o que tá te incomodando_

### Manutenção / Tech debt
- [ ] **[P2] #chore** Atualizar deps menores (`npm outdated`)
  - **Pronto quando:** `npm update` rodado (sem mudar major), `npm test` verde.
  - **Autonomia:** OK fazer direto.

- [ ] **[P2] #test** Subir cobertura dos handlers de SSE
  - **Pronto quando:** `npm run test:coverage` mostra > 70% em `app/api/**/*sse*` e `lib/sse*`.
  - **Autonomia:** OK fazer direto.

- [ ] **[P3] #docs** Adicionar exemplo de "modo treinamento" no README pra novos voluntários
  - **Pronto quando:** seção no README mostrando como rodar com seed + senha 1234 sem afetar evento real.
  - **Autonomia:** OK fazer direto.

---

## 🔮 Backlog (precisa refinar antes de executar)

_Itens sem critério de pronto claro ainda._

- [ ] **[P2] #impressora** Melhorar layout do comprovante térmico (margens cortando)
- [ ] **[P2] #pwa** Resolver bug do background sync em offline prolongado (ver docs/BACKGROUND-SYNC.md)
- [ ] **[P3] #admin** Dashboard de vendas em tempo real durante evento

---

## ✅ Concluídos recentemente

- 2026-05-22 · Sistema STATUS/BACKLOG/PLAYBOOK instalado pelo claude-orchestrator (Cowork).

---

## 📝 Regras

1. Puxar do topo de "Próximos".
2. Mover pra "Em progresso" com `[claude-pastel YYYY-MM-DD]` no fim do bullet.
3. **Antes de fechar item que toca em SSE, auth, ou schema: rodar `npm test` e `npm run test:e2e` (se afeta fluxo de pedido).**
4. **Em véspera de evento (ver STATUS → "Eventos próximos"): só commitar mudanças P2/P3 baixo risco. P0/P1 viram PR pra revisar com calma.**
5. Item sem critério de pronto claro → mover pra "Backlog" e rodar `/planejar`.
