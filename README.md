# Cozinha da Gil

App de pedidos pra barraca da família. Atendente, cozinha e admin em tempo real.

**Stack:** Next.js 15 · React 19 · TypeScript · Prisma + SQLite · Tailwind · SSE pra real-time · PWA com @ducanh2912/next-pwa · iron-session pra auth.

---

## Desenvolvimento

```bash
npm install
npx prisma db push           # cria/sincroniza dev.db
npm run db:seed              # popula produtos, ingredientes, usuários
npm run dev                  # localhost:3000
```

**Senha padrão dos usuários seed:** `1234` (Gil/Maria/José).

**Comandos úteis:**

| comando | o que faz |
|---|---|
| `npm run dev` | dev server com HMR |
| `npm run build && npm start` | build + servidor de produção |
| `npm test` | roda os 107 testes do Vitest |
| `npm run smoke` | smoke test pré-evento (DB + admin + servidor + caixa + backup, ~100ms) |
| `npm run db:seed` | recria produtos/usuários default |
| `npm run db:studio` | Prisma Studio (browser) |
| `npx tsx prisma/backfill-fase6.ts` | reaplica backfill se precisar |

---

## Deploy em produção

O app foi feito pra rodar **localmente na barraca** num laptop ou mini-PC, com tablets/celulares conectados via wifi local. Não precisa de internet pro app funcionar (só pra WhatsApp).

### Opção A — Mini-PC ou laptop dedicado (recomendado)

1. **Hardware:** qualquer máquina com 4 GB RAM, Node 18+ e disco que não vai morrer. Pode ser laptop velho. **Conectar no carregador durante o evento.**
2. **Setup uma vez:**
   ```bash
   git clone <repo> ~/cozinha-da-gil
   cd ~/cozinha-da-gil
   npm ci
   npx prisma db push
   npm run db:seed              # primeira vez só
   npm run build
   ```
3. **Configurar `.env`:**
   ```
   DATABASE_URL="file:./dev.db"
   SESSION_SECRET="<gere com: openssl rand -base64 32>"
   ```
4. **Subir em background com PM2** (ver `ecosystem.config.js`):
   ```bash
   npm install -g pm2
   pm2 start ecosystem.config.js
   pm2 save                     # persiste config
   pm2 startup                  # inicia automaticamente no boot
   ```
5. **Devices conectam em:** `http://<IP-DO-LAPTOP>:3000` (ver IP com `ifconfig`/`ipconfig`).

### Opção B — Docker / Coolify (PaaS self-hosted)

O repo vem com `Dockerfile` + `docker-compose.yml` prontos pro Coolify (ou Docker direto). O SQLite roda dentro de um volume nomeado que sobrevive a redeploys.

**Local (testa antes de subir):**
```bash
# Gera SESSION_SECRET pro .env
echo "SESSION_SECRET=$(openssl rand -base64 32)" >> .env
echo "SEED_ON_BOOT=true" >> .env  # cria Gil/Maria/José no 1º boot

docker compose up -d --build
# Acessa http://localhost:3000 — primeiro boot leva ~1min (build + db push + seed)
docker compose logs -f cozinha
```

**Coolify:**
1. **New Resource → Application → Docker Compose** apontando pro repo `cozinha-da-gil`
2. **Environment Variables** no painel:
   - `SESSION_SECRET` = gerar com `openssl rand -base64 32`
   - `SEED_ON_BOOT` = `true` (apenas no primeiro deploy; depois remover ou trocar pra `false`)
3. **Storage:** Coolify detecta o volume `cozinha-da-gil-data` automaticamente — mapeia pro disco persistente do servidor
4. **Deploy.** Healthcheck embutido marca `Healthy` quando responde `:3000`

**Migração SQLite → Postgres** (se um dia precisar): trocar `DATABASE_URL` pra connection string Postgres no Coolify; adicionar serviço `postgres` no `docker-compose.yml`; rodar `npx prisma db push` uma vez. O schema é o mesmo, Prisma cuida da tradução.

### Opção C — Vercel (online)

O app **pode** ser hospedado na Vercel mas tem caveats:
- **SQLite não funciona** na Vercel (filesystem volátil). Migrar pra Postgres/Turso/PlanetScale.
- Latência maior (sai do servidor da Vercel → wifi local).
- Custo: free tier comporta o app, mas atenção ao limite de SSE concurrent connections.

Não recomendado a menos que o evento tenha internet super estável.

### Opção C — Tablet/celular hospedando

Não dá direto — Next.js precisa de Node. Possível com **Termux** (Android) mas é frágil. Use Opção A.

