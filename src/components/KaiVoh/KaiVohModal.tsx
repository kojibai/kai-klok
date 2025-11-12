// src/components/KaiVohModal.tsx
"use client";

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import "./styles/KaiVohModal.css";
import KaiVohBoundary from "./KaiVohBoundary";
import { SigilAuthProvider } from "./SigilAuthContext";

/** Lazy chunks */
const KaiVohApp = lazy(() => import("./KaiVohApp"));
const KaiRealmsApp = lazy(() => import("../KaiRealms")); // default export with optional onClose

type ViewMode = "voh" | "realms";

interface KaiVohModalProps {
  open: boolean;
  onClose: () => void;
}

/** Golden constants for inline SVG ratios (used by CSS too) */
const PHI = (1 + Math.sqrt(5)) / 2;
const BREATH_SEC = 5.236;

export default function KaiVohModal({ open, onClose }: KaiVohModalProps) {
  // Avoid SSR/DOM mismatch for portals
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Trap focus into the modal while open
  const firstFocusableRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    // set CSS custom props globally for timing/phi
    document.documentElement.style.setProperty("--kai-breath", `${BREATH_SEC}s`);
    document.documentElement.style.setProperty("--kai-phi", `${PHI}`);

    // focus first interactive (if present)
    firstFocusableRef.current?.focus();

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Toggle between Posting Hub (KaiVoh) and Kai Realms
  const [view, setView] = useState<ViewMode>("voh");
  const [realmsMounted, setRealmsMounted] = useState(false);
  const vohMounted = true; // default screen is always ready

  const switchTo = useCallback(
    (next: ViewMode): void => {
      if (next === "realms" && !realmsMounted) setRealmsMounted(true);
      setView(next);
    },
    [realmsMounted]
  );

  // Backdrop close
  const onBackdropPointerDown = useCallback((): void => {
    onClose();
  }, [onClose]);

  // Stop clicks inside panel from reaching backdrop
  const stopBubblePointer = useCallback((e: ReactPointerEvent): void => {
    e.stopPropagation();
  }, []);
  const stopBubbleMouse = useCallback((e: ReactMouseEvent): void => {
    e.stopPropagation();
  }, []);

  // Ensure the X button always closes (pointer + click + keyboard)
  const handleClosePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>): void => {
      e.stopPropagation();
      onClose();
    },
    [onClose]
  );
  const handleCloseClick = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>): void => {
      e.stopPropagation();
      onClose();
    },
    [onClose]
  );
  const handleCloseKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLButtonElement>): void => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    },
    [onClose]
  );

  // Decorative spiral geometry (cached)
  const spiralBox = useMemo(() => ({ w: 610, h: 377 }), []);
  const SpiralSVG = ({ className }: { className?: string }) => (
    <svg
      className={className}
      width={spiralBox.w}
      height={spiralBox.h}
      viewBox={`0 0 ${spiralBox.w} ${spiralBox.h}`}
      aria-hidden
    >
      <defs>
        <linearGradient id="phiStroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.0" />
          <stop offset="40%" stopColor="currentColor" stopOpacity="0.5" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#phiStroke)" strokeWidth="2">
        <path d="M377 0 A377 377 0 0 1 0 377" />
        <path d="M233 0 A233 233 0 0 1 0 233" />
        <path d="M144 0 A144 144 0 0 1 0 144" />
        <path d="M89 0 A89 89 0 0 1 0 89" />
        <path d="M55 0 A55 55 0 0 1 0 55" />
        <path d="M34 0 A34 34 0 0 1 0 34" />
        <path d="M21 0 A21 21 0 0 1 0 21" />
      </g>
    </svg>
  );


  // Single living orb emblem (top-center)
  const SealEmblem = ({ className }: { className?: string }) => (
    <div className={`seal-emblem ${className ?? ""}`} aria-hidden>
      <div className="seal-ring seal-ring--outer" />
      <div className="seal-ring seal-ring--inner" />
      <div className="seal-core" />
    </div>
  );

  if (!open || !mounted) return null;

  const node = (
    <div
      className="kai-voh-modal-backdrop atlantean-veil"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kaivoh-title"
      onPointerDown={onBackdropPointerDown}
      data-view={view}
    >
      {/* Dim stars + parallax halos */}
      <div className="atlantean-stars" aria-hidden />
      <div className="atlantean-halo atlantean-halo--1" aria-hidden />
      <div className="atlantean-halo atlantean-halo--2" aria-hidden />

      <div
        className="kai-voh-container kai-pulse-border glass-omni"
        onPointerDown={stopBubblePointer}
        onMouseDown={stopBubbleMouse}
        role="document"
      >
        {/* Sacred border rings + phi grid */}
        <div className="breath-ring breath-ring--outer" aria-hidden />
        <div className="breath-ring breath-ring--inner" aria-hidden />
        <div className="phi-grid" aria-hidden />

        {/* Corner spirals */}
        <SpiralSVG className="phi-spiral phi-spiral--tl" />
        <SpiralSVG className="phi-spiral phi-spiral--br" />

        {/* Close (hidden while in Realms to avoid double-X on mobile) */}
        {view !== "realms" && (
          <button
            ref={firstFocusableRef}
            type="button"
            className="kai-voh-close auric-btn"
            aria-label="Close portal"
            onPointerDown={handleClosePointerDown}
            onClick={handleCloseClick}
            onKeyDown={handleCloseKeyDown}
          >
            <X size={22} aria-hidden />
          </button>
        )}

        {/* === TOP-CENTER ORB (hide in Realms to avoid double orb) === */}
        {view !== "realms" && (
          <div className="voh-top-orb" aria-hidden>
            <SealEmblem />
          </div>
        )}

        {/* Tab bar */}
        <div className="kai-voh-tabbar" role="tablist" aria-label="Kai portal views">
          <button
            type="button"
            role="tab"
            aria-selected={view === "voh"}
            className={`kai-voh-tab auric-tab ${view === "voh" ? "active" : ""}`}
            onClick={() => switchTo("voh")}
          >
            <span className="tab-glyph" aria-hidden>🜂</span> Voh
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "realms"}
            className={`kai-voh-tab auric-tab ${view === "realms" ? "active" : ""}`}
            onClick={() => switchTo("realms")}
          >
            <span className="tab-glyph" aria-hidden>⚚</span> Realms
          </button>

          {/* Breath progress (phi-timed) */}
          <div className="breath-meter" aria-hidden>
            <div className="breath-meter__dot" />
          </div>
        </div>

        {/* Body */}
        {/* NEW: Wrap both panes with SigilAuthProvider so SigilLogin/useSigilAuth works */}
        <SigilAuthProvider>
          <div className="kai-voh-body">
            <h2 id="kaivoh-title" className="sr-only">
              Kai Portal
            </h2>

            <KaiVohBoundary>
              <section
                className="portal-pane"
                style={{ display: view === "voh" ? "block" : "none" }}
                aria-hidden={view !== "voh"}
              >
                {vohMounted && (
                  <Suspense
                    fallback={
                      <div className="kai-voh-center">
                        <div className="kai-voh-spinner" />
                        <div>Summoning Voh…</div>
                      </div>
                    }
                  >
                    <KaiVohApp />
                  </Suspense>
                )}
              </section>

              <section
                className="portal-pane"
                style={{ display: view === "realms" ? "block" : "none" }}
                aria-hidden={view !== "realms"}
              >
                {realmsMounted ? (
                  <Suspense
                    fallback={
                      <div className="kai-voh-center">
                        <div className="kai-voh-spinner" />
                        <div>Opening Kai Realms…</div>
                      </div>
                    }
                  >
                    {/* Realms close: route back to VOH (keeps modal open).
                       To close the entire modal instead, replace with onClose={onClose}. */}
                    <KaiRealmsApp onClose={() => switchTo("voh")} />
                  </Suspense>
                ) : null}
              </section>
            </KaiVohBoundary>
          </div>
        </SigilAuthProvider>

 
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
