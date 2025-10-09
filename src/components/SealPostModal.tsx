// src/components/SealMomentModal.tsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { FC, MouseEventHandler } from "react";
import { createPortal } from "react-dom";
import "./SealMomentModal.css";

declare global {
  interface Window {
    __SIGIL__?: {
      registerSigilUrl?: (url: string) => void;
    };
  }
}

interface Props {
  open: boolean;
  url: string;
  hash: string;
  onClose: () => void;
  onDownloadZip: () => void;
}

const LS_KEY = "sigil:urls";

/* Fallback registry used if the global hook isn't present */
function registerLocally(url: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const list: string[] = Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
    if (!list.includes(url)) {
      list.push(url);
      window.localStorage.setItem(LS_KEY, JSON.stringify(list));
    }
    // Notify any Explorer listeners
    window.dispatchEvent(
      new CustomEvent("sigil:url-registered", { detail: { url } })
    );
  } catch {
    /* ignore */
  }
}

const SealMomentModal: FC<Props> = ({
  open,
  url,
  hash,
  onClose,
  onDownloadZip,
}) => {
  /* Always call hooks — no early returns above */
  const [container, setContainer] = useState<HTMLElement | null>(null);
  useEffect(() => {
    // SSR-safe: only touch document after mount
    if (typeof document !== "undefined") setContainer(document.body);
  }, []);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const firstFocusRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const [toast, setToast] = useState<string>("");

  // Ensure each minted URL is registered once
  const lastRegisteredRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open || !url) return;
    if (lastRegisteredRef.current === url) return;
    lastRegisteredRef.current = url;

    const hook = typeof window !== "undefined" && window.__SIGIL__?.registerSigilUrl;
    try {
      if (hook) {
        hook(url);
      } else {
        registerLocally(url);
      }
    } catch {
      registerLocally(url);
    }
  }, [open, url]);

  const canShare = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const nav = navigator as Navigator & {
      share?: (data: ShareData) => Promise<void>;
      canShare?: (data: ShareData) => boolean;
    };
    if (typeof nav.share !== "function") return false;
    return typeof nav.canShare === "function" ? nav.canShare({ url }) : true;
  }, [url]);

  const trapFocus = useCallback((e: KeyboardEvent) => {
    const root = cardRef.current;
    if (!root) return;
    const focusables = root.querySelectorAll<HTMLElement>(
      [
        "a[href]",
        "button:not([disabled])",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        "[tabindex]:not([tabindex='-1'])",
      ].join(",")
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = (document.activeElement as HTMLElement) ?? null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(
      () => firstFocusRef.current?.focus({ preventScroll: true }),
      0
    );
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") trapFocus(e);
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey, true);
      clearTimeout(t);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open, trapFocus]);

  const announce = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 900);
  };

  const copy = async (t: string, label: string) => {
    try {
      await navigator.clipboard.writeText(t);
      announce(`${label} copied to clipboard`);
    } catch {
      announce(`Could not copy ${label}`);
    }
  };

  const share = async () => {
    try {
      if (canShare && typeof navigator !== "undefined") {
        const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void>; };
        await nav.share?.({ title: "Kairos Sigil-Glyph", text: "Sealed Kairos Moment", url });
        announce("Share sheet opened");
      } else {
        await copy(url, "Link");
      }
    } catch {
      /* user canceled; ignore */
    }
  };

  const shortHash = useMemo(() => (hash ? hash.slice(0, 16) : "—"), [hash]);

  const handleClose: MouseEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClose?.();
  };

  // Only render once container is available AND modal is open
  if (!container || !open) return null;

  return createPortal(
    <div
      className="seal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="seal-title"
      aria-describedby="seal-desc"
      data-state="open"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.preventDefault()}
    >
      <div className="seal-veil" aria-hidden="true" />
      <div ref={cardRef} className="seal-card" role="document" onClick={(e) => e.stopPropagation()}>
        <button ref={firstFocusRef} className="seal-close" aria-label="Close" onClick={handleClose} type="button">
          <CloseGlyph />
        </button>

        <header className="seal-header">
          <h3 id="seal-title" className="seal-title">Moment Sealed</h3>
          <p id="seal-desc" className="seal-subtitle">
            Your Kairos imprint is preserved. Proceed to the url below to Inhale Claimed Ownership.
          </p>
        </header>

        <label className="field">
          <span className="field-label">Hash</span>
          <div className="row">
            <code className="hash" title={hash || "—"}>{hash ? shortHash : "—"}</code>
            <button className="icon-btn" onClick={() => copy(hash, "Hash")} disabled={!hash} aria-label="Copy hash" title="Copy hash" type="button">
              <CopyGlyph />
            </button>
          </div>
          {hash && <p className="micro">Full: <span className="mono">{hash}</span></p>}
        </label>

        <label className="field">
          <span className="field-label">URL</span>
          <div className="row">
            <input className="url-input" value={url} readOnly aria-readonly="true" spellCheck={false} />
            <button className="icon-btn" onClick={() => copy(url, "Link")} disabled={!url} aria-label="Copy link" title="Copy link" type="button">
              <CopyGlyph />
            </button>
            {url && (
              <a className="open-link" href={url} target="_blank" rel="noopener" aria-label="Open link in new tab" title="Open link">
                <LinkGlyph />
              </a>
            )}
          </div>
        </label>

        <div className="cta-row">
          <button className="secondary cta" onClick={onDownloadZip} type="button"><span>Download ZIP</span></button>
          <button className="secondary cta" onClick={share} type="button"><ShareGlyph /><span>{canShare ? "Share" : "Copy Link"}</span></button>
        </div>

        <p className="fine">
          This moment is now sealed in time. Use the link above within the next 11 breaths to claim ownership & gain permanent access to this kairos moment.
        </p>

        <div className="sr-only" aria-live="polite" aria-atomic="true">{toast}</div>
      </div>
    </div>,
    container
  );
};

/* Icons */
const CloseGlyph: FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden className="seal-close-ico">
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.25" opacity=".35" />
    <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const ShareGlyph: FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden className="ico">
    <path d="M15 8a3 3 0 100-6 3 3 0 000 6zM6 14a3 3 0 100-6 3 3 0 000 6zm9 12a3 3 0 100-6 3 3 0 000 6z" fill="currentColor" />
    <path d="M8.6 9.7l6.8-3.4M8.6 12.3l6.8 3.4" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);
const CopyGlyph: FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden className="ico">
    <rect x="9" y="9" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
    <rect x="5" y="5" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="2" fill="none" opacity=".5" />
  </svg>
);
const LinkGlyph: FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden className="ico">
    <path d="M10 14a5 5 0 007.07 0l1.41-1.41a5 5 0 00-7.07-7.07L10 6" stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="M14 10a5 5 0 00-7.07 0L5.5 11.43a5 5 0 007.07 7.07L14 18" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

export default SealMomentModal;