---

## Backup

- **Automático:** cada vez que admin fecha caixa, snapshot do `dev.db` é salvo em `prisma/backups/`.
- **Manual:** admin pode forçar via `POST /api/backup` ou pelo UI (endpoint `/api/backup`).
- **Rotação:** mantém últimos 30 backups, deleta automaticamente os mais antigos.
- **Restaurar:** copie um arquivo de `prisma/backups/*.db` por cima de `prisma/dev.db` (com servidor parado) e reinicie.

**Pré-evento sempre:** rode `POST /api/backup` antes de começar a vender. Cinto + suspensório.

---

## Saúde do servidor

`GET /api/health` retorna **HTTP 200** se saudável, **HTTP 503** se DB inacessível (Coolify pode reiniciar automaticamente baseado no status). Sem auth — público pra monitor externo pingar.

```json
{
  "ok": true,
  "dbOk": true,
  "dbLatencyMs": 1,
  "sse": { "count": 3, "oldestAgeMs": 1234, "maxAgeMs": 21600000 },
  "session": { "id": "...", "name": "Festa Junina", "openedBy": "Gil" },
  "uptimeSec": 12345,
  "problems": []
}
```

Gil pode bookmarkar no celular dela. Se travar mid-evento, ela abre essa URL pra ver se servidor tá vivo.

**Coolify health check:** aponta pra `/api/health`, intervalo 30s, timeout 5s, retries 3. Se ver 3× 503 consecutivos, restart automático do container.

---

## Auth

- Login com 4-dígito PIN, role-based (atendente/cozinha/admin).
- Cookie `cdg_session` HttpOnly + signed (iron-session) com 30 dias de validade.
- **Rate limit:** 5 tentativas de PIN errado em 60s → 429.
- **`SESSION_SECRET`** no `.env` é obrigatório em produção. Gere com `openssl rand -base64 32`.

---

## Pastas importantes

```
app/                    Routes do Next (atendente/cozinha/admin/cliente)
app/api/                API REST (com requireRole nas mutations)
components/             OrderCard, AppHeader, modais
lib/
  ├── prisma.ts         Singleton + PRAGMAs WAL
  ├── products.ts       computeUnitPrice, validateIngredientSelection
  ├── promotions.ts     detectApplicable, computeDiscount
  ├── orders.ts         serializeOrder, normalizePhone
  ├── event-session.ts  abrir/fechar caixa, totalCents
  ├── backup.ts         copy + rotation
  ├── session.ts        iron-session + requireRole
  ├── rate-limit.ts     in-memory counter
  ├── logger.ts         append em logs/app-YYYY-MM-DD.log
  └── sse.ts            broadcast + stale pruning
prisma/
  ├── schema.prisma     Order, OrderItem, Product, EventSession, Promotion, User
  ├── seed.ts           dados default
  ├── backfill-fase6.ts migração de pedidos legacy
  ├── dev.db            SQLite (gitignored)
  └── backups/          snapshots automáticos (gitignored)
tests/                  Vitest — 51 testes em lib/{promotions,products,orders,rate-limit}
logs/                   gitignored — append do logger
```

---

## Troubleshooting comum

| Sintoma | Causa provável | Fix |
|---|---|---|
| Atendente "Caixa fechado" | Gil não abriu evento | Admin → Vendas → "Abrir caixa" |
| Cozinha não recebe pedidos | SSE morreu | Recarrega `/cozinha` (Ctrl+R). Stats em `/api/health` |
| `SQLITE_BUSY` no log | Concorrência alta | WAL já tá ligado; aumentar busy_timeout em `lib/prisma.ts` |
| Login dá 429 | Rate limit | Espera 60s ou reinicia servidor |
| TV mostra "Reconectando…" | Wifi caiu | Ver router; refresh `/cliente` |
| Esqueceu PIN | Não tem recuperação | Admin pode resetar via UI (Usuários → editar) |

---

## Comandos de evento (cheatsheet pra Gil)

1. **Antes de subir a barraca:** `npm run smoke` (~100ms) → confere DB, admin, servidor, caixa e backup. Se tudo verde, pode começar; se vermelho, conserta antes do cliente chegar.
2. **Início do dia:** `pm2 status` (servidor rodando?) → abrir admin → "Abrir caixa" → bookmark `/api/health` no celular
3. **Durante:** monitorar fila na cozinha + saúde no celular
4. **Fim:** "Fechar caixa" (backup é automático) → baixar CSV se quiser → `pm2 stop cozinha`
