---
description: Fecha o dia — revê commits, atualiza STATUS, propõe 3 itens pra amanhã, gera snapshot pro briefing matinal.
---

Você está rodando `/noite` no Pastel da Gil.

## Roteiro

1. **Leitura**:
   - STATUS.md
   - BACKLOG.md (Em progresso + Concluídos recentemente)
   - `git log --oneline --since="yesterday"`
   - `git status --short`

2. **Revisão**:
   - Quantos itens fecharam hoje?
   - Algum ficou em "Em progresso" sem fechar?
   - Commit não-capturado por BACKLOG? Adicione retroativamente.
   - `npm test` passou? (rode `npm test` se ainda não foi rodado hoje — único comando custoso permitido no /noite, ~5s).

3. **Atualizar STATUS.md**:
   - "Última atualização" → agora
   - "Atualizado por" → `claude-pastel` + tag `/noite`
   - "Fase atual" → revise
   - "O que rolou desde a última sessão" → 3–5 bullets
   - "Bloqueios ativos" → revise
   - "Eventos próximos" → ATUALIZE se algum evento se aproxima de 48h (vira modo congelamento amanhã)
   - "Próximo passo recomendado" → pensando no João amanhã
   - "Saúde dos módulos" → revise emojis
   - "Histórico recente" → adicione entrada de hoje

4. **3 itens pra "Próximos" de amanhã**:
   - Se "Próximos" já tem 3+ viáveis → confirme em STATUS.
   - Menos que 3 → analise estado, proponha 3 itens. NÃO adicione direto, apresente bloco numerado.

5. **Snapshot pro briefing matinal** em `docs/briefing-snapshot.md`:

   ```yaml
   data: <YYYY-MM-DD>
   projeto: pastel-da-gil
   fase: <de STATUS>
   evento_proximo: "<data + nome ou null>"
   modo_congelamento: <true | false>  # true se evento em ≤ 48h
   fechados_hoje: <N>
   em_progresso: <N>
   bloqueios:
     - <texto curto>
   proximos_3:
     - "[P?] título"
     - "[P?] título"
     - "[P?] título"
   modulos_amarelos: [lista]
   modulos_vermelhos: [lista]
   testes_passando: <true | false | desconhecido>
   sugestao_para_manha: "rode /trabalhar | resolva X | aprove PR Y | /planejar (fila magra) | congelamento ativo"
   ```

6. **Commit**:
   - `git add STATUS.md BACKLOG.md docs/briefing-snapshot.md`
   - `git commit -m "chore(noite): fechamento <data>"`

## Regras

- Só leitura + metadados + 1 `npm test` permitido.
- NÃO implementa código de produto.
- Bug crítico descoberto: adiciona `[P0]` no BACKLOG + nota em STATUS. NÃO conserta.
- Sem certeza de escopo: pergunta antes de mexer.
