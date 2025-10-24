// src/components/exhale-note/types.ts
// Shared types for Exhale Note modules

import type { ValueSeal, SigilMetadataLite } from "../../utils/valuation";
import type { IssuancePolicy, Quote } from "../../utils/phi-issuance";

export type ExhaleNoteRenderPayload = {
  lockedPulse: number;
  seal: ValueSeal;
  usdPerPhi: number;
  phiPerUsd: number;
  valuePhi: number;
  valueUsdIndicative: number;
  quote: Quote;
};

export type MaybeUnsignedSeal = Omit<ValueSeal, "stamp"> | ValueSeal;

/** Minimal shape used from computeIntrinsicUnsigned().unsigned */
export type IntrinsicUnsigned = {
  valuePhi: number;
  premium?: number;
  algorithm: string;
  policyChecksum: string;
};

export type ProvenanceRow = {
  action?: string;
  pulse?: string | number;
  beat?: string | number;
  stepIndex?: string | number;
  ownerPhiKey?: string;
};

export type ZkInfo = { scheme?: string; poseidon?: string };

export type BanknoteInputs = {
  // printed on the note
  purpose?: string;
  to?: string;
  from?: string;
  location?: string;
  witnesses?: string;
  reference?: string;
  remark?: string;

  // identity / valuation
  valuePhi?: string;
  premiumPhi?: string;
  computedPulse?: string;
  nowPulse?: string;
  kaiSignature?: string;
  userPhiKey?: string;
  sigmaCanon?: string;
  shaHex?: string;
  phiDerived?: string;
  valuationAlg?: string;
  valuationStamp?: string;

  // provenance + zk (optional)
  provenance?: ProvenanceRow[];
  zk?: ZkInfo;

  // sigil + verify
  sigilSvg?: string;   // raw SVG for slot
  verifyUrl?: string;  // used for QR & clickable slot
};

export type VerifierBridge = {
  getNoteData?: () => BanknoteInputs | Promise<BanknoteInputs>;
};

export interface NoteProps {
  /** Sigil metadata powering live valuation */
  meta: SigilMetadataLite;
  /** Deterministic USD sample size for issuance quote ($/Φ). Default 100. */
  usdSample?: number;
  /** Issuance policy; defaults to DEFAULT_ISSUANCE_POLICY. */
  policy?: IssuancePolicy;
  /** Optional server-first pulse getter; local bridge used if absent. */
  getNowPulse?: () => number;
  /** Callback fired when user locks the note (Render). */
  onRender?: (payload: ExhaleNoteRenderPayload) => void;

  /** Optional initial builder fields (purpose/to/from/etc.). */
  initial?: BanknoteInputs;
  className?: string;
}

/** Inputs needed to render the banknote SVG */
export type BanknoteParams = Required<
  Pick<
    BanknoteInputs,
    | "valuePhi"
    | "premiumPhi"
    | "computedPulse"
    | "nowPulse"
    | "kaiSignature"
    | "userPhiKey"
    | "verifyUrl"
    | "valuationAlg"
    | "valuationStamp"
    | "purpose"
    | "to"
    | "from"
    | "location"
    | "witnesses"
    | "reference"
    | "remark"
    | "sigilSvg"
  >
> & {
  provenance: ProvenanceRow[];
};

/** Inputs needed for proof pages */
export type ProofParams = {
  frozenPulse: string;
  kaiSignature: string;
  userPhiKey: string;
  sigmaCanon: string;
  shaHex: string;
  phiDerived: string;
  valuePhi: string;
  premiumPhi: string;
  valuationAlg: string;
  valuationStamp: string;
  zk?: ZkInfo;
  provenance: ProvenanceRow[];
  sigilSvg: string;
  verifyUrl: string;
};
