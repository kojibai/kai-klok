"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import "./styles/KaiVohModal.css";
import KaiVohBoundary from "./KaiVohBoundary";

// Lazy-load the app chunk
const KaiVohApp = lazy(() => import("./KaiVohApp"));

interface KaiVohModalProps {
  open: boolean;
  onClose: () => void;
}

export default function KaiVohModal({ open, onClose }: KaiVohModalProps) {
  // Avoid SSR/DOM mismatch when using portals
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Lock background scroll + ESC to close while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const node = (
    <div
      className="kai-voh-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kaivoh-title"
      onMouseDown={onClose} // click outside to close
    >
      <div
        className="kai-voh-container kai-pulse-border"
        onMouseDown={(e) => e.stopPropagation()} // don't bubble to backdrop
      >
        <button className="kai-voh-close" aria-label="Close KaiVoh" onClick={onClose}>
          <X size={24} />
        </button>

        <div className="kai-voh-body">
          <h2 id="kaivoh-title" className="sr-only">KaiVoh Sovereign Posting Hub</h2>
          <KaiVohBoundary>
            <Suspense
              fallback={
                <div className="kai-voh-center">
                  <div className="kai-voh-spinner" />
                  <div>Loading KaiVoh…</div>
                </div>
              }
            >
              <KaiVohApp />
            </Suspense>
          </KaiVohBoundary>
        </div>
      </div>
    </div>
  );

  // ← Render OUTSIDE your app tree to avoid stacking/overflow clipping
  return createPortal(node, document.body);
}
