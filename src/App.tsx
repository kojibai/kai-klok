// src/App.tsx
import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import SigilPage from "./pages/SigilPage/SigilPage";
import SigilExplorer from "./components/SigilExplorer"; // ✅ Explorer

import { requestKairosNotifications } from "./components/notifications/KairosNotifier";

import "./App.css";
import "./components/KaiKlock.css";
import "./components/EternalKlock.css";
import "./SplashScreen.css";

// ⬇️ Eternal Klock face (replaces KaiKlockHomeFace)
import EternalKlock from "./components/EternalKlock";

// ⬇️ Exact generator button (already present)
import SigilGlyphButton from "./components/SigilGlyphButton";
// ⬇️ Week modal (same component used in EternalKlock toolbar)
import WeekKalendarModal from "./components/WeekKalendarModal";

/** Home UI */
function HomeShell() {
  const [showSplash, setShowSplash] = useState(true);
  const [morphing, setMorphing] = useState(false);
  const [mounted, setMounted] = useState(false);

  // ⬇️ Local week modal state (home-level button)
  const [showWeekModal, setShowWeekModal] = useState(false);

  // ⬇️ Same seed logic used previously for SigilGlyphButton
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

  // ⬇️ Open handler for Week Kalendar
  const openWeekModal = () => setShowWeekModal(true);

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

      <div className={`main-ui ${showSplash ? "hidden-behind-splash" : ""}`}>
        <section className="hero-stage"></section>

        <div className="eternal-klock-backdrop" role="dialog" aria-modal="false">
          <div className="eternal-klock-panel">
            {/* 🔁 Replaced KaiKlockHomeFace with the EternalKlock face */}
            <EternalKlock />

            {/* ⬇️ Toolbar row on the home screen (kept exactly) */}
            <div
              className="eternal-klock-toolbar"
              style={{ marginTop: "0.75rem", display: "flex", gap: "10px", justifyContent: "center" }}
            >
              <SigilGlyphButton kaiPulse={kaiPulse} />
              <button
                className="toolbar-btn"
                onClick={openWeekModal}
                title="Open Kairos Week Spiral"
              >
                <img
                  src="/assets/weekkalendar.svg"
                  alt="Kairos Week"
                  className="toolbar-icon"
                  draggable={false}
                />
              </button>
            </div>

            {/* ⬇️ Render the Week Kalendar modal when opened */}
            {showWeekModal && (
              <WeekKalendarModal onClose={() => setShowWeekModal(false)} />
            )}
          </div>
        </div>

        <div className="kairos-dev-cta">
          <a
            href="https://github.com/kojibai/kai-klok"
            target="_blank"
            rel="noopener noreferrer"
            className="kairos-api-button"
          >
            <img src="/kai-icon.svg" alt="" className="kairos-icon" />
            <span>View Source</span>
            <img src="/kai-arrow.svg" alt="" className="kairos-arrow" />
          </a>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Sigil viewer routes */}
        <Route path="/s" element={<SigilPage />} />
        <Route path="/s/:hash" element={<SigilPage />} />

        {/* 🚀 Explorer route */}
        <Route path="/explorer" element={<SigilExplorer />} />

        {/* Home */}
        <Route path="/" element={<HomeShell />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
