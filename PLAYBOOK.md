# PLAYBOOK — Como trabalhar autonomamente no Pastel da Gil

> Regras de autonomia. Tudo aqui pode ser feito sem perguntar.

---

## Modos de execução

### Modo presencial (João disponível)
- Pode perguntar em decisões de produto/fluxo.
- Pode renegociar escopo.

### Modo headless / background (João não disponível)
- **Nunca trave esperando resposta.** Registre bloqueios em STATUS → "Bloqueios ativos".
- **Não toque em itens marcados "Confirmar antes".**
- **Não rode comandos destrutivos**: `prisma migrate reset` em prod, `rm -rf`, `git push --force`.
- **Limite a 1 PR por item.** Não acumule.
- Pare ao chegar em `[P0]` que precisa de confirmação.
- Se "Eventos próximos" em STATUS tem evento em ≤ 48h: **só toque em P2/P3** baixo risco. Nada que mexa em SSE, auth, schema.

### Como saber em qual modo está
- `/trabalhar` interativo → presencial
- `claude -p` ou Routine agendada → background
- Em dúvida: pergunte uma vez ("Modo presencial ou background?"). Sem resposta em 30s → background.

---

## Início de sessão (obrigatório)

1. Ler `STATUS.md` (inclui "Eventos próximos" — crítico)
2. Ler `BACKLOG.md`
3. Ler `PLAYBOOK.md`

---

## Fim de sessão (obrigatório)

1. Atualizar `STATUS.md`
2. Mover item completo no `BACKLOG.md`
3. Commit com `<tipo>: <descrição> (backlog: <título-curto>)`

---

## O que posso fazer SEM perguntar

- **Implementar P1/P2/P3** com critério claro e marcado "OK fazer direto".
- `npm run dev`, `npm test`, `npm run lint`, `npx prisma db push` (LOCAL apenas), `npm run db:studio`.
- **Refatorações internas** a um arquivo sem mudar comportamento externo.
- **Atualizar deps menores** (`npm update` sem `--latest`) com testes verdes.
- **Escrever testes novos** (Vitest e Playwright) pra código existente.
- **Editar docs** em `*.md`, `docs/`.
- **Atualizar STATUS.md e BACKLOG.md**.

## O que preciso PERGUNTAR ou ABRIR PR

- **Mexer em `prisma/schema.prisma`** → SEMPRE PR. Migration em SQLite local é fácil; em produção (laptop da barraca) qualquer reset perde histórico de vendas. Cuidado redobrado.
- **Mexer em `lib/session*` ou auth (`iron-session`)** → PR. Sessão quebrada = todos os atendentes deslogados em pleno evento.
- **Mexer em SSE (`app/api/**/sse*`, `lib/sse*`)** → PR + roda Playwright e2e antes. SSE caindo = cozinha não vê pedidos novos.
- **Mexer em `app/comprovante/`, PDFKit, impressora térmica** → PR. Comprovante errado = problema fiscal/comprovação.
- **Mexer em `ecosystem.config.js`, `Dockerfile`, `docker-compose.yml`, `docker-entrypoint.sh`** → PR. Errar aqui derruba o app na barraca.
- **Mexer em `next.config.mjs` (especialmente PWA config)** → PR.
- **Subir versão major** de `next`, `react`, `prisma`, `tailwind` → PR com nota de breaking changes.
- **Deletar arquivo** → perguntar (exceto build artifacts em `.next/`, `dist/`, `node_modules/`).
- **Itens P0** → confirmar com João antes (modo presencial) ou pular (modo background).
- **Tocar em `dev.db` ou backups** em `prisma/backups/` → NUNCA sem confirmação.

## O que NUNCA faço

- Commit em `main` direto sem PR pra mudanças não-triviais.
- `git push --force` em branch compartilhada.
- `prisma migrate reset` em qualquer ambiente sem confirmação explícita.
- Expor secrets (`SESSION_SECRET`, conteúdo de `.env`) em commits, logs ou MDs.
- Tocar em `.env`, `.env.example` sem confirmação.
- Mudanças em véspera de evento (≤ 24h) que mexam em fluxo de pedido, SSE, auth ou schema.

