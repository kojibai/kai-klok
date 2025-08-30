// sovereignVerifier.ts — v14 hardened + ZK bundle verifier
// Offline, zero network trust, no `any`, with Groth16 fallback
// - Verifies prev-head pinning, ECDSA signatures, and leaf-hash bindings
// - Recomputes ZK stamp hashes (public/proof/(vkey)) and checks them
// - Tries snarkjs.groth16.verify with vkey = bundle.vkey || head.zkVerifyingKey || window.SIGIL_ZK_VKEY
// - Sets zk*.verified = true on success

type HashHex = string;
type B64uSPKI = string;

export interface ZkBundle {
  scheme: "groth16" | string;
  curve?: string;                    // e.g. "BLS12-381"
  proof: unknown;
  publicSignals: unknown;
  vkey?: unknown;                    // optional inline vkey
}

export interface ZkStamp {
  scheme: "groth16" | "plonk" | string;
  curve?: string;                    // e.g. "BLS12-381"
  publicHash: HashHex;               // sha256(stable(publicSignals))
  proofHash: HashHex;                // sha256(stable(proof))
  vkeyHash?: HashHex;                // sha256(stable(vkey)) if provided / known
  verified?: boolean;                // set true by this verifier if proof checks out
}

export interface SigilTransfer {
  senderSignature: string;
  senderStamp: string;
  senderKaiPulse: number;
  payload?: { name: string; mime: string; size: number; encoded: string };
  receiverSignature?: string;
  receiverStamp?: string;
  receiverKaiPulse?: number;
}

export interface HardenedTransferV14 {
  previousHeadRoot: string;
  senderPubKey: B64uSPKI;
  senderSig: string;
  senderKaiPulse: number;
  nonce: string;

  transferLeafHashSend: HashHex;

  zkSend?: ZkStamp;
  zkSendBundle?: ZkBundle;

  receiverPubKey?: B64uSPKI;
  receiverSig?: string;
  receiverKaiPulse?: number;

  transferLeafHashReceive?: HashHex;

  zkReceive?: ZkStamp;
  zkReceiveBundle?: ZkBundle;
}

export interface SigilMetadata {
  ["@context"]?: string;
  type?: string;

  pulse?: number;
  beat?: number;
  stepIndex?: number;
  chakraDay?: string;

  kaiSignature?: string;
  userPhiKey?: string;

  creatorPublicKey?: string;

  transfers?: SigilTransfer[];

  // segments (for prevHead pinning)
  segments?: { index: number; root: HashHex; cid: HashHex; count: number }[];
  segmentsMerkleRoot?: HashHex;
  cumulativeTransfers?: number;

  // v14 hardened lineage
  hardenedTransfers?: HardenedTransferV14[];

  // Optional inline verifying key for ZK proofs
  zkVerifyingKey?: unknown;

  [k: string]: unknown;
}

// ────────────────────────────────────────────────────────────────
// utilities (stable stringify + hashing + ECDSA verify + helpers)
// ────────────────────────────────────────────────────────────────
function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(o[k])).join(",") + "}";
}

const b64u = {
  decode(s: string): Uint8Array {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
};

const bytesToHex = (u8: Uint8Array) => Array.from(u8).map((b) => b.toString(16).padStart(2, "0")).join("");

async function sha256Hex(msg: string | Uint8Array): Promise<string> {
  const data = typeof msg === "string" ? new TextEncoder().encode(msg) : msg;
  const buf = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(buf));
}

async function hashAny(x: unknown): Promise<HashHex> {
  return sha256Hex(stableStringify(x));
}

async function importPub(spki: ArrayBuffer) {
  return crypto.subtle.importKey("spki", spki, { name: "ECDSA", namedCurve: "P-256" }, true, ["verify"]);
}
async function verifySig(pubB64u: string, msg: Uint8Array, sigB64u: string): Promise<boolean> {
  const pub = await importPub(b64u.decode(pubB64u).buffer);
  return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pub, b64u.decode(sigB64u), msg);
}

