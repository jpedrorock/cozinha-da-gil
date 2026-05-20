/**
 * /design-system — referência visual viva do design system.
 *
 * Página pública (sem auth) que documenta tokens de tipografia, cores,
 * controles, espaço e ícones. Atualiza automaticamente quando globals.css
 * muda. Pode ser exportada pra PDF via Ctrl+P do browser.
 *
 * Acesso: http://localhost:PORT/design-system
 */
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandIcon, PastelIcon, DoceIcon } from "@/components/icons";

export const dynamic = "force-static";

export default function DesignSystemPage() {
  return (
    <main className="min-h-dvh bg-surface">
      <header className="bg-surface-elevated border-b border-line print:hidden">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-ink-2 hover:text-ink t-body-sm">
            <ArrowLeft size={16} strokeWidth={2.25} />
            Voltar
          </Link>
          <span className="t-caption">Pra exportar PDF: Ctrl/Cmd + P</span>
        </div>
      </header>

      <article className="max-w-5xl mx-auto px-6 py-10 flex flex-col gap-12 print:py-4">
        {/* === COVER === */}
        <section>
          <div className="flex items-baseline gap-2 mb-3">
            <BrandIcon size={40} className="self-center" />
            <span className="t-label">Cozinha da</span>
            <span className="text-[22px] font-bold -tracking-[0.01em] leading-none">Gil</span>
          </div>
          <h1 className="t-display mb-2">Design System</h1>
          <p className="t-body text-ink-2 max-w-2xl">
            Referência viva dos tokens, regras e componentes usados no app. Esta página é
            renderizada a partir do CSS real — sempre reflete o estado atual.
          </p>
        </section>

        <SectionDivider />

        {/* === TYPE SCALE === */}
        <Section title="Type scale" sub="9 níveis. Pesos limitados a 400, 600, 700 — sem extrabold.">
          <div className="flex flex-col gap-5 border-l-2 border-line pl-5">
            <TypeRow token="t-display" size="28-32px" weight="700" example="Vendas do dia" />
            <TypeRow token="t-h1" size="22px" weight="700" example="Entrar / Fila / Novo pedido" />
            <TypeRow token="t-h2" size="17px" weight="600" example="Card title / Cliente em pedido" />
            <TypeRow token="t-h3" size="14px" weight="600" example="Sub-item / Pequeno destaque" />
            <TypeRow token="t-body-lg" size="17px" weight="400" example="Leitura emfática (raro)" />
            <TypeRow token="t-body" size="15px" weight="400" example="Texto padrão do app" />
            <TypeRow token="t-body-sm" size="13px" weight="400" example="Texto secundário (ink-2)" />
            <TypeRow token="t-label" size="11px" weight="700" upper example="LABEL DE SEÇÃO" />
            <TypeRow token="t-caption" size="12px" weight="500" example="Meta · timestamps · hints" />
          </div>
          <Rule>
            <strong>Hierarquia por tela:</strong> 1 <code>t-h1</code> por página, várias <code>t-h2</code> pra
            seções, <code>t-label</code> pros sub-headers uppercase, <code>t-body-sm</code> pro
            texto contextual. Nunca empilhar 2 níveis iguais.
          </Rule>
        </Section>

        <SectionDivider />

        {/* === BUTTONS === */}
        <Section title="Buttons" sub="3 tamanhos por contexto. Defaults toque-friendly.">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line">
                <th className="t-label py-2">Variant</th>
                <th className="t-label py-2">Tamanho</th>
                <th className="t-label py-2">Uso</th>
                <th className="t-label py-2 text-right">Exemplo</th>
              </tr>
            </thead>
            <tbody className="t-body-sm">
              <tr className="border-b border-line">
                <td className="py-3"><code>btn-sm</code></td>
                <td>h-9 (36px)</td>
                <td>Inline, secundário, denso</td>
                <td className="text-right"><button className="btn btn-secondary btn-sm">Editar</button></td>
              </tr>
              <tr className="border-b border-line">
                <td className="py-3"><code>btn</code> (default)</td>
                <td>h-11 (44px)</td>
                <td>Padrão. Mobile-OK pra toque.</td>
                <td className="text-right"><button className="btn btn-secondary">Cancelar</button></td>
              </tr>
              <tr className="border-b border-line">
                <td className="py-3"><code>btn-lg</code></td>
                <td>h-14 (56px)</td>
                <td>Primary actions (FAB, Entrar, Confirmar)</td>
                <td className="text-right"><button className="btn btn-primary btn-lg">Entrar →</button></td>
              </tr>
            </tbody>
          </table>
          <div className="flex flex-wrap gap-2 mt-4">
            <button className="btn btn-primary">btn-primary</button>
            <button className="btn btn-secondary">btn-secondary</button>
            <button className="btn btn-ghost">btn-ghost</button>
            <button className="btn btn-danger">btn-danger</button>
          </div>
        </Section>

        <SectionDivider />

        {/* === INPUTS === */}
        <Section title="Inputs" sub="3 tamanhos alinhados com buttons.">
          <div className="flex flex-col gap-3 max-w-md">
            <div>
              <label className="t-label mb-1 block">input-sm (h-9)</label>
              <input className="input input-sm" placeholder="Tamanho compacto pra modais densos" />
            </div>
            <div>
              <label className="t-label mb-1 block">input (default h-11)</label>
              <input className="input" placeholder="Padrão" />
            </div>
            <div>
              <label className="t-label mb-1 block">input-lg (h-14)</label>
              <input className="input input-lg" placeholder="Hero forms (login, etc)" />
            </div>
          </div>
        </Section>

        <SectionDivider />

        {/* === COLORS === */}
        <Section title="Cores" sub="Paleta brand sóbria, status semântico.">
          <div className="t-label mb-2">Brand</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Swatch name="brand-yellow" hex="#FFD400" bg="bg-brand-yellow" textInk />
            <Swatch name="brand-yellow-hover" hex="#F5C100" bg="bg-brand-yellow-hover" textInk />
            <Swatch name="brand-yellow-press" hex="#E4B400" bg="bg-brand-yellow-press" textInk />
            <Swatch name="brand-yellow-soft" hex="#FFFCE5" bg="bg-[#FFFCE5]" textInk />
          </div>

          <div className="t-label mb-2">Ink (textos)</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            <Swatch name="ink" hex="#1F1410" bg="bg-ink" />
            <Swatch name="ink-2" hex="#4A3F38" bg="bg-ink-2" />
            <Swatch name="ink-3" hex="#8A7C6F" bg="bg-ink-3" />
          </div>

          <div className="t-label mb-2">Surface (fundos)</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            <Swatch name="surface" hex="#FFFCF5" bg="bg-surface" textInk />
            <Swatch name="surface-elevated" hex="#FFFFFF" bg="bg-surface-elevated" textInk />
            <Swatch name="surface-sunken" hex="#F6EFE3" bg="bg-surface-sunken" textInk />
          </div>

          <div className="t-label mb-2">Status</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Swatch name="incoming" hex="azul" bg="bg-status-incoming" />
            <Swatch name="preparing" hex="amarelo" bg="bg-status-preparing" textInk />
            <Swatch name="ready" hex="verde" bg="bg-status-ready" />
            <Swatch name="delivered" hex="cinza" bg="bg-status-delivered" />
            <Swatch name="danger" hex="vermelho" bg="bg-danger" />
          </div>
        </Section>

        <SectionDivider />

        {/* === SPACING === */}
        <Section title="Spacing" sub="Grid de 4pt. Sem 1.5, sem 5, sem 7.">
          <div className="flex items-end gap-4">
            {[4, 8, 12, 16, 24, 32].map((px) => (
              <div key={px} className="flex flex-col items-center gap-2">
                <div className="bg-brand-yellow" style={{ width: `${px}px`, height: `${px}px` }} />
                <span className="t-caption">{px}px</span>
              </div>
            ))}
          </div>
          <Rule>
            Tailwind: <code>gap-1 (4) · gap-2 (8) · gap-3 (12) · gap-4 (16) · gap-6 (24) · gap-8 (32)</code>
          </Rule>
        </Section>

        <SectionDivider />

        {/* === CARDS === */}
        <Section title="Cards" sub="2 níveis de elevação.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-4">
              <div className="t-label mb-1">.card</div>
              <div className="t-body">Card padrão com borda sutil e shadow-sm.</div>
            </div>
            <div className="card-lg">
              <div className="t-label mb-1">.card-lg</div>
              <div className="t-body">Card maior com shadow-md, rounded-lg. Pra hero cards.</div>
            </div>
          </div>
        </Section>

        <SectionDivider />

        {/* === BADGES === */}
        <Section title="Status badges" sub="Pra estados de pedido.">
          <div className="flex flex-wrap gap-3">
            <span className="badge badge-new">Pedido feito</span>
            <span className="badge badge-preparing">Em preparo</span>
            <span className="badge badge-ready">Pronto</span>
            <span className="badge badge-delivered">Entregue</span>
            <span className="badge badge-cancelled">Cancelado</span>
          </div>
        </Section>

        <SectionDivider />

        {/* === ICONOGRAFIA === */}
        <Section title="Iconografia" sub="3 fontes coexistem com propósitos distintos.">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="t-label mb-2">Brand (custom SVG)</div>
              <div className="flex items-center gap-3 p-3 card">
                <BrandIcon size={32} />
                <PastelIcon size={24} />
                <DoceIcon size={24} />
              </div>
              <p className="t-body-sm mt-2">Identidade visual. Headers, comprovante, brand moments.</p>
            </div>
            <div>
              <div className="t-label mb-2">Lucide</div>
              <div className="flex items-center gap-3 p-3 card">
                <span className="t-caption">UI icons da lib lucide-react</span>
              </div>
              <p className="t-body-sm mt-2">UI controls (Pencil, Trash, Coffee). strokeWidth=2 default, 2.5 enfatizado.</p>
            </div>
            <div>
              <div className="t-label mb-2">Iconify (~200k)</div>
              <div className="flex items-center gap-3 p-3 card">
                <span className="t-caption">Ingredientes — Gil escolhe via picker</span>
              </div>
              <p className="t-body-sm mt-2">Formato <code>prefix:name</code>. Tradução PT→EN automática + chips de categoria.</p>
            </div>
          </div>
        </Section>

        <SectionDivider />

        {/* === DENSIDADE === */}
        <Section title="Densidade por contexto" sub="Multiplicador da escala base.">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line">
                <th className="t-label py-2">Contexto</th>
                <th className="t-label py-2">Ajuste</th>
                <th className="t-label py-2">Exemplo</th>
              </tr>
            </thead>
            <tbody className="t-body-sm">
              <tr className="border-b border-line">
                <td className="py-3">Cozinha (TV à distância)</td>
                <td>+1 nível</td>
                <td>Card title 24px bold</td>
              </tr>
              <tr className="border-b border-line">
                <td className="py-3">Atendente / Admin (tablet)</td>
                <td>Default</td>
                <td>t-h1 22px / t-h2 17px</td>
              </tr>
              <tr className="border-b border-line">
                <td className="py-3">Cliente público (TV pública)</td>
                <td>+2 níveis</td>
                <td>Nome 48px bold em colunas</td>
              </tr>
              <tr>
                <td className="py-3">Comprovante (térmico)</td>
                <td>Monospace pequeno</td>
                <td>11pt mono</td>
              </tr>
            </tbody>
          </table>
        </Section>

        <SectionDivider />

        {/* === REGRAS === */}
        <Section title="Regras de ouro" sub="Pra não derivar quando criar componentes novos.">
          <ol className="flex flex-col gap-3 list-decimal pl-5 t-body">
            <li>Sempre escolha um token semântico (<code>t-label</code>) antes de tamanho arbitrário (<code>text-[11px]</code>).</li>
            <li>Peso <code>extrabold (800)</code> só em <strong>números grandes de destaque</strong> (preço, qty, timer). Texto = <code>bold 700</code> ou <code>semibold 600</code>.</li>
            <li>Heights de controles: <code>h-9 / h-11 / h-14</code>. Nunca h-10, h-12, h-16 (a não ser que seja square ou header).</li>
            <li>Spacing no grid de 4pt: <code>gap-1/2/3/4/6/8</code>. Sem 1.5, 5, 7.</li>
            <li>1 <code>t-h1</code> por página. Múltiplos h1 quebra hierarquia.</li>
            <li>Cores brand <code>yellow</code> só em CTAs primárias + 1 destaque por tela. Não inundar.</li>
          </ol>
        </Section>

        <footer className="border-t border-line pt-6 text-center t-caption">
          Cozinha da Gil · Design System · gerado automaticamente do CSS
        </footer>
      </article>
    </main>
  );
}

