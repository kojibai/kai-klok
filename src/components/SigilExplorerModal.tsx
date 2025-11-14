// src/pages/SigilExplorerModal.tsx
/* ─────────────────────────────────────────────────────────────────────
   SigilExplorerModal.tsx — Atlantean Lineage Explorer (Modal)
   v2.0 — Breath-lined branches + Φ-out pills + fixed focus & clicks
   - Uses sigilRegistry bridge for all URL registration + live updates
   - Pure in-memory forest grouped by origin (deterministic, stateless)
   - Depth-aware nodes (data-depth) with Atlantean rail styling
   - Twirl to expand/collapse; rich KaiStamp + chakra + Φ-out per glyph
   - SendLedger integration for local Φ-out totals (origin + branches)
   - Modal: focus trap, scroll lock, ESC/✕ to close, veil click-to-dismiss
   ───────────────────────────────────────────────────────────────────── */

"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { createPortal } from "react-dom";

import {
  extractPayloadFromUrl,
  resolveLineageBackwards,
  getOriginUrl,
} from "../utils/sigilUrl";
import type { SigilSharePayloadLoose } from "../utils/sigilUrl";

import "./SigilExplorerModal.css";

// SendLedger (local-first immutable sends)
import { recordSend, getSpentScaledFor } from "../utils/sendLedger";

// Sigil registry bridge (central source of truth)
import {
  registerSigilUrl,
  subscribeSigilRegistry,
  getRegisteredSigilUrls,
} from "../utils/sigilRegistry";

/* ─────────────────────────────────────────────────────────────────────
 *  Types
 *  ───────────────────────────────────────────────────────────────────── */

export type SigilNode = {
  url: string;
  payload: SigilSharePayloadLoose;
  children: SigilNode[];
};

type Registry = Map<string, SigilSharePayloadLoose>; // key: absolute URL

type SendRecord = {
  parentCanonical: string;
  childCanonical: string;
  amountPhiScaled: string; // Φ * 10^18 as string
  senderKaiPulse: number;
  transferNonce: string;
  senderStamp: string;
  previousHeadRoot: string;
  transferLeafHashSend: string;
};

type SigilGlobal = {
  registerSigilUrl?: (url: string) => void;
  registerSend?: (rec: SendRecord) => void;
};

type PayloadWithCanonical = SigilSharePayloadLoose & {
  canonicalHash?: string;
};

export interface SigilExplorerModalProps {
  open: boolean;
  onClose: () => void;
  /** Optional: focus the close button when opened (default true). */
  autoFocusClose?: boolean;
  /** Optional: allow closing with ESC (default true). */
  escToClose?: boolean;
}

/* ─────────────────────────────────────────────────────────────────────
 *  Constants / Utilities
 *  ───────────────────────────────────────────────────────────────────── */

const hasWindow = typeof window !== "undefined";

/** Accessor that avoids global Window typing conflicts across files. */
function getSigilGlobal(): SigilGlobal {
  const w = window as unknown as { __SIGIL__?: SigilGlobal };
  if (!w.__SIGIL__) w.__SIGIL__ = {};
  return w.__SIGIL__!;
}

/** Make an absolute, normalized URL (stable key). */
function canonicalizeUrl(url: string): string {
  try {
    return new URL(
      url,
      hasWindow ? window.location.origin : "https://example.invalid",
    ).toString();
  } catch {
    return url;
  }
}

/** Attempt to parse hash from a /s/:hash URL (for display only). */
function parseHashFromUrl(url: string): string | undefined {
  try {
    const u = new URL(
      url,
      hasWindow ? window.location.origin : "https://example.invalid",
    );
    const m = u.pathname.match(/\/s\/([^/]+)/);
    return m?.[1] ? decodeURIComponent(m[1]) : undefined;
  } catch {
    return undefined;
  }
}

/** Prefer payload.canonicalHash, else derive from URL path. */
function canonicalFromPayloadOrUrl(
  p: SigilSharePayloadLoose,
  url: string,
): string | undefined {
  const maybe = p as PayloadWithCanonical;
  return maybe.canonicalHash ?? parseHashFromUrl(url);
}

/** Human shortener for long strings. */
function short(s?: string, n = 10): string {
  if (!s) return "—";
  if (s.length <= n * 2 + 3) return s;
  return `${s.slice(0, n)}…${s.slice(-n)}`;
}

/** Safe compare by pulse/beat/step; fallback stable. */
function byKaiTime(a: SigilSharePayloadLoose, b: SigilSharePayloadLoose): number {
  if ((a.pulse ?? 0) !== (b.pulse ?? 0)) return (a.pulse ?? 0) - (b.pulse ?? 0);
  if ((a.beat ?? 0) !== (b.beat ?? 0)) return (a.beat ?? 0) - (b.beat ?? 0);
  return (a.stepIndex ?? 0) - (b.stepIndex ?? 0);
}

