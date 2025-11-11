// src/utils/feedPayload.ts
// URL-safe payload for /feed/p/<token>. No Chronos display; we carry pulse only.

export const FEED_PAYLOAD_VERSION = 1 as const;

export type FeedPostPayload = {
  v: typeof FEED_PAYLOAD_VERSION; // version
  url: string;                    // the sigil/action URL to render
  caption?: string;
  author?: string;                // e.g. "@handle" (optional)
  source?: "x" | "manual";        // where it came from
  pulse: number;                  // Kai pulse index of post
  sigilId?: string;               // short glyph/sigil identifier
  phiKey?: string;                // optional ΦKey (short)
  kaiSignature?: string;          // optional Kai Signature (short)
  // ts optional for sort/debug only; never display Chronos in UI
  ts?: number;                    // unix ms (optional)
};

// ---------- internal helpers ----------

function toBase64Url(bytes: Uint8Array): string {
  // Browser-safe base64url; relies on btoa which exists in the client.
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(token: string): Uint8Array {
  const b64 =
    token.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (token.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function isValidSource(s: unknown): s is "x" | "manual" | undefined {
  return s === undefined || s === "x" || s === "manual";
}

export function isFeedPostPayload(x: unknown): x is FeedPostPayload {
  if (typeof x !== "object" || x === null) return false;
  const p = x as Record<string, unknown>;
  return (
    p.v === FEED_PAYLOAD_VERSION &&
    typeof p.url === "string" &&
    typeof p.pulse === "number" &&
    isValidSource(p.source) &&
    (p.caption === undefined || typeof p.caption === "string") &&
    (p.author === undefined || typeof p.author === "string") &&
    (p.sigilId === undefined || typeof p.sigilId === "string") &&
    (p.phiKey === undefined || typeof p.phiKey === "string") &&
    (p.kaiSignature === undefined || typeof p.kaiSignature === "string") &&
    (p.ts === undefined || typeof p.ts === "number")
  );
}

// ---------- public API ----------

/** Encode a payload into a URL-safe token */
export function encodeFeedPayload(p: FeedPostPayload): string {
  const json = JSON.stringify(p);
  const bytes = new TextEncoder().encode(json);
  return toBase64Url(bytes);
}

/** Decode a token into a payload (returns null if invalid) */
export function decodeFeedPayload(token: string): FeedPostPayload | null {
  try {
    const bytes = fromBase64Url(token);
    const json = new TextDecoder().decode(bytes);
    const parsed: unknown = JSON.parse(json);
    return isFeedPostPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Extract `/feed/p/<token>` token from a pathname */
export function extractPayloadToken(pathname: string): string | null {
  const m = pathname.match(/^\/feed\/p\/([^/]+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Build a full share URL like `${origin}/feed/p/<token>` */
export function buildFeedUrl(origin: string, payload: FeedPostPayload): string {
  const token = encodeFeedPayload(payload);
  return `${origin.replace(/\/+$/, "")}/feed/p/${token}`;
}
