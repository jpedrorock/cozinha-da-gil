// Ícones customizados de marca. SVG inline, pronto pra qualquer tamanho.
// Paleta restrita: brand-yellow #FFD600 · brand-orange #FF8A00 · ink #1F1410
// · surface-elevated #FFFCF5 · brand-yellow-hover #F0C800

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

/**
 * Logo da marca — panelinha cozinhando.
 */
export function BrandIcon({ size = 32, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      {...props}
    >
      <path d="M 38 14 Q 42 8 38 2" stroke="#1F1410" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M 50 18 Q 54 12 50 6" stroke="#1F1410" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M 60 14 Q 64 8 60 2" stroke="#1F1410" strokeWidth="3" strokeLinecap="round" fill="none" />
      <rect x="44" y="28" width="10" height="6" rx="2" fill="#1F1410" />
      <ellipse cx="49" cy="40" rx="30" ry="5" fill="#FFC400" stroke="#1F1410" strokeWidth="3" />
      <path d="M 22 42 L 76 42 L 72 84 L 26 84 Z" fill="#FFD600" stroke="#1F1410" strokeWidth="3" strokeLinejoin="round" />
      <path d="M 19 54 L 8 54 L 8 64 L 19 64" stroke="#1F1410" strokeWidth="3" fill="none" strokeLinejoin="round" />
      <path d="M 79 54 L 90 54 L 90 64 L 79 64" stroke="#1F1410" strokeWidth="3" fill="none" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Pastel salgado detalhado: triângulo dourado com fenda mostrando recheio,
 * marcas do garfo na borda crocante, vapor saindo no topo.
 */
export function PastelSalgadoIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
      {/* vapor */}
      <path d="M 38 14 Q 42 8 38 2" stroke="#1F1410" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M 54 14 Q 58 8 54 2" stroke="#1F1410" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* sombra inferior (lado mais frito) */}
      <path d="M 14 76 L 82 70 L 78 82 Q 48 90 18 82 Z" fill="#FF8A00" stroke="#1F1410" strokeWidth="3" strokeLinejoin="round" />
      {/* corpo dourado */}
      <path d="M 16 74 Q 14 28 50 22 Q 86 28 82 74 Q 48 84 16 74 Z" fill="#FFD600" stroke="#1F1410" strokeWidth="3" strokeLinejoin="round" />
      {/* fenda do recheio */}
      <path d="M 42 46 Q 48 42 56 46 Q 54 54 48 56 Q 44 54 42 46 Z" fill="#FF8A00" stroke="#1F1410" strokeWidth="2.5" strokeLinejoin="round" />
      {/* marcas do garfo na borda */}
      <line x1="26" y1="74" x2="26" y2="80" stroke="#1F1410" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="38" y1="77" x2="38" y2="83" stroke="#1F1410" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="50" y1="78" x2="50" y2="84" stroke="#1F1410" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="62" y1="77" x2="62" y2="83" stroke="#1F1410" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="72" y1="74" x2="72" y2="80" stroke="#1F1410" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Pastel doce: massa clara, calda laranja escorrendo do topo,
 * coraçãozinho carimbado e açúcar polvilhado.
 */
export function PastelDoceIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
      {/* calda escorrendo */}
      <path
        d="M 30 28 Q 30 18 38 18 L 60 18 Q 68 18 68 28 L 70 36 Q 66 42 60 38 L 58 46 Q 52 52 48 44 L 44 50 Q 38 54 36 44 L 32 40 Q 28 36 30 28 Z"
        fill="#FF8A00"
        stroke="#1F1410"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M 14 74 L 82 70 L 78 82 Q 48 90 18 82 Z" fill="#F0C800" stroke="#1F1410" strokeWidth="3" strokeLinejoin="round" />
      {/* corpo amarelo claro */}
      <path d="M 16 74 Q 14 36 50 30 Q 86 36 82 74 Q 48 84 16 74 Z" fill="#FFF1A8" stroke="#1F1410" strokeWidth="3" strokeLinejoin="round" />
      {/* coração */}
      <path d="M 48 58 Q 42 50 38 56 Q 36 62 48 70 Q 60 62 58 56 Q 54 50 48 58 Z" fill="#FF8A00" stroke="#1F1410" strokeWidth="2.5" strokeLinejoin="round" />
      {/* açúcar */}
      <circle cx="26" cy="56" r="1.8" fill="#1F1410" />
      <circle cx="32" cy="64" r="1.8" fill="#1F1410" />
      <circle cx="68" cy="56" r="1.8" fill="#1F1410" />
      <circle cx="74" cy="64" r="1.8" fill="#1F1410" />
      <circle cx="40" cy="74" r="1.8" fill="#1F1410" />
      <circle cx="58" cy="74" r="1.8" fill="#1F1410" />
    </svg>
  );
}