// sender-only leaf
function minifyTransferSenderSide(t: SigilTransfer): string {
  const obj: Record<string, unknown> = {
    senderSignature: t.senderSignature,
    senderStamp: t.senderStamp,
    senderKaiPulse: t.senderKaiPulse,
  };
  if (t.payload) obj.payload = { name: t.payload.name, mime: t.payload.mime, size: t.payload.size };
  return JSON.stringify(obj);
}
async function hashTransferSenderSide(t: SigilTransfer): Promise<HashHex> {
  return sha256Hex(minifyTransferSenderSide(t));
}
// full leaf (after receive)
function minifyTransfer(t: SigilTransfer): string {
  const obj: Record<string, unknown> = {
    senderSignature: t.senderSignature,
    senderStamp: t.senderStamp,
    senderKaiPulse: t.senderKaiPulse,
  };
  if (t.payload) obj.payload = { name: t.payload.name, mime: t.payload.mime, size: t.payload.size };
  if (t.receiverSignature) obj.receiverSignature = t.receiverSignature;
  if (t.receiverStamp) obj.receiverStamp = t.receiverStamp;
  if (t.receiverKaiPulse != null) obj.receiverKaiPulse = t.receiverKaiPulse;
  return JSON.stringify(obj);
}
async function hashTransfer(t: SigilTransfer): Promise<HashHex> {
  return sha256Hex(minifyTransfer(t));
}

