// components/InvestorSigilModal.tsx
//
// Atemporal Φ Mint Portal (φ-aligned, user-facing).
// • FULL-SCREEN overlay via React Portal (renders into <body>)
// • Body scroll lock while open
// • Focus trap, ESC to close, click-outside to close
// • Clean state machine: "form" → "confirm" (+ restart)
// • Deterministic KaiSignature: sha256Hex({phiKey, amount, purpose: "phi-mint"})
// • Mobile-first, no side-scroll; safe-area aware; responsive container
// • Styles: investorSigilStyles.css + investorSigilModal.css
//
// Notes:
// – Language is mint/receipt/verification (not investment/return).
// – Preserves component names/props for compatibility.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import InvestorSigilForm from "./InvestorSigilForm";
import InvestorSigilConfirmation from "./InvestorSigilConfirmation";
import InvestorAtAGlance from "./InvestorAtAGlance";
import { sha256Hex } from "../utils/hash";
import "./investorSigilStyles.css";
import "./investorSigilModal.css";

// Device render image path (place your PNG at /public/assets/kaiklok-device.png)
const HERO_SRC: string | undefined = "/assets/kaiklok-device.png";

type InvestorSigilModalProps = {
  isOpen: boolean;
  onClose: () => void;
  userPhiKey: string;
};

export type InvestorSubmission = {
  amount: number;
  email?: string;
  note?: string;
};

/** Deterministic KaiSignature from an order-stable JSON payload. */
async function generateKaiSignature(input: {
  phiKey: string;
  amount: number;
  purpose: string;
}): Promise<string> {
  const payload = JSON.stringify({
    phiKey: input.phiKey,
    amount: input.amount,
    purpose: input.purpose,
  });
  return sha256Hex(payload);
}

/** Focusable selector for focus trap. */
const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/** Create (or find) a portal root once per app. */
function getPortalRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const id = "investor-portal-root";
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    document.body.appendChild(el);
  }
  return el;
}

/** Optional extension for non-standard style props we want to set/read. */
type OverscrollStyle = CSSStyleDeclaration & {
  overscrollBehaviorY?: string;
};

