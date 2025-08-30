// src/pages/SigilExplorer.tsx
// v3.1 — Holographic Frost edition ✨
// - Matches SealMomentModal colorway (Atlantean Priest-King Holographic Frost)
// - Ultra-responsive, zero overflow, glassy/frosted, refined
// - Scoped styles (no global leaks)
// - BroadcastChannel + storage sync + resilient ancestry reconstruction
// - A11y-first: roles, aria labels, keyboard flow, focus styles

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  extractPayloadFromUrl,
  resolveLineageBackwards,
  getOriginUrl,
} from "../utils/sigilUrl";
import type { SigilSharePayloadLoose } from "../utils/sigilUrl";

/* ─────────────────────────────────────────────────────────────────────
   Global typings for the optional hook the modal will call
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
const MODAL_FALLBACK_LS_KEY = "sigil:urls"; // modal’s fallback URL list
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

/** Load persisted URLs (if any) into memory registry. Includes modal fallback list. */
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

/** Build a forest grouped by origin (each origin becomes a root).
 *  If origin itself is missing from the registry, we promote the earliest
 *  (by Kai timing) entry in that group as the root. */
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
    if (node) {
      forest.push(node);
    } else {
      // Origin missing: pick earliest by Kai-time within this group as synthetic root
      const urls = groups.get(origin)!;
      urls.sort((a, b) => byKaiTime(reg.get(a)!, reg.get(b)!));
      const syntheticRootUrl = urls[0];
      const synthetic = buildTree(syntheticRootUrl, reg);
      if (synthetic) forest.push(synthetic);
    }
  }

  forest.sort((a, b) => byKaiTime(a.payload, b.payload));
  return forest;
}

/* ─────────────────────────────────────────────────────────────────────
 *  Scoped Styles — Holographic Frost (matches SealMomentModal)
 *  No global selector leaks.
 *  ───────────────────────────────────────────────────────────────────── */
