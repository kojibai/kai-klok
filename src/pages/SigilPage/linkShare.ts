// src/pages/SigilPage/linkShare.ts
"use client";

import { makeSigilUrl, type SigilSharePayload } from "../../utils/sigilUrl";
import { rewriteUrlPayload } from "../../utils/shareUrl";
import { ensureClaimTimeInUrl } from "../../utils/urlShort";
import type { SigilPayload } from "../../types/sigil";

/** Minimal fields needed to build share links and upgrade claims. */
export type ShareableSigilMeta = {
  pulse: number;
  beat: number;
  chakraDay?: string | null;

  stepsPerBeat?: number;
  stepIndex?: number | null; // ✅ if present, this is the UI's exact step and will be preserved

  userPhiKey?: string | null;
  kaiSignature?: string | null;

  canonicalHash?: string | null;

  // NOTE: transferNonce is *not* part of SigilSharePayload.
  transferNonce?: string | null; // kept here for convenience but not serialized
  expiresAtPulse?: number | null; // not in SigilSharePayload; only used for URL logic elsewhere
  claimExtendUnit?: "breaths" | "steps" | null; // not in SigilSharePayload
  claimExtendAmount?: number | null; // not in SigilSharePayload
};

type ShareDeps = {
  localHash: string;
  routeHash: string;
  stepsPerBeat: number;
  stepIndexFromPulse: (pulse: number, steps: number) => number;
};

/** The exact union expected by SigilSharePayload.chakraDay */
type ChakraDay =
  | "Root"
  | "Sacral"
  | "Solar Plexus"
  | "Heart"
  | "Throat"
  | "Third Eye"
  | "Crown";

/** Coerce free-form input into a valid ChakraDay (defaults to "Root"). */
function toChakraDay(v: unknown): ChakraDay {
  const s = String(v ?? "").trim().toLowerCase();
  switch (s) {
    case "root":
    case "earth":
    case "earth gate":
      return "Root";
    case "sacral":
      return "Sacral";
    case "solar plexus":
    case "solar_plexus":
    case "solar-plexus":
      return "Solar Plexus";
    case "heart":
      return "Heart";
    case "throat":
      return "Throat";
    case "third eye":
    case "third_eye":
    case "third-eye":
      return "Third Eye";
    case "crown":
      return "Crown";
    default:
      return "Root";
  }
}

function randomToken(): string {
  return crypto.getRandomValues(new Uint32Array(4)).join("");
}

/** Build only the fields that actually belong to SigilSharePayload (no canonicalHash, no transferNonce, no expiry/claim fields). */
function buildSharePayload(args: {
  meta: ShareableSigilMeta;
  stepIndex: number;
  stepsPerBeat: number;
}): SigilSharePayload {
  const { meta, stepIndex, stepsPerBeat } = args;
  return {
    pulse: meta.pulse,
    beat: meta.beat,
    stepIndex, // ✅ single source of truth fed in here
    chakraDay: toChakraDay(meta.chakraDay),
    stepsPerBeat,
    userPhiKey: meta.userPhiKey ?? undefined,
    kaiSignature: meta.kaiSignature ?? undefined,
  };
}

/** Resolve the step index, preferring the exact UI-provided value. */
function resolveStepIndex(
  meta: ShareableSigilMeta,
  stepsPerBeat: number,
  deps: ShareDeps
): number {
  // Use UI's explicit stepIndex when it's a finite integer in range; else derive from pulse.
  const s = meta.stepIndex;
  if (
    typeof s === "number" &&
    Number.isFinite(s) &&
    s >= 0 &&
    s < stepsPerBeat &&
    Math.floor(s) === s
  ) {
    return s;
  }
  return deps.stepIndexFromPulse(meta.pulse, stepsPerBeat);
}

/**
 * Build a canonical link and attach the token only to the URL, not to the payload.
 * Also merge claim window/timing into ?p= for deep links.
 */