/**
 * Pack de mini-pastéis numa bandejinha. Quatro pastelzinhos enfileirados.
 */
export function PackMiniIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
      {/* borda traseira da bandeja */}
      <path d="M 8 36 L 88 36 L 84 46 L 12 46 Z" fill="#F0C800" stroke="#1F1410" strokeWidth="3" strokeLinejoin="round" />
      {/* pastel 1 */}
      <path d="M 14 56 Q 14 38 26 36 Q 38 38 36 56 Q 26 60 14 56 Z" fill="#FFD600" stroke="#1F1410" strokeWidth="2.5" strokeLinejoin="round" />
      <line x1="20" y1="44" x2="22" y2="50" stroke="#FF8A00" strokeWidth="2" strokeLinecap="round" />
      {/* pastel 2 */}
      <path d="M 32 58 Q 32 38 44 36 Q 56 38 54 58 Q 44 62 32 58 Z" fill="#FFD600" stroke="#1F1410" strokeWidth="2.5" strokeLinejoin="round" />
      <line x1="38" y1="44" x2="40" y2="50" stroke="#FF8A00" strokeWidth="2" strokeLinecap="round" />
      {/* pastel 3 */}
      <path d="M 50 58 Q 50 38 62 36 Q 74 38 72 58 Q 62 62 50 58 Z" fill="#FFD600" stroke="#1F1410" strokeWidth="2.5" strokeLinejoin="round" />
      <line x1="56" y1="44" x2="58" y2="50" stroke="#FF8A00" strokeWidth="2" strokeLinecap="round" />
      {/* pastel 4 */}
      <path d="M 68 56 Q 68 38 80 36 Q 92 38 90 56 Q 80 60 68 56 Z" fill="#FFD600" stroke="#1F1410" strokeWidth="2.5" strokeLinejoin="round" />
      <line x1="74" y1="44" x2="76" y2="50" stroke="#FF8A00" strokeWidth="2" strokeLinecap="round" />
      {/* frente da bandeja (laranja) */}
      <path d="M 10 56 L 86 56 L 80 84 L 16 84 Z" fill="#FF8A00" stroke="#1F1410" strokeWidth="3" strokeLinejoin="round" />
      {/* rótulo */}
      <rect x="32" y="66" width="32" height="12" rx="2" fill="#FFFCF5" stroke="#1F1410" strokeWidth="2.5" />
      <line x1="38" y1="72" x2="58" y2="72" stroke="#1F1410" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Macarrão: prato fundo branco com espaguete amarelo, molho laranja no topo
 * e garfo cravado enrolando os fios.
 */
