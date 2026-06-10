# Fase 7 — Pagamento (PIX), dashboard de eventos e conveniências de operação

> **✅ ENTREGUE — 5/5 features concluídas (último merge: 2026-06-09).**
> Fase pós-hardening: manutenção de cardápio (seed + UI admin), a11y, SSW cache, backup dev.db.

---

## 1. QR de PIX por pedido (com valor) — ✅ FEITA (PR `claude-pastel/pix-config`)

- **Entregue:** schema `PaymentConfig` (singleton, 3 campos: chave + nome + cidade); `lib/pix.ts` (BR Code EMV-MPM + CRC16-CCITT-FALSE, valor embutido, txid `PDG<id>`) + `tests/pix.test.ts` (13); endpoints `GET/PATCH /api/settings/payment`; card "Pagamento (PIX)" no Caixa do admin (`PagamentoSettings`); `<PixCheckout>` com QR + copia-e-cola no comprovante (oculto na impressão). Vazio → QR não aparece. Dep: `qrcode@1.5.4`. Validado: tsc/lint/192 testes/build.
- **Decisão travada:** QR com o **valor do pedido já embutido** (não estático). Cliente escaneia e o valor vem preenchido.
- **Como:** gerar o "BR Code" (payload EMV-MPM do PIX, padrão BACEN) com chave + valor + txid opcional. Dá pra hand-roll (spec é pública) ou usar lib (`pix-utils`). Renderizar o QR na **tela do cliente** (painel do pedido) e no **comprovante**.
- **Dependência:** a **chave PIX da Gil**, guardada numa config do admin (editável uma vez). Sem chave → feature inativa.
- **Boundary consciente:** isso é **conveniência pro cliente pagar**. **NÃO** rastreia forma de pagamento nem reconcilia caixa — a Gil continua conferindo manualmente. (Rastreio/reconciliação ficou fora de escopo por escolha; adicionar depois se virar dor.)
- **Schema:** nenhum model novo; no máx. 1 campo de config pra chave PIX.

## 2. Calculadora de troco (discreta, uma mão) — ✅ FEITA (PR #28 mergeada 2026-05-29)

- **Entregue:** ícone `Calculator` discreto no `AppHeader right` do atendente → bottom-sheet de uma mão (`components/TrocoCalculator.tsx`): resultado no topo (troco/falta/exato), campos Total/Recebido, numpad grande na base. Lógica pura em `lib/troco.ts` (entrada estilo centavos) + `tests/troco.test.ts` (9 testes). Sem API/schema. Validado: tsc/lint/172 testes/build.
- **Decisão travada:** **discreta** — ícone pequeno no header do atendente, NÃO em evidência. Quando precisar, abre.
- **Como:** bottom-sheet de **uma mão só** — numpad grande (reusa o teclado do PIN), digita "recebi R$" + total → mostra o troco. Standalone (funciona sem pedido aberto).
- **Escopo:** puro client, sem API, sem schema. **Pode ser feita já**, independente do PR #23.

## 3. Comparativo entre eventos (admin) — ✅ FEITA (PR #29 mergeada 2026-05-29)

- **Entregue:** sub-aba "Comparativo" em admin Vendas: card por `EventSession` (faturamento, nº pedidos, ticket médio), hora de pico e topping campeão. Reusa agregação existente. Sem schema.

## 4. WhatsApp "tá pronto" — auto-surface 1 toque — ✅ FEITA (PR #31 mergeada 2026-06-01)

- **Entregue:** banner fixed-bottom 1-toque quando pedido vira PRONTO + cliente tem telefone. Reusa `notifyReady()`. Só dispara se tem telefone cadastrado.

## 5. "Acabou" — propagação ao vivo (admin marca) — ✅ FEITA (verificado 2026-05-29)

- **Entregue:** toggle "esgotou" do admin já propagava via SSE `ingredient:updated` → atendente aplica `available` ao vivo. Nenhum código adicional necessário.

---

## O que o João precisa fornecer

- **Chave PIX** (pra feature #1) — quando for construir.

## Fora de escopo (consciente — pode voltar depois)

- **Rastreio de forma de pagamento + reconciliação de caixa** — só a conveniência do QR foi pedida, não o tracking.
- **Auto-pedido por QR na mesa** (cliente monta no próprio celular) — descartado por hora.
- **Background Sync offline** (fila de mutações sem rede) — risco de pedido duplicado; revisitar só se a queda de wifi virar dor concreta (agora mais seguro pós-Next 15 + idempotency-key existente).
- **Margem/lucro com custo de ingrediente** — não pedido agora.
