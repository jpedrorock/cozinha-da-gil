#!/bin/sh
#
# Entrypoint do container — roda antes do CMD (npm start).
#
# Tarefas:
#   1. Sincroniza schema do Prisma com o SQLite em /app/data
#      (cria o arquivo na 1ª subida, aplica diffs em redeploys subsequentes)
#   2. [Opcional] Roda seed se variável SEED_ON_BOOT=true e DB tá vazio
#   3. Repassa controle pro CMD (npm start → next start)
#
# Por que aqui e não no Dockerfile? Porque o volume `/app/data` só existe
# em runtime — no build, o DB não está montado.

set -e

DB_PATH="/app/data/dev.db"

echo "🔧 Sincronizando schema do Prisma em $DB_PATH..."
# --skip-generate: client já foi gerado no build, não precisa de novo.
# --accept-data-loss: aceita diffs destrutivos em dev — em produção real,
# usar `prisma migrate deploy` com migrations versionadas em vez de db push.
# Por hora, single-node + schema estável = db push é suficiente.
DATABASE_URL="file:$DB_PATH" npx prisma db push --skip-generate --accept-data-loss \
  || echo "⚠️ prisma db push falhou — pode ser primeiro boot, continuando."

# Audit #63: migra imageDataUrl legacy → arquivo no volume. Idempotente:
# produtos sem imageDataUrl ou que já têm imageUrl são pulados.
# Em primeiro boot (DB vazio) é no-op rápido. Em deploys subsequentes,
# pega resíduo de versões antigas que ainda guardavam base64 no DB.
echo "🖼️  Migrando imagens de produto pra filesystem (se houver)..."
DATABASE_URL="file:$DB_PATH" UPLOADS_DIR="/app/data/uploads" \
  npx tsx scripts/migrate-product-images.ts \
  || echo "⚠️ migração de imagens falhou — não bloqueia boot."

# Gera publicToken pros pedidos antigos sem token (link de acompanhamento
# /p/<token>). Idempotente: roda toda subida, mas só preenche os null.
# Pedidos legados ficam sem link de tracking até o backfill — não quebra.
echo "🔗 Gerando tokens de acompanhamento pra pedidos antigos (se houver)..."
DATABASE_URL="file:$DB_PATH" \
  npx tsx prisma/backfill-public-tokens.ts \
  || echo "⚠️ backfill de tokens falhou — não bloqueia boot."

# Seed só se SEED_ON_BOOT=true E o DB acabou de ser criado (sem users).
# Evita re-seedar a cada redeploy (que apagaria customers/orders reais).
#
# Nota POSIX-sh: NÃO usar here-string (`<<<`) — busybox sh do Alpine não
# suporta. Pipe via `echo |` funciona em qualquer shell. Aprendi na unha. :)
if [ "${SEED_ON_BOOT}" = "true" ]; then
  USER_COUNT=$(echo "SELECT COUNT(*) as c FROM User;" | DATABASE_URL="file:$DB_PATH" npx prisma db execute --stdin 2>/dev/null | grep -oE '[0-9]+' | head -1 || echo "0")
  if [ "${USER_COUNT:-0}" = "0" ]; then
    echo "🌱 DB vazio — rodando seed inicial..."
    DATABASE_URL="file:$DB_PATH" npx tsx prisma/seed.ts || echo "⚠️ seed falhou."
  else
    echo "ℹ️  DB já tem $USER_COUNT usuários — pulando seed."
  fi
fi

echo "🚀 Iniciando Cozinha da Gil em :$PORT..."
exec "$@"