const Styles: React.FC = () => (
  <style>{`
    /* Tokens tuned to match SealMomentModal */
    .sigil-explorer {
      --sx-text: #e8fbf8;
      --sx-text-dim: #aee8df;
      --sx-accent: #37ffe4;
      --sx-accent-2: #a78bfa;
      --sx-accent-3: #5ce1ff;

      --sx-bg: rgba(10,16,18,.72);
      --sx-bg-tint-top: rgba(19,32,36,.65);
      --sx-bg-tint-bot: rgba(10,16,18,.65);

      --sx-veil: radial-gradient(1200px 800px at 50% 20%, rgba(0,255,222,.10), transparent 60%),
                 radial-gradient(800px 600px at 10% 90%, rgba(0,180,255,.10), transparent 60%),
                 radial-gradient(900px 700px at 90% 80%, rgba(175,110,255,.10), transparent 60%);

      --sx-border: rgba(60, 220, 205, .35);
      --sx-border-strong: rgba(55, 255, 228, .55);
      --sx-shadow: 0 30px 80px rgba(0, 0, 0, .55), inset 0 1px 0 rgba(255,255,255,.04);
      --sx-ring: 0 0 0 2px rgba(55,255,228,.25), 0 0 0 6px rgba(55,255,228,.12);

      --sx-radius: 18px;
      --sx-pad: clamp(10px, 3vw, 18px);
      --sx-maxw: 1100px;
    }

    .sigil-explorer {
      color: var(--sx-text);
      background:
        radial-gradient(1200px 800px at 50% -10%, rgba(0,0,0,.6), rgba(0,0,0,.65) 60%),
        var(--sx-veil),
        linear-gradient(180deg, var(--sx-bg-tint-top), var(--sx-bg-tint-bot));
      min-height: 100dvh;
      width: 100%;
      display: grid;
      grid-template-rows: auto 1fr;
      overflow: hidden;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji";
    }
    .sigil-explorer * { box-sizing: border-box; }

    /* ── Sticky toolbar (frosted) ─────────────────────────── */
    .kx-toolbar {
      position: sticky; top: 0; z-index: 10;
      -webkit-backdrop-filter: blur(10px) saturate(120%);
      backdrop-filter: blur(10px) saturate(120%);
      background:
        linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02)) border-box,
        linear-gradient(180deg, var(--sx-bg-tint-top), var(--sx-bg-tint-bot));
      border-bottom: 1px solid var(--sx-border);
      box-shadow: var(--sx-shadow);
    }
    .kx-toolbar-inner {
      max-width: var(--sx-maxw);
      margin: 0 auto;
      padding: var(--sx-pad);
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }
    @media (min-width: 860px) {
      .kx-toolbar-inner { grid-template-columns: 1fr auto; align-items: center; }
    }

    .kx-brand {
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .kx-glyph {
      width: 40px; height: 40px; border-radius: 12px;
      background:
        radial-gradient(120% 120% at 50% 0%, rgba(55,255,228,.35), rgba(255,255,255,0) 60%),
        linear-gradient(180deg, rgba(255,255,255,.15), rgba(255,255,255,.06));
      border: 1px solid var(--sx-border);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.18), 0 10px 26px rgba(0,0,0,.38);
    }
    .kx-title { display: grid; gap: 6px; min-width: 0; }
    .kx-title h1 {
      margin: 0;
      font-size: clamp(18px, 3.2vw, 24px);
      letter-spacing: .14em;
      word-spacing: .1em;
    }
    .kx-title h1 span {
      color: var(--sx-accent);
      text-shadow: 0 0 1px var(--sx-accent), 0 0 18px rgba(55,255,228,.25);
      letter-spacing: .02em;
    }
    .kx-tagline { color: var(--sx-text-dim); font-size: 12px; opacity: .9; }

    /* Controls */
    .kx-controls {
      display: grid; gap: 10px;
      grid-template-columns: 1fr;
    }
    @media (min-width: 680px) {
      .kx-controls { grid-template-columns: 1fr auto auto; align-items: center; }
    }

    .kx-add-form {
      display: grid; grid-template-columns: 1fr auto; gap: 8px;
    }
    .kx-input {
      width: 100%;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,.12);
      background: linear-gradient(180deg, rgba(7,12,14,.6), rgba(7,12,14,.5));
      color: var(--sx-text);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.05);
      outline: none;
      min-width: 0;
    }
    .kx-input::placeholder { color: color-mix(in oklab, var(--sx-text-dim) 70%, transparent); }
    .kx-input:focus-visible {
      border-color: var(--sx-border-strong);
      box-shadow: var(--sx-ring);
    }

    .kx-button {
      padding: 12px 16px;
      border-radius: 14px;
      border: 1px solid var(--sx-border-strong);
      color: #081917;
      font-weight: 800;
      letter-spacing: .06em;
      text-transform: uppercase;
      cursor: pointer;
      background:
        radial-gradient(120% 160% at 0% 0%, rgba(55,255,228,.25), transparent 40%),
        linear-gradient(180deg, rgba(55,255,228,.18), rgba(55,255,228,.08));
      text-shadow: 0 1px 0 rgba(255,255,255,.25);
      box-shadow: 0 12px 30px rgba(55,255,228,.22), inset 0 1px 0 rgba(255,255,255,.25);
      transition: transform .1s ease, box-shadow .2s ease;
    }
    .kx-button:hover { transform: translateY(-1px); box-shadow: 0 18px 40px rgba(55,255,228,.28), inset 0 1px 0 rgba(255,255,255,.3); }

    .kx-io {
      display: grid; grid-auto-flow: column; gap: 8px;
      justify-content: start; align-items: center;
    }
    .kx-import, .kx-export {
      padding: 12px 14px; border-radius: 14px;
      border: 1px solid rgba(255,255,255,.12);
      background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
      color: var(--sx-text);
      cursor: pointer;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.04), 0 6px 18px rgba(0,0,0,.35);
      transition: transform .1s ease, box-shadow .2s ease, border-color .2s ease, color .15s ease;
    }
    .kx-import:hover, .kx-export:hover {
      transform: translateY(-1px);
      border-color: var(--sx-border-strong);
      color: var(--sx-accent);
    }
    .kx-import { position: relative; display: inline-flex; align-items: center; }
    .kx-import input[type="file"] { position: absolute; inset: 0; opacity: 0; cursor: pointer; }

    .kx-stats { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .kx-pill {
      padding: 8px 10px; border-radius: 999px;
      border: 1px solid rgba(255,255,255,.12);
      background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
      color: var(--sx-text-dim);
      font-size: 12px;
      white-space: nowrap;
    }
    .kx-pill.subtle { opacity: .85; }

    /* ── Scroll viewport ───────────────────────────────────── */
    .explorer-scroll {
      overflow: auto;
      padding: var(--sx-pad);
      display: grid; gap: 16px;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior-y: contain;
      scroll-behavior: smooth;
    }
    .explorer-inner {
      max-width: var(--sx-maxw);
      margin: 0 auto; width: 100%;
      display: grid; gap: 16px;
    }

    /* Empty */
    .kx-empty {
      border: 1px dashed var(--sx-border);
      border-radius: var(--sx-radius);
      background:
        linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02)) border-box,
        linear-gradient(180deg, var(--sx-bg-tint-top), var(--sx-bg-tint-bot));
      padding: 18px 16px 22px;
      color: var(--sx-text-dim);
    }
    .kx-empty ol { margin: 8px 0 0; padding-left: 20px; }

    /* Forest / Origins */
    .forest { display: grid; gap: 16px; }

    .origin {
      border: 1px solid var(--sx-border);
      border-radius: var(--sx-radius);
      background:
        linear-gradient(to bottom right, rgba(255,255,255,.06), rgba(255,255,255,.02)) border-box,
        linear-gradient(180deg, var(--sx-bg-tint-top), var(--sx-bg-tint-bot));
      -webkit-backdrop-filter: blur(16px) saturate(160%);
      backdrop-filter: blur(16px) saturate(160%);
      box-shadow: var(--sx-shadow);
      overflow: clip;
    }
    .origin-head {
      display: grid; gap: 10px; padding: 14px;
      border-bottom: 1px dashed rgba(255,255,255,.08);
      background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
      grid-template-columns: 1fr;
    }
    @media (min-width: 720px) {
      .origin-head { grid-template-columns: 1fr auto; align-items: center; }
    }
    .o-meta { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; min-width: 0; }
    .o-title { font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--sx-accent); }
    .o-link {
      color: var(--sx-text);
      text-decoration: none;
      border-bottom: 1px dashed rgba(255,255,255,.14);
      max-width: 60ch; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .o-link:hover { color: var(--sx-accent-3); text-shadow: 0 0 12px rgba(92,225,255,.28); }

    .o-right { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
    .o-count { color: var(--sx-text-dim); font-size: 12px; }
    .o-copy {
      padding: 8px 10px; border-radius: 12px;
      border: 1px solid rgba(255,255,255,.12);
      background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
      color: var(--sx-text);
      cursor: pointer;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.04), 0 6px 18px rgba(0,0,0,.35);
    }
    .o-copy:hover { transform: translateY(-1px); border-color: var(--sx-border-strong); color: var(--sx-accent); }

    .origin-body { padding: 10px; overflow-x: auto; -webkit-overflow-scrolling: touch; }

    /* Node Tree */
    .tree { display: grid; gap: 8px; min-width: min-content; }

    .node {
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 12px;
      background: linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02));
      padding: 6px;
    }
    .node-row {
      display: grid;
      grid-template-columns: auto 1fr auto auto auto;
      align-items: center; gap: 8px;
      padding: 6px;
    }

    .twirl {
      width: 34px; height: 34px; border-radius: 999px;
      border: 1px solid rgba(255,255,255,.12);
      background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
      color: var(--sx-text);
      display: inline-grid; place-items: center; cursor: pointer;
    }
    .tw { width: 10px; height: 10px; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(-45deg); transition: transform .18s ease; opacity: .9; }
    .tw.open { transform: rotate(45deg); color: var(--sx-accent); }

    .node-link { min-width: 0; color: var(--sx-text); text-decoration: none; }
    .node-link:hover { text-decoration: underline; color: var(--sx-accent-3); }

    .k-stamp { display: inline-flex; gap: 6px; align-items: center; flex-wrap: wrap; font-size: 12px; color: var(--sx-text-dim); }
    .k-pill {
      padding: 6px 8px; border-radius: 999px;
      border: 1px solid rgba(255,255,255,.12);
      background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
    }
    .k-dot { opacity: .6; }

    .chakra {
      padding: 6px 8px; border-radius: 999px;
      border: 1px solid rgba(167,139,250,.45);
      background: linear-gradient(180deg, rgba(167,139,250,.18), rgba(167,139,250,.07));
      color: #f5f0ff; font-size: 12px; white-space: nowrap; text-shadow: 0 1px 0 rgba(0,0,0,.25);
    }

    .node-copy {
      width: 34px; height: 34px; border-radius: 10px;
      border: 1px solid rgba(255,255,255,.12);
      background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
      color: var(--sx-text);
      cursor: pointer;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.04), 0 6px 18px rgba(0,0,0,.35);
    }
    .node-copy:hover { transform: translateY(-1px); border-color: var(--sx-border-strong); color: var(--sx-accent); }

    .node-children {
      border-top: 1px dashed rgba(255,255,255,.12);
      margin: 6px; padding: 6px 0 0 12px;
      display: grid; gap: 6px;
      position: relative;
    }
    .node-children::before {
      content: ""; position: absolute; left: 4px; top: 0; bottom: 6px; width: 2px;
      background: linear-gradient(180deg, rgba(255,255,255,.25), rgba(255,255,255,0));
      border-radius: 1px;
    }

    /* Footer */
    .kx-footer {
      color: var(--sx-text-dim);
      text-align: center;
      font-size: 12px;
      padding: 18px 8px 8px;
    }
    .kx-footer .row { display: inline-flex; gap: 10px; align-items: center; flex-wrap: wrap; opacity: .9; }
    .kx-footer .dot { opacity: .6; }

    /* Focus rings (a11y) */
    .sigil-explorer :is(button, a, input) { outline: none; }
    .sigil-explorer :is(button, a, input):focus-visible {
      box-shadow: var(--sx-ring);
      border-color: var(--sx-border-strong);
    }

    /* Scrollbar polish (scoped) */
    .explorer-scroll, .origin-body {
      scrollbar-width: thin;
      scrollbar-color: rgba(55,255,228,.5) transparent;
    }
    .explorer-scroll::-webkit-scrollbar, .origin-body::-webkit-scrollbar { height: 10px; width: 10px; }
    .explorer-scroll::-webkit-scrollbar-thumb, .origin-body::-webkit-scrollbar-thumb {
      background: linear-gradient(180deg, rgba(55,255,228,.35), rgba(55,255,228,.15));
      border-radius: 999px; border: 2px solid transparent; background-clip: padding-box;
    }

    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
      * { transition-duration: .001s !important; }
    }

    /* Prevent horizontal scrollbars everywhere */
    .sigil-explorer, .explorer-scroll, .explorer-inner, .forest, .origin, .node { overflow-x: hidden; }
  `}</style>
);

