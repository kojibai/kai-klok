// components/EternalOverlay.tsx
import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import "./EternalOverlay.css";

export type EternalOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Accessible label for the dialog (defaults to "Eternal Klock") */
  ariaLabel?: string;
};

const EternalOverlay: React.FC<EternalOverlayProps> = ({
  isOpen,
  onClose,
  children,
  ariaLabel,
}) => {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);

  // Create portal root (once, client-side)
  if (!rootRef.current && typeof document !== "undefined") {
    const el = document.createElement("section");
    el.setAttribute("id", "eternal-overlay-root");
    rootRef.current = el as HTMLElement;
  }

  useEffect(() => {
    if (!isOpen) return;

    const root = rootRef.current!;
    document.body.appendChild(root);

    // lock background scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // focus close button & esc to close
    const focusTimer = setTimeout(() => closeRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = originalOverflow;
      try {
        document.body.removeChild(root);
      } catch (e) {
        // node might already be detached (hot reload etc.)
        void e;
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const content = (
    <div
      className="eternal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? "Eternal Klock"}
    >
      <div className="eternal-overlay__backdrop" onClick={onClose} />
      <div
        className="eternal-overlay__content"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          className="eternal-overlay__close"
          type="button"
          onClick={onClose}
          aria-label="Close Eternal overlay"
        >
          ✕ Close
        </button>

        {/* Center stage for your content (e.g., EternalKlock, modal card, etc.) */}
        <div className="eternal-overlay__klock-stage">{children}</div>
      </div>
    </div>
  );

  return createPortal(content, rootRef.current!);
};

export default EternalOverlay;
