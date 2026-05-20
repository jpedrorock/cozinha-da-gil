import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    // Breakpoint `xs` pra acomodar iPhone SE 1st gen (320px). Tailwind
    // default começa em `sm: 640px`. Audit P2 #22: KPIs admin em 2-col
    // ficavam apertados em 320-375px com valores BRL grandes.
    screens: {
      xs: "480px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      colors: {
        brand: {
          yellow: "#FFD600",
          "yellow-hover": "#FFC400",
          "yellow-press": "#F5BF00",
          orange: "#FF6B00",
          "orange-hover": "#E85F00",
          cream: "#FFF9EC",
        },
        ink: {
          DEFAULT: "#1F1410",
          2: "#4A3D34",
          // ink-3 escurecido de #8A7D72 (3.93:1 sobre surface) pra #6F635A
          // (4.55:1) — passa WCAG AA pra texto normal. Texto secundário
          // em sol pleno na barraca a céu aberto agora é legível.
          3: "#6F635A",
          inverse: "#FFF9EC",
        },
        surface: {
          DEFAULT: "#FFF9EC",
          elevated: "#FFFFFF",
          sunken: "#F5EFE0",
        },
        line: {
          DEFAULT: "#EFE9DE",
          strong: "#DDD3C0",
        },
        status: {
          incoming: "#2A6FAA",
          "incoming-bg": "#DBE9F4",
          "incoming-ink": "#143952",
          preparing: "#E5B400",
          "preparing-bg": "#FFF1B8",
          "preparing-ink": "#4A3700",
          ready: "#1F9B4A",
          "ready-bg": "#DEF5E5",
          "ready-ink": "#0F5A29",
          delivered: "#9B9590",
          "delivered-bg": "#EDEAE5",
          "delivered-ink": "#423D38",
        },
        danger: "#D03A2C",
        "danger-bg": "#FBE3E0",
      },
      fontFamily: {
        sans: [
          "var(--font-jakarta)",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SF Mono", "Menlo", "monospace"],
      },
      fontSize: {
        xs: ["12px", { lineHeight: "1.4" }],
        sm: ["14px", { lineHeight: "1.5" }],
        base: ["16px", { lineHeight: "1.5" }],
        lg: ["18px", { lineHeight: "1.5" }],
        xl: ["20px", { lineHeight: "1.4" }],
        "2xl": ["24px", { lineHeight: "1.2" }],
        "3xl": ["32px", { lineHeight: "1.15" }],
        "4xl": ["40px", { lineHeight: "1.1" }],
        "5xl": ["56px", { lineHeight: "1.05" }],
        "6xl": ["72px", { lineHeight: "1.05" }],
      },
      borderRadius: {
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "20px",
        xl: "28px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(31,20,16,.06)",
        md: "0 1px 2px rgba(31,20,16,.06), 0 4px 12px rgba(31,20,16,.08)",
        lg: "0 8px 24px rgba(31,20,16,.16)",
        xl: "0 16px 48px rgba(31,20,16,.20)",
        focus: "0 0 0 3px rgba(255, 214, 0, 0.4)",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(.2,.8,.2,1)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        "sheet-up": {
          from: { transform: "translateY(30%)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "toast-drop": {
          from: { transform: "translate(-50%, -12px)", opacity: "0" },
          to: { transform: "translate(-50%, 0)", opacity: "1" },
        },
        "card-in": {
          from: { transform: "translateY(12px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "card-out": {
          from: { transform: "translateY(0) scale(1)", opacity: "1" },
          to: { transform: "translateY(-8px) scale(0.96)", opacity: "0" },
        },
        "slide-in-right": {
          from: { transform: "translateX(12px)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        "slide-in-left": {
          from: { transform: "translateX(-12px)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        "flash-ring": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(255, 214, 0, 0)" },
          "50%": { boxShadow: "0 0 0 8px rgba(255, 214, 0, 0.5)" },
        },
        "fab-pulse": {
          "0%, 100%": {
            transform: "scale(1)",
            boxShadow:
              "0 10px 28px rgba(31,20,16,0.18), 0 0 0 0 rgba(255,214,0,0.7)",
          },
          "50%": {
            transform: "scale(1.04)",
            boxShadow:
              "0 14px 36px rgba(31,20,16,0.24), 0 0 0 14px rgba(255,214,0,0)",
          },
        },
        "badge-pop": {
          "0%": { transform: "scale(0.85)", opacity: "0.6" },
          "60%": { transform: "scale(1.08)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "number-bump": {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.18)" },
          "100%": { transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "prep-glow": {
          "0%, 100%": {
            boxShadow:
              "0 0 0 0 rgba(208,58,44,0.0), 0 1px 2px rgba(31,20,16,.06), 0 4px 12px rgba(31,20,16,.08)",
          },
          "50%": {
            boxShadow:
              "0 0 0 6px rgba(208,58,44,0.22), 0 1px 2px rgba(31,20,16,.06), 0 4px 12px rgba(31,20,16,.08)",
          },
        },
        // === Animações sutis adicionadas (proposta agente design) ===
        // Exit do ticket na cozinha — premia a ação de "Finalizar" sem celebrar demais
        "ticket-out": {
          "0%": { transform: "translateY(0) scale(1)", opacity: "1" },
          "40%": { transform: "translateY(-2px) scale(1.01)", opacity: "1" },
          "100%": { transform: "translateY(-14px) scale(0.97)", opacity: "0" },
        },
        // Cadeado destravando — micro-rotação ao abrir caixa
        "lock-unlock": {
          "0%": { transform: "rotate(0deg) scale(1)" },
          "40%": { transform: "rotate(-12deg) scale(1.08)" },
          "100%": { transform: "rotate(0deg) scale(1)" },
        },
        "state-swap-in": {
          from: { transform: "translateY(8px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        // Tick no anel quando muda zona crítica (verde→amarelo→laranja→vermelho)
        "ring-tick": {
          "0%": { transform: "scale(1)" },
          "45%": { transform: "scale(1.06)" },
          "100%": { transform: "scale(1)" },
        },
        // Cards do display TV — escala maior pra distância visual
        "tv-card-in": {
          from: { transform: "translateY(24px) scale(0.98)", opacity: "0" },
          to: { transform: "translateY(0) scale(1)", opacity: "1" },
        },
        "flash-ring-once": {
          "0%": { boxShadow: "0 0 0 0 rgba(31,155,74,0.0)" },
          "30%": { boxShadow: "0 0 0 12px rgba(31,155,74,0.45)" },
          "100%": { boxShadow: "0 0 0 0 rgba(31,155,74,0.0)" },
        },
        // Empty states respirando — sutil mas vivo
        "empty-breathe": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.03)" },
        },
        // Feedback tátil quando swipe passa threshold
        "icon-snap": {
          "0%": { transform: "scale(1)" },
          "55%": { transform: "scale(1.18)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 180ms cubic-bezier(.2,.8,.2,1)",
        "fade-out": "fade-out 180ms cubic-bezier(.2,.8,.2,1) forwards",
        "sheet-up": "sheet-up 220ms cubic-bezier(.2,.8,.2,1)",
        "toast-drop": "toast-drop 220ms cubic-bezier(.2,.8,.2,1)",
        "card-in": "card-in 240ms cubic-bezier(.2,.8,.2,1)",
        "card-out": "card-out 220ms cubic-bezier(.2,.8,.2,1) forwards",
        "slide-in-right": "slide-in-right 220ms cubic-bezier(.2,.8,.2,1)",
        "slide-in-left": "slide-in-left 220ms cubic-bezier(.2,.8,.2,1)",
        "flash-ring": "flash-ring 1.6s ease-out infinite",
        "fab-pulse": "fab-pulse 2.4s cubic-bezier(.2,.8,.2,1) infinite",
        "badge-pop": "badge-pop 260ms cubic-bezier(.2,.8,.2,1)",
        "number-bump": "number-bump 180ms cubic-bezier(.2,.8,.2,1)",
        shimmer: "shimmer 1.6s linear infinite",
        "spin-slow": "spin-slow 900ms linear infinite",
        "prep-glow": "prep-glow 1.6s ease-in-out infinite",
        "ticket-out": "ticket-out 240ms cubic-bezier(.2,.8,.2,1) forwards",
        "lock-unlock": "lock-unlock 360ms cubic-bezier(.2,.8,.2,1)",
        "state-swap-in": "state-swap-in 220ms cubic-bezier(.2,.8,.2,1)",
        "ring-tick": "ring-tick 280ms cubic-bezier(.2,.8,.2,1)",
        "tv-card-in": "tv-card-in 320ms cubic-bezier(.2,.8,.2,1)",
        "flash-ring-once": "flash-ring-once 1400ms ease-out 1",
        // Idle público (TV ligada 8h direto) — limita ciclos pra reduzir
        // motion fatigue. 30 ciclos × 3.6s ≈ ~2min de "respiração", suficiente
        // pra atrair atenção quando coluna entra empty; depois fica parado.
        "empty-breathe": "empty-breathe 3.6s ease-in-out 30",
        "icon-snap": "icon-snap 160ms cubic-bezier(.2,.8,.2,1)",
      },
    },
  },
  plugins: [],
};
export default config;
