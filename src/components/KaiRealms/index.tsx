// src/components/KaiRealms/index.tsx
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import GamePortal from "./GamePortal";
import RealmView from "./RealmView";
import type { GlyphData } from "./GlyphUtils";

// Atlantean Glass variables + helpers
import "./styles/KaiRealms.css";

type Props = {
  onClose?: () => void;
};

const KaiRealms: React.FC<Props> = ({ onClose }) => {
  const [glyphData, setGlyphData] = useState<GlyphData | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  /** Enter/Exit */
  const handleEnter = useCallback((data: GlyphData) => setGlyphData(data), []);
  const handleExit = useCallback(() => {
    setGlyphData(null);
    onClose?.();
  }, [onClose]);

  /** Escape to close + initial focus on the close button */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** Keep scroll inside the modal */
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const stopWheel = (e: WheelEvent) => e.stopPropagation();
    node.addEventListener("wheel", stopWheel, { passive: true });
    return () => node.removeEventListener("wheel", stopWheel);
  }, []);

  /** Backdrop click closes; clicks inside glass do not */
  const onBackdropDown = (): void => onClose?.();
  const stopBubble = (e: React.MouseEvent<HTMLDivElement>): void => e.stopPropagation();

  return (
    <div
      className="realms-backdrop realms-veil"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kai-realms-title"
      onMouseDown={onBackdropDown}
    >
      {/* Celestial layers */}
      <div className="realms-stars" aria-hidden />
      <div className="realms-halo realms-halo--1" aria-hidden />
      <div className="realms-halo realms-halo--2" aria-hidden />

      {/* Glass container */}
      <div
        ref={containerRef}
        className="realms-container glass-omni"
        onMouseDown={stopBubble}
        role="document"
      >
        {/* Sacred border rings + phi grid */}
        <div className="breath-ring breath-ring--outer" aria-hidden />
        <div className="breath-ring breath-ring--inner" aria-hidden />
        <div className="phi-grid" aria-hidden />

        {/* Header — close button + SINGLE orb centered */}
        <header className="realms-header">
          <button
            ref={closeRef}
            type="button"
            className="realms-close auric-btn"
            aria-label="Close Kai Realms"
            onClick={(e) => {
              e.stopPropagation();
              onClose?.();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onClose?.();
              }
            }}
          >
            <X size={20} aria-hidden />
          </button>

          {/* One living orb at top-center */}
          <div className="header-seals" aria-hidden>
            <div className="seal-emblem">
              <div className="seal-ring" />
              <div className="seal-ring seal-ring--inner" />
              <div className="seal-core" />
            </div>
          </div>

          {/* SR-only title; visual title comes from the portal card */}
          <h2 id="kai-realms-title" className="sr-only">
            Kai Realms — Sigil Gate
          </h2>
        </header>

        {/* Body — ONLY the GamePortal by default; RealmView after verify */}
        <main className="realms-body">
          {!glyphData ? (
            <div className="portal-stage">
              <GamePortal onEnter={handleEnter} />
            </div>
          ) : (
            <div className="realm-stage">
              <RealmView glyphData={glyphData} onExit={handleExit} />
            </div>
          )}
        </main>

        {/* Footer — centered “wheel” only (no side ornaments) */}
        <footer className="realms-footer" aria-hidden>
          <div className="footer-center" style={{ margin: "0 auto" }}>
            <SealCoin />
          </div>
        </footer>
      </div>
    </div>
  );
};

export default KaiRealms;

/* ──────────────────────────────────────────────────────────────
   Inline, stateless SVG for the centered “wheel”
   (kept here for cohesion; styles come from KaiRealms.css)
   ────────────────────────────────────────────────────────────── */
function SealCoin() {
  return (
    <svg className="seal-coin" width="56" height="56" viewBox="0 0 56 56" aria-hidden>
      <defs>
        <radialGradient id="coinGlowRealms" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="40%" stopColor="#ffd86b" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#ffd86b" stopOpacity="0.15" />
        </radialGradient>
        <linearGradient id="coinEdgeRealms" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00ffd0" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#8a2be2" stopOpacity="0.8" />
        </linearGradient>
      </defs>

      <circle
        cx="28"
        cy="28"
        r="26"
        fill="url(#coinGlowRealms)"
        stroke="url(#coinEdgeRealms)"
        strokeWidth="1.5"
      />
      <g className="seal-coin__rotor">
        <circle cx="28" cy="28" r="18" fill="none" stroke="url(#coinEdgeRealms)" strokeWidth="1.25" />
        <g stroke="rgba(255,255,255,0.35)" strokeWidth="0.6">
          <line x1="28" y1="10" x2="28" y2="46" />
          <line x1="10" y1="28" x2="46" y2="28" />
          <line x1="15" y1="15" x2="41" y2="41" />
          <line x1="41" y1="15" x2="15" y2="41" />
        </g>
      </g>
      <circle className="seal-coin__core" cx="28" cy="28" r="6.5" />
    </svg>
  );
}
