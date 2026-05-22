---
description: Puxa o próximo item de BACKLOG.md, implementa, valida com checker, atualiza STATUS.md.
---

Você está rodando `/trabalhar` no Pastel da Gil.

## Roteiro

1. **Identifique modo**. Leia CLAUDE.md e PLAYBOOK.md → "Modos de execução". Declare: "Sou `claude-pastel`, em modo `presencial` | `background`."

2. **Ritual**. Leia: STATUS.md (atenção em "Eventos próximos"), BACKLOG.md, PLAYBOOK.md.

3. **Verifique modo congelamento**: se STATUS → "Eventos próximos" tem evento em ≤ 48h, só processe P2/P3 baixo risco. P0/P1 que mexem em SSE/auth/schema/comprovante: pule e registre "modo congelamento ativo".

4. **Escolha próximo item**:
   - Primeiro de "Próximos", de cima pra baixo.
   - `[P0]` presencial: confirme. Background: PULE.
   - Sem critério de pronto claro: pule e sinalize.
   - "Confirmar antes" (decisão de fluxo da barraca): em background sempre pular; em presencial perguntar.

5. **Mova pra "Em progresso"** com `[claude-pastel YYYY-MM-DD]`.

6. **Implemente**:
   - Use task list interna.
   - Respeite PLAYBOOK (modo apropriado).
   - Pra mudanças em schema: `npx prisma db push` em LOCAL apenas.
   - Pra mudanças em fluxo de pedido: rode `npm test` E `npm run test:e2e`.
   - Pra mudanças em SSE: teste manualmente abrindo /cozinha em outra aba.

7. **CHECKER (obrigatório pra [P0]/[P1])**:
   Antes de marcar pronto, dispare Task tool (subagent_type "general-purpose" ou "Explore") com:

   > Você é o checker do Pastel da Gil. O agente principal implementou: "<título>" com critério: "<critério>". Examine `git diff HEAD` e arquivos tocados.
   > 1. Critério atendido? Sim/Não com evidência.
   > 2. Regressão em arquivo não-intencional? Sim/Não.
   > 3. Mudou algo em `prisma/`, `lib/session*`, SSE, ou `app/comprovante/`? Se sim, confirme que rodou os testes apropriados.
   > 4. Há evento em ≤ 48h em STATUS.md? Mudança é segura pra produção?
   > 5. Recomendação: aprovar / pedir ajuste / rejeitar.
   > Máximo 150 palavras.

   Rejeitado/ajuste: corrija, rode testes, dispare checker de novo. Max 2 ciclos.

   `[P2]/[P3]` pulam checker (exceto se tocam schema ou SSE).

8. **Item pronto**:
   - Move pra "Concluídos recentemente".
   - Atualiza STATUS.md.
   - Commit: `<tipo>: <descrição> (backlog: <título-curto>)`.

9. **Continua?**:
   - Presencial: viável sem decisão nova → volta pro 4. Travou → registra bloqueio.
   - Background: sempre volta pro 4 até fila acabar ou 3 bloqueios.

## Regras de segurança

- Background herda restrições do PLAYBOOK → "Modo headless".
- Não rodar `prisma migrate reset`.
- Não tocar em `dev.db` ou `prisma/backups/`.
- Não delete arquivos sem confirmar (exceto `.next/`, `node_modules/`, `test-results/`).
- Em modo congelamento de evento: respeite, não force trabalho.
