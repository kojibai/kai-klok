// src/components/verifier/types/local.ts
/* ────────────────────────────────────────────────────────────────
   Local verifier-only structural helpers
   Self-contained: defines SigilMetadata and all used verifier types.
   Avoids circular deps and works offline in the Verifier folder.

   NOTE:
   - These shapes are designed to be structurally compatible with
     src/components/VerifierStamper/types.ts.
   - Keep only string aliases (no branded types) to preserve
     structural assignability across modules.
────────────────────────────────────────────────────────────────── */

// Canonical types live in src/components/VerifierStamper/types.ts

/* ────────────────────────────────────────────────────────────────
   UI tabs and state
────────────────────────────────────────────────────────────────── */
export type TabKey = "summary" | "lineage" | "data";

export type UiState =
  | "idle"
  | "invalid"
  | "structMismatch"
  | "sigMismatch"
  | "notOwner"
  | "unsigned"
  | "readySend"
  | "readyReceive"
  | "verified"
  | "complete";

/* ────────────────────────────────────────────────────────────────
   Chakra constants + helpers
   - normalizeChakraDay: accepts loose inputs (e.g. "root gate",
     "ROOT-CHAKRA") and returns a canonical ChakraDay label.
────────────────────────────────────────────────────────────────── */
export const CHAKRA_DAYS = [
  "Root",
  "Sacral",
  "Solar Plexus",
  "Heart",
  "Throat",
  "Third Eye",
  "Crown",
] as const;

export type ChakraDay = (typeof CHAKRA_DAYS)[number];

const CHAKRA_DAY_MAP: Record<string, ChakraDay> = CHAKRA_DAYS.reduce((acc, v) => {
  acc[v.toLowerCase()] = v;
  return acc;
}, {} as Record<string, ChakraDay>);