export function MacarraoIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
      {/* cabo do garfo */}
      <path d="M 64 8 L 56 44" stroke="#1F1410" strokeWidth="3" strokeLinecap="round" />
      {/* dentes do garfo */}
      <path d="M 60 10 L 58 22 M 66 12 L 64 24 M 72 14 L 70 26" stroke="#1F1410" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 56 22 Q 64 24 72 26" stroke="#1F1410" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* monte de espaguete */}
      <ellipse cx="48" cy="56" rx="36" ry="14" fill="#FFD600" stroke="#1F1410" strokeWidth="3" />
      {/* fios enrolados */}
      <path d="M 40 50 Q 52 38 60 46 Q 56 54 50 50" stroke="#1F1410" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M 36 54 Q 48 44 58 52" stroke="#1F1410" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M 20 56 Q 32 50 44 58" stroke="#1F1410" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M 56 60 Q 66 56 76 58" stroke="#1F1410" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* molho no topo */}
      <path
        d="M 32 52 Q 40 46 50 50 Q 60 48 64 56 Q 56 60 48 58 Q 38 60 32 52 Z"
        fill="#FF8A00"
        stroke="#1F1410"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* prato */}
      <path d="M 8 64 Q 8 84 48 84 Q 88 84 88 64" fill="#FFFCF5" stroke="#1F1410" strokeWidth="3" strokeLinejoin="round" />
      <path d="M 14 68 Q 18 78 48 78 Q 78 78 82 68" stroke="#1F1410" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Bebida: copo com tampa amarela, canudo laranja, refrigerante laranja
 * com bolhinhas dentro.
 */
export function BebidaIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
      {/* canudo laranja */}
      <path d="M 56 8 L 50 32" stroke="#FF8A00" strokeWidth="6" strokeLinecap="round" />
      <path d="M 56 8 L 50 32" stroke="#1F1410" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* tampa */}
      <path d="M 18 28 L 78 28 L 74 38 L 22 38 Z" fill="#FFD600" stroke="#1F1410" strokeWidth="3" strokeLinejoin="round" />
      {/* furo do canudo */}
      <ellipse cx="52" cy="33" rx="5" ry="2.5" fill="#1F1410" />
      {/* copo */}
      <path d="M 22 38 L 74 38 L 68 86 L 28 86 Z" fill="#FFFCF5" stroke="#1F1410" strokeWidth="3" strokeLinejoin="round" />
      {/* refrigerante dentro */}
      <path d="M 25 48 L 71 48 L 67 84 L 29 84 Z" fill="#FF8A00" stroke="#1F1410" strokeWidth="2.5" strokeLinejoin="round" />
      {/* bolhas */}
      <circle cx="38" cy="60" r="3" fill="#FFD600" stroke="#1F1410" strokeWidth="2" />
      <circle cx="56" cy="68" r="2.5" fill="#FFD600" stroke="#1F1410" strokeWidth="2" />
      <circle cx="46" cy="76" r="2" fill="#FFD600" stroke="#1F1410" strokeWidth="2" />
      {/* faixa horizontal */}
      <path d="M 28 56 L 68 56" stroke="#1F1410" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}

/**
 * Promoção/combo: tag de oferta laranja com estrela amarela e faíscas
 * celebrativas saindo dos cantos.
 */
export function PromocaoIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
      {/* faíscas */}
      <path d="M 12 20 L 18 24 M 18 16 L 16 24 M 22 20 L 14 22" stroke="#FF8A00" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 80 70 L 88 74 M 84 66 L 84 78 M 88 70 L 78 72" stroke="#FF8A00" strokeWidth="2.5" strokeLinecap="round" />
      {/* cordão */}
      <path d="M 18 18 Q 26 22 32 30" stroke="#1F1410" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* corpo da tag */}
      <path
        d="M 30 32 L 76 22 Q 84 22 86 30 L 88 70 Q 88 78 80 80 L 38 86 Q 30 86 28 78 L 22 40 Q 22 32 30 32 Z"
        fill="#FF8A00"
        stroke="#1F1410"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* furinho */}
      <circle cx="34" cy="40" r="4" fill="#FFFCF5" stroke="#1F1410" strokeWidth="2.5" />
      {/* estrela */}
      <path
        d="M 58 38 L 64 52 L 78 54 L 68 64 L 70 78 L 58 71 L 46 78 L 48 64 L 38 54 L 52 52 Z"
        fill="#FFD600"
        stroke="#1F1410"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* brilho */}
      <circle cx="54" cy="56" r="2" fill="#FFFCF5" />
    </svg>
  );
}

