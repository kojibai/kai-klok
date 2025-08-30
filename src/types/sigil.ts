// src/types/sigil.ts

export type VerifyState = "checking" | "ok" | "mismatch" | "notfound" | "error";

export type ExpiryUnit = "breaths" | "steps";

export type EmbeddedAttachment = {
  name: string;
  mime: string;
  size: number;
  dataUri: string; // data:<mime>;base64,...
};

export type ProvenanceEntry = {
  ownerPhiKey: string;
  kaiSignature?: string;
  pulse: number;             // sealed glyph’s eternal pulse
  beat: number;
  stepIndex?: number;        // pulse-derived at the glyph’s pulse
  atPulse: number;           // event pulse (e.g., claim, transfer)
  attachmentName?: string;
  action: "mint" | "transfer" | "claim";
};

// Standard zero-knowledge Groth16 proof object
export interface SigilZkProof {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
}

// Metadata about the proof context for future explorers or APIs
export interface SigilProofHints {
  scheme: string;      // e.g., "groth16-poseidon"
  api: string;         // e.g., "/api/proof/sigil"
  explorer: string;    // e.g., "/explorer/hash/<hash>"
}

// Full canonical SigilPayload with ZK proof and biometric signature
export type SigilPayload = {
  pulse: number;
  beat: number;
  stepIndex?: number;
  stepPct?: number; // 0..1 (presentational only)
  chakraDay:
    | "Root"
    | "Sacral"
    | "Solar Plexus"
    | "Heart"
    | "Throat"
    | "Third Eye"
    | "Crown";

  kaiSignature?: string;
  userPhiKey?: string;
  stepsPerBeat?: number;

  // Embedded chain of events
  provenance?: ProvenanceEntry[];

  // Optional SVG or zip-encoded glyph file
  attachment?: EmbeddedAttachment;

  // Expiration & lifecycle
  expiresAtPulse?: number;
  exportedAtPulse?: number;
  originalAmount?: number;

  // Canonical sigil fingerprint
  canonicalHash?: string;
  lineageRoot?: string | null;

  // Transfer + claim fields
  transferNonce?: string;
  transferSig?: string | null;
  transferPub?: JsonWebKey | string | null;
  packageHash?: string | null;

  // Optional debit log
  debits?: Array<{
    amount: number;
    recipientPhiKey?: string;
    timestamp?: number;
    nonce: string;
  }>;
  totalDebited?: number;

  // Expiration extension by receiver (used in sigil/claim)
  claimExtendUnit?: ExpiryUnit;
  claimExtendAmount?: number;

  // Zero-knowledge section (ZK Poseidon proof)
  zkPoseidonHash: string;
  zkProof: SigilZkProof;

  // Public key used for breath signature and the signature itself
  ownerPubKey: JsonWebKey;
  ownerSig: string;

  // Context for explorer or verifier
  eternalRecord: string;
  creatorResolved: string;
  origin: string;
  proofHints: SigilProofHints;

  // Optional timestamp (for inspection/logging only)
  timestamp?: string;
};

export type SigilMetaLoose = Partial<SigilPayload> & Record<string, unknown>;

// Payload used when generating shareable URLs or QR codes
export type SharePayloadX = {
  pulse: number;
  beat: number;
  stepIndex: number;
  chakraDay: SigilPayload["chakraDay"];
  stepsPerBeat: number;
  kaiSignature?: string;
  userPhiKey?: string;
  transferNonce?: string;
  canonicalHash?: string;
  expiresAtPulse?: number;
  claimExtendUnit?: ExpiryUnit;
  claimExtendAmount?: number;
};