export function shareTransferLink(
  meta: ShareableSigilMeta,
  forcedToken: string | undefined,
  deps: ShareDeps
): { url: string; token: string } | null {
  // Canonical hash goes in the path, not in the payload
  const canonical = ((meta.canonicalHash ?? deps.localHash ?? deps.routeHash) ?? "").toLowerCase();
  if (!canonical) return null;

  const token = forcedToken ?? randomToken();
  const stepsNum = meta.stepsPerBeat ?? deps.stepsPerBeat;

  // ✅ Prefer the UI's exact step if provided, else fall back to deterministic derivation
  const stepIndex = resolveStepIndex(meta, stepsNum, deps);

  const sharePayload = buildSharePayload({
    meta,
    stepIndex,
    stepsPerBeat: stepsNum,
  });

  // Base URL with ?p= (share payload) + ?t= (token)
  const base = makeSigilUrl(canonical, sharePayload);
  const withToken = rewriteUrlPayload(base, sharePayload, token);

  // Deep-linking update: ensure claim window & timing are embedded/merged in ?p=
  // (We also include the resolved stepIndex for future-proof verifiers that read long-form fields.)
  const metaForP: Partial<SigilPayload> = {
    pulse: meta.pulse,
    beat: meta.beat,
    stepsPerBeat: stepsNum,
    stepIndex, // ✅ mirror the same stepIndex into the long-form merge
    chakraDay: toChakraDay(meta.chakraDay) as SigilPayload["chakraDay"],
    canonicalHash: canonical,
    kaiSignature: meta.kaiSignature ?? undefined,
    userPhiKey: meta.userPhiKey ?? undefined,
    transferNonce: token, // carried in ?p= for verifiers to reason about the window context
    expiresAtPulse: meta.expiresAtPulse ?? undefined,
    claimExtendUnit: meta.claimExtendUnit ?? undefined,
    claimExtendAmount: meta.claimExtendAmount ?? undefined,
  };

  const url = ensureClaimTimeInUrl(withToken, metaForP as SigilPayload);
  return { url, token };
}

type UpgradeDeps = ShareDeps & {
  getKaiPulseEternalInt: (d: Date) => number;
  breathsToPulses: (n: number) => number;
  shareTransferLink: typeof shareTransferLink;
  publishRotation: (keys: string[], token: string) => void;
  navigate: (url: string) => void;
};

/** Start an 11-breath upgrade claim window and navigate to the fresh link. */
export function beginUpgradeClaim(
  meta: ShareableSigilMeta,
  canonical: string,
  deps: UpgradeDeps
): string | null {
  const DEFAULT_UPGRADE_BREATHS = 11;
  const nowPulse = deps.getKaiPulseEternalInt(new Date());
  const expiresAtPulse = nowPulse + deps.breathsToPulses(DEFAULT_UPGRADE_BREATHS);
  const token = randomToken();

  const upgraded: ShareableSigilMeta = {
    ...meta,
    canonicalHash: canonical,
    transferNonce: token, // convenience for callers (not serialized)
    expiresAtPulse,
    claimExtendUnit: "breaths",
    claimExtendAmount: DEFAULT_UPGRADE_BREATHS,
  };

  const out = deps.shareTransferLink(upgraded, token, {
    localHash: deps.localHash,
    routeHash: deps.routeHash,
    stepsPerBeat: deps.stepsPerBeat,
    stepIndexFromPulse: deps.stepIndexFromPulse,
  });
  if (!out?.url) return null;

  if (canonical && token) deps.publishRotation([canonical], token);

  // SPA-style navigation first; fall back to hard redirect
  try {
    deps.navigate(out.url);
  } catch (err) {
    // Non-fatal: router may be unavailable; fall back to hard navigation.
    void err;
    try {
      window.location.href = out.url;
    } catch (err2) {
      // Ignore final failure (e.g., sandboxed/blocked navigation).
      void err2;
    }
  }

  return out.url;
}

/** Optional alias for backwards-compat */
export { shareTransferLink as buildShareTransferUrl };
