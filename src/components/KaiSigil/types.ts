/* Public types kept stable */
export type HashMode = "moment" | "deterministic";

/** Kai weekday names (6-day harmonic week) */
export type WeekdayName =
  | "Solhara"
  | "Aquaris"
  | "Flamora"
  | "Verdari"
  | "Sonari"
  | "Kaelith";

export type ChakraDayKey =
  | "Root"
  | "Sacral"
  | "Solar Plexus"
  | "Heart"
  | "Throat"
  | "Third Eye"
  | "Crown";

export type ChakraDay = ChakraDayKey | WeekdayName;

export interface KaiSigilProps {
  id?: string;

  pulse: number;
  beat: number;

  /** Caller may provide these; if omitted we derive from pulse for full backward-compat. */
  stepIndex?: number;
  stepPct?: number;

  chakraDay: ChakraDay;

  size?: number;

  hashOverride?: string;
  strict?: boolean;
  quality?: "ultra" | "high" | "low";
  animate?: boolean;
  debugOutline?: boolean;
  goldenId?: string;

  hashMode?: HashMode;

  userPhiKey?: string;
  kaiSignature?: string;
  intentionSigil?: string;
  creatorPublicKey?: string;

  origin?: string;
  qrHref?: string;

  showZKBadge?: boolean;

  onReady?: (info: { hash: string; url: string; metadataJson: string }) => void;
  onError?: (err: unknown) => void;

  /* kept for embedding/attrs (NOT for step resolution) */
  klock?: Record<string, unknown>;
  embed?: Record<string, unknown>;
  prevLedgerB64?: string;
}

export interface KaiSigilHandle {
  toDataURL(): string;
  exportBlob(
    type?: "image/svg+xml" | "image/png",
    scale?: number
  ): Promise<Blob>;
  verifySvgHash(expected: string): Promise<string>;
  verifyConsistency(): void;
  uid: string;
  stepIndex: number;
  payloadHashHex: string | undefined;
  sigilUrl: string | undefined;
  userPhiKey?: string;
  kaiSignature?: string;
}

/* build snapshot */
export type SnapshotKey = string;

export type ProofHints = {
  scheme: "groth16-poseidon" | string;
  api: string;
  explorer: string;
};

export type ZkProof = {
  pi_a: [string, string, string];
  pi_b: [[string, string], [string, string], [string, string]];
  pi_c: [string, string, string];
};

export type SigilPayloadExtended = {
  v: "1.0";
  kaiSignature: string;
  phikey: string;
  pulse: number;
  beat: number;
  stepIndex: number;
  chakraDay: ChakraDayKey;
  chakraGate: string;
  kaiPulse: number;
  stepsPerBeat: number;
  timestamp?: string;
  eternalRecord: string;
  creatorResolved: string;
  origin: string;
  proofHints: ProofHints;
  zkPoseidonHash: string;
  zkProof: ZkProof;
  ownerPubKey?: JsonWebKey;
  ownerSig?: string;
};

export type Built = {
  createdFor: {
    pulse: number;
    beat: number;
    stepIndex: number;
    chakraDayKey: ChakraDayKey;
    stateKey: SnapshotKey;
  };
  payloadHashHex: string;
  shareUrl: string;
  embeddedMetaJson: string;
  valuationSourceJson: string;
  zkScheme?: string;
  zkPoseidonHash?: string;
  innerRingText: string;
  sigilUrl: string;
  hashB58: string;
  frequencyHz: number;
};