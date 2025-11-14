// src/utils/sigilUrl.ts
// Compact encoder/decoder for sigil ?p= payloads + lineage helpers.
// Uses short-key JSON + base64url (no compression) for maximum compatibility.
// Also bridges KaiVoh Stream URLs (/stream/p/<token>, /p~<token>, #t=<token>)
// into lightweight SigilSharePayloadLoose so Explorer can walk glyph ←→ stream.

import { decodeFeedPayload, extractPayloadToken } from "./feedPayload";
import type { FeedPostPayload } from "./feedPayload";
import { momentFromPulse } from "./kai_pulse";

export type SigilSharePayload = {
  pulse: number;
  beat: number;
  stepIndex: number; // 0..(stepsPerBeat-1)
  chakraDay:
    | "Root"
    | "Sacral"
    | "Solar Plexus"
    | "Heart"
    | "Throat"
    | "Third Eye"
    | "Crown";
  stepsPerBeat?: number;
  kaiSignature?: string;
  userPhiKey?: string;

  /** NEW: lineage (compact short-keys "r" and "o") */
  parentUrl?: string;
  originUrl?: string;
};

export type SigilTransferLite = {
  s: string; // senderSignature
  r?: string; // receiverSignature
  p: number;  // pulse
};

export function encodeSigilHistory(history: SigilTransferLite[]): string {
  const json = JSON.stringify(history);
  const b64url = toB64url(toB64(new TextEncoder().encode(json)));
  return `h:${b64url}`;
}

export function decodeSigilHistory(hParam: string): SigilTransferLite[] {
  if (!hParam.startsWith("h:")) throw new Error("Invalid history param");
  const b64url = hParam.slice(2);
  const b64 = fromB64url(b64url);
  const bytes = fromB64(b64);
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json) as SigilTransferLite[];
}


// ⬇️ keep extended fields alive (expiry, token, etc.)
export type SigilSharePayloadLoose = SigilSharePayload & {
  expiresAtPulse?: number;
  canonicalHash?: string;
  transferNonce?: string;
  exportedAtPulse?: number;
  claimExtendUnit?: "breaths" | "steps";
  claimExtendAmount?: number;
  [k: string]: unknown; // future-proof pass-through
};

type KaiMomentLike = {
  beatIndex?: number;
  beat?: number;
  stepIndex?: number;
  chakraDay?: SigilSharePayload["chakraDay"];
  stepsPerBeat?: number;
};

/* ───────── base64url helpers ───────── */

const btoa_ = (s: string) =>
  typeof globalThis.btoa === "function"
    ? globalThis.btoa(s)
    : Buffer.from(s, "binary").toString("base64");

const atob_ = (s: string) =>
  typeof globalThis.atob === "function"
    ? globalThis.atob(s)
    : Buffer.from(s, "base64").toString("binary");

const toB64 = (bytes: Uint8Array) => btoa_(String.fromCharCode(...bytes));
const fromB64 = (b64: string) => Uint8Array.from(atob_(b64), (c) => c.charCodeAt(0));

const toB64url = (b64: string) =>
  b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

const fromB64url = (b64url: string) => {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  return b64 + pad;
};

/* ───────── v2 compact codec (short keys, no compression) ─────────
   Tag with "c:" to distinguish from legacy/unprefixed JSON.

   Short key map:
   u=pulse, b=beat, s=stepIndex, c=chakraDay, d=stepsPerBeat,
   k=kaiSignature, p=userPhiKey, r=parentUrl, o=originUrl
------------------------------------------------------------------ */

export function encodeSigilPayload(p: SigilSharePayload): string {
  const compact: Record<string, unknown> = {
    u: p.pulse,
    b: p.beat,
    s: p.stepIndex,
    c: p.chakraDay,
    d: p.stepsPerBeat ?? 44,
    k: p.kaiSignature,
    p: p.userPhiKey,
  };
  if (p.parentUrl) compact.r = p.parentUrl;
  if (p.originUrl) compact.o = p.originUrl;

  const json = JSON.stringify(compact);
  const b64url = toB64url(toB64(new TextEncoder().encode(json)));
  return `c:${b64url}`;
}

