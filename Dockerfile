# syntax=docker/dockerfile:1.6
#
# Cozinha da Gil — Dockerfile multi-stage pra deploy em Coolify.
#
# Stages:
#   1. deps     — instala todas as deps (com cache via package-lock)
#   2. builder  — gera Prisma client + faz `next build`
#   3. runner   — runtime slim com só o necessário pra rodar
#
# Decisões:
# - node:20-alpine pra base pequena + openssl pro Prisma engine
# - Não usei `output: standalone` do Next pra simplificar inclusão do Prisma CLI
#   (que rodamos no boot pra sincronizar schema). Trade-off: image ~300MB em vez
#   de ~80MB; vale pela simplicidade do entrypoint.
# - SQLite mora em `/app/data/dev.db` — diretório montado como volume nomeado
#   pelo docker-compose pra sobreviver redeploys do Coolify.
# - User não-root (uid 1001) por segurança.

# === STAGE 1: deps ===
FROM node:20-alpine AS deps
WORKDIR /app

# Prisma engine precisa de openssl + libc6-compat no Alpine.
# wget pro healthcheck no runner final.
RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json ./
# `npm ci` é determinístico (respeita lockfile) e mais rápido que `npm install`.
RUN npm ci

# === STAGE 2: builder ===
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Gera Prisma client (sem isso, runtime quebra no primeiro import).
RUN npx prisma generate

# Next telemetry pra Vercel — desligamos pra build limpo + nada vazando.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# === STAGE 3: runner ===
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl wget

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Usuário não-root — boa prática de segurança em container.
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copia outputs do build + deps + schema do Prisma.
# node_modules inteiro pesa, mas evita precisar reinstalar no runtime
# (e mantém o Prisma CLI disponível pro entrypoint).
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.mjs ./next.config.mjs

# Diretório onde o SQLite vive — montado como volume no docker-compose
# (vide DATABASE_URL=file:/app/data/dev.db). Permissão pro user não-root.
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

# Entrypoint roda `prisma db push` no boot pra sincronizar schema com
# o volume persistente antes de subir o Next.
COPY --chown=nextjs:nodejs docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

USER nextjs
EXPOSE 3000

# Healthcheck simples — Coolify usa pra marcar o container saudável.
# Bate na home (login screen) — se a app subiu, responde 200.
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["npm", "start"]