/* ─────────────────────────────────────────────────────────────────────
 *  UI Components
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
          aria-label={open ? "Collapse branch" : "Expand branch"}
          onClick={() => setOpen((v) => !v)}
          title={open ? "Collapse" : "Expand"}
        >
          <span className={`tw ${open ? "open" : ""}`} />
        </button>

        <a className="node-link" href={node.url} target="_blank" rel="noopener noreferrer" title={node.url}>
          <span style={{ opacity: .9 }}>{short(sig ?? hash ?? "glyph", 12)}</span>
        </a>

        <KaiStamp p={node.payload} />
        <span className="chakra" title={node.payload.chakraDay}>{node.payload.chakraDay}</span>

        <button
          className="node-copy"
          aria-label="Copy URL"
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
    <section className="origin" aria-label="Sigil origin branch">
      <header className="origin-head">
        <div className="o-meta">
          <span className="o-title">Origin</span>
          <a className="o-link" href={root.url} target="_blank" rel="noopener noreferrer" title={root.url}>
            {short(originSig ?? originHash ?? "origin", 14)}
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
          <div className="kx-empty">No branches yet. The tree begins here.</div>
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
    <div className="kx-toolbar" role="region" aria-label="Explorer toolbar">
      <div className="kx-toolbar-inner">
        <div className="kx-brand">
          <div className="kx-glyph" aria-hidden />
          <div className="kx-title">
            <h1>
              KAIROS <span>Keystream</span>
            </h1>
            <div className="kx-tagline">Sovereign Lineage • No DB • Pure Φ</div>
          </div>
        </div>

        <div className="kx-controls">
          <form
            className="kx-add-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!input.trim()) return;
              onAdd(input.trim());
              setInput("");
            }}
          >
            <input
              className="kx-input"
              placeholder="Paste a sigil URL (or current page URL)…"
              spellCheck={false}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="Sigil URL"
            />
            <button className="kx-button" type="submit">
              Add
            </button>
          </form>

          <div className="kx-io" role="group" aria-label="Import and export">
            <label className="kx-import" title="Import a JSON list of URLs">
              <input
                type="file"
                accept="application/json"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImport(f);
                }}
                aria-label="Import JSON"
              />
              Import
            </label>
            <button className="kx-export" onClick={onExport} aria-label="Export registry to JSON">
              Export
            </button>
          </div>

          <div className="kx-stats" aria-live="polite">
            <span className="kx-pill" title="Total URLs in registry">
              {total} URLs
            </span>
            {lastAdded && (
              <span className="kx-pill subtle" title={lastAdded}>
                Last: {short(lastAdded, 8)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 *  Main Page
 *  ───────────────────────────────────────────────────────────────────── */