// ⬇️ "c:" decodes (lossy to core + known extras), "j:"/legacy decodes losslessly.
export function decodeSigilPayload(pParam: string): SigilSharePayloadLoose {
  // v2 compact (short keys)
  if (pParam.startsWith("c:")) {
    const b64url = pParam.slice(2);
    const b64 = fromB64url(b64url);
    const bytes = fromB64(b64);
    const json = new TextDecoder().decode(bytes);
    const v = JSON.parse(json) as Record<string, unknown>;
    const out: SigilSharePayloadLoose = {
      pulse: Number(v.u) || 0,
      beat: Number(v.b) || 0,
      stepIndex: Number(v.s) || 0,
      chakraDay: v.c as SigilSharePayload["chakraDay"],
      stepsPerBeat: Number(v.d) || 44,
      kaiSignature: typeof v.k === "string" ? (v.k as string) : undefined,
      userPhiKey: typeof v.p === "string" ? (v.p as string) : undefined,
      parentUrl: typeof v.r === "string" ? (v.r as string) : undefined,
      originUrl: typeof v.o === "string" ? (v.o as string) : undefined,
    };
    return out;
  }

  // NEW: optional explicit long-key tag "j:" (treat same as unprefixed)
  const rawB64url = pParam.startsWith("j:") ? pParam.slice(2) : pParam;

  // legacy/unprefixed long-key JSON (LOSSLESS: pass through unknown fields)
  const b64 = fromB64url(rawB64url);
  const bytes = fromB64(b64);
  const json = new TextDecoder().decode(bytes);
  const v = JSON.parse(json) as Record<string, unknown>;

  // Normalize core numeric fields but keep everything else
  const core: SigilSharePayload = {
    pulse: Number(v.pulse) || 0,
    beat: Number(v.beat) || 0,
    stepIndex: Number(v.stepIndex) || 0,
    chakraDay: v.chakraDay as SigilSharePayload["chakraDay"],
    stepsPerBeat: Number(v.stepsPerBeat) || 44,
    kaiSignature: typeof v.kaiSignature === "string" ? (v.kaiSignature as string) : undefined,
    userPhiKey: typeof v.userPhiKey === "string" ? (v.userPhiKey as string) : undefined,
    parentUrl: typeof v.parentUrl === "string" ? (v.parentUrl as string) : undefined,
    originUrl: typeof v.originUrl === "string" ? (v.originUrl as string) : undefined,
  };

  // Known extended fields (typed), everything else passes through via spread
  const extended: Omit<SigilSharePayloadLoose, keyof SigilSharePayload> = {
    expiresAtPulse: v.expiresAtPulse != null ? Number(v.expiresAtPulse) : undefined,
    canonicalHash: typeof v.canonicalHash === "string" ? (v.canonicalHash as string) : undefined,
    transferNonce: typeof v.transferNonce === "string" ? (v.transferNonce as string) : undefined,
    exportedAtPulse: v.exportedAtPulse != null ? Number(v.exportedAtPulse) : undefined,
    claimExtendUnit:
      v.claimExtendUnit === "breaths" || v.claimExtendUnit === "steps"
        ? (v.claimExtendUnit as "breaths" | "steps")
        : undefined,
    claimExtendAmount: v.claimExtendAmount != null ? Number(v.claimExtendAmount) : undefined,
  };

  return { ...v, ...extended, ...core };
}

/* ───────── canonical URL builders ───────── */

export function makeSigilUrl(
  hash: string,
  payload: SigilSharePayload,
  opts?: {
    absolute?: boolean;
    origin?: string;
    /** NEW: if provided, injects lineage. */
    parentUrl?: string;
    /** NEW: if true, infer parent from window.location.href (SSR-safe guarded). */
    autoInferParent?: boolean;
  }
): string {
  const runtimeOrigin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "";
  const origin = opts?.absolute === false ? "" : opts?.origin ?? runtimeOrigin;

  // Mutate a shallow clone only (keep caller immutable)
  const p: SigilSharePayload = { ...payload };

  // Inject lineage if requested
  const inferredParent =
    opts?.parentUrl ||
    (opts?.autoInferParent && typeof window !== "undefined" ? window.location.href : undefined);

  if (inferredParent && !p.parentUrl) {
    p.parentUrl = inferredParent;

    // try to derive origin from parent's payload; else default to parent
    try {
      const parentPayload = extractPayloadFromUrl(inferredParent);
      p.originUrl = p.originUrl || parentPayload?.originUrl || inferredParent;
    } catch {
      p.originUrl = p.originUrl || inferredParent;
    }
  }

  const qp = encodeSigilPayload(p); // compact v2 (+ lineage r/o if present)
  const path = `/s/${encodeURIComponent(hash)}?p=${qp}`;
  return origin ? `${origin}${path}` : path;
}

