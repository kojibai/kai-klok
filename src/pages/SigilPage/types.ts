// src/pages/SigilPage/types.ts

export type ExpiryUnit = "breaths" | "steps";

export type EmbeddedAttachment = {
  name?: string | null;
  mime?: string | null;
  size?: number | null;
  dataUri?: string | null;
} | null;

export type ProvWithSteps = {
  // provenance base is app-defined; keep loose but add step indices we rely on
  [key: string]: unknown;
  stepIndex?: number;    // sealed-moment step (authoritative)
  atStepIndex?: number;  // claim/transfer-time step (display)
};

/** Base verify state used by existing components (e.g., SigilMetaPanel). */
export type VerifyState = "checking" | "ok" | "mismatch" | "notfound" | "error";

/** UI-only state that includes a distinct "verified" badge if you want it in the page. */
export type VerifyUIState = VerifyState | "verified";

/** Map the UI state to the prop-safe state (collapses "verified" -> "ok"). */
export const toMetaVerifyState = (v: VerifyUIState): VerifyState =>
  v === "verified" ? "ok" : v;

/** Optional helper for checks in your page code. */
export const isVerifiedBadge = (v: VerifyUIState): v is "verified" => v === "verified";

export type SigilTransferLite = {
  // compact history tokens; keep permissive
  [key: string]: unknown;
};

export type SigilPayload = {
  /** moment */
  pulse: number;
  beat: number;
  chakraDay?:
    | "Root"
    | "Sacral"
    | "Solar Plexus"
    | "Heart"
    | "Throat"
    | "Third Eye"
    | "Crown";
  stepsPerBeat?: number;
  stepIndex?: number;     // NOTE: number (no null); callers must coerce before assigning
  stepPct?: number;

  /** identity / signing */
  userPhiKey?: string;
  kaiSignature?: string;

  /** canonical id + transfer token */
  canonicalHash?: string;
  transferNonce?: string;

  /** expiry / upgrade window (not part of SigilSharePayload; SVG/manifest-only) */
  expiresAtPulse?: number;
  claimExtendUnit?: ExpiryUnit;
  claimExtendAmount?: number;

  /** attachments + provenance */
  attachment?: EmbeddedAttachment;
  provenance?: ProvWithSteps[];

  /** misc */
  exportedAtPulse?: number;
};

/** Convenience share payload used in a few places (NOT the tight SigilSharePayload). */
export type SharePayloadX = {
  pulse: number;
  beat: number;
  stepIndex: number;
  chakraDay:
    | "Root"
    | "Sacral"
    | "Solar Plexus"
    | "Heart"
    | "Throat"
    | "Third Eye"
    | "Crown";
  stepsPerBeat?: number;
  userPhiKey?: string;
  kaiSignature?: string;
};

/** Loose meta wrapper for uploads etc. */
export type SigilMetaLoose = Partial<SigilPayload>;
