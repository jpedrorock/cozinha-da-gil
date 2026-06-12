# Fase 7 — Pagamento (PIX), dashboard de eventos e conveniências de operação

> **Status: ✅ ENTREGUE (2026-06-05).** 5/5 features implementadas e mergeadas em main.
> Next 15 deployado em prod via Coolify. PIX configurável pelo admin. Troco, comparativo,
> WhatsApp auto-surface e "Acabou" ao vivo — todos funcionando. Doc mantido como referência histórica.

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

## 3. Comparativo entre eventos (admin) — ✅ FEITA (PR #29)

- **Entregue:** sub-aba "Comparativo" no admin Vendas. Card por `EventSession` com faturamento, nº pedidos, ticket médio. Mergeado junto ao PR #23 (Next 15).
- **Escopo original:** read-only, reusa a agregação existente. Sem schema. Endpoint estático novo.

## 4. WhatsApp "tá pronto" — auto-surface 1 toque — ✅ FEITA (PR #31)

- **Entregue:** banner fixed-bottom 1-toque no atendente quando pedido vira PRONTO e tem telefone. Reusa `notifyReady()` existente. PR #39 complementar (auto-abrir wa.me pós-pedido + botão Comprovante em todo card) mergeado junto. Validado em prod 2026-06-01.
- **Teto técnico mantido:** `wa.me` exige 1 toque humano. Automático 100% (sem toque) exigiria WhatsApp Business API — fora de escopo consciente.

## 5. "Acabou" — propagação ao vivo (admin marca) — ✅ FEITA (já existia)

- **Verificado em 2026-05-29:** PATCH ingrediente já dispara broadcast `ingredient:updated` → atendente aplica `available` ao vivo via SSE, sem refresh. Feature completa sem código novo.
- **Decisão mantida:** só admin marca esgotado (restrito ao Cardápio). Atendente não ganha o toggle.

---

## O que o João precisa fornecer

- **Chave PIX** (pra feature #1) — quando for construir.

## Fora de escopo (consciente — pode voltar depois)

- **Rastreio de forma de pagamento + reconciliação de caixa** — só a conveniência do QR foi pedida, não o tracking.
- **Auto-pedido por QR na mesa** (cliente monta no próprio celular) — descartado por hora.
- **Background Sync offline** (fila de mutações sem rede) — risco de pedido duplicado; revisitar só se a queda de wifi virar dor concreta (agora mais seguro pós-Next 15 + idempotency-key existente).
- **Margem/lucro com custo de ingrediente** — não pedido agora.
