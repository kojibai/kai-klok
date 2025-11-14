// src/utils/feedPayload.ts
// URL-safe payload utilities for Kai-Klok Stream.
// - Default navigation uses hash (#t=<token>) to avoid request-line limits
// - Back-compat: supports /stream/p/<token> (new) and /feed/p/<token> (old)
// - SMS-safe short alias: /p~<token>
// - No Chronos display in UI; pulse is authoritative

/* ───────── Versioning ───────── */

export const FEED_PAYLOAD_VERSION = 1 as const;
export const ATTACHMENTS_VERSION = 1 as const;

/* ───────── Token budgets (empirically safe across iOS share, SMS, routers) ───────── */
export const TOKEN_SOFT_BUDGET = 1800 as const; // prefer staying under this
export const TOKEN_HARD_LIMIT = 3500 as const;  // absolute cut-off for path usage

/* ───────── Core Types ───────── */

export type FeedSource = "x" | "manual";

export type AttachmentUrl = {
  kind: "url";
  url: string;
  title?: string;
};

export type AttachmentFileRef = {
  kind: "file-ref";
  name?: string;
  type?: string;         // MIME
  size?: number;         // bytes
  sha256: string;        // hex, lowercase
  url?: string;          // local ref like /att/<sha> or remote
};

export type AttachmentFileInline = {
  kind: "file-inline";
  name?: string;
  type?: string;         // MIME
  size?: number;         // bytes of original file
  data_b64url: string;   // bytes as base64url (potentially large)
  thumbnail_b64?: string;// optional small preview (image/*), pruned for links
};

export type AttachmentItem = AttachmentUrl | AttachmentFileRef | AttachmentFileInline;

export type Attachments = {
  version: typeof ATTACHMENTS_VERSION;
  totalBytes?: number;    // total file bytes (original sizes)
  inlinedBytes?: number;  // bytes carried inline (data_b64url + thumbnails)
  items: AttachmentItem[];
};

/**
 * FeedPostPayload — single KaiVoh “memory” / stream post.
 *
 * Lineage fields:
 *  - parentUrl: canonical immediate parent (sigil or stream URL)
 *  - originUrl: root origin of the thread (top-most sigil/stream)
 *  - parent:    legacy field, kept for back-compat; prefer parentUrl.
 */
export type FeedPostPayload = {
  v: typeof FEED_PAYLOAD_VERSION; // schema version
  url: string;                    // sigil/action URL to render
  caption?: string;
  author?: string;                // e.g. "@handle"
  source?: FeedSource;            // where it came from
  pulse: number;                  // Kai pulse index of post
  sigilId?: string;               // short glyph/sigil identifier
  phiKey?: string;                // optional ΦKey (short)
  kaiSignature?: string;          // optional Kai Signature (short)

  /** Legacy parent field (can be sigil or stream URL). Prefer parentUrl. */
  parent?: string;

  /** Canonical immediate parent URL (sigil or stream). */
  parentUrl?: string;

  /** Root-most origin URL (sigil or original stream). */
  originUrl?: string;

  ts?: number;                    // unix ms (optional; never display)
  attachments?: Attachments;      // videos/images/files/url refs
};

/* ───────── Tiny runtime guards (no 'any') ───────── */

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}
function isString(x: unknown): x is string {
  return typeof x === "string";
}
function isNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}
function isOptionalString(x: unknown): x is string | undefined {
  return x === undefined || isString(x);
}
function isOptionalNumber(x: unknown): x is number | undefined {
  return x === undefined || isNumber(x);
}
function isValidSource(x: unknown): x is FeedSource | undefined {
  return x === undefined || x === "x" || x === "manual";
}

/* ───────── Attachment guards ───────── */

function isAttachmentUrl(x: unknown): x is AttachmentUrl {
  if (!isObject(x)) return false;
  return x["kind"] === "url"
    && isString(x["url"])
    && isOptionalString(x["title"]);
}