const SigilExplorer: React.FC = () => {
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
      setLastAdded(canonicalizeUrl(window.location.href));
    }

    // (1) Expose the global hook that the modal will call
    const prev = window.__SIGIL__?.registerSigilUrl;
    if (!window.__SIGIL__) window.__SIGIL__ = {};
    window.__SIGIL__.registerSigilUrl = (u: string) => {
      if (addUrl(u, true, true)) {
        setLastAdded(canonicalizeUrl(u));
        refresh();
      }
    };

    // (2) Listen for the modal’s fallback DOM event
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
          setLastAdded(canonicalizeUrl(any.detail.url));
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
            setLastAdded(canonicalizeUrl(ev.data.url));
            refresh();
          }
        }
      };
      channel.addEventListener("message", onMsg);
    }

    // (5) Also watch storage updates to the modal’s fallback list
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
    return () => { unmounted.current = true; };
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
      <Styles />

      <ExplorerToolbar
        onAdd={handleAdd}
        onImport={handleImport}
        onExport={handleExport}
        total={memoryRegistry.size}
        lastAdded={lastAdded}
      />

      {/* Scroll viewport so content never gets cut off */}
      <div className="explorer-scroll" role="region" aria-label="Kairos Sigil-Glyph Explorer Content">
        <div className="explorer-inner">
          {forest.length === 0 ? (
            <div className="kx-empty">
              <p>No sigils in your keystream yet.</p>
              <ol>
              <li>Import your keystream data.</li>
                <li>Seal a moment — auto-registered here.</li>
                <li>Paste any sigil-glyph URL above — for reconstruction of its ancestry instantly.</li>
              </ol>
            </div>
          ) : (
            <div className="forest">
              {forest.map((root) => (
                <OriginPanel key={root.url} root={root} />
              ))}
            </div>
          )}

          <footer className="kx-footer" aria-label="About">
            <div className="row">
              <span>Deterministic • Stateless • Kairos-traceable</span>
              <span className="dot">•</span>
              <span>No DB. No backend. Pure Φ.</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default SigilExplorer;