function SectionDivider() {
  return <div className="border-t border-line print:hidden" />;
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <header className="mb-4">
        <h2 className="t-h1 mb-1">{title}</h2>
        {sub && <p className="t-body-sm">{sub}</p>}
      </header>
      <div>{children}</div>
    </section>
  );
}

function TypeRow({
  token,
  size,
  weight,
  example,
  upper,
}: {
  token: string;
  size: string;
  weight: string;
  example: string;
  upper?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[140px_180px_1fr] gap-3 items-baseline">
      <code className="t-body-sm">{token}</code>
      <span className="t-caption">{size} · {weight}</span>
      <span className={token + (upper ? "" : "")}>{example}</span>
    </div>
  );
}

function Swatch({ name, hex, bg, textInk }: { name: string; hex: string; bg: string; textInk?: boolean }) {
  return (
    <div className={`rounded-md p-3 ${bg} border border-line`}>
      <div className={`t-label !${textInk ? "text-ink-2" : "text-white/70"}`}>{name}</div>
      <div className={`text-[13px] font-mono mt-1 ${textInk ? "text-ink" : "text-white"}`}>{hex}</div>
    </div>
  );
}

function Rule({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 p-3 bg-surface-sunken rounded-md t-body-sm border-l-2 border-brand-yellow">
      {children}
    </div>
  );
}