function isAttachmentFileRef(x: unknown): x is AttachmentFileRef {
  if (!isObject(x)) return false;
  const hasKind = x["kind"] === "file-ref";
  const sha = x["sha256"];
  return !!hasKind
    && isString(sha)
    && /^[0-9a-f]{64}$/.test(sha) // strict 32-byte sha256 hex
    && isOptionalString(x["name"])
    && isOptionalString(x["type"])
    && isOptionalNumber(x["size"])
    && (x["url"] === undefined || isString(x["url"]));
}

function isAttachmentFileInline(x: unknown): x is AttachmentFileInline {
  if (!isObject(x)) return false;
  const hasKind = x["kind"] === "file-inline";
  return !!hasKind
    && isOptionalString(x["name"])
    && isOptionalString(x["type"])
    && isOptionalNumber(x["size"])
    && isString(x["data_b64url"])
    && (x["thumbnail_b64"] === undefined || isString(x["thumbnail_b64"]));
}

function isAttachmentItem(x: unknown): x is AttachmentItem {
  return isAttachmentUrl(x) || isAttachmentFileRef(x) || isAttachmentFileInline(x);
}

function isAttachments(x: unknown): x is Attachments {
  if (!isObject(x)) return false;
  if (x["version"] !== ATTACHMENTS_VERSION) return false;
  if (!Array.isArray(x["items"])) return false;
  if (!x["items"].every(isAttachmentItem)) return false;
  if (!isOptionalNumber(x["totalBytes"])) return false;
  if (!isOptionalNumber(x["inlinedBytes"])) return false;
  return true;
}

/* ───────── Feed payload guard ───────── */

export function isFeedPostPayload(x: unknown): x is FeedPostPayload {
  if (!isObject(x)) return false;
  return (
    x["v"] === FEED_PAYLOAD_VERSION &&
    isString(x["url"]) &&
    isNumber(x["pulse"]) &&
    isValidSource(x["source"]) &&
    isOptionalString(x["caption"]) &&
    isOptionalString(x["author"]) &&
    isOptionalString(x["sigilId"]) &&
    isOptionalString(x["phiKey"]) &&
    isOptionalString(x["kaiSignature"]) &&
    isOptionalString(x["parent"]) &&
    isOptionalString(x["parentUrl"]) &&
    isOptionalString(x["originUrl"]) &&
    isOptionalNumber(x["ts"]) &&
    (x["attachments"] === undefined || isAttachments(x["attachments"]))
  );
}

/* ───────── Base64URL helpers (global-safe) ───────── */

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = typeof globalThis.btoa === "function"
    ? globalThis.btoa(bin)
    : Buffer.from(bin, "binary").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(token: string): Uint8Array {
  const b64 = token.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (token.length % 4)) % 4);
  const bin = typeof globalThis.atob === "function"
    ? globalThis.atob(b64)
    : Buffer.from(b64, "base64").toString("binary");
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ───────── Encoding / Decoding ───────── */

export function encodeFeedPayload(p: FeedPostPayload): string {
  const json = JSON.stringify(p);
  const bytes = new TextEncoder().encode(json);
  return toBase64Url(bytes);
}

export function decodeFeedPayload(token: string): FeedPostPayload | null {
  try {
    if (!token || token.length > 1_000_000) return null; // defensive: refuse absurd inputs
    const bytes = fromBase64Url(token);
    if (bytes.length === 0) return null;
    const json = new TextDecoder().decode(bytes);
    const parsed: unknown = JSON.parse(json);
    return isFeedPostPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/* ───────── ArrayBuffer helpers (fix ArrayBufferLike vs ArrayBuffer) ───────── */

function toArrayBuffer(buf: ArrayBufferLike): ArrayBuffer {
  if (buf instanceof ArrayBuffer) return buf;
  // Copy SharedArrayBuffer into a new ArrayBuffer
  const view = new Uint8Array(buf);
  const out = new ArrayBuffer(view.byteLength);
  new Uint8Array(out).set(view);
  return out;
}

function hexOf(bytes: ArrayBufferLike): string {
  const v = new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < v.length; i++) s += v[i].toString(16).padStart(2, "0");
  return s;
}

async function sha256Hex(bytes: ArrayBufferLike): Promise<string> {
  const ab = toArrayBuffer(bytes);
  if (typeof globalThis.crypto !== "undefined" && "subtle" in globalThis.crypto) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", ab);
    return hexOf(digest);
  }
  // Node fallback (dynamic to avoid bundling in browser)
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const { createHash } = await import("crypto");
  return createHash("sha256").update(Buffer.from(new Uint8Array(ab))).digest("hex");
}

