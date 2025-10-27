import { useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import SigilPage from "./pages/SigilPage/SigilPage";
import SigilExplorer from "./components/SigilExplorer";
import SigilFeedPage from "./pages/SigilFeedPage";

import { requestKairosNotifications } from "./components/notifications/KairosNotifier";

import "./App.css";
import "./components/KaiKlock.css";
import "./components/EternalKlock.css";
import "./SplashScreen.css";

import EternalKlock from "./components/EternalKlock";
import SigilGlyphButton from "./components/SigilGlyphButton";
import WeekKalendarModal from "./components/WeekKalendarModal";
import InvestorSigilModal from "./components/InvestorSigilModal";

import type { BIPEvent } from "./pwa-shim";
import HomePriceChartCard from "./components/HomePriceChartCard";

/** ---- Config ---- */
const APP_STORE_URL = "https://apps.apple.com/us/app/kai-klok/id6752520846";
const GITHUB_URL = "https://api.kaiklok.com";

/** ---- Window augmentation for safe TS ---- */
declare global {
  interface Window {
    __bipEvent?: BIPEvent | null;
    __bipWaiters?: Array<(e: BIPEvent) => void>;
  }
}

/** iOS + iPadOS desktop-UA detection (no `any`) */
function useIsIOS(): boolean {
  return useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent;
    const platform = (navigator as { platform?: string }).platform ?? "";
    const maxTouchPoints = (navigator as { maxTouchPoints?: number }).maxTouchPoints ?? 0;
    const iOSUA = /iPad|iPhone|iPod/.test(ua);
    const iPadOSDesktopUA = platform === "MacIntel" && maxTouchPoints > 1;
    return iOSUA || iPadOSDesktopUA;
  }, []);
}

