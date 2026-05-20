"use client";
import { useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { useSwipeable } from "react-swipeable";

/**
 * Wrapper Android-style pra item de cart: arrasta pra esquerda revela
 * fundo vermelho com ícone de lixeira; passa do threshold = remove.
 *
 * Usabilidade:
 * - Swipe < 80px: snaps de volta (não remove)
 * - Swipe ≥ 120px: snap pra revelar 100% o "Remover" — solta = remove
 * - Swipe contínuo até final: remove imediato
 *
 * Mantém o botão X tradicional dentro do children pra quem prefere
 * tap (acessibilidade + onboarding). O swipe é shortcut, não único caminho.
 */
export function SwipeableCartItem({
  onRemove,
  children,
}: {
  onRemove: () => void;
  children: ReactNode;
}) {
  // deltaX < 0 = arrastando pra esquerda. positivo = ignora.
  const [deltaX, setDeltaX] = useState(0);
  const [removing, setRemoving] = useState(false);

  const REMOVE_THRESHOLD = 120;
  const MAX_REVEAL = 200;

  const handlers = useSwipeable({
    onSwiping: (e) => {
      if (e.dir === "Left" && e.deltaX < 0) {
        setDeltaX(Math.max(-MAX_REVEAL, e.deltaX));
      } else if (e.dir === "Right" && deltaX < 0) {
        setDeltaX(Math.min(0, deltaX + e.deltaX));
      }
    },
    onSwiped: (e) => {
      if (e.deltaX < -REMOVE_THRESHOLD) {
        // Confirma remoção — anima até off-screen e dispara
        setRemoving(true);
        setTimeout(onRemove, 200);
      } else if (e.deltaX < -10) {
        // Snap-back abaixo do threshold — vibra 10ms pra confirmar "não fez nada".
        // Sem isso, atendente fica em dúvida ("será que removeu?"). Audit P2 #17.
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate(10);
        }
        setDeltaX(0);
      } else {
        setDeltaX(0);
      }
    },
    trackMouse: false, // só touch — desktop usa o botão X
    preventScrollOnSwipe: true,
    delta: 10,
  });

  const reveal = Math.min(MAX_REVEAL, -deltaX);
  const passedThreshold = reveal >= REMOVE_THRESHOLD;

  return (
    <div className="relative overflow-hidden rounded-md">
      {/* Fundo vermelho revelado embaixo */}
      <div
        className={`absolute inset-0 flex items-center justify-end pr-5 transition-colors ${
          passedThreshold ? "bg-danger" : "bg-danger-bg"
        }`}
        aria-hidden
      >
        <div className={`flex items-center gap-2 ${passedThreshold ? "text-white" : "text-danger"}`}>
          <Trash2
            key={passedThreshold ? "hot" : "cold"}
            size={20}
            strokeWidth={2.5}
            className={passedThreshold ? "animate-icon-snap" : ""}
          />
          <span className="text-sm font-extrabold uppercase tracking-[0.06em]">
            {passedThreshold ? "Solta pra remover" : "Remover"}
          </span>
        </div>
      </div>

      {/* Conteúdo arrastável */}
      <div
        {...handlers}
        style={{
          transform: `translateX(${removing ? -MAX_REVEAL * 1.5 : deltaX}px)`,
          transition:
            deltaX === 0 || removing ? "transform 200ms ease-out" : "none",
        }}
        className="relative bg-surface-elevated"
      >
        {children}
      </div>
    </div>
  );
}
