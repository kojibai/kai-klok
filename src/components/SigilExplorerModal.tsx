// src/pages/SigilExplorerModal.tsx
/* ─────────────────────────────────────────────────────────────────────
   SigilExplorerModal.tsx — Atlantean lineage explorer as a modal
   - Keeps Explorer logic/markup intact, wrapped in an accessible modal
   - Live updates via: window.__SIGIL__.registerSigilUrl, DOM events,
     BroadcastChannel, and localStorage sync — identical to page version
   - Focus trap + scroll lock + portal; ESC/✕ to close
────────────────────────────────────────────────────────────────────── */

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  extractPayloadFromUrl,
  resolveLineageBackwards,
  getOriginUrl,
} from "../utils/sigilUrl";
import type { SigilSharePayloadLoose } from "../utils/sigilUrl";
import "./SigilExplorerModal.css";

/* ─────────────────────────────────────────────────────────────────────
   Global typings for the optional hook the seal modal will call
────────────────────────────────────────────────────────────────────── */
declare global {
  interface Window {
    __SIGIL__?: {
      registerSigilUrl?: (url: string) => void;
    };
  }
}

/* ─────────────────────────────────────────────────────────────────────
 *  Types
 *  ───────────────────────────────────────────────────────────────────── */
export type SigilNode = {
  url: string;
  payload: SigilSharePayloadLoose;
  children: SigilNode[];
};
type Registry = Map<string, SigilSharePayloadLoose>; // key: absolute URL

/* ─────────────────────────────────────────────────────────────────────
 *  Constants / Utilities
 *  ───────────────────────────────────────────────────────────────────── */
const REGISTRY_LS_KEY = "kai:sigils:v1"; // explorer’s persisted URL list
const MODAL_FALLBACK_LS_KEY = "sigil:urls"; // seal modal’s fallback URL list
const BC_NAME = "kai-sigil-registry";

const hasWindow = typeof window !== "undefined";
const canStorage = hasWindow && typeof window.localStorage !== "undefined";

/** Make an absolute, normalized URL (stable key). */
function canonicalizeUrl(url: string): string {
  try {
    return new URL(url, hasWindow ? window.location.origin : "https://example.invalid").toString();
  } catch {
    return url;
  }
}

/** Attempt to parse hash from a /s/:hash URL (for display only). */
function parseHashFromUrl(url: string): string | undefined {
  try {
    const u = new URL(url, hasWindow ? window.location.origin : "https://example.invalid");
    const m = u.pathname.match(/\/s\/([^/]+)/);
    return m?.[1] ? decodeURIComponent(m[1]) : undefined;
  } catch {
    return undefined;
  }
}

/** Human shortener for long strings. */
function short(s?: string, n = 10) {
  if (!s) return "—";
  if (s.length <= n * 2 + 3) return s;
  return `${s.slice(0, n)}…${s.slice(-n)}`;
}

/** Safe compare by pulse/beat/step; fallback stable. */
function byKaiTime(a: SigilSharePayloadLoose, b: SigilSharePayloadLoose) {
  if ((a.pulse ?? 0) !== (b.pulse ?? 0)) return (a.pulse ?? 0) - (b.pulse ?? 0);
  if ((a.beat ?? 0) !== (b.beat ?? 0)) return (a.beat ?? 0) - (b.beat ?? 0);
  return (a.stepIndex ?? 0) - (b.stepIndex ?? 0);
}

/* ─────────────────────────────────────────────────────────────────────
 *  Global, in-memory registry + helpers
 *  (no backend, can persist to localStorage, and sync via BroadcastChannel)
 *  ───────────────────────────────────────────────────────────────────── */
const memoryRegistry: Registry = new Map();
const channel = hasWindow && "BroadcastChannel" in window ? new BroadcastChannel(BC_NAME) : null;