/* Lossless: carries extended fields directly */
export function encodeSigilPayloadLoose(p: SigilSharePayloadLoose): string {
  const json = JSON.stringify(p);
  const b64url = toB64url(toB64(new TextEncoder().encode(json)));
  return `j:${b64url}`;
}

export function makeSigilUrlLoose(
  hash: string,
  payload: SigilSharePayloadLoose,
  opts?: {
    absolute?: boolean;
    origin?: string;
    parentUrl?: string;
    autoInferParent?: boolean;
  }
): string {
  const runtimeOrigin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "";
  const origin = opts?.absolute === false ? "" : opts?.origin ?? runtimeOrigin;

  const p: SigilSharePayloadLoose = { ...payload };

  const inferredParent =
    opts?.parentUrl ||
    (opts?.autoInferParent && typeof window !== "undefined" ? window.location.href : undefined);

  if (inferredParent && !p.parentUrl) {
    p.parentUrl = inferredParent;
    try {
      const parentPayload = extractPayloadFromUrl(inferredParent);
      p.originUrl = p.originUrl || parentPayload?.originUrl || inferredParent;
    } catch {
      p.originUrl = p.originUrl || inferredParent;
    }
  }

  const qp = encodeSigilPayloadLoose(p);
  const t = p.transferNonce ? `&t=${encodeURIComponent(p.transferNonce)}` : "";
  const path = `/s/${encodeURIComponent(hash)}?p=${qp}${t}`;
  return origin ? `${origin}${path}` : path;
}

/* ───────── Lineage utilities (no backend, URL-only) ───────── */

