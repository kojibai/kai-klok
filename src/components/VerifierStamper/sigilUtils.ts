import { SIGIL_CTX, SIGIL_TYPE } from "./constants";
import type {
  SigilTransfer,
  HashHex,
  SigilMetadata,
  HardenedTransferV14,
  SegmentEntry,
  ChakraDay,
} from "./types";
import { base58Check, sha256Hex } from "./crypto";
import { buildMerkleRoot } from "./merkle";
import { normalizeChakraDay } from "./types";

/* ──────────────────────────────────────────────────────────────
   Sentinels to *use* imported constants/types without changing behavior
   (keeps ESLint/TS happy while preserving the exact surface + features)
──────────────────────────────────────────────────────────────── */
export const SIGIL_SCHEMA = { CTX: SIGIL_CTX, TYPE: SIGIL_TYPE } as const;

// exported type aliases keep type-only imports "used" with verbatimModuleSyntax
export type __Keep_HardenedTransferV14 = HardenedTransferV14;
export type __Keep_SegmentEntry = SegmentEntry;

/** Optional tiny helper that legitimately uses the schema constants. */
export function isSigilMetaOk(meta: Pick<SigilMetadata, "@context" | "type">): boolean {
  return (
    (!meta["@context"] || meta["@context"] === SIGIL_SCHEMA.CTX) &&
    (!meta.type || meta.type === SIGIL_SCHEMA.TYPE)
  );
}

/* v14: deterministic snapshot for prev-head pinning (parallel; does not change legacy) */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(o[k])).join(",") + "}";
}

export async function computeKaiSignature(meta: SigilMetadata): Promise<string | null> {
  const { pulse, beat, stepIndex, chakraDay } = meta;
  if (
    typeof pulse !== "number" ||
    typeof beat !== "number" ||
    typeof stepIndex !== "number" ||
    typeof chakraDay !== "string"
  ) {
    return null;
  }
  const base = `${pulse}|${beat}|${stepIndex}|${chakraDay}|${meta.intentionSigil ?? ""}`;
  return sha256Hex(base);
}