function mimeToBlob(bytes: ArrayBufferLike, type?: string): Blob {
  const ab = toArrayBuffer(bytes);
  try {
    return new Blob([ab], { type: type || "application/octet-stream" });
  } catch {
    return new Blob([ab]);
  }
}

/* ───────── Attachment utilities ───────── */

function bytesFromBase64Url(b64url: string): Uint8Array {
  return fromBase64Url(b64url);
}

/**
 * Compute attachment size stats for a payload.
 */
export function computeAttachmentStats(p: FeedPostPayload): { totalBytes: number; inlinedBytes: number } {
  let total = 0;
  let inline = 0;
  const A = p.attachments?.items ?? [];
  for (const it of A) {
    if (it.kind === "file-ref") {
      total += it.size ?? 0;
    } else if (it.kind === "file-inline") {
      total += it.size ?? 0;
      inline += (it.data_b64url?.length ?? 0) * 0.75; // b64 expansion ≈ 4/3; inverse ≈ ×0.75
      if (it.thumbnail_b64) inline += it.thumbnail_b64.length * 0.75;
    }
  }
  return { totalBytes: Math.round(total), inlinedBytes: Math.round(inline) };
}

/**
 * Return a clone with thumbnails removed (kept for UI only, never in links).
 * No unused vars: clone + delete on typed inline object.
 */
export function pruneThumbnails(p: FeedPostPayload): FeedPostPayload {
  if (!p.attachments) return p;
  const items = p.attachments.items.map((it) => {
    if (it.kind === "file-inline" && it.thumbnail_b64) {
      const rest: AttachmentFileInline = { ...it };
      delete rest.thumbnail_b64;
      return rest;
    }
    return it;
  });
  const { totalBytes, inlinedBytes } = computeAttachmentStats({ ...p, attachments: { ...p.attachments, items } });
  return {
    ...p,
    attachments: {
      version: ATTACHMENTS_VERSION,
      items,
      totalBytes,
      inlinedBytes,
    },
  };
}

/**
 * Drop all file-inline items (keep URLs and file-refs). Use only as a last resort.
 */
export function dropInlineFiles(p: FeedPostPayload): FeedPostPayload {
  if (!p.attachments) return p;
  const items = p.attachments.items.filter((it) => it.kind !== "file-inline");
  const { totalBytes, inlinedBytes } = computeAttachmentStats({ ...p, attachments: { ...p.attachments, items } });
  return {
    ...p,
    attachments: {
      version: ATTACHMENTS_VERSION,
      items,
      totalBytes,
      inlinedBytes,
    },
  };
}

/**
 * Materialize inline files into CacheStorage and convert them to file-refs.
 * - Computes SHA-256 of the content
 * - Stores blobs under /att/<sha> (cache-only URL)
 * - Converts each file-inline → file-ref with the derived sha and url
 * - Prunes thumbnails
 * If CacheStorage is unavailable, inline files are dropped (never left in token).
 */