/**
 * Coxinha: formato de gota/lágrima invertida, empanada dourada com
 * textura de farinha de rosca (pontinhos escuros). Base laranja
 * indicando a parte mais frita.
 */
export function CoxinhaIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
      {/* vapor */}
      <path d="M 40 10 Q 44 4 40 -1" stroke="#1F1410" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M 52 12 Q 56 6 52 1" stroke="#1F1410" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* base do prato (sombra) */}
      <ellipse cx="48" cy="86" rx="26" ry="4" fill="#F0C800" stroke="#1F1410" strokeWidth="2.5" />
      {/* corpo da coxinha (gota invertida) */}
      <path
        d="M 48 16 Q 52 20 58 32 Q 68 50 68 66 Q 68 82 48 82 Q 28 82 28 66 Q 28 50 38 32 Q 44 20 48 16 Z"
        fill="#FFD600"
        stroke="#1F1410"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* sombra inferior (mais frito) */}
      <path
        d="M 30 62 Q 30 82 48 82 Q 66 82 66 62 Q 60 76 48 76 Q 36 76 30 62 Z"
        fill="#FF8A00"
        stroke="#1F1410"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* textura da farinha */}
      <circle cx="42" cy="40" r="1.6" fill="#1F1410" />
      <circle cx="52" cy="46" r="1.6" fill="#1F1410" />
      <circle cx="46" cy="54" r="1.6" fill="#1F1410" />
      <circle cx="56" cy="58" r="1.6" fill="#1F1410" />
      <circle cx="40" cy="62" r="1.6" fill="#1F1410" />
      <circle cx="50" cy="70" r="1.6" fill="#1F1410" />
    </svg>
  );
}

/**
 * Torta salgada: fatia triangular vista de cima, com crosta dourada
 * na borda e recheio laranja no centro. Cortada em cunha.
 */
export function TortaIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
      {/* vapor */}
      <path d="M 42 14 Q 46 8 42 2" stroke="#1F1410" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M 56 14 Q 60 8 56 2" stroke="#1F1410" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* base (sombra da tábua) */}
      <path d="M 12 74 L 84 74 L 78 84 L 18 84 Z" fill="#F0C800" stroke="#1F1410" strokeWidth="3" strokeLinejoin="round" />
      {/* fatia triangular — vista de perfil */}
      <path
        d="M 20 74 L 76 74 L 48 26 Z"
        fill="#FFD600"
        stroke="#1F1410"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* recheio laranja (visível na fatia) */}
      <path
        d="M 30 68 L 66 68 L 48 40 Z"
        fill="#FF8A00"
        stroke="#1F1410"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* massinha da borda superior (crosta lateral) */}
      <line x1="26" y1="68" x2="70" y2="68" stroke="#1F1410" strokeWidth="2.5" strokeLinecap="round" />
      {/* riscos de forno na crosta */}
      <line x1="36" y1="60" x2="42" y2="52" stroke="#1F1410" strokeWidth="2" strokeLinecap="round" />
      <line x1="54" y1="52" x2="60" y2="60" stroke="#1F1410" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Cuscuz no pote: pote cilíndrico transparente com camada de cuscuz
 * granulado no topo, recheio abaixo. Tampa dourada.
 */