const InvestorSigilModal: React.FC<InvestorSigilModalProps> = ({
  isOpen,
  onClose,
  userPhiKey,
}) => {
  // ---------- State machine ----------
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [submission, setSubmission] = useState<InvestorSubmission | null>(null);
  const [kaiSignature, setKaiSignature] = useState<string>("");
  const [error, setError] = useState<string>("");

  // Collapsible details
  const [showDetails, setShowDetails] = useState<boolean>(false);

  // ---------- Refs for a11y/focus handling ----------
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<Element | null>(null);
  const detailsRef = useRef<HTMLDivElement | null>(null);

  // ---------- Body scroll lock while open (no horizontal drift) ----------
  useEffect(() => {
    if (!isOpen || typeof document === "undefined") return;

    const { body, documentElement: html } = document;
    const htmlStyle = html.style;
    const bodyStyle = body.style as OverscrollStyle;

    const prevHtmlOverflowX = htmlStyle.overflowX;
    const prevBodyOverflow = bodyStyle.overflow;
    const prevBodyOverscroll = bodyStyle.overscrollBehaviorY;

    htmlStyle.overflowX = "hidden"; // prevent side scroll from roots
    bodyStyle.overflow = "hidden";   // lock page beneath
    bodyStyle.overscrollBehaviorY = "none";

    return () => {
      htmlStyle.overflowX = prevHtmlOverflowX;
      bodyStyle.overflow = prevBodyOverflow;
      if (typeof prevBodyOverscroll === "string") {
        bodyStyle.overscrollBehaviorY = prevBodyOverscroll;
      } else {
        bodyStyle.overscrollBehaviorY = "";
      }
    };
  }, [isOpen]);

  // ---------- Focus management (save/restore + initial focus) ----------
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current =
      typeof document !== "undefined" ? document.activeElement : null;
    const first = modalRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    return () => {
      const prev = previouslyFocused.current as HTMLElement | null;
      prev?.focus?.();
    };
  }, [isOpen]);

  // ---------- Focus trap & ESC handling ----------
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      handleClose();
      return;
    }
    if (e.key !== "Tab") return;

    const root = modalRef.current;
    if (!root) return;

    const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement
    );
    if (nodes.length === 0) return;

    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (e.shiftKey) {
      if (active === first || !nodes.includes(active as HTMLElement)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (active === last || !nodes.includes(active as HTMLElement)) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  // ---------- Click-outside to close (overlay only) ----------
  const onOverlayMouseDown = (evt: React.MouseEvent<HTMLDivElement>) => {
    if (evt.target === overlayRef.current) {
      handleClose();
    }
  };

  // ---------- Close & restart ----------
  const handleClose = () => {
    setError("");
    setStep("form");
    setSubmission(null);
    setKaiSignature("");
    setShowDetails(false);
    onClose();
  };

  const handleRestart = () => {
    setError("");
    setStep("form");
    setKaiSignature("");
    setSubmission(null);
    requestAnimationFrame(() => {
      const el = modalRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      el?.focus();
    });
  };

  // ---------- Submit from form → generate signature → confirm ----------
  const handleFormSubmit = useCallback(
    async (data: InvestorSubmission) => {
      setError("");
      try {
        if (!Number.isFinite(data.amount) || data.amount <= 0) {
          throw new Error("Invalid inhale amount.");
        }
        const kaiSig = await generateKaiSignature({
          phiKey: userPhiKey,
          amount: data.amount,
          purpose: "phi-mint",
        });
        setKaiSignature(kaiSig);
        setSubmission(data);
        setStep("confirm");
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Unable to create KaiSignature. Please check your browser security settings.";
        setError(msg);
      }
    },
    [userPhiKey]
  );

  // ---------- Render via portal ----------
  const portalRoot = getPortalRoot();
  if (!isOpen || !portalRoot) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="investor-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={step === "form" ? "Inhale Φ — Sigil-Glyph" : "Confirm Φ mint"}
      onMouseDown={onOverlayMouseDown}
      onKeyDown={onKeyDown}
    >
      <div ref={modalRef} className="investor-modal">
        {/* Close (accessible, top-right) */}
        <button
          type="button"
          className="investor-close"
          aria-label="Close"
          onClick={handleClose}
        >
          ✕
        </button>

        {/* Error banner */}
        {error && (
          <div className="investor-error-banner modal-error">
            {error}
          </div>
        )}

        {/* Content wrapper */}
        <div className="investor-modal-content">
          {step === "form" && (
            <>
              {/* Form collects amount/email/note; caller handles payment */}
              <InvestorSigilForm onSubmit={handleFormSubmit} onCancel={handleClose} />

              {/* CTA: invites action + opens details */}
              <div className="inv-cta">
                <button
                  type="button"
                  className="investor-button glow inv-cta-primary"
                  onClick={() => {
                    setShowDetails((s) => !s);
                    if (!showDetails) {
                      setTimeout(() => {
                        detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }, 50);
                    }
                  }}
                  aria-expanded={showDetails}
                  aria-controls="inv-details"
                >
                  ⚡ Inhale your breath-backed Sigil-Glyph — learn how proof seals to breath
                </button>

                <button
                  type="button"
                  className="investor-button inv-cta-secondary"
                  onClick={() => {
                    setShowDetails((s) => !s);
                    if (!showDetails) {
                      setTimeout(() => {
                        detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }, 50);
                    }
                  }}
                  aria-expanded={showDetails}
                  aria-controls="inv-details"
                >
                  What you receive • Proof Of Breath™ • Trustless Value (tap to unfold)
                </button>
              </div>

              {/* Collapsible “More details” drawer UNDER the form */}
              <div
                id="inv-details"
                ref={detailsRef}
                className={`inv-accordion ${showDetails ? "open" : ""}`}
                role="region"
                aria-label="Φ Inhale details & verification"
              >
                {showDetails && <InvestorAtAGlance heroImageSrc={HERO_SRC} />}
              </div>
            </>
          )}

          {step === "confirm" && submission && (
            <InvestorSigilConfirmation
              submission={submission}
              kaiSignature={kaiSignature}
              userPhiKey={userPhiKey}
              onDone={handleClose}
              onBack={handleRestart}
            />
          )}
        </div>
      </div>
    </div>,
    portalRoot
  );
};

export default InvestorSigilModal;