export async function materializeInlineToCache(
  p: FeedPostPayload,
  opts: { cacheName?: string; pathPrefix?: string } = {},
): Promise<FeedPostPayload> {
  const cacheName = opts.cacheName ?? "sigil-attachments-v1";
  const pathPrefix = (opts.pathPrefix ?? "/att/").replace(/\/+$/, "") + "/";

  if (!p.attachments || p.attachments.items.length === 0) {
    return pruneThumbnails(p);
  }

  const hasCaches =
    typeof globalThis.caches !== "undefined" &&
    typeof globalThis.caches.open === "function";

  const outItems: AttachmentItem[] = [];
  for (const it of p.attachments.items) {
    if (it.kind !== "file-inline") {
      outItems.push(it);
      continue;
    }

    if (!hasCaches) {
      // If we can't persist safely, drop inline payloads to protect link size.
      continue;
    }

    // Decode
    const bytes = bytesFromBase64Url(it.data_b64url).buffer;
    const sha = await sha256Hex(bytes);
    const blob = mimeToBlob(bytes, it.type);
    const url = `${pathPrefix}${sha}`;

    // Put into CacheStorage
    const cache = await globalThis.caches.open(cacheName);
    await cache.put(new Request(url, { method: "GET" }), new Response(blob, {
      headers: it.type ? { "Content-Type": it.type } : undefined,
    }));

    // Convert to file-ref (no thumbnail)
    const ref: AttachmentFileRef = {
      kind: "file-ref",
      name: it.name,
      type: it.type,
      size: it.size,
      sha256: sha,
      url,
    };
    outItems.push(ref);
  }

  const pruned = { ...p, attachments: { version: ATTACHMENTS_VERSION, items: outItems } };
  const { totalBytes, inlinedBytes } = computeAttachmentStats(pruned);
  return { ...pruned, attachments: { ...pruned.attachments!, totalBytes, inlinedBytes } };
}

/* ───────── Token helpers & URL builders ───────── */

/**
 * Encode a payload into a token, enforcing budgets:
 * - We always prune thumbnails first.
 * - If still too large for path usage, caller should prefer hash/#t=.
 */
export function encodeTokenWithBudgets(
  p: FeedPostPayload,
): { token: string; withinSoft: boolean; withinHard: boolean } {
  const pruned = pruneThumbnails(p);
  const token = encodeFeedPayload(pruned);
  return {
    token,
    withinSoft: token.length <= TOKEN_SOFT_BUDGET,
    withinHard: token.length <= TOKEN_HARD_LIMIT,
  };
}

