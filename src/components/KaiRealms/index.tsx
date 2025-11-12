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
    // focus the close button when opened
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
      /* Full-screen overlay */
      style={{ position: "fixed", inset: 0 }}
    >
      {/* Celestial layers */}
      <div className="realms-stars" aria-hidden />
      <div className="realms-halo realms-halo--1" aria-hidden />
      <div className="realms-halo realms-halo--2" aria-hidden />

      {/* Glass container (full-screen, no radius/caps) */}
      <div
        ref={containerRef}
        className="realms-container glass-omni"
        onMouseDown={stopBubble}
        role="document"
        style={{
          width: "100vw",
          height: "100vh",
          maxWidth: "none",
          maxHeight: "none",
          borderRadius: 0,
          margin: 0,
          padding: 0,
          display: "grid",
          gridTemplateRows: "auto 1fr", // header + body
          overflow: "hidden",
        }}
      >
        {/* Sacred border rings + phi grid */}
        <div className="breath-ring breath-ring--outer" aria-hidden />
        <div className="breath-ring breath-ring--inner" aria-hidden />
        <div className="phi-grid" aria-hidden />

        {/* Header — close button + SINGLE orb centered (floats above portal) */}
        <header
          className="realms-header"
          /* Keep header clickable above the portal; add internal padding so the X never clips */
          style={{
            position: "relative",
            zIndex: 3, // above GamePortal (z-index: 1)
            paddingTop: "max(12px, env(safe-area-inset-top))",
            paddingRight: "max(12px, env(safe-area-inset-right))",
            paddingLeft: "max(12px, env(safe-area-inset-left))",
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
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
            /* Absolute inside header with safe-area guards so it never goes off-screen */
            style={{
              position: "absolute",
              top: "max(12px, env(safe-area-inset-top))",
              right: "max(12px, env(safe-area-inset-right))",
              width: 44,
              height: 44,
              display: "grid",
              placeItems: "center",
              borderRadius: "9999px",
              /* ensure visible even on bright halos */
              backdropFilter: "blur(6px)",
            }}
          >
            <X size={20} aria-hidden />
          </button>

          {/* One living orb at top-center */}
          <div
            className="header-seals"
            aria-hidden
            /* keep seals centered even with the absolute X on the right */
            style={{ pointerEvents: "none", textAlign: "center" }}
          >
            <div className="seal-emblem" style={{ margin: "0 auto" }}>
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
        <main
          className="realms-body"
          style={{ position: "relative", minHeight: 0, zIndex: 2 }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {!glyphData ? (
            <div className="portal-stage" style={{ height: "100%" }}>
              {/* GamePortal is full-screen (fixed) with z-index: 1; header stays above */}
              <GamePortal onEnter={handleEnter} />
            </div>
          ) : (
            <div className="realm-stage" style={{ height: "100%", overflow: "auto" }}>
              <RealmView glyphData={glyphData} onExit={handleExit} />
            </div>
          )}
        </main>

        {/* Footer removed to maximize space */}
      </div>
    </div>
  );
};

export default KaiRealms;
