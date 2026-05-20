# HTTPS local na barraca — opções

> P2 do audit de segurança. Em rede 100% local com 3 devices da família, **rate-limit + cookie HttpOnly já é proteção suficiente** contra o threat model real ("primo curioso na wifi"). Este doc descreve quando vale ligar HTTPS e como.

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

## Recomendação

**Hoje:** opção C. Não ligue HTTPS.
**Quando virar negócio formal (recebe estranhos, atende festa pública grande, LGPD relevante):** opção A. ~2h pra setup + 5min/device.

Não Opção B até ter internet redundante na barraca.