/** Format a SCALE=18n scaled bigint as fixed 4dp string (no rounding issues). */
function fmtScaled4(bi: bigint): string {
  const SCALE = 18n;
  const keep = 4n;
  const cut = 10n ** (SCALE - keep); // 10^(18-4) = 10^14
  const val = bi / cut; // integer scaled to 4dp
  const intPart = val / 10000n;
  const frac = (val % 10000n).toString().padStart(4, "0");
  return `${intPart}.${frac}`;
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

function buildTree(
  rootUrl: string,
  reg: Registry,
  seen = new Set<string>(),
): SigilNode | null {
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
 *  UI Components
 *  ───────────────────────────────────────────────────────────────────── */

function KaiStamp({ p }: { p: SigilSharePayloadLoose }) {
  return (
    <span
      className="k-stamp"
      title={`pulse ${p.pulse} • beat ${p.beat} • step ${p.stepIndex}`}
    >
      <span className="k-pill">pulse {p.pulse}</span>
      <span className="k-dot">•</span>
      <span className="k-pill">beat {p.beat}</span>
      <span className="k-dot">•</span>
      <span className="k-pill">step {p.stepIndex}</span>
    </span>
  );
}

/** Read Φ out (sum of sends recorded locally) for a glyph's canonical. */
function PhiOutPill({ canonical }: { canonical?: string }) {
  const [value, setValue] = useState<string>("0.0000");

  useEffect(() => {
    const c = (canonical || "").toLowerCase();
    if (!c) {
      setValue("0.0000");
      return;
    }
    const bi = getSpentScaledFor(c); // bigint
    setValue(fmtScaled4(bi));
  }, [canonical]);

  if (!canonical) return null;
  return (
    <span
      className="pill phi-out"
      title="Total Φ exhaled from this glyph (local ledger)"
    >
      Φ out: {value}
    </span>
  );
}

type SigilTreeNodeProps = {
  node: SigilNode;
  /** depth = 0 at origin children; used for Atlantean branch styling */
  depth?: number;
};

function SigilTreeNode({ node, depth = 0 }: SigilTreeNodeProps) {
  const hasChildren = node.children.length > 0;
  const [open, setOpen] = useState<boolean>(hasChildren);

  const hashFromPath = parseHashFromUrl(node.url);
  const sig = node.payload.kaiSignature;
  const canonical = canonicalFromPayloadOrUrl(node.payload, node.url);

  return (
    <div
      className="node"
      data-depth={depth}
      data-has-children={hasChildren ? "1" : "0"}
    >
      <div className="node-row">
        {hasChildren ? (
          <button
            className="twirl"
            aria-label={open ? "Collapse branch" : "Expand branch"}
            onClick={() => setOpen(v => !v)}
            title={open ? "Collapse branch" : "Expand branch"}
            type="button"
          >
            <span className={`tw ${open ? "open" : ""}`} />
          </button>
        ) : (
          <div
            className="twirl twirl-leaf"
            aria-hidden="true"
            title="Leaf glyph (no branches yet)"
          >
            <span className="tw-leaf" />
          </div>
        )}

        <a
          className="node-link"
          href={node.url}
          target="_blank"
          rel="noopener"
          title={node.url}
        >
          <span className="node-sig">
            {short(sig ?? hashFromPath ?? "glyph", 10)}
          </span>
        </a>

        <KaiStamp p={node.payload} />

        <span className="chakra">{node.payload.chakraDay}</span>

        <PhiOutPill canonical={canonical} />

        <button
          className="node-copy"
          onClick={() => navigator.clipboard.writeText(node.url)}
          title="Copy URL"
          type="button"
        >
          ⧉
        </button>
      </div>

      {hasChildren && open && (
        <div className="node-children">
          {node.children.map(c => (
            <SigilTreeNode key={c.url} node={c} depth={depth + 1} />
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
  const originCanonical = canonicalFromPayloadOrUrl(root.payload, root.url);

  return (
    <section className="origin">
      <header className="origin-head">
        <div className="o-meta">
          <span className="o-title">Origin</span>
          <a
            className="o-link"
            href={root.url}
            target="_blank"
            rel="noopener"
            title={root.url}
          >
            {short(originSig ?? originHash ?? "origin", 12)}
          </a>
        </div>
        <div className="o-right">
          <KaiStamp p={root.payload} />
          <span className="o-count" title="Total glyphs in this lineage">
            {count} nodes
          </span>
          {/* Φ out total from origin (useful overview) */}
          <PhiOutPill canonical={originCanonical} />
          <button
            className="o-copy"
            onClick={() => navigator.clipboard.writeText(root.url)}
            title="Copy origin URL"
            type="button"
          >
            Copy Origin
          </button>
        </div>
      </header>

      <div className="origin-body">
        {root.children.length === 0 ? (
          <div className="empty-branch">
            No branches yet. The tree begins here.
          </div>
        ) : (
          <div className="tree">
            {root.children.map((c) => (
              <SigilTreeNode key={c.url} node={c} depth={0} />
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
        <h1 id="explorer-title" className="title">
          KAIROS <span>Keystream</span>
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
          <button className="export" onClick={onExport} type="button">
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
 *  Explorer Body (registry-backed + SendLedger wiring)
 *  ───────────────────────────────────────────────────────────────────── */

function ExplorerBody() {
  const [urls, setUrls] = useState<string[]>([]);
  const [forest, setForest] = useState<SigilNode[]>([]);
  const [lastAdded, setLastAdded] = useState<string | undefined>(undefined);
  const [tick, setTick] = useState(0); // bumps when SendLedger changes
  const unmounted = useRef(false);

  // 1) Hook into sigilRegistry: initial snapshot + live updates
  useEffect(() => {
    if (!hasWindow) return;

    // initial snapshot
    setUrls(getRegisteredSigilUrls());

    // optional: seed current URL if it already has a ?p= payload
    if (window.location.search.includes("p=")) {
      // registry bridge handles dedupe + cross-tab; we just announce it
      registerSigilUrl(window.location.href);
    }

    const unsubscribe = subscribeSigilRegistry((url) => {
      const abs = canonicalizeUrl(url);
      setUrls((prev) => (prev.includes(abs) ? prev : [...prev, abs]));
      setLastAdded(abs);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 2) Hook SendLedger (Φ-out) via window.__SIGIL__.registerSend + sigil:sent events
  useEffect(() => {
    if (!hasWindow) return;

    const g = getSigilGlobal();
    const prevSendHook = g.registerSend;

    g.registerSend = (rec: SendRecord) => {
      if (!rec || !rec.parentCanonical) return;
      void recordSend(rec).then(() => {
        if (!unmounted.current) {
          setTick((v) => v + 1);
        }
      });
    };

    const onSent = (e: Event) => {
      const ce = e as CustomEvent<SendRecord>;
      const rec = ce?.detail;
      if (rec && rec.parentCanonical) {
        void recordSend(rec).then(() => {
          if (!unmounted.current) {
            setTick((v) => v + 1);
          }
        });
      }
    };

    window.addEventListener("sigil:sent", onSent);

    return () => {
      const gg = getSigilGlobal();
      gg.registerSend = prevSendHook;
      window.removeEventListener("sigil:sent", onSent);
    };
  }, []);

  // 3) Build a local in-memory registry (including ancestry) from URLs
  useEffect(() => {
    if (unmounted.current) return;

    const reg: Registry = new Map();

    for (const raw of urls) {
      const abs = canonicalizeUrl(raw);
      const payload = extractPayloadFromUrl(abs);
      if (!payload) continue;

      // include ancestry chain: child → parent → … → origin
      const chain = resolveLineageBackwards(abs);
      for (const link of chain) {
        const key = canonicalizeUrl(link);
        if (reg.has(key)) continue;
        const p = extractPayloadFromUrl(key);
        if (p) reg.set(key, p);
      }
    }

    const f = buildForest(reg);
    setForest(f);
  }, [urls, tick]);

  useEffect(() => {
    return () => {
      unmounted.current = true;
    };
  }, []);

  // Handlers (registry bridge handles dedupe + storage)
  const handleAdd = (url: string) => {
    if (!url.trim()) return;
    registerSigilUrl(url.trim());
    // urls + lastAdded will update via subscribeSigilRegistry callback
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const arr = JSON.parse(text) as unknown;
      if (!Array.isArray(arr)) return;
      for (const u of arr) {
        if (typeof u === "string" && u.trim()) {
          registerSigilUrl(u.trim());
        }
      }
    } catch {
      // ignore invalid import
    }
  };

  const handleExport = () => {
    const current = getRegisteredSigilUrls();
    const data = JSON.stringify(current, null, 2);
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
        total={urls.length}
        lastAdded={lastAdded}
      />

      {/* Scroll viewport so content never gets cut off */}
      <div
        className="explorer-scroll"
        role="region"
        aria-label="Kairos Sigil-Glyph Explorer Content"
      >
        {forest.length === 0 ? (
          <div className="empty">
            <p>No sigils in the explorer yet.</p>
            <ol>
              <li>
                Seal a moment — your modal will auto-register its URL here via
                the sigilRegistry bridge.
              </li>
              <li>
                Or paste any glyph/stream URL above — we’ll reconstruct its
                ancestry instantly.
              </li>
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
      ].join(","),
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

    previouslyFocusedRef.current =
      (document.activeElement as HTMLElement | null) ?? null;

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
      window.clearTimeout(t);
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
        // click outside to close (veil)
        if (e.target === e.currentTarget) onClose();
      }}
      onPointerDown={(e) => {
        // Only block default on the veil itself; let inner clicks breathe
        if (e.target === e.currentTarget) e.preventDefault();
      }}
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

        {/* Explorer body: lineage viewer + Φ-out pills */}
        <ExplorerBody />
      </div>
    </div>,
    document.body,
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
