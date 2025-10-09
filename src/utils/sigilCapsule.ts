// src/utils/sigilCapsule.ts
// STRICT: no `any`, no empty catches, browser-safe Base64, typed helpers.

export type ChakraName =
  | "Root"
  | "Sacral"
  | "Solar Plexus"
  | "Heart"
  | "Throat"
  | "Third Eye"
  | "Crown";

export interface MediaRef {
  kind: "url" | "svg" | "png" | "audio" | "video" | "pdf";
  url: string;
  sha256?: string;
}

export interface PostPayload {
  title?: string;
  text?: string;
  tags?: string[];
  media?: MediaRef[];
}

export interface MessagePayload {
  toUserId: string;
  text: string;
  media?: Array<Pick<MediaRef, "kind" | "url">>;
  threadId?: string;
}

export interface SharePayload {
  refUrl: string;
  note?: string;
}

export interface ReactionPayload {
  refUrl: string;
  emoji?: string;
  value?: number;
}

/** Legacy short keys present in compact capsules. */
interface LegacyShorts {
  u?: number; // pulse
  b?: number; // beat
  s?: number; // stepIndex
  c?: string | number; // chakraDay
}

/** Canonical capsule shape (extensible with unknown extras). */
export interface Capsule extends LegacyShorts {
  pulse?: number;
  beat?: number;
  stepIndex?: number;
  chakraDay?: string | number;

  userPhiKey?: string;
  userId?: string;
  kaiSignature?: string;
  timestamp?: string;

  appId?: string;
  kind?: string;
  nonce?: string;

  // session/control-ish extras (optional)
  expiresAtPulse?: number;
  canonicalHash?: string;

  post?: PostPayload;
  message?: MessagePayload;
  share?: SharePayload;
  reaction?: ReactionPayload;

  work?: Record<string, unknown>;
  w?: Record<string, unknown>;

  [k: string]: unknown;
}

/* ────────────── type guards ────────────── */
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const isFiniteNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

const isString = (v: unknown): v is string => typeof v === "string";

/* ────────────── base64 helpers ────────────── */

function normalizeBase64(input: string): string {
  const raw =
    input.includes("-") || input.includes("_")
      ? input.replace(/-/g, "+").replace(/_/g, "/")
      : input;
  const pad = raw.length % 4;
  if (pad === 2) return `${raw}==`;
  if (pad === 3) return `${raw}=`;
  return raw;
}

