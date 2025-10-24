// src/components/sigil/OwnershipVerifyModal.tsx
import { useCallback, useEffect, useRef, useState } from "react";

export type OwnershipVerifyModalProps = {
  title?: string;
  subtitle?: string;
  accept?: string;
  onResolve: (file: File | null) => void;
};

/* --------- Types for browser picker (local only) --------- */
type FilePickerAccept = { description?: string; accept: Record<string, string[]> };
type FilePickerOptionsStrict = {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: FilePickerAccept[];
};
type FileSystemFileHandleLike = { getFile: () => Promise<File> };

/* --------- Cross-browser, mobile-safe file picker --------- */
async function pickFileStrict(accept?: string): Promise<File | null> {
  const w = window as unknown as {
    showOpenFilePicker?: (opts?: FilePickerOptionsStrict) => Promise<FileSystemFileHandleLike[]>;
  };

  if (typeof w.showOpenFilePicker === "function") {
    try {
      const handles = await w.showOpenFilePicker({
        multiple: false,
        excludeAcceptAllOption: true,
        types: [{ description: "Φkey", accept: { "image/svg+xml": [".svg"] } }],
      });
      const file = await handles[0]?.getFile();
      return file ?? null;
    } catch {
      return null;
    }
  }

  // iOS-compatible fallback
  return new Promise<File | null>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    if (accept) input.accept = accept;
    input.tabIndex = -1;

    input.style.position = "absolute";
    input.style.top = "0";
    input.style.left = "0";
    input.style.width = "100vw";
    input.style.height = "100vh";
    input.style.opacity = "0.001";
    input.style.pointerEvents = "auto";
    input.style.zIndex = "2147483647";
    input.style.background = "transparent";
    input.style.border = "0";
    input.style.transform = "none";

    const cleanup = () => {
      if (input.parentNode) input.parentNode.removeChild(input);
    };

    input.addEventListener(
      "change",
      () => {
        const file = input.files?.[0] ?? null;
        cleanup();
        resolve(file);
      },
      { once: true }
    );

    document.body.appendChild(input);
    input.click();
  });
}

