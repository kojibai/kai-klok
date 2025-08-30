/* ═════════════════ TYPES ═════════════════ */

export interface SigilPayload {
  name: string;
  mime: string;
  size: number;
  encoded: string; // base64 (no data: prefix)
}

export interface SigilTransfer {
  // Sender side
  senderSignature: string;
  senderStamp: string; // hash(liveSig|meta.pulse|nowPulse)
  senderKaiPulse: number;

  // Optional payload (filename/mime/size only kept in metadata; bytes in payload.encoded)
  payload?: SigilPayload;

  // Receiver side (present only after receive)
  receiverSignature?: string;
  receiverStamp?: string; // hash(receiverSig|senderStamp|nowPulse)
  receiverKaiPulse?: number;
}

/* ───────────────── v14 add-only hardened lineage ─────────────── */
export type B64uSPKI = string;
export type HashHex = string;

/** Full ZK bundle (optional) kept alongside stamps for full offline verification */
export interface ZkBundle {
  scheme: "groth16" | string;
  curve?: string; // e.g. "BLS12-381"
  proof: unknown;
  publicSignals: unknown;
  vkey?: unknown; // optional inline vkey
}

/** Minimal ZK stamp bound to the leaf to keep lineage tiny/immutable */
export interface ZkStamp {
  scheme: "groth16" | "plonk" | string;
  curve?: string; // e.g. "BLS12-381"
  publicHash: HashHex; // sha256(stable(publicSignals))
  proofHash: HashHex; // sha256(stable(proof))
  vkeyHash?: HashHex; // sha256(stable(vkey)) if provided
  verified?: boolean; // set by offline verifier
}

/** Canonical, signed lineage (kept in parallel; legacy untouched) */
export interface HardenedTransferV14 {
  previousHeadRoot: string; // head snapshot hash *before* this transfer
  senderPubKey: B64uSPKI; // base64url(SPKI)
  senderSig: string; // base64url(ECDSA over canonical SEND)
  senderKaiPulse: number;
  nonce: string; // random 16B hex captured at send-time

  // Bind legacy window content immutably
  transferLeafHashSend: HashHex; // hash over sender-side leaf (sender fields + payload only)

  // Optional ZK proof & stamp for SEND (bound to sender-side leaf)
  zkSend?: ZkStamp;
  zkSendBundle?: ZkBundle;

  // Receive seal (optional if accepted)
  receiverPubKey?: B64uSPKI; // base64url(SPKI)
  receiverSig?: string; // base64url(ECDSA over canonical RECEIVE)
  receiverKaiPulse?: number;

  // Full leaf after receive (includes receiver fields)
  transferLeafHashReceive?: HashHex;

  // Optional ZK proof & stamp for RECEIVE (bound to full leaf)
  zkReceive?: ZkStamp;
  zkReceiveBundle?: ZkBundle;
}

/* ── Segments & proofs (head stays tiny, history is archived) */
export interface SegmentEntry {
  index: number; // 0..N
  root: HashHex; // merkle root over that segment's transfers
  cid: HashHex; // SHA-256 of the segment JSON blob
  count: number; // transfers in this segment
}

export interface SegmentFile {
  version: 1;
  segmentIndex: number;
  segmentRange: [number, number]; // global index range [start, end]
  segmentRoot: HashHex;
  headHashAtSeal: HashHex; // hash of head snapshot when sealed
  leafHash: "sha256";
  transfers: SigilTransfer[]; // frozen
}

export interface TransferProof {
  leaf: HashHex; // hash(transfer-json-minified)
  index: number; // leaf index within the window/segment
  siblings: HashHex[]; // path to root (bottom-up)
}

export interface SegmentProofBundle {
  kind: "segment";
  segmentIndex: number;
  segmentRoot: HashHex;
  transferProof: TransferProof; // proves transfer ∈ segmentRoot
  segmentsSiblings: HashHex[]; // proves segmentRoot ∈ head.segmentsMerkleRoot
  headHashAtSeal: HashHex;
}

export interface HeadWindowProofBundle {
  kind: "head";
  windowMerkleRoot: HashHex; // head-window root
  transferProof: TransferProof; // proves transfer ∈ window root
}

export interface SigilMetadata {
  ["@context"]?: string;
  type?: string;

  pulse?: number;
  beat?: number;
  stepIndex?: number;
  chakraDay?: string;
  chakraGate?: string;
  frequencyHz?: number;

  kaiPulse?: number;
  kaiSignature?: string;
  userPhiKey?: string;
  intentionSigil?: string;

  creatorPublicKey?: string; // (optional) base64url(SPKI). UI never labels this "public key"
  origin?: string;

  kaiPulseToday?: number;
  kaiMomentSummary?: string;

  transfers?: SigilTransfer[];

  // Segmented history (new)
  segmentSize?: number; // policy (default SEGMENT_SIZE)
  segments?: SegmentEntry[]; // archived segments (roots + counts + cids)
  segmentsMerkleRoot?: HashHex; // root over SegmentEntry.root (ordered by index)
  transfersWindowRoot?: HashHex; // merkle root over current head-window transfers
  cumulativeTransfers?: number; // total transfers across segments + head-window
  headHashAtSeal?: HashHex; // last head snapshot hash at segment seal

  // page-style extras
  canonicalHash?: string;
  transferNonce?: string;

  /* v14 parallel hardened lineage (add-only; legacy untouched) */
  hardenedTransfers?: HardenedTransferV14[];
  transfersWindowRootV14?: HashHex;

  /* Optional inline verifying key for ZK proofs (non-breaking) */
  zkVerifyingKey?: unknown;

  [k: string]: unknown;
}

export type UiState =
  | "idle"
  | "invalid"
  | "structMismatch"
  | "sigMismatch"
  | "notOwner"
  | "unsigned"
  | "readySend"
  | "readyReceive"
  | "complete"
  | "verified";

export type TabKey = "summary" | "lineage" | "data";

/* ChakraDay helper (to satisfy SigilSharePayloadLoose['chakraDay']) */
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

export function normalizeChakraDay(input: unknown): ChakraDay | null {
  if (typeof input !== "string") return null;
  const key = input.trim().toLowerCase();
  return CHAKRA_DAY_MAP[key] ?? null;
}