function base64DecodeUtf8(b64: string): string {
  const payload = b64.startsWith("c:") ? b64.slice(2) : b64;
  const normalized = normalizeBase64(payload);
  if (typeof window === "undefined" || typeof window.atob !== "function") {
    throw new Error("Base64 decoding not available in this environment");
  }
  const binary = window.atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function base64EncodeUtf8(text: string, withCPrefix = true): string {
  if (typeof window === "undefined" || typeof window.btoa !== "function") {
    throw new Error("Base64 encoding not available in this environment");
  }
  const utf8 = encodeURIComponent(text).replace(
    /%([0-9A-F]{2})/g,
    (_m, h) => String.fromCharCode(parseInt(h, 16))
  );
  const b64 = window.btoa(utf8);
  return withCPrefix ? `c:${b64}` : b64;
}

/* ────────────── core helpers ────────────── */

/** Safely parse JSON string into an object. */
function parseJson(text: string): Record<string, unknown> {
  const v = JSON.parse(text) as unknown;
  if (!isObject(v)) throw new Error("Payload is not an object");
  return v;
}

/** Resolve standard meta with legacy short-key fallback. */
export function resolveMeta(capsule: Capsule): {
  pulse?: number;
  beat?: number;
  stepIndex?: number;
  chakraDay?: string | number;
} {
  const pulse = isFiniteNumber(capsule.pulse)
    ? capsule.pulse
    : isFiniteNumber(capsule.u)
    ? capsule.u
    : undefined;

  const beat = isFiniteNumber(capsule.beat)
    ? capsule.beat
    : isFiniteNumber(capsule.b)
    ? capsule.b
    : undefined;

  const stepIndex = isFiniteNumber(capsule.stepIndex)
    ? capsule.stepIndex
    : isFiniteNumber(capsule.s)
    ? capsule.s
    : undefined;

  const chakraDay =
    isString(capsule.chakraDay) || isFiniteNumber(capsule.chakraDay)
      ? capsule.chakraDay
      : isString(capsule.c) || isFiniteNumber(capsule.c)
      ? capsule.c
      : undefined;

  return { pulse, beat, stepIndex, chakraDay };
}

/** Infer kind based on declared field presence. */
export type CapsuleKind = "post" | "message" | "share" | "reaction" | "sigil";
export function kindOfCapsule(c: Capsule): CapsuleKind {
  if (c.kind === "post" || c.post) return "post";
  if (c.kind === "message" || c.message) return "message";
  if (c.kind === "share" || c.share) return "share";
  if (c.kind === "reaction" || c.reaction) return "reaction";
  return "sigil";
}
/** Attach an encoded capsule as ?p=… to a path or URL (SSR-safe). */
export function withCapsuleInUrl(
    pathOrUrl: string,
    capsule: Capsule,
    baseOrigin?: string
  ): string {
    const base =
      baseOrigin ??
      (typeof window !== "undefined" ? window.location.origin : "https://example.org");
    const u = new URL(pathOrUrl, base);
    u.searchParams.set("p", encodeCapsuleParam(capsule, true));
    return u.toString();
  }
  
  // If you also want an alias that matches buildSigilUrl semantics:
  export const attachCapsuleParam = withCapsuleInUrl;
  
/** True if shape looks like a Capsule. */
export function isCapsule(v: unknown): v is Capsule {
  if (!isObject(v)) return false;
  if ("post" in v || "message" in v || "share" in v || "reaction" in v) return true;
  if ("pulse" in v || "u" in v) return true;
  if ("kaiSignature" in v || "userPhiKey" in v || "userId" in v) return true;
  return false;
}

export type DecodeParamResult =
  | { ok: true; capsule: Capsule }
  | { ok: false; error: string };

/** Decode a ?p= param (supports "c:"-prefixed compact form) into a Capsule. */
export function decodeCapsuleParam(pParam: string): DecodeParamResult {
  try {
    const jsonText = base64DecodeUtf8(pParam);
    const obj = parseJson(jsonText);
    const capsule = obj as Capsule;
    if (!isCapsule(capsule)) {
      return { ok: false, error: "Param decoded but not a Capsule" };
    }
    return { ok: true, capsule };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Decode failure";
    return { ok: false, error: msg };
  }
}

/** Encode a Capsule to a ?p= value. Uses "c:" prefix by default (compact marker). */
export function encodeCapsuleParam(capsule: Capsule, useCompactPrefix = true): string {
  const text = JSON.stringify(capsule);
  return base64EncodeUtf8(text, useCompactPrefix);
}

export type ParseUrlResult =
  | {
      ok: true;
      url: string;
      appId?: string;
      userId?: string;
      kind: CapsuleKind;
      capsule: Capsule;
      pulse?: number;
      beat?: number;
      stepIndex?: number;
      chakraDay?: string | number;
      path: string[];
    }
  | { ok: false; error: string };

/** Parse a full Sigil URL, decode ?p= capsule (if present), and extract basics. */
export function parseSigilUrl(url: string, base?: string): ParseUrlResult {
  try {
    const u = new URL(
      url,
      base ?? (typeof window !== "undefined" ? window.location.origin : "https://example.org")
    );
    const pParam = u.searchParams.get("p");
    const path = u.pathname.split("/").filter(Boolean);
    const appId = path[0] === "s" && path.length >= 2 ? path[1] : undefined;

    let capsule: Capsule = {};
    if (pParam) {
      const d = decodeCapsuleParam(pParam);
      if (!d.ok) return { ok: false, error: d.error };
      capsule = d.capsule;
    }

    const userId = isString(capsule.userId)
      ? capsule.userId
      : isString(capsule.userPhiKey)
      ? capsule.userPhiKey
      : undefined;

    const kind = kindOfCapsule(capsule);
    const { pulse, beat, stepIndex, chakraDay } = resolveMeta(capsule);

    return {
      ok: true,
      url: u.toString(),
      appId,
      userId,
      kind,
      capsule,
      pulse,
      beat,
      stepIndex,
      chakraDay,
      path,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid URL";
    return { ok: false, error: msg };
  }
}

/** Build a Sigil URL by attaching an encoded capsule as ?p= */
export function buildSigilUrl(baseUrl: string, capsule: Capsule): string {
  const url = new URL(
    baseUrl,
    typeof window !== "undefined" ? window.location.origin : "https://example.org"
  );
  url.searchParams.set("p", encodeCapsuleParam(capsule, true));
  return url.toString();
}

/* ────────────── NEW: the helper your session expects ────────────── */

export interface CapsuleMeta {
  userPhiKey?: string;
  userId?: string;
  kaiSignature?: string;
  pulse?: number;
  beat?: number;
  stepIndex?: number;
  expiresAtPulse?: number;
  canonicalHash?: string;
}

/** Unpack the ?p= capsule param to a minimal, typed meta view (or null). */
export function unpackCapsuleParam(pParam: string | null): CapsuleMeta | null {
  if (!pParam) return null;
  const d = decodeCapsuleParam(pParam);
  if (!d.ok) return null;
  const cap = d.capsule;

  const { pulse, beat, stepIndex } = resolveMeta(cap);

  const meta: CapsuleMeta = {
    userPhiKey: isString(cap.userPhiKey)
      ? cap.userPhiKey
      : isString(cap.userId)
      ? cap.userId
      : undefined,
    userId: isString(cap.userId) ? cap.userId : undefined,
    kaiSignature: isString(cap.kaiSignature) ? cap.kaiSignature : undefined,
    pulse,
    beat,
    stepIndex,
    expiresAtPulse: isFiniteNumber(cap.expiresAtPulse) ? cap.expiresAtPulse : undefined,
    canonicalHash: isString(cap.canonicalHash) ? cap.canonicalHash : undefined,
  };

  return meta;
}
