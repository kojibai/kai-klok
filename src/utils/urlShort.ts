// src/utils/urlShort.ts

/**
 * v48 — urlShort.ts (KKS-coherent)
 * -----------------------------------------------------------------------------
 * Purpose
 * -------
 * Small, sharp URL utilities for Sigil routes:
 *  - Extract a canonical hash from `/s/:hash`.
 *  - Normalize/merge manifest-style `?p=` payloads (and legacy `c:` payloads)
 *    while ensuring `stepIndex` is present and correct for the *sealed* moment.
 *  - Normalize a Sigil URL to the modern `/s/:canonical` route without losing qs/hash.
 *  - Provide helpers to choose the current canonical hash and active token.
 *
 * Design choices
 * --------------
 *  - Depends on cryptoLedger's base64url helpers for consistency.
 *  - Avoids throwing: all functions return safe fallbacks on malformed inputs.
 *  - Legacy `c:` payloads (`{u,b,s,c,d}`) are auto-upgraded to manifest JSON:
 *      { pulse, beat, stepIndex, chakraDay, stepsPerBeat, ... }
 *  - `stepIndex` is guaranteed to be present by computing from the *sealed* pulse
 *    (never from the current time).
 *
 * Integration
 * -----------
 *  - canonicalFromUrl(url) -> string | null
 *  - ensureClaimTimeInUrl(url, payloadWithOptionals) -> string
 *  - normalizeSigilPath(url, canonical) -> string
 *  - currentCanonical(payload, localHash, legacyInfo) -> string | null
 *  - currentToken(urlToken, payload) -> string | null
 * -----------------------------------------------------------------------------
 */

import type { SigilPayload } from "../types/sigil";
import { b64urlDecodeUtf8, b64urlEncodeUtf8 } from "./cryptoLedger";
import {
  stepIndexFromPulse,
  ETERNAL_STEPS_PER_BEAT as STEPS_PER_BEAT,
} from "../SovereignSolar";

