// src/utils/urlShort.ts

/**
 * v46 — urlShort.ts
 * -----------------------------------------------------------------------------
 * Purpose
 * -------
 * Small, sharp URL utilities for Sigil routes:
 *  - Extract a canonical hash from `/s/:hash`.
 *  - Write/merge claim timing + lineage into `?p=`.
 *  - Normalize a Sigil URL to the modern `/s/:canonical` route without losing qs/hash.
 *  - Provide helpers to choose the current canonical hash and active token.
 *
 * Design choices
 * --------------
 *  - Depends on cryptoLedger's base64url helpers for consistency.
 *  - Avoids throwing: all functions return safe fallbacks on malformed inputs.
 *
 * Integration
 * -----------
 *  - `canonicalFromUrl(url) -> string | null`
 *  - `ensureClaimTimeInUrl(url, payloadWithOptionals) -> string`
 *  - `normalizeSigilPath(url, canonical) -> string`
 *  - `currentCanonical(payload, localHash, legacyInfo) -> string | null`
 *  - `currentToken(urlToken, payload) -> string | null`
 * -----------------------------------------------------------------------------
 */

import type { SigilPayload } from "../types/sigil";
import { b64urlDecodeUtf8, b64urlEncodeUtf8 } from "./cryptoLedger";

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

/**
 * Ensure timing + lineage needed for claim window are embedded in `?p=`.
 * If `?p=` exists, merges missing keys; otherwise creates one.
 */
export function ensureClaimTimeInUrl(
  baseUrl: string,
  meta: SigilPayload | (SigilPayload & WithLineage)
): string {
  try {
    const u = new URL(baseUrl, window.location.origin);
    const pRaw = u.searchParams.get("p");

    let obj: Record<string, unknown> = {};
    if (pRaw) {
      try {
        obj = JSON.parse(b64urlDecodeUtf8(pRaw)) as Record<string, unknown>;
      } catch {
        obj = {};
      }
    }

    const merged: Record<string, unknown> = { ...obj };

    const m = meta as Partial<SigilPayload> & Partial<WithClaim> & WithLineage;

    // claim timing
    if (typeof m.expiresAtPulse === "number") merged.expiresAtPulse = m.expiresAtPulse;
    if (m.claimExtendUnit != null) merged.claimExtendUnit = m.claimExtendUnit;
    if (typeof m.claimExtendAmount === "number") merged.claimExtendAmount = m.claimExtendAmount;

    // identity
    if (typeof m.pulse === "number") merged.pulse = m.pulse;
    if (typeof m.beat === "number") merged.beat = m.beat;
    if (typeof m.stepsPerBeat === "number") merged.stepsPerBeat = m.stepsPerBeat;
    if (m.chakraDay) merged.chakraDay = m.chakraDay;
    if (m.canonicalHash) merged.canonicalHash = String(m.canonicalHash).toLowerCase();
    if (m.kaiSignature) merged.kaiSignature = m.kaiSignature;
    if (m.userPhiKey) merged.userPhiKey = m.userPhiKey;
    if (m.transferNonce) merged.transferNonce = m.transferNonce;

    // optional lineage
    if (Array.isArray(m.lineage)) merged.lineage = m.lineage;

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