export default function OwnershipVerifyModal({
  title,
  subtitle,
  accept,
  onResolve,
}: OwnershipVerifyModalProps) {
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const ctaRef = useRef<HTMLButtonElement | null>(null);

  // One-time mobile CSS injection (idempotent)
  useEffect(() => {
    const id = "ovm-mobile-css";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      :root { --ovm-accent: var(--crystal-accent, #00FFD0); }
      .ovm-host   { position: fixed; inset: 0; z-index: 2147483647; }
      .ovm-backdrop {
        position:absolute; inset:0;
        min-height: 100svh;
        background: radial-gradient(80% 60% at 50% 50%, rgba(0,0,0,.65), rgba(0,0,0,.92)),
                    linear-gradient(180deg, rgba(0,0,0,.1), rgba(0,0,0,.35));
        display:flex; align-items:center; justify-content:center;
        padding:
          max(14px, env(safe-area-inset-top))
          max(12px, env(safe-area-inset-right))
          max(16px, env(safe-area-inset-bottom))
          max(12px, env(safe-area-inset-left));
        overscroll-behavior: contain;
      }
      .ovm-dialog {
        width: min(560px, 96vw);
        color: #fff;
        background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03));
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 18px;
        box-shadow: 0 20px 70px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.04) inset;
        padding: 16px;
        max-height: 85svh; overflow:auto;
      }
      .ovm-header { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:10px; }
      .ovm-title { margin:0; font-weight:800; font-size: clamp(16px, 4.5vw, 18px); }
      .ovm-close {
        appearance:none; display:grid; place-items:center;
        width:40px; height:40px; border-radius:12px;
        background: rgba(255,255,255,.08);
        border:1px solid rgba(255,255,255,.14);
        color:#fff; font-size:18px; cursor:pointer; touch-action:manipulation;
      }
      .ovm-body { display:grid; gap:12px; }
      .ovm-sub { margin:0; opacity:.88; font-size:14px; }
      .ovm-cta {
        margin-top: 6px;
        width: 100%;
        min-height: 56px;
        border-radius: 14px;
        border:1px solid rgba(255,255,255,.18);
        background:
          linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,.06)),
          radial-gradient(120% 150% at 50% -20%, color-mix(in oklab, var(--ovm-accent) 35%, transparent), transparent);
        color:#fff; font-weight:900; font-size:16px;
        display:flex; align-items:center; justify-content:center; gap:10px;
        cursor:pointer; touch-action:manipulation;
        box-shadow: 0 10px 30px rgba(0,0,0,.35);
      }
      .ovm-cta:active { transform: scale(.985); }
      .ovm-cta[disabled] { opacity:.8; cursor:progress; }
      .ovm-cta[aria-busy="true"]::after {
        content:""; width:18px; height:18px; border-radius:50%;
        border:2px solid rgba(255,255,255,.25);
        border-top-color: var(--ovm-accent);
        animation: ovm-spin .7s linear infinite;
      }
      @keyframes ovm-spin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
  }, []);

  // App inerting / scroll lock while modal is open
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.setAttribute("data-ovm-open", "1");

    const appRoot =
      (document.getElementById("root") as HTMLElement | null) ||
      (document.querySelector("#app") as HTMLElement | null) ||
      (document.querySelector(".sigilpage") as HTMLElement | null);

    const prevPointer = appRoot?.style.pointerEvents;
    if (appRoot) {
      appRoot.setAttribute("inert", "");
      appRoot.style.pointerEvents = "none";
    }

    setMounted(true);
    // Focus the primary action quickly for a11y / speed
    requestAnimationFrame(() => ctaRef.current?.focus({ preventScroll: true }));

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.removeAttribute("data-ovm-open");
      if (appRoot) {
        appRoot.removeAttribute("inert");
        if (prevPointer != null) appRoot.style.pointerEvents = prevPointer;
        else appRoot.style.removeProperty("pointer-events");
      }
    };
  }, []);

  const handlePick = useCallback(async () => {
    if (!mounted || busy) return;
    setBusy(true);
    try {
      const file = await pickFileStrict(accept || "image/svg+xml,.svg");
      onResolve(file ?? null);
    } finally {
      setBusy(false);
    }
  }, [mounted, busy, accept, onResolve]);

  return (
    <div className="ovm-host" role="dialog" aria-modal="true" aria-labelledby="ovm-title">
      {/* Overlay click closes (tap outside) */}
      <div className="ovm-backdrop" onClick={() => onResolve(null)}>
        <div
          className="ovm-dialog"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="ovm-header">
            <h4 id="ovm-title" className="ovm-title">
              {title || "Verify"}
            </h4>
            <button
              className="ovm-close"
              aria-label="Close"
              onClick={() => onResolve(null)}
            >
              ✕
            </button>
          </div>

          <div className="ovm-body">
            {subtitle && <p className="ovm-sub">{subtitle}</p>}
            <button
              ref={ctaRef}
              type="button"
              className="ovm-cta"
              onClick={handlePick}
              onTouchEnd={(e) => {
                // Prevent a duplicate click on some mobile browsers
                e.preventDefault();
                handlePick();
              }}
              disabled={!mounted || busy}
              aria-busy={busy ? "true" : undefined}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M20 17.5V9h-3V6H7v3H4v8.5A2.5 2.5 0 0 0 6.5 20h11A2.5 2.5 0 0 0 20 17.5ZM9 8V7h6v1h3v2H6V8Zm3 3.5A3.5 3.5 0 1 1 8.5 15A3.5 3.5 0 0 1 12 11.5m0 2A1.5 1.5 0 1 0 13.5 15A1.5 1.5 0 0 0 12 13.5Z"
                />
              </svg>
              {busy ? "Opening…" : "Choose Φkey"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
