# HTTPS — decisão e estado atual

> **DECIDIDO 2026-05-27 (João/Gil):** app hospedado em domínio público `cozinhadagil.evapro.cloud` via Coolify. **HTTPS já é nativo via Let's Encrypt** — não precisa de mkcert/HTTPS local. Este doc fica como referência caso um dia volte pra rodar em LAN.

## Estado atual ✅

- **Hospedagem:** Coolify (self-hosted PaaS) em domínio público
- **HTTPS:** **ativo**, cert Let's Encrypt renovado automaticamente pelo Coolify
- **PINs e cookies de sessão:** sempre encriptados em trânsito
- **Devices conectam via:** `https://cozinhadagil.evapro.cloud` (HTTPS público), não LAN
- **Wifi da barraca:** só precisa de internet pra acessar o site — não há tráfego sensível na LAN local

Decisão: usar o app em família, mas sempre via web pública. Não precisa setup de cert local.

---

## (Histórico) HTTPS local na barraca — opções

> Esse roteiro fica como referência caso um dia o app volte a rodar em LAN privada (laptop offline, sem internet). Em rede 100% local com 3 devices da família, **rate-limit + cookie HttpOnly já seria proteção suficiente** contra o threat model real ("primo curioso na wifi"). Mas com HTTPS público no Coolify, isso virou histórico.

## Por que considerar HTTPS

O app hoje serve via HTTP plano. Riscos:
1. **PIN trafega em claro** pela LAN — alguém com Wireshark + acesso à rede captura
2. **Cookie de sessão também trafega em claro** — pode ser roubado
3. **Telefones dos clientes** (no payload `clientPhone`) também ficam visíveis
4. **PWA + Service Worker** têm features que só funcionam em contexto seguro (Push, BG Sync, Geolocation)

Pra família + barraca, isso é improvável. Mas se um dia tiver:
- Visitantes no evento (festa aberta, não só família)
- Conexão de internet compartilhada (não só LAN)
- Pessoa técnica curiosa por perto
- Compliance LGPD se virar negócio formal

Vale ligar HTTPS.

## Opção A — Caddy reverse proxy com cert auto-assinado (recomendado)

[Caddy](https://caddyserver.com/) é o jeito mais fácil:

### 1. Instalar

```bash
# macOS
brew install caddy

# Linux (Debian/Ubuntu)
sudo apt install caddy
```

### 2. `Caddyfile` na raiz do projeto

```caddyfile
cozinha.local {
    tls internal      # cert auto-assinado, renovado automático
    reverse_proxy localhost:3000
}
```

### 3. Subir

```bash
sudo caddy run
```

Caddy gera um root CA local em `~/Library/Application Support/Caddy/pki/authorities/local/root.crt` (mac) ou `/etc/caddy/...` (linux).

### 4. Instalar root CA em cada device

**Esse é o custo real.** Cada tablet/celular precisa importar o CA root pra navegador confiar no cert. Senão, dá warning "site não seguro" toda hora.

- **iOS:** Mandar `root.crt` por email/AirDrop → toca pra instalar → Ajustes → Geral → VPN e Gerenciamento de Dispositivo → confiar
- **Android:** Mandar `root.crt` → toca → Instalar como certificado de autoridade
- **Chrome desktop:** Importar nas configurações de certificados

Tempo: ~5 min por device. Multiply pelo número de tablets do evento.

### 5. PORT do Next

Caddy ouve em 443 (HTTPS) e proxy pra 3000 (Next). Atualizar atalho dos devices: `https://cozinha.local` em vez de `http://192.168.x.y:3000`.

**Resolução DNS local:** registra `cozinha.local` no `/etc/hosts` de cada device, ou usa mDNS (Bonjour já vem no iOS/macOS; Android precisa apps).

## Opção B — Tailscale ou ngrok com cert público

Se o servidor da barraca tiver internet enquanto o evento roda, pode usar Tailscale (rede VPN gratuita) ou ngrok (tunnel pago) — ambos dão HTTPS público sem precisar configurar cert.

**Vantagem:** zero esforço por device, só conecta na URL.
**Desvantagem:** dependência de internet. Se cair, app fica fora do ar. Anti-objetivo pra barraca.

Sem internet redundante, não vale.

## Opção C — Não fazer nada (atual)

Aceita risco de sniff na LAN. Mitigações já em vigor:
- Rate-limit (5 tentativas/60s) → bruteforce de PIN inviável mesmo com nome conhecido
- Cookie HttpOnly + SameSite=Lax → não acessível via JS
- Cookies signed (iron-session) → adulteração detectada
- requireRole em mutations → mesmo com cookie roubado, atacante limitado ao role do dono

Pro threat model real ("família + 1–2 convidados no roteador"), isso basta.

## Recomendação histórica

**Hoje (atual):** N/A — HTTPS já ativo via Coolify/Let's Encrypt em produção.
**Se um dia voltar pra LAN privada (app offline-first):** opção A (Caddy + tls internal).
**Não Opção B** (Tailscale/ngrok) até ter internet redundante na barraca — anti-objetivo.
