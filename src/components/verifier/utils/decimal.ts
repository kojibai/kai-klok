// src/components/verifier/utils/decimal.ts
/* ────────────────────────────────────────────────────────────────
   decimal.ts
   Φ arithmetic (18dp fixed scale)
   • bigint math for Φ balance and USD conversion
   • no floating point except for readable string formatting
   • includes helper to extract exhaled Φ from a transfer payload
────────────────────────────────────────────────────────────────── */

import type { SigilTransfer } from "../types/local";
import { base64DecodeUtf8 } from "./base64";

const SCALE = 18n;

/** 10^n bigint */
function pow10(n: bigint): bigint {
  let r = 1n;
  for (let i = 0n; i < n; i += 1n) r *= 10n;
  return r;
}

const TEN_S = pow10(SCALE);

/** Turn "123.456" -> scaled bigint (18dp). Non-numeric characters are ignored. */
function toScaledBig(s: string): bigint {
  const t = (s ?? "").trim();
  if (!t) return 0n;

  const negative = t.startsWith("-");
  const sign = negative ? -1n : 1n;

  // Keep digits and dot; normalize leading dots like ".5" -> "0.5"
  const clean = t
    .replace(/[^0-9.]/g, "")
    .replace(/^\.*/, (m) => (m ? "0." : ""));

  const [iRaw, fRaw = ""] = clean.split(".");
  const i = iRaw.replace(/^0+(?=\d)/, "") || "0";
  // Right-pad to exactly SCALE fractional digits, then cut
  const f = (fRaw + "0".repeat(Number(SCALE))).slice(0, Number(SCALE));

  const whole = BigInt(i) * TEN_S + BigInt(f || "0");
  return sign * whole;
}

/** Scaled bigint -> plain string, trimming trailing zeros in the fractional part. */
function fromScaledBig(bi: bigint): string {
  const sign = bi < 0n ? "-" : "";
  const v = bi < 0n ? -bi : bi;
  const intPart = v / TEN_S;
  let frac = (v % TEN_S).toString().padStart(Number(SCALE), "0");
  frac = frac.replace(/0+$/, "");
  return frac.length ? `${sign}${intPart}.${frac}` : `${sign}${intPart}`;
}

/** (a*b)/scale — safe fixed-point multiplication. */
function mulScaled(a: bigint, b: bigint): bigint {
  return (a * b) / TEN_S;
}

/** (a/b)*scale — safe fixed-point division. Returns 0 if divisor is 0. */
function divScaled(a: bigint, b: bigint): bigint {
  if (b === 0n) return 0n;
  return (a * TEN_S) / b;
}

/**
 * Round a scaled bigint to `decimals` places (0..18).
 * Half-up behavior.
 */
function roundScaledToDecimals(bi: bigint, decimals: number): bigint {
  const d = Math.max(0, Math.min(Number(SCALE), decimals));
  const factor = pow10(SCALE - BigInt(d));
  const half = factor / 2n;
  return bi >= 0n ? ((bi + half) / factor) * factor : ((bi - half) / factor) * factor;
}

/** Scaled bigint -> fixed decimal string with exactly `decimals` digits after the dot. */
function fromScaledBigFixed(bi: bigint, decimals: number): string {
  const d = Math.max(0, Math.min(Number(SCALE), decimals));
  const sign = bi < 0n ? "-" : "";
  const v = bi < 0n ? -bi : bi;

  const cut = pow10(SCALE - BigInt(d));
  const val = v / cut;

  const tenD = pow10(BigInt(d));
  const intPart = val / tenD;
  const frac = (val % tenD).toString().padStart(d, "0");
  return `${sign}${intPart}.${frac}`;
}

/** Pretty Φ display, 4dp (rounds first, then formats). */
function fmtPhiFixed4(phiStr: string): string {
  const scaled = toScaledBig(phiStr);
  const rounded = roundScaledToDecimals(scaled, 4);
  return fromScaledBigFixed(rounded, 4);
}

/** Clamp/clean `".123"` etc. for UI input; ensure "0" or "0.xxx" forms. */
function fmtPhiCompact(s: string): string {
  let t = (s ?? "").trim();
  if (!t) return "0";
  if (t.startsWith(".")) t = "0" + t;
  // Remove trailing '.' if no decimals typed yet.
  t = t.replace(/\.?$/, (m) => (/\.\d/.test(t) ? m : ""));
  return t;
}

/**
 * Extract the exhaled Φ amount from a transfer's payload, returned as a scaled bigint.
 * Recognizes MIME "application/vnd.kairos-exhale+json" with a base64-encoded JSON:
 * {
 *   kind: "exhale",
 *   unit: "USD" | "PHI",
 *   amountPhi: string,      // decimal string
 *   amountUsd?: string,     // decimal string
 *   usdPerPhi?: number
 * }
 */
function exhalePhiFromTransferScaled(t: SigilTransfer | null | undefined): bigint {
  try {
    if (!t || !t.payload) return 0n;
    const { mime, encoded } = t.payload;
    if (!mime || !encoded) return 0n;
    if (!/^application\/vnd\.kairos-exhale/i.test(mime)) return 0n;

    const json = base64DecodeUtf8(encoded);
    const obj = JSON.parse(json) as {
      kind?: string;
      amountPhi?: string | number;
    } | null;

    if (!obj || obj.kind !== "exhale") return 0n;
    const phiStr = String(obj.amountPhi ?? "");
    if (!phiStr) return 0n;

    return toScaledBig(phiStr);
  } catch {
    return 0n;
  }
}

export {
  SCALE,
  toScaledBig,
  fromScaledBig,
  mulScaled,
  divScaled,
  roundScaledToDecimals,
  fromScaledBigFixed,
  fmtPhiFixed4,
  fmtPhiCompact,
  exhalePhiFromTransferScaled,
};
