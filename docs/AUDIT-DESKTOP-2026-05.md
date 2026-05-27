# Auditoria UX Desktop — 27/05/2026

Foco: paridade com mobile + botões de voltar + aproveitamento de tela em ≥1024px. Sprint recente foi mobile-first, então o objetivo é confirmar que o desktop não ficou órfão.

**TL;DR:** Estado geral OK. **2 gaps críticos** (largura espremida em desktop), **1 menor** (verificar drawer). Padrões transversais (sem breadcrumb, hovers em ~85%) são decisões conscientes, não regressões.

---

## Achados por tela

### `app/atendente/AtendenteClient.tsx`

| Status | Achado | Fix |
|---|---|---|
| ❌ **GAP crítico** | Stepper "Novo Pedido" tem `max-w-2xl` (linhas 1190, 1292) — limita conteúdo a **672px** mesmo em desktop 1440px+ (ocupa só 47% da tela). | `md:max-w-4xl` ou remover constraint em `md+` |
| ⚠️ menor | `EditDrawer` (~linha 1580) — verificar se tem botão voltar/X com hover claro | inspecionar component, adicionar X com `hover:bg-surface-sunken` se faltar |
| ✅ OK | Hover states presentes em FAB amarelo, "Começar", "Adicionar telefone" |
| ✅ OK | Botão voltar `←` (ArrowLeft, linha 1680) presente; tamanho adequado pra desktop |

### `app/cozinha/CozinhaClient.tsx`

| Status | Achado | Fix |
|---|---|---|
| ❌ **GAP crítico** | Ticket card em `md:grid-cols-2 xl:grid-cols-3` (linha 550) — quando 1 item só, fica "solto" em tela larga sem constraint. Pode ficar muito longo em TV. | `max-w-2xl` wrapper ou volta a 1 coluna em telas muito largas |
| ✅ OK | Bottom action bar com 3 botões (Buscar/Ordenar/Som) com labels visíveis + hover (linha 596-655) |
| ✅ OK | Atalhos teclado documentados: `?` (help), `/` (busca), `S` (ordenar), `M` (som). Help modal lista todos (linha 662-696) |

### `app/cliente/`

| Status | Achado |
|---|---|
| ✅ OK | Botão "Voltar pro login" (ArrowLeft, linha 95-102) com hover state claro (`hover:bg-surface-sunken hover:text-ink`) |
| ✅ OK | Layout 2 colunas `md:grid-cols-2` (linha 127) aproveita espaço desktop |

### `app/admin/AdminClient.tsx`

| Status | Achado |
|---|---|
| ✅ OK | Sidebar com botão "Recolher" hover claro (linha 414-469). Quando recolhido, `title` attribute serve de tooltip nativo (linha 603) |
| ✅ OK | Bottom nav mobile (`md:hidden`) com truncate em labels (linha 640); "Mais" sheet com swipe-down |
| ✅ OK | Vendas sub-tabs (linhas 787-800) — Resumo/Pedidos com persistência localStorage |
| ✅ OK | Estado de aba ativo bem sinalizado (fundo amarelo, linha 606) |

---

## Padrões transversais

- **AppHeader sticky** com nome do operador em todas as telas. `max-w-[160px] md:max-w-none` (truncate mobile, full desktop). Estável.
- **Sem breadcrumbs** em nenhuma tela. Decisão consciente: fluxos são lineares e mobile-first com swipe; breadcrumb traria pouco valor.
- **Hovers presentes em ~85%** dos elementos clicáveis. Gaps residuais em drawers/modais — investigar caso a caso.
- **`useBodyScrollLock` aplicado em modais** (audit P2 #12+#18 completado).
- **Cursor pointer** raro (apenas em labels checkbox/radio); botões usam `<button>` (cursor implícito).

---

## Top 3 fixes prioritários (viraram items P3 no BACKLOG)

1. **Stepper atendente: `md:max-w-4xl` ou remover constraint** — aproveita desktop 1440px+
2. **Ticket cozinha: `max-w-2xl` no wrapper** — não estica indefinidamente em TV
3. **EditDrawer: verificar close button** — adicionar X com hover se faltar

---

## O que NÃO foi avaliado nesta auditoria

- Mobile (já tá ok — sprint recente focou nele)
- Backend / API / SSE / auth
- Performance / bundle size
- a11y WCAG nuanced (só onde sobrepõe com UX desktop)
