import type { SigilMetadata } from "./types";
import { hashAny } from "./sigilUtils";

/* ═════════════ OPTIONAL ZK: lightweight glue (no hard dep) ═════════════
   • If you have snarkjs installed, we’ll try to import it at runtime.
   • We look for a verifying key either in meta.zkVerifyingKey or window.SIGIL_ZK_VKEY.
   • Regardless, we bind proofs via hashes (public+proof+vkey) so lineage is immutable.
────────────────────────────────────────────────────────────────── */

declare global {
  interface Window {
    SIGIL_ZK_VKEY?: unknown;
    SIGIL_ZK?: {
      /** Return a Groth16 proof object for SEND (free shape; we hash it). */
      provideSendProof?: (ctx: {
        meta: SigilMetadata;
        leafHash: string; // sender-side leaf hash
        previousHeadRoot: string;
        nonce: string;
      }) => Promise<{ proof: unknown; publicSignals: unknown; vkey?: unknown } | null>;
      /** Return a Groth16 proof object for RECEIVE (free shape; we hash it). */
      provideReceiveProof?: (ctx: {
        meta: SigilMetadata;
        leafHash: string; // full leaf hash
        previousHeadRoot: string;
        linkSig: string; // senderSig from hardened entry
      }) => Promise<{ proof: unknown; publicSignals: unknown; vkey?: unknown } | null>;
    };
    snarkjs?: { groth16?: Groth16 };
  }
}

/* ─────────── Groth16 minimal structural types ─────────── */
export type JsonValue = string | number | boolean | null | { [k: string]: JsonValue } | JsonValue[];

export type Groth16VerifyingKey = { protocol?: "groth16"; curve?: string } & Record<string, JsonValue>;
export type Groth16Proof = Record<string, JsonValue>;
export type Groth16PublicSignals = readonly (string | number | bigint)[] | Record<string, string | number | bigint>;

/* Narrowing helpers */
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isScalar = (v: unknown): v is string | number | bigint => typeof v === "string" || typeof v === "number" || typeof v === "bigint";
function isVerifyingKey(v: unknown): v is Groth16VerifyingKey {
  return isObject(v); // permissive; we only need object shape
}
function isProof(v: unknown): v is Groth16Proof {
  return isObject(v);
}
function isPublicSignals(v: unknown): v is Groth16PublicSignals {
  if (Array.isArray(v)) return v.every(isScalar);
  if (!isObject(v)) return false;
  return Object.values(v).every((iscalar) => isScalar(iscalar));
}

export interface Groth16 {
  verify: (...args: unknown[]) => Promise<boolean> | boolean;
}

function isGroth16(x: unknown): x is Groth16 {
  return typeof x === "object" &&
    x !== null &&
    "verify" in x &&
    typeof (x as { verify?: unknown }).verify === "function";
}

async function loadGroth16(): Promise<Groth16 | null> {
  // try global
  if (typeof window !== "undefined" && window.snarkjs?.groth16 && isGroth16(window.snarkjs.groth16)) {
    return window.snarkjs.groth16;
  }
  // try dynamic import (optional)
  try {
    const spec = "snarkjs";
    type SnarkjsDynamic = { groth16?: unknown; default?: { groth16?: unknown } };
    const mod = (await import(/* @vite-ignore */ spec)) as unknown as SnarkjsDynamic;
    const candidate = mod.groth16 ?? mod.default?.groth16;
    if (isGroth16(candidate)) return candidate;
  } catch {
    /* optional */
  }
  return null;
}

/** Best-effort Groth16 verifier. Returns null if snarkjs is not available. */
export async function tryVerifyGroth16(args: {
  proof: unknown;
  publicSignals: unknown;
  vkey?: unknown;
  fallbackVkey?: unknown;
}): Promise<boolean | null> {
  const groth16 = await loadGroth16();
  if (!groth16) return null;

  const vkeyCandidate = args.vkey ?? args.fallbackVkey;
  if (!isVerifyingKey(vkeyCandidate)) return false;
  if (!isPublicSignals(args.publicSignals)) return false;
  if (!isProof(args.proof)) return false;

  const ok = await groth16.verify(
    vkeyCandidate as Groth16VerifyingKey,
    args.publicSignals as Groth16PublicSignals,
    args.proof as Groth16Proof
  );
  return !!ok;
}

/** Eagerly verify any ZK bundles on the head (best-effort, offline) */
export async function verifyZkOnHead(m: SigilMetadata): Promise<void> {
  const vkeyInline = m.zkVerifyingKey;
  const vkeyWindow = typeof window !== "undefined" ? window.SIGIL_ZK_VKEY : undefined;
  const fallbackVkey = vkeyInline ?? vkeyWindow;

  const hs = m.hardenedTransfers ?? [];
  for (let i = 0; i < hs.length; i++) {
    const t = hs[i];

    if (t.zkSendBundle) {
      const res = await tryVerifyGroth16({
        proof: t.zkSendBundle.proof,
        publicSignals: t.zkSendBundle.publicSignals,
        vkey: t.zkSendBundle.vkey,
        fallbackVkey,
      });
      if (t.zkSend) t.zkSend.verified = res === true;
    }
    if (t.zkReceiveBundle) {
      const res = await tryVerifyGroth16({
        proof: t.zkReceiveBundle.proof,
        publicSignals: t.zkReceiveBundle.publicSignals,
        vkey: t.zkReceiveBundle.vkey,
        fallbackVkey,
      });
      if (t.zkReceive) t.zkReceive.verified = res === true;
    }
  }
}
export { hashAny as __keep_hashAny };