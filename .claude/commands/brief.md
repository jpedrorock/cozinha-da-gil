---
description: Gera resumo curto do que rolou desde a última leitura.
---

Você está rodando `/brief` no Pastel da Gil.

## Roteiro

1. Leia STATUS.md, BACKLOG.md (topo + concluídos).

2. Rode em paralelo (uma única mensagem):
   - `git log --oneline -10`
   - `git status --short`

3. **Não rode comandos custosos** (build/test).

4. Gere saída neste formato:

   ```
   📊 BRIEFING — Pastel da Gil · <data>

   FASE: <de STATUS>
   EVENTO PRÓXIMO: <data e nome, ou "nenhum agendado">

   DESDE ONTEM
   - <bullet>
   - <bullet>

   BLOQUEIOS ATIVOS
   - <de STATUS, ou "nenhum">

   PRÓXIMOS 3
   1. [P?] <título do BACKLOG>
   2. [P?] <título>
   3. [P?] <título>

   SAÚDE
   <só módulos não-🟢>

   COMANDOS PRA HOJE
   - `/trabalhar` na conversa claude-pastel
   - <ou outro, se bloqueio precisa decisão>
   ```

5. **NÃO atualize arquivos.** Só leitura.
6. Notou inconsistência (ex: STATUS diz fase 6 mas commits são de fase 7): `⚠️ STATUS.md possivelmente desatualizado: <o quê>`.
