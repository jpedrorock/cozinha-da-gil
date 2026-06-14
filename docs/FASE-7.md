# Fase 7 — Pagamento (PIX), dashboard de eventos e conveniências de operação

> **Status: ✅ ENTREGUE (5/5).** Todas as features foram implementadas e mergeadas em main.
> PIX (#1) mergeado como PR #30 (2026-06-05). Troco (#2) como PR #28. Comparativo (#3) como PR #29.
> WhatsApp auto-surface (#4) como PR #31 (2026-06-01). "Acabou" (#5) verificado como já existente.
> Next 15 (#23, pré-requisito) mergeado em 2026-05-29.

---

## 1. QR de PIX por pedido (com valor) — ✅ FEITA (PR `claude-pastel/pix-config`)

- **Entregue:** schema `PaymentConfig` (singleton, 3 campos: chave + nome + cidade); `lib/pix.ts` (BR Code EMV-MPM + CRC16-CCITT-FALSE, valor embutido, txid `PDG<id>`) + `tests/pix.test.ts` (13); endpoints `GET/PATCH /api/settings/payment`; card "Pagamento (PIX)" no Caixa do admin (`PagamentoSettings`); `<PixCheckout>` com QR + copia-e-cola no comprovante (oculto na impressão). Vazio → QR não aparece. Dep: `qrcode@1.5.4`. Validado: tsc/lint/192 testes/build.
- **Decisão travada:** QR com o **valor do pedido já embutido** (não estático). Cliente escaneia e o valor vem preenchido.
- **Como:** gerar o "BR Code" (payload EMV-MPM do PIX, padrão BACEN) com chave + valor + txid opcional. Dá pra hand-roll (spec é pública) ou usar lib (`pix-utils`). Renderizar o QR na **tela do cliente** (painel do pedido) e no **comprovante**.
- **Dependência:** a **chave PIX da Gil**, guardada numa config do admin (editável uma vez). Sem chave → feature inativa.
- **Boundary consciente:** isso é **conveniência pro cliente pagar**. **NÃO** rastreia forma de pagamento nem reconcilia caixa — a Gil continua conferindo manualmente. (Rastreio/reconciliação ficou fora de escopo por escolha; adicionar depois se virar dor.)
- **Schema:** nenhum model novo; no máx. 1 campo de config pra chave PIX.

## 2. Calculadora de troco (discreta, uma mão) — ✅ FEITA (PR `claude-pastel/troco-calc`)

- **Entregue:** ícone `Calculator` discreto no `AppHeader right` do atendente → bottom-sheet de uma mão (`components/TrocoCalculator.tsx`): resultado no topo (troco/falta/exato), campos Total/Recebido, numpad grande na base. Lógica pura em `lib/troco.ts` (entrada estilo centavos) + `tests/troco.test.ts` (9 testes). Sem API/schema. Validado: tsc/lint/172 testes/build.
- **Decisão travada:** **discreta** — ícone pequeno no header do atendente, NÃO em evidência. Quando precisar, abre.
- **Como:** bottom-sheet de **uma mão só** — numpad grande (reusa o teclado do PIN), digita "recebi R$" + total → mostra o troco. Standalone (funciona sem pedido aberto).
- **Escopo:** puro client, sem API, sem schema. **Pode ser feita já**, independente do PR #23.

## 3. Comparativo entre eventos (admin) — ✅ FEITA (PR `#29`)

- **Como:** nova sub-aba no admin Vendas: card por `EventSession` (faturamento, nº pedidos, ticket médio) + **hora de pico** + **topping campeão do evento**. Comparação lado a lado.
- **Escopo:** read-only, reusa a agregação existente. Sem schema. Endpoint estático novo (sem `[id]` → sem questão de async-params).

## 4. WhatsApp "tá pronto" — auto-surface 1 toque — ✅ FEITA (PR `#31`)

- **Decisão travada + teto técnico:** o `wa.me` (que o app usa) **não envia sozinho** — exige 1 toque humano no WhatsApp. Então "automático" = ao marcar **PRONTO**, a mensagem prefillada **aparece pronta** → 1 toque pra enviar (em vez de caçar o botão).
- **Entregue:** banner fixed-bottom 1-toque quando vira PRONTO + tem telefone, reutilizando `notifyReady()`. Mergeado como PR #31 (2026-06-01).

## 5. "Acabou" — propagação ao vivo (admin marca) — ✅ FEITA (existia)

- **Decisão travada:** **só admin marca** esgotado (mantém restrito ao Cardápio). O atendente **não** ganha o toggle.
- **Verificado em 2026-05-29:** a propagação ao vivo já existia — toggle de ingrediente faz PATCH que dispara broadcast SSE `ingredient:updated` → atendente aplica `available` ao vivo sem refresh. Feature já estava entregue.

---

## O que o João precisa fornecer

- **Chave PIX** (pra feature #1) — quando for construir.

## Fora de escopo (consciente — pode voltar depois)

- **Rastreio de forma de pagamento + reconciliação de caixa** — só a conveniência do QR foi pedida, não o tracking.
- **Auto-pedido por QR na mesa** (cliente monta no próprio celular) — descartado por hora.
- **Background Sync offline** (fila de mutações sem rede) — risco de pedido duplicado; revisitar só se a queda de wifi virar dor concreta (agora mais seguro pós-Next 15 + idempotency-key existente).
- **Margem/lucro com custo de ingrediente** — não pedido agora.
