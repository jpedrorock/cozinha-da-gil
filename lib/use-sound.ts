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
 */
export function useDing() {
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
      }
    };
  }, []);

  return function play() {
    if (!isSoundEnabled()) return;
    if (typeof window === "undefined") return;
    try {
      if (!ctxRef.current) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctxRef.current = new Ctx();
      }
      const ctx = ctxRef.current;
      // Dois pulsos curtos: G5 (~784Hz) → C6 (~1047Hz)
      const now = ctx.currentTime;
      const beep = (freq: number, t: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + t);
        gain.gain.linearRampToValueAtTime(0.2, now + t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + t + duration);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + t);
        osc.stop(now + t + duration);
      };
      beep(784, 0, 0.15);
      beep(1047, 0.12, 0.2);
    } catch {
      // sem som disponível, ignora
    }
  };
}