/** Load persisted URLs (if any) into memory registry. Includes seal modal fallback list. */
function hydrateRegistryFromStorage() {
  if (!canStorage) return;

  const ingestList = (raw: string | null) => {
    if (!raw) return;
    try {
      const urls: string[] = JSON.parse(raw);
      urls.forEach((u) => {
        const url = canonicalizeUrl(u);
        const payload = extractPayloadFromUrl(url);
        if (payload) memoryRegistry.set(url, payload);
      });
    } catch {
      /* ignore bad entries */
    }
  };

  ingestList(localStorage.getItem(REGISTRY_LS_KEY));
  ingestList(localStorage.getItem(MODAL_FALLBACK_LS_KEY));
}

/** Persist memory registry to localStorage (Explorer’s canonical key). */
function persistRegistryToStorage() {
  if (!canStorage) return;
  const urls = Array.from(memoryRegistry.keys());
  localStorage.setItem(REGISTRY_LS_KEY, JSON.stringify(urls));
}

/** Add a single URL (and optionally its ancestry chain) to the registry. */
function addUrl(url: string, includeAncestry = true, broadcast = true) {
  const abs = canonicalizeUrl(url);
  const payload = extractPayloadFromUrl(abs);
  if (!payload) return false;

  let changed = false;

  // Include ancestry chain (child → parent → ... → origin)
  if (includeAncestry) {
    const chain = resolveLineageBackwards(abs);
    for (const link of chain) {
      const p = extractPayloadFromUrl(link);
      const key = canonicalizeUrl(link);
      if (p && !memoryRegistry.has(key)) {
        memoryRegistry.set(key, p);
        changed = true;
      }
    }
  }

  if (!memoryRegistry.has(abs)) {
    memoryRegistry.set(abs, payload);
    changed = true;
  }

  if (changed) {
    persistRegistryToStorage();
    if (channel && broadcast) {
      channel.postMessage({ type: "sigil:add", url: abs });
    }
  }
  return changed;
}



/* ─────────────────────────────────────────────────────────────────────
 *  Tree building (pure, derived from registry)
 *  ───────────────────────────────────────────────────────────────────── */
function childrenOf(url: string, reg: Registry): string[] {
  const out: string[] = [];
  for (const [u, p] of reg) {
    if (p.parentUrl && canonicalizeUrl(p.parentUrl) === canonicalizeUrl(url)) {
      out.push(u);
    }
  }
  // sort by Kai timing for coherent branches
  out.sort((a, b) => byKaiTime(reg.get(a)!, reg.get(b)!));
  return out;
}

function buildTree(rootUrl: string, reg: Registry, seen = new Set<string>()): SigilNode | null {
  const url = canonicalizeUrl(rootUrl);
  const payload = reg.get(url);
  if (!payload) return null;

  if (seen.has(url)) {
    // Break cycles defensively
    return { url, payload, children: [] };
  }
  seen.add(url);

  const kids = childrenOf(url, reg)
    .map((child) => buildTree(child, reg, seen))
    .filter(Boolean) as SigilNode[];

  return { url, payload, children: kids };
}

/** Build a forest grouped by origin (each origin becomes a root). */
function buildForest(reg: Registry): SigilNode[] {
  const groups = new Map<string, string[]>(); // originUrl -> [urls]
  for (const [url, payload] of reg) {
    const origin = payload.originUrl
      ? canonicalizeUrl(payload.originUrl)
      : getOriginUrl(url) ?? url;
    if (!groups.has(origin)) groups.set(origin, []);
    groups.get(origin)!.push(url);
  }

  const forest: SigilNode[] = [];
  for (const origin of groups.keys()) {
    const node = buildTree(origin, reg);
    if (node) forest.push(node);
  }

  forest.sort((a, b) => byKaiTime(a.payload, b.payload));
  return forest;
}

/* ─────────────────────────────────────────────────────────────────────
 *  UI Components (unchanged from Explorer)
 *  ───────────────────────────────────────────────────────────────────── */
