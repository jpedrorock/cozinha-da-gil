# 🚨 Emergency Reset — quando Gil não consegue logar em prod

Se chegou aqui, é porque o admin (Gil) perdeu acesso ao app em produção
e não consegue trocar PIN via UI. Este doc descreve como resetar a
tabela User remotamente sem precisar de SSH/shell no container.

> **Use só em emergência.** Endpoint cria ponto de exposição que precisa
> ser fechado depois.

## Quando usar

- Gil tentando logar com PIN correto e recebendo 401
- PIN de prod divergente do seed atual e sem outro caminho de recovery
- Coolify shell indisponível
- Login via UI falhando por qualquer motivo

## Como fazer (5 passos)

### 1. Gere um token aleatório longo

No seu terminal local:

```bash
openssl rand -base64 32
```

Vai imprimir algo tipo `Xy9k+B7nQ...mZ4=` (40+ caracteres).

### 2. Adicione a env var no Coolify

1. Coolify Web UI → sua aplicação **cozinha-da-gil** → **Environment Variables**
2. Adiciona:
   - Nome: `BOOTSTRAP_RESET_TOKEN`
   - Valor: o token gerado no passo 1
3. **Salva** e clica **Redeploy** (ou Restart) — o container precisa
   carregar a env var nova

Aguarde o redeploy terminar (~1 minuto).

### 3. Confirme que o endpoint tá ativo

```bash
# Sem token deve dar 401:
curl -X POST https://cozinhadagil.evapro.cloud/api/admin/bootstrap-reset
# {"error":"Token inválido."}

# Sem env var (antes do redeploy) daria 503:
# {"error":"Endpoint desabilitado..."}
```

### 4. Chama o reset com o token

```bash
curl -X POST "https://cozinhadagil.evapro.cloud/api/admin/bootstrap-reset?token=SEU_TOKEN_AQUI"
```

Resposta esperada:

```json
{
  "ok": true,
  "message": "Reset feito. N user(s) apagado(s). Gil admin recriado com PIN 2699.",
  "created": { "id": "...", "name": "Gil", "role": "admin" }
}
```

Agora prod tem **apenas Gil admin com PIN 2699**.

### 5. **REMOVA a env var** (importante!)

1. Volta no Coolify → Environment Variables
2. **Apaga** `BOOTSTRAP_RESET_TOKEN`
3. **Redeploy** de novo

Agora o endpoint voltou a retornar 503 e não dá pra usar mesmo se vazasse o token.

## O que o reset faz exatamente

- `DELETE FROM User` (apaga TODOS os users)
- `INSERT INTO User` com Gil/admin/PIN 2699
- **Histórico de pedidos preservado** (não tem FK pra User; `Order.operator` é string snapshot)
- Outros dados (produtos, ingredientes, sessões de evento) intactos

## Depois que estabilizar

Esse endpoint é tech debt — deve ser **deletado em PR futuro** quando
o sistema de prod estabilizar. Próximos passos:

1. Confirmar que login funciona em prod com PIN 2699
2. Próxima sessão de desenvolvimento: **`rm -r app/api/admin/bootstrap-reset/`** + commit
3. Atualizar STATUS.md / BACKLOG.md

## Segurança — por que esse design

- **Env var ausente = endpoint 503 efetivamente desabilitado.** A maior parte
  do tempo, mesmo se alguém descobrir o path, retorna erro sem fazer nada.
- **Token requer mínimo 16 chars** pra evitar tokens triviais ("1234").
- **Compara via timing-unsafe `===`** mas com tokens longos aleatórios o
  risco é desprezível (a brute force seria impossível dentro da janela
  curta que a env var fica configurada).
- **Sem nenhuma auth de sessão** — justamente o ponto: usar quando
  ninguém consegue autenticar.

Se isso te incomoda (devia incomodar pra qualquer sistema crítico), considere:
- Usar Coolify shell (mais seguro)
- Ou SSH direto no servidor pra rodar `npx tsx scripts/reset-users.ts`

Este endpoint é a opção "quando não tenho mais nada".