---

## Padrões de commit e PR

**Commits:**
- Imperativo, pt-BR ou en, curto: `fix: SSE reconectar após sleep do laptop`
- Se fechar BACKLOG: `(backlog: <título-curto>)`

**Branches:**
- `claude-pastel/<short-desc>`

**PR:**
- Título igual ao item do BACKLOG
- Descrição: o que mudou, por que, **como testar localmente**, screenshots se mexe em UI dos 4 papéis
- Draft enquanto `npm test` + `npm run lint` não passarem

---

## Qualidade — checks antes de pronto

Mínimo absoluto pra P0/P1:
```bash
npm run lint
npm test              # vitest unit
```

Pra mudanças em fluxo de pedido, SSE, auth ou comprovante:
```bash
npm run test:e2e      # Playwright — pode demorar
```

Pra mudanças em schema:
```bash
npx prisma db push    # local
npm run db:seed       # se seed precisa reaplicar
npm test
```

---

## Quando travar

Pare e registre em STATUS → "Bloqueios ativos" quando:

- Mais de 30 min sem progresso visível.
- Critério de pronto não bate com a realidade.
- Decisão de fluxo da barraca (ex: "quando o cliente paga? antes ou depois de receber?").
- Necessidade de testar com hardware real (impressora térmica, tablets).
- Conflito com mudança em `dev.db` que requer reset (peça permissão sempre).

Bloqueio bem-escrito tem: o que tentava fazer, o que descobriu que trava, 2+ opções de resolução, sua recomendação.

---

## Routine background — branches vazias

**Causa identificada (2026-06-15):** a routine cria a branch (`git checkout -b routine-pastel-*`) no passo 2, **antes** de avaliar se há itens elegíveis em "Próximos". Se todos os itens são "Confirmar antes", "Abrir PR" ou P0, a branch nasce sem trabalho → PR log-only → accumula 40+ branches.

**Regra corretiva:** antes de criar a branch, avaliar mentalmente se há ao menos 1 item "OK fazer direto" ou "Abrir PR" na fila "Próximos". Se a fila estiver 100% bloqueada:
1. **Não criar branch.**
2. Atualizar `STATUS.md` diretamente em `main` com: `"Routine encerrada — sem itens elegíveis em Próximos. Fila bloqueada: todos itens são Confirmar antes / P0."`
3. Registrar em "Bloqueios ativos" se a fila ficar bloqueada por múltiplas rotinas seguidas.

---

## Dicas práticas pra este projeto

- **App roda local em evento.** Não tem CI/CD bonito. Testes ANTES de commitar.
- **SSE é frágil em network ruim** — wifi de evento é caótico. Mudanças nessa parte precisam testar com throttling.
- **Next.js 14 App Router** — `'use client'` necessário em componentes interativos. Server Components por default.
- **Prisma + SQLite** — não usa migrations formais em dev, `prisma db push` direto. Em "produção" (laptop da barraca) o mesmo arquivo `dev.db` vive entre eventos.
- **iron-session** — sessão é cookie criptografado, server-side. Mudou `SESSION_SECRET` = todo mundo desloga.
- **PWA next-pwa** — service worker cacheia agressivo. Bump de versão necessário pra cliente receber update.
- **next-pwa em dev** — desabilitado em dev por padrão. Testar PWA = `npm run build && npm start`.
- **Impressora térmica** — fluxo via PDFKit (ver docs/IMPRESSORA-TERMICA.md). Não testar com impressora real sem hardware presente.
- **Senhas de seed (`1234`)** — só pra dev. Em "produção" (barraca), Gil troca manualmente após primeiro setup.
- **`prisma/backups/`** — backups de eventos passados. NÃO mexer, são dados reais.
- **Backfills** — scripts tipo `prisma/backfill-fase6.ts` são idempotentes; rodar sem medo localmente, em produção SEMPRE confirmar.
