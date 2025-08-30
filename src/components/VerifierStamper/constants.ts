// src/components/VerifierStamper/constants.ts
/* Constants used across VerifierStamper */

export const PULSE_MS = 5_236 as const;
export const GENESIS_TS = Date.UTC(2024, 4, 10, 6, 45, 41, 888);

export const kaiPulseNow = () =>
  Math.floor((Date.now() - GENESIS_TS) / PULSE_MS);

export const SIGIL_CTX = "https://schema.phi.network/sigil/v1" as const;
export const SIGIL_TYPE = "application/phi.kairos.sigil+svg" as const;

/* Segment / proofs policy */
export const SEGMENT_SIZE = 2_000 as const; // head-window live transfers cap before rolling a segment
