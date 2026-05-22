"use client";
import { useEffect, useRef } from "react";

const KEY = "pdg:sound-enabled";

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const v = window.localStorage.getItem(KEY);
  return v !== "0";
}

export function setSoundEnabled(v: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, v ? "1" : "0");
}

/**
 * Toca um "ding" curto (oscilador Web Audio API).
 * Sem mp3/wav — gerado no navegador.
 *
 * Níveis de urgência (audit-crit B #21):
 *   - "normal" (default): G5→C6, suave — chegada de pedido novo
 *   - "warn":    A5→D6→A5, médio — pedido cruzou aviso (10min)
 *   - "urgent":  E6→A5→E6→A5, grave/insistente — passou da meta (20min)
 */
export type DingLevel = "normal" | "warn" | "urgent";

export function useDing() {
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
      }
    };
  }, []);

  return function play(level: DingLevel = "normal") {
    if (!isSoundEnabled()) return;
    if (typeof window === "undefined") return;
    try {
      if (!ctxRef.current) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctxRef.current = new Ctx();
      }
      const ctx = ctxRef.current;
      const now = ctx.currentTime;
      const beep = (freq: number, t: number, duration: number, vol = 0.2) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + t);
        gain.gain.linearRampToValueAtTime(vol, now + t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + t + duration);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + t);
        osc.stop(now + t + duration);
      };

      if (level === "urgent") {
        // 4 beeps alternados, mais altos e curtos — insistente
        beep(1319, 0.00, 0.13, 0.28); // E6
        beep(880, 0.15, 0.13, 0.28); // A5
        beep(1319, 0.30, 0.13, 0.28);
        beep(880, 0.45, 0.18, 0.28);
      } else if (level === "warn") {
        // 3 beeps médios — chama atenção sem alarmar
        beep(880, 0.00, 0.14, 0.22); // A5
        beep(1175, 0.16, 0.14, 0.22); // D6
        beep(880, 0.32, 0.18, 0.22);
      } else {
        // normal — chegada (mantido idêntico ao original pra não mudar UX)
        beep(784, 0, 0.15);
        beep(1047, 0.12, 0.2);
      }
    } catch {
      // sem som disponível, ignora
    }
  };
}
