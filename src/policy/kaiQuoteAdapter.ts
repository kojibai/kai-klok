// policy/kaiQuoteAdapter.ts
// Attach REAL Φ issuance quote to window.KaiKlok without changing global types.
//
// Exposes: window.KaiKlok.quotePhiForUSD(usd: number, pulseIndex: number) => number (Φ)
//
// - Uses your deterministic issuance policy from ../utils/phi-issuance.ts
// - No global redeclaration; no `any`; strict & safe
// - Optional `getMeta` callback lets you supply the exact SigilMetadataLite
//   that your checkout / valuation layer already uses.
// - If no meta is available yet, returns 0 and the live chart will no-op
//   until the engine is ready (prevents fake $2 readings).
//
// RAH • VEH • YAH • DAH

import type { SigilMetadataLite } from "../utils/valuation.ts";
import {
  quotePhiForUsd,
  DEFAULT_ISSUANCE_POLICY,
  type IssuancePolicy,
} from "../utils/phi-issuance.ts";

// Local shape for safe access to window.KaiKlok without redeclaring global types.
type KaiKlokRuntime = {
  postContribution?: (amount: number, method?: "card" | "btc") => void;
  openPayment?: (amount: number, suggestedMethod?: "card" | "btc") => void;

  // Will be attached by this adapter:
  quotePhiForUSD?: (amountUSD: number, pulseIndex: number) => number;

  // Optional: If you expose a meta provider here, we’ll use it when getMeta is not given.
  getIssuanceMeta?: () => SigilMetadataLite | null | undefined;
};

// Resolve a SigilMetadataLite safely from either the provided callback or runtime.
function resolveMeta(getMeta?: () => SigilMetadataLite): SigilMetadataLite | null {
  if (typeof getMeta === "function") {
    try {
      const m = getMeta();
      return m ?? null;
    } catch {
      return null;
    }
  }
  if (typeof window !== "undefined") {
    const w = window as unknown as { KaiKlok?: KaiKlokRuntime };
    const m = w.KaiKlok?.getIssuanceMeta?.();
    return m ?? null;
  }
  return null;
}

/**
 * Attach your real issuance quote as window.KaiKlok.quotePhiForUSD.
 *
 * @param getMeta  Callback returning the SAME SigilMetadataLite your checkout uses.
 *                 If omitted, we’ll try window.KaiKlok.getIssuanceMeta().
 * @param policy   Issuance policy to use (defaults to DEFAULT_ISSUANCE_POLICY).
 */
export function attachKaiQuotePolicy(
  getMeta?: () => SigilMetadataLite,
  policy: IssuancePolicy = DEFAULT_ISSUANCE_POLICY
): void {
  if (typeof window === "undefined") return;

  // Keep any existing helpers intact; attach only what we need.
  const w = window as unknown as { KaiKlok?: KaiKlokRuntime };
  w.KaiKlok = w.KaiKlok || {};

  // The one function your parity feed & price chart need:
  w.KaiKlok.quotePhiForUSD = (usd: number, pulseIndex: number): number => {
    // Guard: reject non-finite or negative USD
    if (!Number.isFinite(usd) || usd <= 0) return 0;

    // Get the live valuation meta (engine context) deterministically
    const meta = resolveMeta(getMeta);
    if (!meta) return 0; // engine/meta not ready yet — caller will skip this tick

    try {
      // Run the REAL issuance quote (deterministic, φ-anchored)
      const qt = quotePhiForUsd(
        {
          meta,
          nowPulse: Math.max(0, Math.trunc(pulseIndex)),
          usd: Math.max(0, usd),
        },
        policy
      );

      // Return Φ for this USD at this pulse — EXACTLY what parity feed expects
      return Number.isFinite(qt.addPhiNow) ? qt.addPhiNow : 0;
    } catch {
      // If anything goes wrong (e.g., meta shape mismatch while booting), be safe:
      return 0;
    }
  };
}