export function CuscuzIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
      {/* vapor */}
      <path d="M 40 8 Q 44 2 40 -3" stroke="#1F1410" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M 54 8 Q 58 2 54 -3" stroke="#1F1410" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* colher espetada */}
      <rect x="66" y="10" width="4" height="42" rx="1.5" fill="#FFFCF5" stroke="#1F1410" strokeWidth="2.5" />
      <ellipse cx="68" cy="16" rx="6" ry="4" fill="#FFFCF5" stroke="#1F1410" strokeWidth="2.5" />
      {/* corpo do pote (cilindro) */}
      <path
        d="M 18 24 L 74 24 L 74 84 Q 74 88 70 88 L 22 88 Q 18 88 18 84 Z"
        fill="#FFFCF5"
        stroke="#1F1410"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* camada de recheio (frango/charque) laranja */}
      <path d="M 20 60 L 72 60 L 72 84 Q 72 86 70 86 L 22 86 Q 20 86 20 84 Z" fill="#FF8A00" />
      {/* pedacinhos do recheio */}
      <circle cx="30" cy="72" r="2" fill="#1F1410" />
      <circle cx="42" cy="78" r="2" fill="#1F1410" />
      <circle cx="56" cy="72" r="2" fill="#1F1410" />
      <circle cx="62" cy="80" r="2" fill="#1F1410" />
      {/* camada de cuscuz amarelinho */}
      <path d="M 20 32 L 72 32 L 72 60 L 20 60 Z" fill="#FFD600" />
      {/* granulado do cuscuz */}
      <circle cx="26" cy="40" r="1.4" fill="#1F1410" />
      <circle cx="34" cy="46" r="1.4" fill="#1F1410" />
      <circle cx="42" cy="38" r="1.4" fill="#1F1410" />
      <circle cx="50" cy="44" r="1.4" fill="#1F1410" />
      <circle cx="58" cy="38" r="1.4" fill="#1F1410" />
      <circle cx="66" cy="46" r="1.4" fill="#1F1410" />
      <circle cx="30" cy="52" r="1.4" fill="#1F1410" />
      <circle cx="46" cy="54" r="1.4" fill="#1F1410" />
      <circle cx="62" cy="52" r="1.4" fill="#1F1410" />
      {/* linhas divisórias das camadas */}
      <line x1="20" y1="60" x2="72" y2="60" stroke="#1F1410" strokeWidth="2.5" />
      {/* tampa (opcional — sugere pote fechável) */}
      <path d="M 14 22 L 78 22 L 76 32 L 16 32 Z" fill="#F0C800" stroke="#1F1410" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Refeição: prato branco redondo visto de cima, com montinho de
 * arroz amarelo/branco e feijão marrom no lado, garfo apoiado.
 */
export function RefeicaoIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
      {/* vapor */}
      <path d="M 38 14 Q 42 8 38 2" stroke="#1F1410" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M 54 14 Q 58 8 54 2" stroke="#1F1410" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* borda externa do prato (perspectiva de cima) */}
      <ellipse cx="48" cy="58" rx="40" ry="24" fill="#FFFCF5" stroke="#1F1410" strokeWidth="3" />
      {/* borda interna do prato */}
      <ellipse cx="48" cy="58" rx="32" ry="18" fill="#FFFCF5" stroke="#1F1410" strokeWidth="2.5" />
      {/* arroz — montinho amarelo à esquerda */}
      <path
        d="M 22 58 Q 26 46 40 46 Q 50 48 48 62 Q 40 68 24 66 Q 20 62 22 58 Z"
        fill="#FFD600"
        stroke="#1F1410"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* granulação do arroz */}
      <circle cx="30" cy="54" r="1.4" fill="#1F1410" />
      <circle cx="36" cy="58" r="1.4" fill="#1F1410" />
      <circle cx="42" cy="54" r="1.4" fill="#1F1410" />
      <circle cx="32" cy="62" r="1.4" fill="#1F1410" />
      {/* feijão — mancha marrom/laranja à direita */}
      <path
        d="M 50 52 Q 60 46 70 52 Q 74 60 66 66 Q 56 68 50 62 Q 46 56 50 52 Z"
        fill="#FF8A00"
        stroke="#1F1410"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* grãos do feijão */}
      <ellipse cx="58" cy="56" rx="2.4" ry="1.6" fill="#1F1410" />
      <ellipse cx="64" cy="60" rx="2.4" ry="1.6" fill="#1F1410" />
      <ellipse cx="56" cy="62" rx="2.4" ry="1.6" fill="#1F1410" />
    </svg>
  );
}

// === Aliases de compat ===
// Código antigo importa PastelIcon e DoceIcon. Mantém apontando pros novos.
export const PastelIcon = PastelSalgadoIcon;
export const DoceIcon = PastelDoceIcon;