/** Extract token from current location (hash → tilde path → query → path), with budget awareness. */
export function extractPayloadTokenFromLocation(): string | null {
  try {
    const loc = globalThis.location;

    // 1) #t=<token>
    const hash = new URLSearchParams((loc?.hash ?? "").replace(/^#/, "")).get("t");
    if (hash) return hash;

    // 2) /p~<token> (SMS-safe alias)
    const mTilde = loc?.pathname.match(/\/p~([^/?#]+)/);
    if (mTilde) return decodeURIComponent(mTilde[1]);

    // 3) ?p=<token>
    const qp = new URLSearchParams(loc?.search ?? "").get("p");
    if (qp) return qp;

    // 4) /stream/p/<token> (new) or /feed/p/<token> (legacy)
    const m = loc?.pathname.match(/^\/(?:stream|feed)\/p\/([^/]+)$/);
    if (m) {
      const t = decodeURIComponent(m[1]);
      if (t.length <= TOKEN_HARD_LIMIT) return t;
      return null;
    }

    return null;
  } catch {
    return null;
  }
}

/** Extract token from an arbitrary pathname string. */
export function extractPayloadToken(pathname: string): string | null {
  const mTilde = pathname.match(/\/p~([^/?#]+)/);
  if (mTilde) return decodeURIComponent(mTilde[1]);
  const m = pathname.match(/^\/(?:stream|feed)\/p\/([^/]+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Build a URL using hash as the default (safest): `${origin}/stream#t=<token>` */
export function buildHashUrl(origin: string, payload: FeedPostPayload): string {
  const { token } = encodeTokenWithBudgets(payload);
  const base = origin.replace(/\/+$/, "");
  return `${base}/stream#t=${token}`;
}

/** Build a path URL `${origin}/stream/p/<token>` — ONLY if within hard limit; otherwise falls back to hash. */
export function buildPathUrl(origin: string, payload: FeedPostPayload): string {
  const { token, withinHard } = encodeTokenWithBudgets(payload);
  const base = origin.replace(/\/+$/, "");
  return withinHard ? `${base}/stream/p/${token}` : `${base}/stream#t=${token}`;
}

/** Build an SMS-safe alias `${origin}/p~<token>` (still falls back to hash if absurdly large). */
export function buildSmsUrl(origin: string, payload: FeedPostPayload): string {
  const { token, withinHard } = encodeTokenWithBudgets(payload);
  const base = origin.replace(/\/+$/, "");
  return withinHard ? `${base}/p~${token}` : `${base}/stream#t=${token}`;
}

/** Back-compat canonical builder (prefers path if small, otherwise hash). */
export function buildFeedUrl(origin: string, payload: FeedPostPayload): string {
  return buildPathUrl(origin, payload);
}

/* ───────── High-level safe flow helpers ───────── */

export async function preparePayloadForLink(
  p: FeedPostPayload,
  opts: { cacheName?: string; pathPrefix?: string } = {},
): Promise<FeedPostPayload> {
  const withRefs = await materializeInlineToCache(p, opts);
  return pruneThumbnails(withRefs);
}

export async function buildPreparedHashUrl(
  origin: string,
  payload: FeedPostPayload,
  opts?: { cacheName?: string; pathPrefix?: string },
): Promise<string> {
  const prepared = await preparePayloadForLink(payload, opts);
  return buildHashUrl(origin, prepared);
}

export async function buildPreparedShareUrl(
  origin: string,
  payload: FeedPostPayload,
  opts?: { cacheName?: string; pathPrefix?: string },
): Promise<string> {
  const prepared = await preparePayloadForLink(payload, opts);
  return buildSmsUrl(origin, prepared);
}

/* ───────── Strict constructors (to avoid accidental schema drift) ───────── */

export function makeBasePayload(args: {
  url: string;
  pulse: number;
  caption?: string;
  author?: string;
  source?: FeedSource;
  sigilId?: string;
  phiKey?: string;
  kaiSignature?: string;
  /** Legacy parent; if parentUrl not provided, we mirror this into parentUrl. */
  parent?: string;
  /** Canonical immediate parent URL (preferred). */
  parentUrl?: string;
  /** Root-most origin URL for the thread. */
  originUrl?: string;
  ts?: number;
  attachments?: Attachments;
}): FeedPostPayload {
  const parentUrl = args.parentUrl ?? args.parent;
  const p: FeedPostPayload = {
    v: FEED_PAYLOAD_VERSION,
    url: args.url,
    pulse: args.pulse,
    caption: args.caption,
    author: args.author,
    source: args.source,
    sigilId: args.sigilId,
    phiKey: args.phiKey,
    kaiSignature: args.kaiSignature,
    parent: args.parent,
    parentUrl,
    originUrl: args.originUrl,
    ts: args.ts,
    attachments: args.attachments,
  };
  return p;
}

/* ───────── Attachment builders ───────── */

export function makeAttachments(items: AttachmentItem[]): Attachments {
  const A: Attachments = { version: ATTACHMENTS_VERSION, items: items.slice() };
  const { totalBytes, inlinedBytes } = computeAttachmentStats({ v: FEED_PAYLOAD_VERSION, url: "", pulse: 0, attachments: A });
  A.totalBytes = totalBytes;
  A.inlinedBytes = inlinedBytes;
  return A;
}

export function makeInlineAttachment(params: {
  name?: string;
  type?: string;
  data_b64url: string;
  size?: number;
  thumbnail_b64?: string;
}): AttachmentFileInline {
  return {
    kind: "file-inline",
    name: params.name,
    type: params.type,
    size: params.size,
    data_b64url: params.data_b64url,
    thumbnail_b64: params.thumbnail_b64,
  };
}

export function makeFileRefAttachment(params: {
  sha256: string;
  name?: string;
  type?: string;
  size?: number;
  url?: string;
}): AttachmentFileRef {
  if (!/^[0-9a-f]{64}$/.test(params.sha256)) {
    throw new Error("sha256 must be 64 hex chars");
  }
  return {
    kind: "file-ref",
    sha256: params.sha256,
    name: params.name,
    type: params.type,
    size: params.size,
    url: params.url,
  };
}

export function makeUrlAttachment(params: {
  url: string;
  title?: string;
}): AttachmentUrl {
  return {
    kind: "url",
    url: params.url,
    title: params.title,
  };
}