/** Detect if running as an installed PWA; keep it reactive to changes */
function useIsStandalone(): boolean {
  const [standalone, setStandalone] = useState<boolean>(() => {
    const viaMedia =
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(display-mode: standalone)")?.matches;
    const viaNav =
      typeof navigator !== "undefined" &&
      "standalone" in navigator &&
      (navigator as { standalone?: boolean }).standalone === true;
    return Boolean(viaMedia || viaNav);
  });

  useEffect(() => {
    // React to media-query changes (Chromium + some desktop PWAs)
    const mql =
      typeof window !== "undefined"
        ? window.matchMedia?.("(display-mode: standalone)")
        : null;

    const onChange = () => {
      const viaMedia = !!mql?.matches;
      const viaNav =
        typeof navigator !== "undefined" &&
        "standalone" in navigator &&
        (navigator as { standalone?: boolean }).standalone === true;
      setStandalone(Boolean(viaMedia || viaNav));
    };

    mql?.addEventListener?.("change", onChange);

    // React when install completes
    const onInstalled = () => setStandalone(true);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      mql?.removeEventListener?.("change", onChange);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return standalone;
}

/** One-button CTA that adapts:
 *  - Not installed → shows "Source / Install" pill that opens a small menu (Install, Source)
 *  - Installed (standalone) → shows a simple "Source" pill
 */
function SourceOrInstallButton() {
  const isIOS = useIsIOS();
  const isStandalone = useIsStandalone();

  const [deferredPrompt, setDeferredPrompt] = useState<BIPEvent | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Capture any early or future beforeinstallprompt events
  useEffect(() => {
    if (typeof window !== "undefined" && window.__bipEvent) {
      setDeferredPrompt(window.__bipEvent);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      const bip = e as BIPEvent;
      setDeferredPrompt(bip);
      if (window.__bipWaiters && window.__bipWaiters.length) {
        // flush any waiters awaiting a late event
        window.__bipWaiters.forEach((fn) => fn(bip));
        window.__bipWaiters = [];
      }
      window.__bipEvent = bip;
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Close menu on outside click / ESC
  useEffect(() => {
    if (!menuOpen) return;

    const onDocClick = (evt: MouseEvent) => {
      const t = evt.target as Node | null;
      if (t && (btnRef.current?.contains(t) || menuRef.current?.contains(t))) return;
      setMenuOpen(false);
    };
    const onKey = (evt: KeyboardEvent) => {
      if (evt.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const openMenu = () => setMenuOpen((v) => !v);

  const promptInstall = async (ev: BIPEvent) => {
    await ev.prompt();
    try {
      await ev.userChoice;
    } finally {
      setDeferredPrompt(null);
      if (typeof window !== "undefined") window.__bipEvent = null;
      setMenuOpen(false);
    }
  };

  /** Install flow:
   *  iOS → App Store
   *  Android/Desktop → prompt via BIP (immediate or wait ~1.5s for a late event)
   */
  const handleInstall = async () => {
    if (isIOS) {
      window.open(APP_STORE_URL, "_blank", "noopener,noreferrer");
      setMenuOpen(false);
      return;
    }

    if (deferredPrompt) {
      await promptInstall(deferredPrompt);
      return;
    }

    if (typeof window !== "undefined" && window.__bipEvent) {
      await promptInstall(window.__bipEvent);
      return;
    }

    // Wait briefly for a late-firing BIP
    const got = await new Promise<BIPEvent | null>((resolve) => {
      let resolved = false;
      const flush = (e: BIPEvent) => {
        if (resolved) return;
        resolved = true;
        resolve(e);
      };

      if (typeof window !== "undefined") {
        if (Array.isArray(window.__bipWaiters)) {
          window.__bipWaiters.push(flush);
        } else {
          window.__bipWaiters = [flush];
        }
      }

      window.setTimeout(() => {
        if (!resolved) resolve(null);
      }, 1500);
    });

    if (got) {
      await promptInstall(got);
      return;
    }

    // No prompt available; close menu gracefully
    setMenuOpen(false);
  };

  const handleSource = () => {
    window.open(GITHUB_URL, "_blank", "noopener,noreferrer");
    setMenuOpen(false);
  };

  // If already installed as a PWA: show a single "Source" pill (no menu)
  if (isStandalone) {
    return (
      <div className="kairos-dev-cta">
        <button
          ref={btnRef}
          type="button"
          className="kairos-api-button dual-cta-trigger"
          aria-label="Source"
          onClick={handleSource}
        >
          <img src="/kai-icon.svg" alt="" className="kairos-icon" />
          <span>Source</span>
        </button>
      </div>
    );
  }

  // Not installed yet → show menu trigger: "Source / Install"
  return (
    <>
      <div className="kairos-dev-cta">
        <button
          ref={btnRef}
          type="button"
          className="kairos-api-button dual-cta-trigger"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={openMenu}
        >
          <img src="/kai-icon.svg" alt="" className="kairos-icon" />
          <span>Source / Install</span>
          <img
            src="/kai-arrow.svg"
            alt=""
            className={`kairos-arrow ${menuOpen ? "rot" : ""}`}
          />
        </button>
      </div>

      {menuOpen && (
        <div
          ref={menuRef}
          className="dual-cta-menu"
          role="menu"
          aria-label="Source or Install"
        >
          <button
            type="button"
            className="dual-cta-item"
            role="menuitem"
            onClick={handleInstall}
          >
            <img
              src={isIOS ? "/assets/appstore.svg" : "/assets/install-iphone.svg"}
              alt=""
              className="dual-cta-icon"
              draggable={false}
            />
            <div className="dual-cta-text">
              <div className="dual-cta-title">
                {isIOS ? "Install from App Store" : "Install App"}
              </div>
              <div className="dual-cta-sub">
                {isIOS ? "Opens Apple App Store" : "Adds Kai-Klok as a PWA"}
              </div>
            </div>
          </button>

          <button
            type="button"
            className="dual-cta-item"
            role="menuitem"
            onClick={handleSource}
          >
            <img src="/kai-icon.svg" alt="" className="dual-cta-icon" draggable={false} />
            <div className="dual-cta-text">
              <div className="dual-cta-title">Source</div>
              <div className="dual-cta-sub">View the KAI-Klok Gateway</div>
            </div>
          </button>
        </div>
      )}
    </>
  );
}

/** Home UI */
function HomeShell() {
  const [showSplash, setShowSplash] = useState(true);
  const [morphing, setMorphing] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [showWeekModal, setShowWeekModal] = useState(false);

  // Investor modal state + phi key
  const [showInvestorModal, setShowInvestorModal] = useState(false);
  const userPhiKey = useMemo(() => {
    try {
      return (typeof localStorage !== "undefined" && localStorage.getItem("userPhiKey")) || "guest";
    } catch {
      return "guest";
    }
  }, []);

  // Kai Pulse (kept as-is from your snippet)
  const calculateKaiPulse = (): number => {
    const moment = new Date(Date.UTC(2024, 4, 10, 6, 45, 40));
    const base = new Date("1990-02-19T00:00:00Z");
    const diffSeconds = Math.floor((moment.getTime() - base.getTime()) / 1000);
    return 206_000_000 + Math.floor(diffSeconds / (3 + Math.sqrt(5)));
  };
  const [kaiPulse] = useState<number>(calculateKaiPulse());

  useEffect(() => {
    requestKairosNotifications();
    const delayMount = setTimeout(() => setMounted(true), 0);
    const frame = requestAnimationFrame(() => {
      setTimeout(() => {
        setMorphing(true);
        setTimeout(() => setShowSplash(false), 888);
      }, 1618);
    });
    return () => {
      clearTimeout(delayMount);
      cancelAnimationFrame(frame);
    };
  }, []);

  const openWeekModal = () => setShowWeekModal(true);
  const openInvestorModal = () => setShowInvestorModal(true);

  return (
    <div className="app-root">
      {showSplash && (
        <div className="splash-screen">
          {mounted && (
            <div className={`logo-wrapper ${morphing ? "morph-start" : ""}`}>
              <img
                src="/spiral-logo.png"
                alt="Kai-Klok Spiral"
                className={`spiral-logo ${!morphing ? "pulse-animation" : ""}`}
                draggable={false}
              />
              <img src="/logo.png" alt="Kai-Klok Face" className="klok-logo" draggable={false} />
            </div>
          )}
          
        </div>
      )}
          
 {/* Live Φ value + inline checkout: UNDER the buttons, INSIDE the panel */}
            <div style={{ marginTop: "8px" }}>
              <HomePriceChartCard
                apiBase="https://pay.kaiklok.com"
                ctaAmountUsd={144}
                chartHeight={240}
                // stripePk={import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY} // optional override
              />
              
            </div>

            
            
      <div className={`main-ui ${showSplash ? "hidden-behind-splash" : ""}`}>
        <section className="hero-stage"></section>

        <div className="eternal-klock-backdrop" role="dialog" aria-modal="false">
          
          <div className="eternal-klock-panel">
            <EternalKlock />

            <div
              className="eternal-klock-toolbar"
              style={{ marginTop: "0.75rem", display: "flex", gap: "10px", justifyContent: "center" }}
            >
              <SigilGlyphButton kaiPulse={kaiPulse} />

              {/* Investor Portal */}
              <button
                className="toolbar-btn"
                onClick={openInvestorModal}
                title="Open Investor Portal"
                aria-label="Open Investor Portal"
              >
                <img
                  src="/assets/invest.svg"
                  alt="Investor Portal"
                  className="toolbar-icon"
                  draggable={false}
                />
              </button>

              <button className="toolbar-btn" onClick={openWeekModal} title="Open Kairos Week Spiral">
                <img src="/assets/weekkalendar.svg" alt="Kairos Week" className="toolbar-icon" draggable={false} />
              </button>
            </div>

            {showWeekModal && <WeekKalendarModal onClose={() => setShowWeekModal(false)} />}

            {showInvestorModal && (
              <InvestorSigilModal
                isOpen={showInvestorModal}
                onClose={() => setShowInvestorModal(false)}
                userPhiKey={userPhiKey}
              />
            )}

      
          </div>
             {/* Bottom-center CTA: Source button — chart is above this */}
             <div className="cta-stack">
          <SourceOrInstallButton />
        </div>
        </div>

      
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/s" element={<SigilPage />} />
        <Route path="/s/:hash" element={<SigilPage />} />
        <Route path="/explorer" element={<SigilExplorer />} />
        <Route path="/feed" element={<SigilFeedPage />} />
        <Route path="/" element={<HomeShell />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
