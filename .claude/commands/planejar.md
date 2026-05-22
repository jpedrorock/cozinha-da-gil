---
description: Revisa o estado e propõe novos itens pra "Próximos" no BACKLOG.
---

Você está rodando `/planejar` no Pastel da Gil.

Objetivo: gerar 5–10 itens novos pra "Próximos" do BACKLOG, pra João aprovar.

## Roteiro

1. Leia STATUS.md (em especial "Eventos próximos"), BACKLOG.md, PLAYBOOK.md, README.md, docs/FASE-6.md (fase atual).

2. **Diagnóstico**:
   - Quais módulos em STATUS estão 🟡/🔴?
   - O `docs/FASE-6.md` (ou fase atual) tem TODOs/próximos passos abertos?
   - Quais TODOs em código? `grep -rn -E "(TODO|FIXME)" --include="*.ts" --include="*.tsx" -l app/ lib/ components/`
   - `npm outdated` — quais deps?
   - `npm test` passa? Algum teste flaky?
   - Algum bug conhecido em `docs/` (HTTPS-LOCAL, IMPRESSORA-TERMICA, BACKGROUND-SYNC)?
   - Há evento próximo? Itens de preparação?

3. **Proponha itens** no formato BACKLOG:
   ```
   - [ ] **[P?] #tag** Título curto e acionável
     - **Pronto quando:** critério objetivo
     - **Contexto:** referência (opcional, max 1 linha)
     - **Autonomia:** "OK fazer direto" | "Abrir PR" | "Confirmar antes"
   ```

4. **NÃO escreva direto no BACKLOG.md.** Apresente proposta numerada, agrupada por categoria (Fase atual, Bugs, Evento próximo, Manutenção). Pergunte ao João: quais entram, em que ordem, vira P0/P1?

5. **Aplique escolhas**: edite BACKLOG.md adicionando aprovados.

6. **Atualize STATUS.md**: "Backlog replanejado: N novos itens."

## Boas regras

- **Não invente trabalho.** Só sugira com evidência.
- **Mudanças em fluxo da barraca** (cliente paga antes ou depois? formato do comprovante? quem cancela pedido?) → sempre "Confirmar antes".
- **Em véspera de evento**: prioridade absoluta pra estabilidade, não features. Sugira só itens de hardening.
- **Quebre item grande** em sub-itens.
