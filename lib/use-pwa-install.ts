"use client";
import { useEffect, useState } from "react";

/**
 * Estado de instalabilidade PWA, com 3 caminhos distintos:
 *
 * - `installed`: app já está em modo standalone (instalado e aberto pela home).
 *   Nada a oferecer.
 * - `ios-installable`: Safari iOS — não tem `beforeinstallprompt` (Apple
 *   intencionalmente não expõe). Tem que ensinar gesto manual: "Toque em
 *   compartilhar → Adicionar à Tela de Início".
 * - `android-installable`: Chrome/Edge Android — captura `beforeinstallprompt`
 *   e permite acionar via JS quando user clicar em CTA.
 * - `desktop`: navegador desktop ou outros mobiles sem PWA install path
 *   (Firefox iOS, etc). Não mostra prompt.
 */
type State =
  | { mode: "loading" }
  | { mode: "installed" }
  | { mode: "ios-installable" }
  | { mode: "android-installable"; prompt: BeforeInstallPromptEvent }
  | { mode: "desktop" };

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function usePwaInstall() {
  const [state, setState] = useState<State>({ mode: "loading" });

  useEffect(() => {
    // 1) Detecta se já está instalado (standalone display-mode).
    //    Em iOS, navigator.standalone é específico; em Android/Chrome, é o
    //    media query. Ambos cobrem o caso "rodando como app".
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // Safari iOS expõe via navigator.standalone (não-standard mas estável).
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) {
      setState({ mode: "installed" });
      return;
    }

    // 2) iOS Safari? UserAgent é fonte mais confiável aqui — sem API direta.
    //    iPadOS 13+ se anuncia como Mac Safari, mas tem touch — checamos isso
    //    pra incluir.
    const ua = navigator.userAgent;
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
    if (isIOS && isSafari) {
      setState({ mode: "ios-installable" });
      return;
    }

    // 3) Chrome/Edge Android — espera beforeinstallprompt
    const onBeforeInstall = (e: Event) => {
      e.preventDefault(); // bloqueia mini-infobar default; vamos disparar nós
      setState({ mode: "android-installable", prompt: e as BeforeInstallPromptEvent });
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // 4) Quando o app é instalado a partir do nosso prompt, vira "installed"
    const onAppInstalled = () => setState({ mode: "installed" });
    window.addEventListener("appinstalled", onAppInstalled);

    // Default: desktop ou outros browsers sem path de install conhecido
    setState({ mode: "desktop" });

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  /** Dispara o prompt nativo do Chrome/Edge Android. Em iOS não faz nada
   *  (Safari não permite — UI tem que mostrar instrução manual). */
  async function promptInstall() {
    if (state.mode !== "android-installable") return;
    await state.prompt.prompt();
    const choice = await state.prompt.userChoice;
    if (choice.outcome === "accepted") {
      setState({ mode: "installed" });
    }
  }

  return { state, promptInstall };
}