// deterministic head snapshot for v14 prevHead pinning
function sumSegments(meta: SigilMetadata) {
  return (meta.segments ?? []).reduce((a, s) => a + (s.count || 0), 0);
}
async function headCanonicalHashV14(meta: SigilMetadata, cumulativeOverride?: number): Promise<HashHex> {
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
async function expectedPrevHeadRootV14(meta: SigilMetadata, indexWithinWindow: number): Promise<HashHex> {
  const baseCum = sumSegments(meta);
  return headCanonicalHashV14(meta, baseCum + indexWithinWindow);
}

type ChakraDay =
  | "Root"
  | "Sacral"
  | "Solar Plexus"
  | "Heart"
  | "Throat"
  | "Third Eye"
  | "Crown";

function normalizeChakraDay(input?: string): ChakraDay {
  const map: Record<string, ChakraDay> = {
    root: "Root",
    sacral: "Sacral",
    "solar plexus": "Solar Plexus",
    heart: "Heart",
    throat: "Throat",
    "third eye": "Third Eye",
    crown: "Crown",
  };
  const key = (input ?? "").trim().toLowerCase();
  return map[key] ?? "Root";
}

function buildSendMessageV14(meta: SigilMetadata, args: {
  previousHeadRoot: string; senderKaiPulse: number; senderPubKey: B64uSPKI; nonce: string; transferLeafHashSend: HashHex;
}) {
  const body = {
    v: 1,
    type: "send" as const,
    sigil: {
      pulse: meta.pulse ?? 0,
      beat: meta.beat ?? 0,
      stepIndex: meta.stepIndex ?? 0,
      chakraDay: normalizeChakraDay(meta.chakraDay),
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

function buildReceiveMessageV14(args: {
  previousHeadRoot: string; senderSig: string; receiverKaiPulse: number; receiverPubKey: B64uSPKI; transferLeafHashReceive: HashHex;
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

// ────────────────────────────────────────────────────────────────
// Groth16 typings + loader (no `any`)
// ────────────────────────────────────────────────────────────────
type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [k: string]: JsonValue }
  | JsonValue[];

type Groth16VerifyingKey = { protocol?: "groth16"; curve?: string } & Record<string, JsonValue>;
type Groth16Proof = Record<string, JsonValue>;
type Groth16PublicSignals =
  | readonly (string | number | bigint)[]
  | Record<string, string | number | bigint>;

type Groth16 = {
  verify: (
    vkey: Groth16VerifyingKey,
    publicSignals: Groth16PublicSignals,
    proof: Groth16Proof
  ) => Promise<boolean>;
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function isScalar(v: unknown): v is string | number | bigint {
  return typeof v === "string" || typeof v === "number" || typeof v === "bigint";
}
function isPublicSignals(v: unknown): v is Groth16PublicSignals {
  if (Array.isArray(v)) return v.every(isScalar);
  return isObject(v) && Object.values(v).every(isScalar);
}
function isVerifyingKey(v: unknown): v is Groth16VerifyingKey {
  return isObject(v);
}
function isProofObject(v: unknown): v is Groth16Proof {
  return isObject(v);
}
function getProp<T = unknown>(obj: unknown, key: string): T | undefined {
  if (!isObject(obj)) return undefined;
  return obj[key] as T | undefined;
}
function isGroth16(x: unknown): x is Groth16 {
  return isObject(x) && typeof getProp<(vkey: Groth16VerifyingKey, s: Groth16PublicSignals, p: Groth16Proof) => Promise<boolean>>(x, "verify") === "function";
}

declare global {
  interface Window {
    SIGIL_ZK_VKEY?: unknown;
  }
}

async function loadGroth16(): Promise<Groth16 | null> {
  // global (CDN script)
  const fromWindow = typeof window !== "undefined" ? window.snarkjs?.groth16 : undefined;
  if (isGroth16(fromWindow)) return fromWindow;

  // dynamic import (optional)
  try {
    const spec = "snarkjs";
    const mod: unknown = await import(/* @vite-ignore */ spec);
    const g = getProp<unknown>(mod, "groth16") ??
              getProp<unknown>(getProp<unknown>(mod, "default"), "groth16");
    if (isGroth16(g)) return g;
  } catch {
    /* optional */
  }
  return null;
}

async function groth16VerifyWithFallback(args: {
  proof: unknown;
  publicSignals: unknown;
  vkeyInline?: unknown;
  vkeyBundle?: unknown;
  vkeyWindow?: unknown;
}): Promise<boolean | null> {
  const groth16 = await loadGroth16();
  if (!groth16) return null;

  const vkey = args.vkeyBundle ?? args.vkeyInline ?? args.vkeyWindow;
  if (!isVerifyingKey(vkey)) return false;
  if (!isPublicSignals(args.publicSignals) || !isProofObject(args.proof)) return false;

  try {
    return await groth16.verify(vkey, args.publicSignals, args.proof);
  } catch {
    return false;
  }
}

// ────────────────────────────────────────────────────────────────
export type VerifyIssue = {
  kind:
    | "prevHeadMismatch"
    | "sendLeafMismatch"
    | "receiveLeafMismatch"
    | "sendSigInvalid"
    | "receiveSigInvalid"
    | "zkSendStampHashMismatch"
    | "zkReceiveStampHashMismatch"
    | "zkSendFailed"
    | "zkReceiveFailed"
    | "zkUnavailable";
  index: number;       // transfer index
  note?: string;
};

export type VerifyReport = {
  ok: boolean;
  count: number;
  issues: VerifyIssue[];
  zk: {
    sendVerified: number;
    receiveVerified: number;
    unavailable: boolean;
  };
};

/**
 * Fully offline verifier for your v14 lineage + exact ZK bundles.
 * - Verifies prev-head pinning and ECDSA signatures.
 * - Recomputes leaf hashes and checks they match.
 * - For each zk*Bundle:
 *    • recomputes publicHash/proofHash/(vkeyHash) and checks against zk* stamp
 *    • uses snarkjs with vkey = bundle.vkey || head.zkVerifyingKey || window.SIGIL_ZK_VKEY
 *    • sets zk*.verified = true on success
 */
export async function verifySovereignOffline(head: SigilMetadata): Promise<VerifyReport> {
  const issues: VerifyIssue[] = [];
  const transfers = head.hardenedTransfers ?? [];
  const legacyWindow = head.transfers ?? [];
  const vkeyInline = head.zkVerifyingKey;
  const vkeyWindow: unknown = typeof window !== "undefined" ? window.SIGIL_ZK_VKEY : undefined;

  let sendVerified = 0;
  let recvVerified = 0;

  for (let i = 0; i < transfers.length; i++) {
    const ht = transfers[i];
    const win = legacyWindow[i];

    // 1) prev-head pinning
    const expectPrev = await expectedPrevHeadRootV14(head, i);
    if (ht.previousHeadRoot !== expectPrev) {
      issues.push({ kind: "prevHeadMismatch", index: i, note: "previousHeadRoot != expected snapshot" });
      continue; // cannot trust anything after a broken pin
    }

    // 2) leaf binding checks (against legacy window if present)
    if (win) {
      const expectSendLeaf = await hashTransferSenderSide(win);
      if (ht.transferLeafHashSend !== expectSendLeaf) {
        issues.push({ kind: "sendLeafMismatch", index: i });
        continue;
      }
      if (ht.receiverSig) {
        const expectRecvLeaf = await hashTransfer(win);
        if (ht.transferLeafHashReceive !== expectRecvLeaf) {
          issues.push({ kind: "receiveLeafMismatch", index: i });
          continue;
        }
      }
    }

    // 3) ECDSA SEND signature (always required)
    {
      const msgS = buildSendMessageV14(head, {
        previousHeadRoot: ht.previousHeadRoot,
        senderKaiPulse: ht.senderKaiPulse ?? 0,
        senderPubKey: ht.senderPubKey ?? "",
        nonce: ht.nonce ?? "",
        transferLeafHashSend: ht.transferLeafHashSend ?? "",
      });
      const okSend = ht.senderPubKey ? await verifySig(ht.senderPubKey, msgS, ht.senderSig) : false;
      if (!okSend) {
        issues.push({ kind: "sendSigInvalid", index: i });
        continue;
      }
    }

    // 4) ECDSA RECEIVE signature (if present)
    if (ht.receiverSig && ht.receiverPubKey) {
      const msgR = buildReceiveMessageV14({
        previousHeadRoot: ht.previousHeadRoot,
        senderSig: ht.senderSig,
        receiverKaiPulse: ht.receiverKaiPulse ?? 0,
        receiverPubKey: ht.receiverPubKey,
        transferLeafHashReceive: ht.transferLeafHashReceive ?? "",
      });
      const okRecv = await verifySig(ht.receiverPubKey, msgR, ht.receiverSig);
      if (!okRecv) {
        issues.push({ kind: "receiveSigInvalid", index: i });
        continue;
      }
    }

    // 5) ZK SEND (optional)
    if (ht.zkSendBundle) {
      const publicHash = await hashAny(ht.zkSendBundle.publicSignals);
      const proofHash = await hashAny(ht.zkSendBundle.proof);
      const vkeyEff = ht.zkSendBundle.vkey ?? vkeyInline ?? vkeyWindow;
      const vkeyHash = vkeyEff ? await hashAny(vkeyEff) : undefined;

      if (ht.zkSend) {
        if (ht.zkSend.publicHash !== publicHash || ht.zkSend.proofHash !== proofHash ||
            (ht.zkSend.vkeyHash && vkeyHash && ht.zkSend.vkeyHash !== vkeyHash)) {
          issues.push({ kind: "zkSendStampHashMismatch", index: i, note: "stamp hashes don’t match bundle" });
        }
      }

      const res = await groth16VerifyWithFallback({
        proof: ht.zkSendBundle.proof,
        publicSignals: ht.zkSendBundle.publicSignals,
        vkeyInline,
        vkeyBundle: ht.zkSendBundle.vkey,
        vkeyWindow,
      });

      if (res === true) {
        if (ht.zkSend) ht.zkSend.verified = true;
        sendVerified++;
      } else if (res === null) {
        issues.push({ kind: "zkUnavailable", index: i, note: "snarkjs not available" });
      } else {
        issues.push({ kind: "zkSendFailed", index: i });
      }
    }

    // 6) ZK RECEIVE (optional)
    if (ht.zkReceiveBundle) {
      const publicHash = await hashAny(ht.zkReceiveBundle.publicSignals);
      const proofHash = await hashAny(ht.zkReceiveBundle.proof);
      const vkeyEff = ht.zkReceiveBundle.vkey ?? vkeyInline ?? vkeyWindow;
      const vkeyHash = vkeyEff ? await hashAny(vkeyEff) : undefined;

      if (ht.zkReceive) {
        if (ht.zkReceive.publicHash !== publicHash || ht.zkReceive.proofHash !== proofHash ||
            (ht.zkReceive.vkeyHash && vkeyHash && ht.zkReceive.vkeyHash !== vkeyHash)) {
          issues.push({ kind: "zkReceiveStampHashMismatch", index: i, note: "stamp hashes don’t match bundle" });
        }
      }

      const res = await groth16VerifyWithFallback({
        proof: ht.zkReceiveBundle.proof,
        publicSignals: ht.zkReceiveBundle.publicSignals,
        vkeyInline,
        vkeyBundle: ht.zkReceiveBundle.vkey,
        vkeyWindow,
      });

      if (res === true) {
        if (ht.zkReceive) ht.zkReceive.verified = true;
        recvVerified++;
      } else if (res === null) {
        issues.push({ kind: "zkUnavailable", index: i, note: "snarkjs not available" });
      } else {
        issues.push({ kind: "zkReceiveFailed", index: i });
      }
    }
  }

  return {
    ok: issues.length === 0,
    count: transfers.length,
    issues,
    zk: {
      sendVerified,
      receiveVerified: recvVerified,
      unavailable: issues.some(i => i.kind === "zkUnavailable"),
    },
  };
}
