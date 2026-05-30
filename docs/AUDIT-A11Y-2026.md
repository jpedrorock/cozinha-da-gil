# Auditoria de Acessibilidade — WCAG 2.1 AA

**Data:** 2026-05-29
**Auditor:** `claude-pastel` (revisão de código + tokens, não em runtime)
**Escopo:** 4 telas principais (atendente, cozinha, cliente TV, admin) + componentes compartilhados.
**Metodologia:** análise de tokens de cor, padrões de touch target, ARIA, semântica, focus management. Não inclui teste com screen reader real.

---

## TL;DR — bom estado geral

A app **passa boa parte do WCAG 2.1 AA** sem trabalho extra. Há padrões maduros: `aria-label` em quase todos os botões icon-only (zero achados sem label), `useEscapeKey` em modais, `<label>` em forms novos (`PagamentoSettings`), `shadow-focus` token definido, `ink-3` foi escurecido pra passar contraste AA (4.55:1 — comentado em `tailwind.config.ts`).

**Os gaps reais são 3:**
1. **Touch targets a 32–36px** em ~10 sites (Apple HIG/Material recomendam 44×44; WCAG 2.5.5 AAA exige).
2. **Inputs sem label explícito** em pelo menos 4 sites do `AdminClient` (WCAG 1.3.1, 3.3.2).
3. **`status-preparing` (#E5B400)** tem contraste ~2.5:1 em fundo branco — não passa AA pra texto normal. Verificar onde é usado como texto.

**Não achei** problemas em: contraste de texto principal, alt em imagens (zero `<img>` sem alt), botões icon-only sem aria-label, semântica de botões (zero `<div onClick>` interativo).

---

## Findings por categoria

### 1. Contraste de cor — passa AA na maioria

**Tokens auditados** (`tailwind.config.ts`):

| Token | Hex | Sobre `surface` (#FFF9EC) | Veredito |
|---|---|---|---|
| `ink` | #1F1410 | ~15:1 | ✓ AAA |
| `ink-2` | #4A3D34 | ~9:1 | ✓ AAA |
| `ink-3` | #6F635A | **4.55:1** (já corrigido) | ✓ AA texto normal |
| `danger` | #D03A2C | ~5.2:1 | ✓ AA |
| `status-incoming` | #2A6FAA | ~5.1:1 | ✓ AA |
| `status-ready` | #1F9B4A | ~3.7:1 | ⚠ AA Large (≥18px) só |
| `status-preparing` | #E5B400 | **~2.5:1** | ✗ FAIL AA — verificar uso |
| `status-delivered` | #9B9590 | ~3:1 | ⚠ AA Large só |
| `brand-yellow` | #FFD600 | ~1.5:1 | ✗ FAIL — mas usado como **bg** com `ink` (escuro) por cima, aí passa ✓ |

**`status.*-ink` variants** (`-ink` é texto escuro sobre `-bg` claro): todos passam AAA ✓.

**Achados:**

- **A11Y-01 [P2] Contraste `status-preparing` (#E5B400) sobre branco** — usado em texto? Confirmar no Trello dot/badge da cozinha. Se sim, usar `status-preparing-ink` (#4A3700) pro texto e manter amarelo só de fundo.
- **A11Y-02 [P3] Contraste `status-ready` / `status-delivered`** — borderline. Verificar tamanho de texto onde aparecem (≥18px = "Large" passa).

### 2. Touch targets — vários sub-44px

WCAG 2.5.5 (AAA) exige ≥44×44. Apple HIG e Material Design recomendam o mesmo pra AA na prática. Achados (grep `h-(8|9)\b w-(8|9)\b`):

| Site | Tamanho | Contexto |
|---|---|---|
| `AppHeader` (operador chip) | h-9 (36px) | tap pra trocar operador |
| `AppHeader` (ícone troco no atendente) | 36×36 | abrir calc |
| `AppHeader` (botão fechar / sair na sidebar) | h-9 | dispensar |
| `MonitorClient:141` | 36×36 | botão de ação |
| `GuiaClient:289` | 32×32 | search clear |
| `AtendenteClient:933` | 32×32 | botão pequeno (chip?) |
| `CozinhaClient:1092` | h-9 | botão secundário |

**Achados:**

- **A11Y-03 [P2] Subir touch targets críticos pra ≥44px** — pelo menos os do atendente (operacional na pressão) e cozinha (mãos sujas, tablet). Não obrigatório AA mas alto valor pra UX de barraca. Ícones de 32–36 são fáceis de errar.

### 3. ARIA + semântica — bom estado

- **0 achados** de botão icon-only sem `aria-label` (grep `<button.*<Icon.*` sem `aria-label`). Padrão consistente em todo o app: `aria-label="Calculadora de troco"`, `aria-label="Dispensar"`, etc.
- **0 achados** de `<img>` sem `alt`.
- **1 achado** de `<div onClick>`: `AdminClient:2454` é o backdrop de modal — pattern aceitável (não é foco navegável, só clique-fora-pra-fechar; existe ESC + botão X em paralelo).
- `useEscapeKey` + `useBodyScrollLock` aplicados em todos os modais — bom padrão.

**Achados:** nenhum P2; só pequenos riscos.

- **A11Y-04 [P3] Focus trap em modais** — `ConfirmDialog`, `TrocoCalculator`, `IconPicker`, etc. travam scroll e ESC, mas **não trapeiam o Tab focus dentro do modal** (Tab pode sair pra elementos atrás). Recomendado: usar `inert` no resto da página OU lib `focus-trap-react`. Real-world impact baixo (modais são curtos), mas é AA strict (2.4.3).

### 4. Forms — inputs sem label explícito

Vários inputs em `AdminClient.tsx` aparecem sem `<label htmlFor>` nem `aria-label`:
- `AdminClient:2467, 2877, 4106` (campos `name`)
- `AdminClient:2584` (checkbox `active`)

Provavelmente têm contexto visual (heading próximo), mas screen reader não captura associação → falha **WCAG 1.3.1 (Info and Relationships)** + **3.3.2 (Labels or Instructions)**.

Componentes NOVOS já fazem certo (`PagamentoSettings`: `<label><span>...<input>` ✓; `PinInput`: `aria-label="Senha"` ✓).

**Achados:**

- **A11Y-05 [P2] Adicionar `<label>` ou `aria-label` aos inputs em `AdminClient`** — ~4-5 sites. Mecânico (não muda lógica). Útil pra acessibilidade e SEO.

### 5. Cliente público (TV) — atenção ao "breathe"

O painel `/cliente` tem efeito breathe (animação de pulso) que já foi tornado **intermitente** (Audit P2 #20 — em Concluídos). Isso ajuda com **WCAG 2.3.3 (Animation from Interactions)**, mas verificar se respeita `prefers-reduced-motion`.

**Achados:**

- **A11Y-06 [P3] Respeitar `prefers-reduced-motion`** — checar se animações (breathe, fade-in, slide-up, animate-pulse) param quando o user tem `prefers-reduced-motion: reduce` nas configs do OS. Trivial (1 media query em `globals.css`), alto valor a11y.

### 6. Atendente / Cozinha — operação operacional

- Headers + AppHeader: sticky com safe-area pra notch ✓.
- Bottom-nav e botnav da cozinha: tap targets ok (verificar).
- Botões com `active:scale-[0.94]` — feedback tátil bom.
- Cores de status no card do pedido: chips usam `status-*-bg` + `status-*-ink` — passa AAA ✓.

---

## Priorização

| ID | Sev | Tela/Componente | Esforço |
|---|---|---|---|
| **A11Y-01** | P2 | Cozinha kanban — confirmar uso de `status-preparing` em texto | 15min |
| **A11Y-05** | P2 | AdminClient — `<label>` em ~4-5 inputs | 30min |
| **A11Y-03** | P2 | Atendente + Cozinha — subir touch targets críticos a 44px | 1-2h |
| **A11Y-02** | P3 | Cozinha — verificar `status-ready/delivered` em texto | 15min |
| **A11Y-04** | P3 | Modais — focus trap (`inert` ou lib) | 1-2h |
| **A11Y-06** | P3 | Globals — respeitar `prefers-reduced-motion` | 30min |

**Total estimado pra fechar os 3 P2 + 3 P3:** 4-6 horas distribuídas.

---

## O que NÃO precisa de trabalho

- Contraste de texto principal (ink series) ✓
- aria-labels em botões icon-only ✓
- Modais com ESC + scroll lock ✓
- Imagens com alt ✓
- Touch targets em components NOVOS (PinInput, TrocoCalculator, etc.) — todos h-14 ✓
- Form labels em components NOVOS ✓

---

## Próximos passos sugeridos

1. **Quick wins primeiro** (A11Y-01, A11Y-05, A11Y-02 — ~1h total) → fecha os 3 issues semânticos / contraste.
2. **A11Y-06 (`prefers-reduced-motion`)** — 30min, high a11y value.
3. **A11Y-03 (touch targets)** — sprint dedicado, toca várias telas; vale fazer com observação do usuário em device.
4. **A11Y-04 (focus trap)** — só se relatar problema com teclado.

Este audit não substitui um teste com screen reader real (VoiceOver / TalkBack) — recomendado pra um pass futuro.