/** Internal canonicalization helper: strips "gate"/"chakra" and punctuation. */
function _simplifyChakraToken(s: string): string {
  const lowered = s.toLowerCase().trim();
  // remove common suffixes/words like "gate", "chakra", punctuation and extra spaces
  const noDecor = lowered
    .replace(/[-_]/g, " ")
    .replace(/\b(gate|chakra|day)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // handle common two-word forms
  if (/(third\s*eye)/.test(noDecor)) return "third eye";
  if (/(solar\s*plexus)/.test(noDecor)) return "solar plexus";

  return noDecor;
}

/** Normalize any loose chakra label to a canonical ChakraDay, or null if unknown. */
export function normalizeChakraDay(input: unknown): ChakraDay | null {
  if (typeof input !== "string") return null;

  const simplified = _simplifyChakraToken(input);
  // Direct matches first
  const direct = CHAKRA_DAY_MAP[simplified];
  if (direct) return direct;

  // Single-token fallbacks
  switch (simplified) {
    case "root":
      return "Root";
    case "sacral":
      return "Sacral";
    case "solar":
    case "plexus":
      return "Solar Plexus";
    case "heart":
      return "Heart";
    case "throat":
      return "Throat";
    case "third":
    case "eye":
      return "Third Eye";
    case "crown":
      return "Crown";
    default:
      return null;
  }
}

/* ────────────────────────────────────────────────────────────────
   Primitive aliases (keep as plain strings for structural typing)
────────────────────────────────────────────────────────────────── */
export type B64uSPKI = string; // base64url-encoded SubjectPublicKeyInfo
export type HashHex = string;  // lowercase hex string

/* ────────────────────────────────────────────────────────────────
   Payload + transfer (legacy window)
────────────────────────────────────────────────────────────────── */
export type SigilPayload = {
  name: string;
  mime: string;
  size: number;
  /** Base64-encoded UTF-8 bytes of the payload (no 'data:' prefix). */
  encoded: string;
};

export type SigilTransfer = {
  // Sender (Exhale)
  senderSignature: string; // live Σ (breath signature) of sender
  senderStamp: string;     // deterministic stamp for sender-side commit
  senderKaiPulse: number;
  payload?: SigilPayload;

  // Receiver (Inhale)
  receiverSignature?: string;
  receiverStamp?: string;
  receiverKaiPulse?: number;
};

/* ────────────────────────────────────────────────────────────────
   ZK references + optional embedded bundles
────────────────────────────────────────────────────────────────── */
export type ZkRef = {
  scheme: "groth16";
  curve: "BLS12-381";
  /** Optional hashes (usually Poseidon or keccak/sha256 of artifacts) */
  publicHash?: HashHex;
  proofHash?: HashHex;
  vkeyHash?: HashHex;
  /** Local verification toggle */
  verified?: boolean;
};

export type ZkBundle = {
  scheme: "groth16";
  curve: "BLS12-381";
  proof: unknown;
  publicSignals: unknown;
  vkey?: unknown;
};

/* ────────────────────────────────────────────────────────────────
   Hardened add-only lineage (v14)
   Mirrors canonical V14 lineage used by VerifierStamper.
────────────────────────────────────────────────────────────────── */
export type HardenedTransferV14 = {
  previousHeadRoot: HashHex;

  // sender side
  senderPubKey: B64uSPKI;
  senderSig: string; // b64url(ECDSA over canonical SEND)
  senderKaiPulse: number;
  nonce: string;
  transferLeafHashSend: HashHex;

  // receiver side (when sealed)
  receiverPubKey?: B64uSPKI;
  receiverSig?: string; // b64url(ECDSA over canonical RECEIVE)
  receiverKaiPulse?: number;
  transferLeafHashReceive?: HashHex;

  // zk stamps (hash refs)
  zkSend?: ZkRef;
  zkReceive?: ZkRef;

  // optional embedded bundles for offline verify
  zkSendBundle?: ZkBundle;
  zkReceiveBundle?: ZkBundle;
};

/* ────────────────────────────────────────────────────────────────
   Segments + proof structures
────────────────────────────────────────────────────────────────── */
export type SegmentEntry = {
  index: number;   // 0..N
  root: HashHex;   // Merkle root for segment transfers
  cid: HashHex;    // content hash (segment JSON)
  count: number;   // #transfers in segment
};

export type SegmentFile = {
  version: 1;
  segmentIndex: number;
  segmentRange: [number, number];
  segmentRoot: HashHex;
  headHashAtSeal: HashHex;
  leafHash: "sha256";
  transfers: SigilTransfer[];
};

export type TransferProof = {
  leaf: HashHex;
  index: number;        // leaf index
  siblings: HashHex[];  // bottom-up path to root
};

export type SegmentProofBundle = {
  kind: "segment";
  segmentIndex: number;
  segmentRoot: HashHex;
  transferProof: TransferProof;
  segmentsSiblings: HashHex[];
  headHashAtSeal: HashHex;
};

export type HeadWindowProofBundle = {
  kind: "head";
  windowMerkleRoot: HashHex;
  transferProof: TransferProof;
};

/* ────────────────────────────────────────────────────────────────
   Send lock (one-time)
────────────────────────────────────────────────────────────────── */
export type SendLock = {
  nonce: string;
  used?: boolean;
  usedPulse?: number;
};

/* ────────────────────────────────────────────────────────────────
   Core Sigil metadata used by Verifier (self-contained)
────────────────────────────────────────────────────────────────── */
export type SigilMetadata = {
  ["@context"]?: string;
  type?: string;

  pulse?: number;
  beat?: number;
  stepIndex?: number;
  /** e.g. "Root", "Sacral", ... (canonicalized with normalizeChakraDay) */
  chakraDay?: string;
  /** Source label may include the word "gate"; callers should strip via normalizeChakraDay. */
  chakraGate?: string;
  frequencyHz?: number;

  kaiPulse?: number;
  kaiSignature?: string;
  userPhiKey?: string;
  intentionSigil?: string;

  creatorPublicKey?: B64uSPKI; // base64url(SPKI)
  origin?: string;

  kaiPulseToday?: number;
  kaiMomentSummary?: string;

  transfers?: SigilTransfer[];

  /* Segments + head-window */
  segmentSize?: number;
  segments?: SegmentEntry[];
  segmentsMerkleRoot?: HashHex;
  transfersWindowRoot?: HashHex;
  cumulativeTransfers?: number;
  headHashAtSeal?: HashHex;

  /* Canonical & nonce for share links */
  canonicalHash?: string;
  transferNonce?: string;

  /* Hardened lineage (parallel to legacy) */
  hardenedTransfers?: HardenedTransferV14[];
  transfersWindowRootV14?: HashHex;

  /* Optional inline verifying key (ZK) */
  zkVerifyingKey?: unknown;

  /* Parent branch Φ accounting (decimal strings up to 18dp) */
  branchBasePhi?: string;
  branchSpentPhi?: string;

  /* Allow extensions */
  [k: string]: unknown;
};

export type SigilMetadataWithOptionals = SigilMetadata & {
  /* CHILD context */
  childOfHash?: HashHex;        // parent canonical hash
  childAllocationPhi?: string;  // Φ allocated to this child
  childIssuedPulse?: number;    // senderKaiPulse at issuance
  childClaim?: {
    steps: number;         // typically 11
    expireAtPulse: number; // issuedPulse + (steps * 11)
  };
  sendLock?: SendLock;
};

/* ────────────────────────────────────────────────────────────────
   Verification status for latest head-window proof
────────────────────────────────────────────────────────────────── */
export type HeadProofInfo = {
  ok: boolean;
  index: number;
  root: HashHex;
};

/* ────────────────────────────────────────────────────────────────
   Small runtime helpers (pure & tree-shakeable)
   Included here to keep VerifierStamper lean and avoid extra deps.
────────────────────────────────────────────────────────────────── */

/** Regex for quick hex validation (lower/upper both accepted). */
const HEX_RX = /^[0-9a-fA-F]+$/;
/** Regex for a minimal base64url check (paddingless). */
const B64U_RX = /^[A-Za-z0-9_-]+$/;

export function isHashHex(x: unknown): x is HashHex {
  return typeof x === "string" && x.length > 0 && HEX_RX.test(x);
}

export function isB64u(x: unknown): x is string {
  return typeof x === "string" && x.length > 0 && B64U_RX.test(x);
}

export function isB64uSPKI(x: unknown): x is B64uSPKI {
  return isB64u(x);
}

/** Ensure a hex string is lowercase (no validation beyond hex chars). */
export function toLowerHex(x: string): HashHex {
  return x.toLowerCase() as HashHex;
}

/** CHILD claim math constants (KKS v1) */
export const CHILD_STEPS_DEFAULT = 11;
export const PULSES_PER_STEP = 11;

/**
 * Compute child-claim expiry from metadata.
 * If explicit `childClaim.expireAtPulse` exists, prefer it.
 * Otherwise derive from `childIssuedPulse + steps*11`.
 */
export function computeChildExpireAt(meta: SigilMetadataWithOptionals): number | undefined {
  if (meta.childClaim?.expireAtPulse != null) return meta.childClaim.expireAtPulse;

  const issued = meta.childIssuedPulse;
  const steps =
    meta.childClaim?.steps != null ? meta.childClaim.steps : CHILD_STEPS_DEFAULT;

  if (typeof issued === "number" && Number.isFinite(issued)) {
    return issued + steps * PULSES_PER_STEP;
  }
  return undefined;
}

/** Return seconds-to-expiry in pulses (non-negative), or undefined if unknown. */
export function remainingChildPulses(
  meta: SigilMetadataWithOptionals,
  nowPulse: number
): number | undefined {
  const exp = computeChildExpireAt(meta);
  if (typeof exp !== "number") return undefined;
  const r = Math.max(0, Math.floor(exp - nowPulse));
  return Number.isFinite(r) ? r : undefined;
}

/** Convenience: true if a child file is past expiry. */
export function isChildExpired(meta: SigilMetadataWithOptionals, nowPulse: number): boolean {
  const exp = computeChildExpireAt(meta);
  return typeof exp === "number" ? nowPulse >= exp : false;
}

/**
 * Returns a compact summary for UI presence panels.
 * - expireAt: pulse where RECEIVE closes
 * - remaining: pulses remaining (if nowPulse given)
 * - steps: configured steps (default 11)
 */
export function getChildLockInfo(
  meta: SigilMetadata | SigilMetadataWithOptionals,
  nowPulse?: number
): { expireAt?: number; remaining?: number; steps?: number } {
  const m = meta as SigilMetadataWithOptionals;
  const steps =
    m.childClaim?.steps != null ? m.childClaim.steps : CHILD_STEPS_DEFAULT;
  const expireAt = computeChildExpireAt(m);

  const res: { expireAt?: number; remaining?: number; steps?: number } = { steps };
  if (typeof expireAt === "number") {
    res.expireAt = expireAt;
    if (typeof nowPulse === "number" && Number.isFinite(nowPulse)) {
      const remaining = Math.max(0, Math.floor(expireAt - nowPulse));
      res.remaining = Number.isFinite(remaining) ? remaining : undefined;
    }
  }
  return res;
}

/**
 * Resolve a ChakraDay from either chakraDay or chakraGate-like labels.
 * This strips the word "gate" so UI can display just the chakra name.
 */
export function resolveChakraDay(meta: Partial<SigilMetadata>): ChakraDay | null {
  // Prefer explicit chakraDay
  const fromDay = normalizeChakraDay(meta.chakraDay ?? "");
  if (fromDay) return fromDay;

  // Fallback to any "gate" label
  const fromGate = normalizeChakraDay(meta.chakraGate ?? "");
  if (fromGate) return fromGate;

  // Nothing resolvable
  return null;
}
