# ROTINA — Pastel da Gil

> Mesmo sistema do Cultivo e IRed, adaptado pra esse projeto. Veja `/Users/joaopedro/Cultivo App/ROTINA.md` se quiser a explicação completa do desenho.

---

## Arquivos vivos

| Arquivo | Pra quê |
|---|---|
| **CLAUDE.md** | Entrypoint estável |
| **STATUS.md** | Estado atual, atualizado a cada sessão (inclui "Eventos próximos") |
| **BACKLOG.md** | Fila P0–P3 |
| **PLAYBOOK.md** | Regras de autonomia, com cuidados específicos por ser app de evento |
| **README.md** | Doc oficial do projeto (deploy, comandos) |
| **docs/FASE-6.md** | Fase atual de desenvolvimento |

## Slash commands

- `/trabalhar` — pega topo do BACKLOG, implementa, checker pra P0/P1, atualiza STATUS
- `/planejar` — analisa estado, propõe novos itens
- `/brief` — resumo do que rolou
- `/noite` — fechamento do dia + snapshot pro briefing matinal das 8h

## Diferenças importantes vs outros projetos

1. **Stack Next.js 14 (App Router)** — não Vite. Server vs Client Components matter.
2. **npm, não pnpm** — checar tudo no `package.json`.
3. **Prisma + SQLite** — schema em `prisma/schema.prisma`. `npx prisma db push` aplica local.
4. **SSE pra real-time** — não tRPC, não WebSocket. Fragilidade na rede do evento.
5. **PWA + offline** — service worker (`next-pwa`).
6. **Produção é laptop em evento** — mudanças sensíveis exigem PR mesmo P1.
7. **Tem Playwright e2e** — rodar antes de fechar P0/P1 que mexe em fluxo.
8. **Single-Claude** — sem multi-identidade. Sempre `claude-pastel`.

## Pra começar a usar

1. Edita `STATUS.md` agora com a **fase atual** (provavelmente "Fase 6 — ver docs/FASE-6.md"), **eventos próximos** (se há barraca marcada), e emojis dos módulos.
2. Adiciona 5–10 itens reais em `BACKLOG.md` → "Próximos". Pode puxar do `docs/FASE-6.md`.
3. Roda `/brief` numa conversa Claude Code pra ver se renderiza ok.
4. Roda `/trabalhar` num item P2 baixo risco pra testar o ciclo.

## Integração com o briefing matinal (Cowork)

O briefing das 8h já tá configurado pra olhar esse projeto. Ele tenta ler:
1. `docs/briefing-snapshot.md` (gerado por `/noite`)
2. `STATUS.md` (fallback)
3. `BACKLOG.md` (pega os 3 próximos)

E o `/noite` automatizado (Cowork) roda às 22h e gera o snapshot pra amanhã.

## Cuidado de evento

Se "Eventos próximos" em STATUS.md mostra evento ≤ 48h:
- **Modo congelamento**: só P2/P3 baixo risco entram nos commits
- **Mudanças em fluxo de pedido / auth / SSE / schema**: viram PR pra revisar depois do evento
- `/noite` na véspera deve registrar isso explicitamente no snapshot pra o briefing de amanhã avisar