/** Extract the `?p=` value from a sigil URL (returns null if absent). */
export function extractPayloadParamFromUrl(url: string): string | null {
  try {
    const u = new URL(url, "resolve://");
    // When base is fake, browsers rewrite origin; we only need search params.
    const qp = u.searchParams.get("p");
    return qp ?? null;
  } catch {
    // Fallback: naive parse
    const m = url.match(/[?&]p=([^&#]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }
}

/** Internal: extract FeedPost token from any Stream URL (/stream, /stream/p, /p~, #t=). */
function extractFeedTokenFromUrl(url: string): string | null {
  try {
    const u = new URL(url, "https://example.invalid");

    // 1) Hash form: #t=<token>
    if (u.hash) {
      const hashToken = new URLSearchParams(u.hash.replace(/^#/, "")).get("t");
      if (hashToken) return hashToken;
    }

    // 2) Path forms handled by feedPayload.extractPayloadToken
    const tokenFromPath = extractPayloadToken(u.pathname);
    if (tokenFromPath) return tokenFromPath;

    // 3) Query param ?p=<token> (rare, but we support it)
    const qp = u.searchParams.get("p");
    return qp ?? null;
  } catch {
    // Fallback: regex-based parse (very defensive)
    const hashMatch = url.match(/#(?:t|p)=([^&#]+)/);
    if (hashMatch) return decodeURIComponent(hashMatch[1]);

    const tildeMatch = url.match(/\/p~([^/?#]+)/);
    if (tildeMatch) return decodeURIComponent(tildeMatch[1]);

    const pathMatch = url.match(/\/(?:stream|feed)\/p\/([^/]+)/);
    if (pathMatch) return decodeURIComponent(pathMatch[1]);

    const qpMatch = url.match(/[?&]p=([^&#]+)/);
    return qpMatch ? decodeURIComponent(qpMatch[1]) : null;
  }
}

/** Internal: decode a Stream URL into a SigilSharePayloadLoose via FeedPostPayload. */
function extractStreamSigilPayload(url: string): SigilSharePayloadLoose | null {
  const token = extractFeedTokenFromUrl(url);
  if (!token) return null;

  const feed: FeedPostPayload | null = decodeFeedPayload(token);
  if (!feed) return null;

  // Derive Kai moment from pulse (beat/step/chakraDay/stepsPerBeat)
  let beat = 0;
  let stepIndex = 0;
  let chakraDay: SigilSharePayload["chakraDay"] = "Root";
  let stepsPerBeat = 44;

  try {
    const m = momentFromPulse(feed.pulse) as KaiMomentLike;
    if (typeof m.beat === "number") {
      beat = m.beat;
    } else if (typeof m.beatIndex === "number") {
      beat = m.beatIndex;
    }
    if (typeof m.stepIndex === "number") {
      stepIndex = m.stepIndex;
    }
    if (typeof m.chakraDay === "string") {
      chakraDay = m.chakraDay as SigilSharePayload["chakraDay"];
    }
    if (typeof m.stepsPerBeat === "number") {
      stepsPerBeat = m.stepsPerBeat;
    }
  } catch {
    // fall back to defaults if Kai moment isn't available
  }

  const parentUrl =
    typeof feed.parentUrl === "string"
      ? feed.parentUrl
      : typeof (feed as { parent?: string }).parent === "string"
      ? (feed as { parent: string }).parent
      : undefined;

  const out: SigilSharePayloadLoose = {
    pulse: feed.pulse,
    beat,
    stepIndex,
    chakraDay,
    stepsPerBeat,
    kaiSignature: typeof feed.kaiSignature === "string" ? feed.kaiSignature : undefined,
    userPhiKey: typeof feed.phiKey === "string" ? feed.phiKey : undefined,
    parentUrl,
    originUrl: typeof feed.originUrl === "string" ? feed.originUrl : undefined,
    // expose full FeedPostPayload for Explorer / introspection
    feed,
  };

  return out;
}

/** Decode the payload embedded in a sigil or stream URL (null if not present/decodable). */
export function extractPayloadFromUrl(url: string): SigilSharePayloadLoose | null {
  // 1) Sigil (?p=c:...) case
  const qp = extractPayloadParamFromUrl(url);
  if (qp) {
    try {
      return decodeSigilPayload(qp);
    } catch {
      // fall through to stream decode if it wasn't a sigil payload
    }
  }

  // 2) KaiVoh Stream URL (/stream/p/<token>, /p~<token>, #t=<token>)
  return extractStreamSigilPayload(url);
}

/** Build a child payload with correct lineage from a parent URL. */
export function inheritLineage(
  base: SigilSharePayload,
  parentUrl: string
): SigilSharePayload {
  const out: SigilSharePayload = { ...base, parentUrl: parentUrl };
  const parentPayload = extractPayloadFromUrl(parentUrl);
  out.originUrl = base.originUrl || parentPayload?.originUrl || parentUrl;
  return out;
}

/** Convenience: create a child sigil URL from a parent URL and base payload. */
export function makeChildSigilUrl(
  hash: string,
  base: SigilSharePayload,
  parentUrl: string,
  opts?: { absolute?: boolean; origin?: string }
): string {
  const payload = inheritLineage(base, parentUrl);
  return makeSigilUrl(hash, payload, { ...opts });
}

/** Walk backwards child → parent → … → origin, returning the URL chain (first is start). */
export function resolveLineageBackwards(startUrl: string): string[] {
  const chain: string[] = [];
  let curr: string | undefined = startUrl;

  // Prevent pathological loops via a Set
  const seen = new Set<string>();

  while (curr && !seen.has(curr)) {
    seen.add(curr);
    chain.push(curr);
    const p = extractPayloadFromUrl(curr);
    if (!p?.parentUrl) break;
    curr = p.parentUrl;
  }
  return chain;
}

/** Get the originUrl for any glyph/stream URL (falls back to the top of the backward chain). */
export function getOriginUrl(startUrl: string): string | undefined {
  const p = extractPayloadFromUrl(startUrl);
  if (p?.originUrl) return p.originUrl;
  const chain = resolveLineageBackwards(startUrl);
  return chain.length ? chain[chain.length - 1] : undefined;
}

/* ─────────────────────────────────────────────────────────────────────
 *  🔔 Live registry bus (instant updates across UI + tabs)
 *  - Use from *any* file (e.g., seal modal) to announce new sigil URLs.
 *  - Components subscribe once and get live updates (no page reload).
 *  - SSR-safe guards; de-dupes; persists to both canonical and fallback keys.
 *  - Keeps compatibility with older listeners that watch localStorage only.
 *  Exports:
 *    - registerSigilUrl(url)
 *    - subscribeSigilRegistry(handler) -> unsubscribe()
 *    - getRegisteredSigilUrls()
 *    - constants for keys/channel
 *  ──────────────────────────────────────────────────────────────────── */

export const SIGIL_REGISTRY_LS_KEY = "kai:sigils:v1";
export const SIGIL_MODAL_FALLBACK_LS_KEY = "sigil:urls"; // legacy/fallback key used by SealMomentModal
export const SIGIL_CHANNEL_NAME = "kai-sigil-registry";
const hasWindowEnv = typeof window !== "undefined";

/** Read a JSON string[] list from localStorage (SSR-safe). */
function readList(key: string): string[] {
  if (!hasWindowEnv) return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? (arr.filter((x) => typeof x === "string") as string[]) : [];
  } catch {
    return [];
  }
}

/** Write a JSON string[] list to localStorage (SSR-safe). */
function writeList(key: string, list: string[]) {
  if (!hasWindowEnv) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // ignore
  }
}

/** Add unique URL to list; returns true if inserted. */
function pushUnique(list: string[], url: string): boolean {
  if (list.includes(url)) return false;
  list.push(url);
  return true;
}

/** Canonicalize to absolute URL for stable storage. */
function canonicalize(url: string): string {
  try {
    return new URL(url, hasWindowEnv ? window.location.origin : "https://example.invalid").toString();
  } catch {
    return url;
  }
}

/** Broadcast channel (lazy) */
let _bc: BroadcastChannel | null = null;
function bc(): BroadcastChannel | null {
  if (!hasWindowEnv || !("BroadcastChannel" in window)) return null;
  if (_bc) return _bc;
  _bc = new BroadcastChannel(SIGIL_CHANNEL_NAME);
  return _bc;
}

/**
 * Register a minted sigil URL everywhere:
 * - persist to canonical + fallback localStorage keys
 * - post BroadcastChannel message (cross-tab)
 * - dispatch DOM CustomEvent ('sigil:url-registered') (same-tab)
 *
 * Call this from your seal flow (e.g., after mint), not from components.
 */
export function registerSigilUrl(url: string) {
  if (!hasWindowEnv || !url) return;

  const abs = canonicalize(url);

  // Persist to canonical list
  const canon = readList(SIGIL_REGISTRY_LS_KEY);
  const changedCanon = pushUnique(canon, abs);
  if (changedCanon) writeList(SIGIL_REGISTRY_LS_KEY, canon);

  // Persist to legacy/fallback list for older listeners
  const fallback = readList(SIGIL_MODAL_FALLBACK_LS_KEY);
  const changedFallback = pushUnique(fallback, abs);
  if (changedFallback) writeList(SIGIL_MODAL_FALLBACK_LS_KEY, fallback);

  // Notify same-tab listeners
  try {
    window.dispatchEvent(new CustomEvent("sigil:url-registered", { detail: { url: abs } }));
  } catch {
    /* ignore */
  }

  // Cross-tab broadcast
  try {
    bc()?.postMessage({ type: "sigil:add", url: abs });
  } catch {
    /* ignore */
  }
}

/**
 * Subscribe to live registry updates.
 * Fires for:
 *  - DOM CustomEvent 'sigil:url-registered' (same tab)
 *  - BroadcastChannel 'sigil:add' (other tabs)
 *  - 'storage' events when lists change (other tabs)
 * Returns an unsubscribe function.
 */
export function subscribeSigilRegistry(
  handler: (url: string, source: "event" | "broadcast" | "storage") => void
): () => void {
  if (!hasWindowEnv) return () => {};

  const onEvent = (e: Event) => {
    const evt = e as CustomEvent<{ url?: string }>;
    const u = evt?.detail?.url;
    if (typeof u === "string") handler(u, "event");
  };

  const chan = bc();
  const onMsg = (ev: MessageEvent) => {
    if (ev?.data?.type === "sigil:add" && typeof ev.data.url === "string") {
      handler(ev.data.url, "broadcast");
    }
  };

  const onStorage = (ev: StorageEvent) => {
    if (
      ev.key &&
      (ev.key === SIGIL_REGISTRY_LS_KEY || ev.key === SIGIL_MODAL_FALLBACK_LS_KEY) &&
      typeof ev.newValue === "string"
    ) {
      try {
        const arr = JSON.parse(ev.newValue) as unknown;
        if (Array.isArray(arr)) {
          for (const u of arr) if (typeof u === "string") handler(u, "storage");
        }
      } catch {
        /* ignore */
      }
    }
  };

  window.addEventListener("sigil:url-registered", onEvent as EventListener);
  chan?.addEventListener("message", onMsg);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener("sigil:url-registered", onEvent as EventListener);
    chan?.removeEventListener("message", onMsg);
    window.removeEventListener("storage", onStorage);
  };
}

/** Current snapshot (merged + de-duped across canonical + fallback). */
export function getRegisteredSigilUrls(): string[] {
  if (!hasWindowEnv) return [];
  const a = readList(SIGIL_REGISTRY_LS_KEY);
  const b = readList(SIGIL_MODAL_FALLBACK_LS_KEY);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of [...a, ...b]) {
    const abs = canonicalize(u);
    if (!seen.has(abs)) {
      out.push(abs);
      seen.add(abs);
    }
  }
  return out;
}

/** 🔁 Canonicalize sealed sigil URL from current location for QR rendering and click */
export function makeCanonicalQrUrl(currentUrl: string): string | null {
  try {
    const url = new URL(currentUrl);
    const pathname = url.pathname;

    // Match `/s/:hash` or `/sigil/:hash` or any custom pattern
    const hashMatch = pathname.match(/\/(?:s|sigil)\/([a-f0-9]{6,})/i);
    const hash = hashMatch?.[1];

    // Try extracting payload from full URL (query/hash portion)
    const payload = extractPayloadFromUrl(currentUrl);

    if (hash && payload) {
      return makeSigilUrl(hash, payload);
    }

    // Fallback: if payload is valid, but hash is missing, extract from current URL hash
    const fallbackHash = url.hash?.slice(1).match(/^([a-f0-9]{6,})$/i)?.[1];
    if (fallbackHash && payload) {
      return makeSigilUrl(fallbackHash, payload);
    }

    return null;
  } catch (err) {
    console.error("Failed to generate canonical QR URL:", err);
    return null;
  }
}

// Optional: augment Vite env typing (keeps strict TS happy without `any`)
declare global {
  interface ImportMetaEnv {
    readonly VITE_SITE_URL?: string; // e.g. https://kaiklok.com
  }
}

/* ──────────────── SAFE ORIGIN RESOLVER (Vite-only, no `any`) ──────────────── */
function resolveSiteOrigin(explicit?: string): string {
  // 1) explicit override from caller
  if (explicit) {
    try {
      return new URL(explicit).origin;
    } catch {
      /* ignore invalid explicit */
    }
  }

  // 2) Vite environment
  const hasImportMeta = typeof import.meta !== "undefined";
  const hasEnv = hasImportMeta && typeof import.meta.env !== "undefined";
  const envOrigin =
    hasEnv && typeof import.meta.env.VITE_SITE_URL === "string"
      ? import.meta.env.VITE_SITE_URL
      : "";

  if (envOrigin) {
    try {
      return new URL(envOrigin).origin;
    } catch {
      /* ignore invalid env */
    }
  }

  // 3) browser at runtime
  if (typeof window !== "undefined" && typeof window.location?.origin === "string" && window.location.origin) {
    return window.location.origin;
  }

  // 4) final fallback (SSR/tests)
  return "https://kaiklok.com";
}

// export this helper
export function canonicalUrlFromContext(canonicalHash: string, base?: string): string {
  const origin = resolveSiteOrigin(base);

  const hash = (canonicalHash ?? "").toString().trim().toLowerCase();
  if (!hash) return origin + "/";

  const u = new URL(`/s/${encodeURIComponent(hash)}`, origin);

  // Preserve live query that SigilPage keeps (browser-only)
  if (typeof window !== "undefined") {
    const locQs = new URLSearchParams(window.location.search);
    const d = locQs.get("d");
    if (d) u.searchParams.set("d", d);
    const t = locQs.get("t");
    if (t) u.searchParams.set("t", t);
  }

  return u.toString();
}