function KaiStamp({ p }: { p: SigilSharePayloadLoose }) {
  return (
    <span className="k-stamp" title={`pulse ${p.pulse} • beat ${p.beat} • step ${p.stepIndex}`}>
      <span className="k-pill">pulse {p.pulse}</span>
      <span className="k-dot">•</span>
      <span className="k-pill">beat {p.beat}</span>
      <span className="k-dot">•</span>
      <span className="k-pill">step {p.stepIndex}</span>
    </span>
  );
}

function SigilTreeNode({ node }: { node: SigilNode }) {
  const [open, setOpen] = useState(true);
  const hash = parseHashFromUrl(node.url);
  const sig = node.payload.kaiSignature;

  return (
    <div className="node">
      <div className="node-row">
        <button
          className="twirl"
          aria-label={open ? "Collapse" : "Expand"}
          onClick={() => setOpen((v) => !v)}
          title={open ? "Collapse" : "Expand"}
        >
          <span className={`tw ${open ? "open" : ""}`} />
        </button>

        <a className="node-link" href={node.url} target="_blank" rel="noopener" title={node.url}>
          <span className="node-sig">{short(sig ?? hash ?? "glyph")}</span>
        </a>

        <KaiStamp p={node.payload} />
        <span className="chakra">{node.payload.chakraDay}</span>

        <button
          className="node-copy"
          onClick={() => navigator.clipboard.writeText(node.url)}
          title="Copy URL"
        >
          ⧉
        </button>
      </div>

      {open && node.children.length > 0 && (
        <div className="node-children">
          {node.children.map((c) => (
            <SigilTreeNode key={c.url} node={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function OriginPanel({ root }: { root: SigilNode }) {
  const count = useMemo(() => {
    let n = 0;
    const walk = (s: SigilNode) => {
      n += 1;
      s.children.forEach(walk);
    };
    walk(root);
    return n;
  }, [root]);

  const originHash = parseHashFromUrl(root.url);
  const originSig = root.payload.kaiSignature;

  return (
    <section className="origin">
      <header className="origin-head">
        <div className="o-meta">
          <span className="o-title">Origin</span>
          <a className="o-link" href={root.url} target="_blank" rel="noopener" title={root.url}>
            {short(originSig ?? originHash ?? "origin")}
          </a>
        </div>
        <div className="o-right">
          <KaiStamp p={root.payload} />
          <span className="o-count" title="Total glyphs in this lineage">
            {count} nodes
          </span>
          <button
            className="o-copy"
            onClick={() => navigator.clipboard.writeText(root.url)}
            title="Copy origin URL"
          >
            Copy Origin
          </button>
        </div>
      </header>

      <div className="origin-body">
        {root.children.length === 0 ? (
          <div className="empty-branch">No branches yet. The tree begins here.</div>
        ) : (
          <div className="tree">
            {root.children.map((c) => (
              <SigilTreeNode key={c.url} node={c} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ExplorerToolbar({
  onAdd,
  onImport,
  onExport,
  total,
  lastAdded,
}: {
  onAdd: (u: string) => void;
  onImport: (f: File) => void;
  onExport: () => void;
  total: number;
  lastAdded?: string;
}) {
  const [input, setInput] = useState("");

  return (
    <div className="toolbar">
      <div className="brand">
        <div className="sigil-glyph" aria-hidden />
        <h1 className="title">
          KAIROS <span>EXPLORER</span>
        </h1>
        <div className="tag">Sovereign Lineage • No DB • Pure Φ</div>
      </div>

      <div className="controls">
        <form
          className="add-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!input.trim()) return;
            onAdd(input.trim());
            setInput("");
          }}
        >
          <input
            className="add-input"
            placeholder="Paste a sigil URL (or current page URL)…"
            spellCheck={false}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button className="add-btn" type="submit">
            Add
          </button>
        </form>

        <div className="io">
          <label className="import">
            <input
              type="file"
              accept="application/json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImport(f);
              }}
            />
            Import
          </label>
          <button className="export" onClick={onExport}>
            Export
          </button>
        </div>

        <div className="stats">
          <span className="pill" title="Total URLs in registry">
            {total} URLs
          </span>
          {lastAdded && (
            <span className="pill subtle" title={lastAdded}>
              Last: {short(lastAdded, 8)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 *  Explorer Body (same as the page, intact)
 *  ───────────────────────────────────────────────────────────────────── */
function ExplorerBody() {
  const [, force] = useState(0);
  const [forest, setForest] = useState<SigilNode[]>([]);
  const [lastAdded, setLastAdded] = useState<string | undefined>(undefined);
  const unmounted = useRef(false);

  // Initial hydrate, global hook, event listeners
  useEffect(() => {
    hydrateRegistryFromStorage();

    // Seed with current URL if it looks like a sigil
    if (hasWindow && window.location.search.includes("p=")) {
      addUrl(window.location.href, true, false);
      setLastAdded(window.location.href);
    }

    // (1) Expose the global hook that the seal modal will call
    const prev = window.__SIGIL__?.registerSigilUrl;
    if (!window.__SIGIL__) window.__SIGIL__ = {};
    window.__SIGIL__.registerSigilUrl = (u: string) => {
      if (addUrl(u, true, true)) {
        setLastAdded(canonicalizeUrl(u));
        refresh();
      }
    };

    // (2) Listen for the seal modal’s fallback DOM event
    const onUrlRegistered = (e: Event) => {
      const any = e as CustomEvent<{ url: string }>;
      const u = any?.detail?.url;
      if (typeof u === "string" && u.length) {
        if (addUrl(u, true, true)) {
          setLastAdded(canonicalizeUrl(u));
          refresh();
        }
      }
    };
    window.addEventListener("sigil:url-registered", onUrlRegistered as EventListener);

    // (3) Back-compat: still listen for sigil:minted if other parts dispatch it
    const onMint = (e: Event) => {
      const any = e as CustomEvent<{ url: string }>;
      if (any?.detail?.url) {
        if (addUrl(any.detail.url, true, true)) {
          setLastAdded(any.detail.url);
          refresh();
        }
      }
    };
    window.addEventListener("sigil:minted", onMint as EventListener);

    // (4) Cross-tab sync via BroadcastChannel
    let onMsg: ((ev: MessageEvent) => void) | undefined;
    if (channel) {
      onMsg = (ev: MessageEvent) => {
        if (ev.data?.type === "sigil:add" && typeof ev.data.url === "string") {
          if (addUrl(ev.data.url, true, false)) {
            setLastAdded(ev.data.url);
            refresh();
          }
        }
      };
      channel.addEventListener("message", onMsg);
    }

    // (5) Also watch storage updates to the seal modal’s fallback list
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === MODAL_FALLBACK_LS_KEY && ev.newValue) {
        try {
          const urls: string[] = JSON.parse(ev.newValue);
          let changed = false;
          for (const u of urls) {
            if (addUrl(u, true, false)) changed = true;
          }
          if (changed) {
            setLastAdded(undefined);
            persistRegistryToStorage();
            refresh();
          }
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      // restore previous hook (if any)
      if (window.__SIGIL__) window.__SIGIL__.registerSigilUrl = prev;
      window.removeEventListener("sigil:url-registered", onUrlRegistered as EventListener);
      window.removeEventListener("sigil:minted", onMint as EventListener);
      window.removeEventListener("storage", onStorage);
      if (channel && onMsg) channel.removeEventListener("message", onMsg);
    };
  }, []);

  /** Rebuild derived forest + light re-render. */
  const refresh = () => {
    if (unmounted.current) return;
    const f = buildForest(memoryRegistry);
    setForest(f);
    force((v) => v + 1);
  };

  useEffect(() => {
    refresh();
    return () => {
      unmounted.current = true;
    };
  }, [lastAdded]);

  // Handlers
  const handleAdd = (url: string) => {
    const changed = addUrl(url, true, true);
    if (changed) {
      setLastAdded(canonicalizeUrl(url));
      refresh();
    }
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const urls = JSON.parse(text) as string[];
      let n = 0;
      for (const u of urls) {
        if (addUrl(u, true, false)) n++;
      }
      if (n > 0) {
        setLastAdded(undefined);
        persistRegistryToStorage();
        refresh();
      }
    } catch {
      // ignore
    }
  };

  const handleExport = () => {
    const data = JSON.stringify(Array.from(memoryRegistry.keys()), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sigils.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="sigil-explorer">
      <ExplorerToolbar
        onAdd={handleAdd}
        onImport={handleImport}
        onExport={handleExport}
        total={memoryRegistry.size}
        lastAdded={lastAdded}
      />

      {/* Scroll viewport so content never gets cut off */}
      <div className="explorer-scroll" role="region" aria-label="Kairos Sigil-Glyph Explorer Content">
        {forest.length === 0 ? (
          <div className="empty">
            <p>No sigils in the explorer yet.</p>
            <ol>
              <li>Seal a moment — your modal will auto-register its URL here.</li>
              <li>Or paste any glyph URL above — we’ll reconstruct its ancestry instantly.</li>
            </ol>
          </div>
        ) : (
          <div className="forest">
            {forest.map((root) => (
              <OriginPanel key={root.url} root={root} />
            ))}
          </div>
        )}

        <footer className="footer">
          <div className="footer-row">
            <span>Deterministic • Stateless • Kairos-traceable</span>
            <span className="dot">•</span>
            <span>No DB. No backend. Pure Φ.</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 *  Modal wrapper
 *  ───────────────────────────────────────────────────────────────────── */
export interface SigilExplorerModalProps {
  open: boolean;
  onClose: () => void;
  /** Optional: focus the close button when opened (default true). */
  autoFocusClose?: boolean;
  /** Optional: allow closing with ESC (default true). */
  escToClose?: boolean;
}

const SigilExplorerModal: React.FC<SigilExplorerModalProps> = ({
  open,
  onClose,
  autoFocusClose = true,
  escToClose = true,
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Focus trap
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

    if (e.key === "Tab") {
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    }
  }, []);

  // Mount effects: scroll lock, focus, key handling
  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current = (document.activeElement as HTMLElement) ?? null;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const t = window.setTimeout(() => {
      if (autoFocusClose) closeRef.current?.focus({ preventScroll: true });
    }, 0);

    const onKey = (e: KeyboardEvent) => {
      if (escToClose && e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      trapFocus(e);
    };
    document.addEventListener("keydown", onKey, true);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey, true);
      clearTimeout(t);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open, autoFocusClose, escToClose, onClose, trapFocus]);

  if (!open) return null;

  return createPortal(
    <div
      className="explorer-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="explorer-title"
      data-state="open"
      onClick={(e) => {
        // click outside to close (optional UX). Stop if you don't want this:
        if (e.target === e.currentTarget) onClose();
      }}
      onPointerDown={(e) => e.preventDefault()}
    >
      {/* Backplate / aurora veil (visual only) */}
      <div className="explorer-veil" aria-hidden="true" />

      {/* Modal card */}
      <div
        ref={cardRef}
        className="explorer-card"
        role="document"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          ref={closeRef}
          className="explorer-close"
          aria-label="Close Explorer"
          type="button"
          onClick={onClose}
          title="Close"
        >
          <CloseGlyph />
        </button>

        {/* Keep explorer EXACT as-is */}
        <ExplorerBody />
      </div>
    </div>,
    document.body
  );
};

/* ── decorative close glyph ───────────────────────────────────────── */
const CloseGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden className="seal-close-ico">
    <circle
      cx="12"
      cy="12"
      r="10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      opacity=".35"
    />
    <path
      d="M7 7l10 10M17 7L7 17"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export default SigilExplorerModal;