/* derive PhiKey from kaiSignature (legacy) */
export async function derivePhiKeyFromSig(sig: string): Promise<string> {
  const s = await sha256Hex(sig + "φ");
  const raw = new Uint8Array(20);
  for (let i = 0; i < 20; i++) raw[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return base58Check(raw, 0x00);
}

function minifyTransfer(t: SigilTransfer): Record<string, unknown> {
  const obj: Record<string, unknown> = {
    senderSignature: t.senderSignature,
    senderStamp: t.senderStamp,
    senderKaiPulse: t.senderKaiPulse,
  };
  if (t.payload) obj.payload = { name: t.payload.name, mime: t.payload.mime, size: t.payload.size };
  if (t.receiverSignature) obj.receiverSignature = t.receiverSignature;
  if (t.receiverStamp) obj.receiverStamp = t.receiverStamp;
  if (t.receiverKaiPulse != null) obj.receiverKaiPulse = t.receiverKaiPulse;
  return obj;
}
export async function hashTransfer(t: SigilTransfer): Promise<HashHex> {
  return sha256Hex(JSON.stringify(minifyTransfer(t)));
}

/* Sender-side-only leaf (stable across receive) */
function minifyTransferSenderSide(t: SigilTransfer): Record<string, unknown> {
  const obj: Record<string, unknown> = {
    senderSignature: t.senderSignature,
    senderStamp: t.senderStamp,
    senderKaiPulse: t.senderKaiPulse,
  };
  if (t.payload) obj.payload = { name: t.payload.name, mime: t.payload.mime, size: t.payload.size };
  return obj;
}
export async function hashTransferSenderSide(t: SigilTransfer): Promise<HashHex> {
  return sha256Hex(JSON.stringify(minifyTransferSenderSide(t)));
}

export async function computeHeadWindowRoot(transfers: SigilTransfer[]): Promise<HashHex> {
  const leaves = await Promise.all(transfers.map(hashTransfer));
  return buildMerkleRoot(leaves);
}

export async function headCanonicalHashV14(meta: SigilMetadata, cumulativeOverride?: number): Promise<HashHex> {
  const snapshot = {
    pulse: meta.pulse ?? 0,
    beat: meta.beat ?? 0,
    stepIndex: meta.stepIndex ?? 0,
    chakraDay: meta.chakraDay ?? "",
    kaiSignature: meta.kaiSignature ?? "",
    creatorPublicKey: meta.creatorPublicKey ?? "",
    cumulativeTransfers: (cumulativeOverride ?? meta.cumulativeTransfers) ?? 0,
    segments: (meta.segments ?? []).map((s) => ({ index: s.index, root: s.root, cid: s.cid, count: s.count })),
    segmentsMerkleRoot: meta.segmentsMerkleRoot ?? "",
  };
  return sha256Hex(stableStringify(snapshot));
}
export function sumSegments(meta: SigilMetadata) {
  return (meta.segments ?? []).reduce((a, s) => a + (s.count || 0), 0);
}
export async function expectedPrevHeadRootV14(meta: SigilMetadata, indexWithinWindow: number): Promise<HashHex> {
  const baseCum = sumSegments(meta);
  return headCanonicalHashV14(meta, baseCum + indexWithinWindow);
}

export function buildSendMessageV14(
  meta: SigilMetadata,
  args: {
    previousHeadRoot: string;
    senderKaiPulse: number;
    senderPubKey: string; // B64uSPKI
    nonce: string;
    transferLeafHashSend: HashHex;
  }
) {
  const chakraDay: ChakraDay = normalizeChakraDay(meta.chakraDay) ?? "Root";
  const body = {
    v: 1,
    type: "send" as const,
    sigil: {
      pulse: meta.pulse ?? 0,
      beat: meta.beat ?? 0,
      stepIndex: meta.stepIndex ?? 0,
      chakraDay,
      kaiSignature: meta.kaiSignature ?? "",
    },
    previousHeadRoot: args.previousHeadRoot,
    senderKaiPulse: args.senderKaiPulse,
    senderPubKey: args.senderPubKey,
    nonce: args.nonce,
    transferLeafHashSend: args.transferLeafHashSend,
  };
  return new TextEncoder().encode(stableStringify(body));
}
export function buildReceiveMessageV14(args: {
  previousHeadRoot: string;
  senderSig: string;
  receiverKaiPulse: number;
  receiverPubKey: string; // B64uSPKI
  transferLeafHashReceive: HashHex;
}) {
  const body = {
    v: 1,
    type: "receive" as const,
    link: args.senderSig,
    previousHeadRoot: args.previousHeadRoot,
    receiverKaiPulse: args.receiverKaiPulse,
    receiverPubKey: args.receiverPubKey,
    transferLeafHashReceive: args.transferLeafHashReceive,
  };
  return new TextEncoder().encode(stableStringify(body));
}

export async function headCanonicalHash(meta: SigilMetadata): Promise<HashHex> {
  const snapshot = JSON.stringify({
    pulse: meta.pulse,
    beat: meta.beat,
    stepIndex: meta.stepIndex,
    chakraDay: meta.chakraDay,
    kaiSignature: meta.kaiSignature,
    userPhiKey: meta.userPhiKey,
    cumulativeTransfers: meta.cumulativeTransfers ?? 0,
    segments: (meta.segments ?? []).map((s) => ({ index: s.index, root: s.root, cid: s.cid, count: s.count })),
    segmentsMerkleRoot: meta.segmentsMerkleRoot ?? "",
  });
  return sha256Hex(snapshot);
}

/* ──────────────────────────────────────────────────────────────
   SigilPage-style helpers for share URL construction
────────────────────────────────────────────────────────────── */

export function base64urlJson(obj: unknown): string {
  const json = JSON.stringify(obj);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** quick random 16-byte token (hex) */
export function genNonce() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* A tiny helper some verifiers use without importing crypto.ts directly */
export async function hashAny(x: unknown): Promise<HashHex> {
  return sha256Hex(stableStringify(x));
}
// types.ts (or inline)
export interface SigilMeta {
  pulse: number;
  beat: number;
  stepIndex: number;
  chakraDay: string;
  kaiSignature: string;
  userPhiKey: string;
  [key: string]: unknown; // optional: allow future fields
}
export async function derivePhiKeyFromMeta(meta: SigilMeta): Promise<string> {
  const json = JSON.stringify(meta);
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(json));
  return [...new Uint8Array(hashBuffer)].map(b => b.toString(16).padStart(2, "0")).join("");
}
