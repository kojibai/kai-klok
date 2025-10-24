// src/components/ExhaleNote/titles.ts

/** Builds a stable PDF/PNG filename from signature, stamp, and pulse. */
export function buildPdfTitle(
    kaiSignature?: string,
    valuationStamp?: string,
    frozenPulse?: string
  ): string {
    const serialCore = (kaiSignature ? kaiSignature.slice(0, 12).toUpperCase() : "SIGIL").replace(
      /[^0-9A-Z]/g,
      "Φ"
    );
    const serial = `KK-${serialCore}-${frozenPulse || ""}`;
    const stamp = (valuationStamp || "").toString();
    const safe = (s: string): string =>
      s
        .replace(/[^\w\-–—\u0394\u03A6\u03C6]+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 180);
    return `SIGIL-${safe(serial)}—VAL-${safe(stamp)}`;
  }
  // src/components/exhale-note/titles.ts

/** Main immutable title printed on the banknote header (SVG). */
export const NOTE_TITLE =
"KAIROS NOTE — LEGAL TENDER OF THE SOVEREIGN KINGDOM";

/** Optional UI brand line used in app chrome / print header. */
export const UI_BRAND_LINE =
"KAIROS KURRENSY — Sovereign Harmonik Kingdom";

/** Optional tagline line used under the SVG title. */
export const ISSUANCE_TAGLINE =
"ISSUED UNDER YAHUAH’S LAW OF ETERNAL LIGHT — Φ • KAI-TURAH";