/** Extract the canonical hash from a /s/:hash URL (lowercased). */
export function canonicalFromUrl(u: string): string | null {
  try {
    const path = new URL(u, window.location.origin).pathname;
    const m = path.match(/\/s\/([0-9a-fA-F]+)/);
    return m ? m[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

/** Minimal lineage node typing (local only, optional if present in payload). */
type LineageNode = {
  token: string;
  parentToken: string | null;
  amount: number;
  timestamp: number;
  depth: number;
  senderPhiKey?: string | null;
};

type WithClaim = {
  claimExtendUnit?: SigilPayload["claimExtendUnit"] | null;
  claimExtendAmount?: number | null;
};

type WithLineage = { lineage?: LineageNode[] };

/** Legacy `c:` payload shape. */
type LegacyCPayload = {
  u?: unknown; // pulse
  b?: unknown; // beat
  s?: unknown; // stepIndex
  c?: unknown; // chakraDay
  d?: unknown; // stepsPerBeat
};

/** Chakra + claim unit helpers */
type ChakraDayStrict = Exclude<SigilPayload["chakraDay"], undefined>;
type ClaimUnit = SigilPayload["claimExtendUnit"];

function toChakraDay(v: unknown): ChakraDayStrict | undefined {
  if (typeof v !== "string") return undefined;
  const key = v.trim().toLowerCase().replace(/\s+/g, " ");
  switch (key) {
    case "root":
      return "Root";
    case "sacral":
      return "Sacral";
    case "solar plexus":
    case "solarplexus":
      return "Solar Plexus";
    case "heart":
      return "Heart";
    case "throat":
      return "Throat";
    case "third eye":
    case "thirdeye":
      return "Third Eye";
    case "crown":
      return "Crown";
    default:
      return undefined;
  }
}

function toClaimUnit(v: unknown): ClaimUnit | undefined {
  return v === "breaths" || v === "steps" ? v : undefined;
}

/** Manifest JSON payload subset (what we normalize to). */
type ManifestLike = Partial<
  Pick<
    SigilPayload,
    | "pulse"
    | "beat"
    | "stepsPerBeat"
    | "stepIndex"
    | "canonicalHash"
    | "kaiSignature"
    | "userPhiKey"
    | "transferNonce"
    | "expiresAtPulse"
    | "claimExtendUnit"
    | "claimExtendAmount"
  >
> & {
  chakraDay?: ChakraDayStrict; // <— strict, never undefined when present
  lineage?: LineageNode[];
};

/** Type guards / utils */
const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object";

const isLegacyShape = (o: unknown): o is LegacyCPayload => {
  if (!isObj(o)) return false;
  const hasUB = "u" in o && "b" in o;
  const hasD = "d" in o;
  return hasUB || hasD;
};

const toNum = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

const toStr = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v : undefined;

/**
 * Decode the `p` parameter into a normalized manifest-like object.
 *  - Accepts both: base64url(JSON)  and  legacy `c:` + base64url(JSON).
 *  - Upgrades legacy `{u,b,s,c,d}` → `{pulse,beat,stepIndex,chakraDay,stepsPerBeat}`.
 *  - Returns {} on any decode/parse error.
 */
function decodePToManifestLike(pRaw: string | null | undefined): ManifestLike {
  if (!pRaw) return {};
  try {
    let raw = String(pRaw).trim();
    let isLegacy = false;

    if (/^c:/i.test(raw)) {
      raw = raw.slice(2); // legacy prefix
      isLegacy = true;
    }

    const parsed = JSON.parse(b64urlDecodeUtf8(raw)) as unknown;

    if (isLegacy || isLegacyShape(parsed)) {
      const o = parsed as LegacyCPayload;
      const out: ManifestLike = {};
      const pulse = toNum(o.u);
      const beat = toNum(o.b);
      const stepsPerBeat = toNum(o.d);
      const stepIndex = toNum(o.s);
      const chakraDay = toChakraDay(o.c);

      if (pulse !== undefined) out.pulse = pulse;
      if (beat !== undefined) out.beat = beat;
      if (stepsPerBeat !== undefined) out.stepsPerBeat = stepsPerBeat;
      if (stepIndex !== undefined) out.stepIndex = stepIndex;
      if (chakraDay !== undefined) out.chakraDay = chakraDay; // strict, not undefined
      return out;
    }

    if (isObj(parsed)) {
      const inObj = parsed as Record<string, unknown>;
      const out: ManifestLike = {};

      const p = toNum(inObj.pulse);
      const b = toNum(inObj.beat);
      const spb = toNum(inObj.stepsPerBeat);
      const si = toNum(inObj.stepIndex);
      const cd = toChakraDay(inObj.chakraDay);
      const canon = toStr(inObj.canonicalHash);
      const kai = toStr(inObj.kaiSignature);
      const phi = toStr(inObj.userPhiKey);
      const t = toStr(inObj.transferNonce);
      const exp = toNum(inObj.expiresAtPulse);
      const cu = toClaimUnit(inObj.claimExtendUnit);
      const cea = toNum(inObj.claimExtendAmount);

      if (p !== undefined) out.pulse = p;
      if (b !== undefined) out.beat = b;
      if (spb !== undefined) out.stepsPerBeat = spb;
      if (si !== undefined) out.stepIndex = si;
      if (cd !== undefined) out.chakraDay = cd; // strict here as well
      if (canon !== undefined) out.canonicalHash = canon.toLowerCase();
      if (kai !== undefined) out.kaiSignature = kai;
      if (phi !== undefined) out.userPhiKey = phi;
      if (t !== undefined) out.transferNonce = t;
      if (exp !== undefined) out.expiresAtPulse = exp;
      if (cu !== undefined) out.claimExtendUnit = cu;
      if (cea !== undefined) out.claimExtendAmount = cea;
      if (Array.isArray(inObj.lineage)) out.lineage = inObj.lineage as LineageNode[];

      return out;
    }

    return {};
  } catch {
    return {};
  }
}

/**
 * Merge a meta/payload into a manifest-like object, guaranteeing stepIndex.
 * Priority per field (left wins):
 *   1) meta value (if present)
 *   2) existing `p` value (if present)
 *   3) computed fallback (for stepIndex only)
 */
function mergeManifestLike(
  fromP: ManifestLike,
  meta: (SigilPayload | (SigilPayload & WithLineage)) & Partial<WithClaim>
): ManifestLike {
  const out: ManifestLike = { ...fromP };

  // Claim window timing
  if (typeof meta.expiresAtPulse === "number") out.expiresAtPulse = meta.expiresAtPulse;
  if (meta.claimExtendUnit != null) out.claimExtendUnit = meta.claimExtendUnit;
  if (typeof meta.claimExtendAmount === "number") out.claimExtendAmount = meta.claimExtendAmount;

  // Identity
  if (typeof meta.pulse === "number") out.pulse = meta.pulse;
  if (typeof meta.beat === "number") out.beat = meta.beat;
  if (typeof meta.stepsPerBeat === "number") out.stepsPerBeat = meta.stepsPerBeat;

  // chakraDay — only assign when definitely present (strict literal union)
  if (meta.chakraDay !== undefined) {
    out.chakraDay = meta.chakraDay as ChakraDayStrict;
  }

  if (meta.canonicalHash) out.canonicalHash = String(meta.canonicalHash).toLowerCase();
  if (meta.kaiSignature) out.kaiSignature = meta.kaiSignature;
  if (meta.userPhiKey) out.userPhiKey = meta.userPhiKey;
  if (meta.transferNonce) out.transferNonce = meta.transferNonce;

  // Optional lineage
  if (Array.isArray((meta as WithLineage).lineage)) out.lineage = (meta as WithLineage).lineage;

  // Ensure stepIndex is present and sealed to the moment:
  // Priority: meta.stepIndex → p.stepIndex → compute from pulse
  const steps =
    typeof out.stepsPerBeat === "number" && Number.isFinite(out.stepsPerBeat)
      ? (out.stepsPerBeat as number)
      : STEPS_PER_BEAT;

  const metaAny = meta as unknown as { stepIndex?: unknown };
  const metaStepMaybe = toNum(metaAny?.stepIndex);
  const pStepMaybe = toNum(out.stepIndex);

  if (metaStepMaybe !== undefined) {
    out.stepIndex = metaStepMaybe;
  } else if (pStepMaybe !== undefined) {
    out.stepIndex = pStepMaybe;
  } else if (typeof out.pulse === "number" && Number.isFinite(out.pulse)) {
    out.stepIndex = stepIndexFromPulse(out.pulse, steps);
  }

  return out;
}

/**
 * Ensure timing + lineage needed for claim window are embedded in `?p=`,
 * and guarantee `stepIndex` is present and correct for the sealed moment.
 * - If `?p=` exists (JSON or legacy `c:`), it is normalized and merged.
 * - Otherwise a new `?p=` is created from `meta`.
 */
export function ensureClaimTimeInUrl(
  baseUrl: string,
  meta: SigilPayload | (SigilPayload & WithLineage)
): string {
  try {
    const u = new URL(baseUrl, window.location.origin);
    const pRaw = u.searchParams.get("p");

    const fromP = decodePToManifestLike(pRaw);
    const merged = mergeManifestLike(fromP, meta as SigilPayload & Partial<WithClaim> & WithLineage);

    // Final safety: canonical lowercasing
    if (merged.canonicalHash) {
      merged.canonicalHash = String(merged.canonicalHash).toLowerCase();
    }

    u.searchParams.set("p", b64urlEncodeUtf8(JSON.stringify(merged)));
    return u.toString();
  } catch {
    return baseUrl;
  }
}

/** Force a URL to point at `/s/:canonical`, preserving `?` and `#`. */
export function normalizeSigilPath(baseUrl: string, canonical: string): string {
  try {
    const u = new URL(baseUrl, window.location.origin);
    u.pathname = `/s/${(canonical || "").toLowerCase()}`;
    return u.toString();
  } catch {
    return baseUrl;
  }
}

/**
 * Choose the current canonical hash to use, preferring (in order):
 *  - payload.canonicalHash
 *  - localHash (live hash from KaiSigil)
 *  - legacyInfo.matchedHash (when on a legacy route)
 */
export function currentCanonical(
  payload: SigilPayload | null,
  localHash: string | null,
  legacyInfo?: { matchedHash?: string | null } | null
): string | null {
  const candidates: Array<string | null | undefined> = [
    payload?.canonicalHash,
    localHash,
    legacyInfo?.matchedHash,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.toLowerCase();
  }
  return null;
}

/**
 * Choose the active transfer token to scope state by, preferring:
 *  - token from URL (?t=)
 *  - payload.transferNonce
 */
export function currentToken(
  urlToken: string | null,
  payload: SigilPayload | null
): string | null {
  if (typeof urlToken === "string" && urlToken.trim()) return urlToken;
  if (typeof payload?.transferNonce === "string" && payload.transferNonce.trim()) {
    return payload.transferNonce;
  }
  return null;
}
