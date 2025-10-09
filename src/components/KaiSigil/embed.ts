import { canonicalize } from "../../lib/sigil/canonicalize";
import { blake3Hex } from "../../lib/sigil/hash";
import { gzipB64 } from "../../lib/sigil/codec";
import {
  getSigner,
  signHash as signWithProvider,
  type HarmonicSig,
} from "../../lib/sigil/signature";
import { generateKeyPair, signCanonicalMessage } from "../../lib/sigil/breathProof";

import { createLedger, packLedger } from "../../lib/ledger/log";
import type { MintEntry } from "../../lib/ledger/types";
import { buildDhtBlock } from "../../lib/sync/dht";
import { ipfs } from "../../lib/sync/ipfsAdapter";

import {
  base58Encode,
  b64ToUint8,
  crc32,
  hexToBytes,
  sha256,
  toBufferSource,
} from "./crypto";
import { clean, type JSONDict } from "./utils";
import { jwkToJSONLike } from "./identity";
import type { Built, SigilPayloadExtended, ChakraDayKey } from "./types";
import type { SigilMetadataLite } from "../../utils/valuation";

/** NEW: use the same URL builder as the modal (coherent share URL) */
import { makeSigilUrl, type SigilSharePayload } from "../../utils/sigilUrl";

/** Narrow, re-usable return type that references `Built` so the import is used. */
export type EmbeddedBundleResult = Pick<
  Built,
  "payloadHashHex" | "sigilUrl" | "hashB58" | "innerRingText"
> & {
  parityUrl: string;   // kept for backward compatibility; now equals manifest URL
  embeddedBase: unknown;
};

/** Map internal ChakraDayKey -> canonical SigilSharePayload["chakraDay"] label */
const chakraFromKey = (k: string): SigilSharePayload["chakraDay"] => {
  const s = (k || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (s === "root") return "Root";
  if (s === "sacral") return "Sacral";
  if (s === "solar plexus" || s === "solarplexus") return "Solar Plexus";
  if (s === "heart") return "Heart";
  if (s === "throat") return "Throat";
  if (s === "third eye" || s === "thirdeye" || s === "third-eye") return "Third Eye";
  return "Crown";
};

export async function buildEmbeddedBundle(args: {
  canon: {
    pulse: number;
    beat: number;
    stepIndex: number;        // ← KKS step (0..43) captured atomically
    chakraDayKey: ChakraDayKey;
    stepsPerBeat: number;     // 44
  };
  hashMode: "moment" | "deterministic";
  chakraGate: string;
  kaiSignature?: string | undefined;
  userPhiKey?: string | undefined;
  intentionSigil?: string | undefined;
  origin?: string | undefined;
  title: string;
  klockSnapshot?: Record<string, unknown> | null;
  kaiApiSnapshot?: Record<string, unknown> | null;
  weekdayResolved?: string | null;
  valuationSource: SigilMetadataLite;
  mintSeal: SigilMetadataLite | null; // can be embedded here or by caller
  frequencyHzCurrent: number;
  qrHref?: string | undefined;
  canonicalUrlFromContext: (hashHex: string, base: string) => string;
  creatorResolved: { creator: string; creatorAlg: string; creatorId: string };
}): Promise<EmbeddedBundleResult> {
  const {
    canon,
    hashMode,
    chakraGate,
    kaiSignature,
    userPhiKey,
    origin,
    title,
    weekdayResolved,
    valuationSource,
    mintSeal,
    frequencyHzCurrent,
    // qrHref, canonicalUrlFromContext — no longer used to compose the share URL,
    // but kept in the signature for compatibility.
    creatorResolved,
  } = args;

  const nowIso = new Date().toISOString();
  const includeTimestamp = (hashMode ?? "moment") === "moment";

  const headerBase = {
    v: "1.0",
    title,
    creator: creatorResolved.creator,
    creatorAlg: creatorResolved.creatorAlg,
    creatorId: creatorResolved.creatorId,
    pulse: canon.pulse,
    ...(includeTimestamp ? { timestamp: nowIso } : {}),
  } as const;

  const eternalRecord =
    clean(title, 300) ??
    `Day Seal: ${canon.beat}:${canon.stepIndex} • Kai-Pulse ${canon.pulse}`;

  const payloadObj: SigilPayloadExtended = {
    v: "1.0",
    kaiSignature: kaiSignature ?? "",
    phikey: userPhiKey ?? "",
    pulse: canon.pulse,
    beat: canon.beat,
    stepIndex: canon.stepIndex,         // ← KKS step kept exactly
    chakraDay: canon.chakraDayKey,
    chakraGate,
    kaiPulse: canon.pulse,
    stepsPerBeat: canon.stepsPerBeat,
    ...(includeTimestamp ? { timestamp: nowIso } : {}),
    eternalRecord,
    creatorResolved: headerBase.creator,
    origin:
      origin ?? (typeof window !== "undefined" ? window.location.origin : ""),
    proofHints: {
      scheme: "groth16-poseidon",
      api: "/api/proof/sigil",
      explorer: `/explorer/hash/<hash>`,
    },
    zkPoseidonHash:
      "7110303097080024260800444665787206606103183587082596139871399733998958991511",
    zkProof: {
      pi_a: ["1985613...27250", "1010639...44602", "1"],
      pi_b: [
        ["1533282...09373", "5207800...48361"],
        ["1976559...93879", "1852385...5266"],
        ["1", "0"],
      ],
      pi_c: ["1756353...9777", "8962254...24426", "1"],
    },
  };

  // Canonical (signature/commit) payload — this is what’s hashed
  const canonicalPayload: JSONDict = {
    v: payloadObj.v,
    kaiSignature: payloadObj.kaiSignature,
    phikey: payloadObj.phikey,
    pulse: payloadObj.pulse,
    beat: payloadObj.beat,
    stepIndex: payloadObj.stepIndex, // ← same step
    chakraDay: payloadObj.chakraDay,
    chakraGate: payloadObj.chakraGate,
    kaiPulse: payloadObj.kaiPulse,
    stepsPerBeat: payloadObj.stepsPerBeat,
    timestamp: payloadObj.timestamp,
    eternalRecord: payloadObj.eternalRecord,
    creatorResolved: payloadObj.creatorResolved,
    origin: payloadObj.origin,
    proofHints: payloadObj.proofHints,
    zkPoseidonHash: payloadObj.zkPoseidonHash,
    zkProof: payloadObj.zkProof,
    ownerPubKey: payloadObj.ownerPubKey
      ? jwkToJSONLike(payloadObj.ownerPubKey)
      : undefined,
    ownerSig: payloadObj.ownerSig,
  };

  const canonicalBytes = canonicalize(canonicalPayload);
  const hashHexRaw = await blake3Hex(canonicalBytes);
  const hashHex = hashHexRaw.toLowerCase();

  // Secondary SHA-256 integrity
  const hashSha256Hex = Array.from(await sha256(canonicalBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const payloadB64 = gzipB64(canonicalBytes);

  let payloadSignature: HarmonicSig | undefined;
  const signer = getSigner();
  if (signer) payloadSignature = await signWithProvider(hashHex);

  const integrity = {
    payloadEncoding: "gzip+base64",
    payloadHash: { alg: "blake3", value: hashHex },
    payloadHashSecondary: { alg: "sha256", value: hashSha256Hex },
    payloadSignature:
      payloadSignature ?? {
        alg: "harmonic-sig",
        public: userPhiKey ?? creatorResolved.creatorId,
        value: "",
      },
  } as const;

  // Canonicalize a ledger event message for owner signing
  const canonicalMsg = canonicalize({
    parentCanonical: "optional-parent-ref",
    parentStateRoot: "optional-state-root",
    eventKind: "mint",
    pulse: canon.pulse,
    beat: canon.beat,
    stepIndex: canon.stepIndex,     // ← same step
    chakraDay: canon.chakraDayKey,
    childNonce: `${canon.beat}-${canon.stepIndex}`,
    amount: "1.000",
    expiresAtPulse: canon.pulse + 12,
    lineageCommitment: "optional-hash-of-lineage",
  });

  const { publicKeyJwk, privateKey } = await generateKeyPair();
  const ownerSig = await signCanonicalMessage(
    privateKey,
    toBufferSource(canonicalMsg)
  );
  payloadObj.ownerPubKey = publicKeyJwk;
  payloadObj.ownerSig = ownerSig;

  /**
   * ─────────────────────────────────────────────────────────────
   * Build the **manifest URL** exactly like the modal does,
   * carrying the same KKS step (canon.stepIndex) in the payload.
   * ─────────────────────────────────────────────────────────────
   */
  const manifestPayload: SigilSharePayload & {
    canonicalHash: string;
    exportedAt: string;
    expiresAtPulse: number;
  } = {
    pulse: canon.pulse,
    beat: canon.beat,
    stepIndex: canon.stepIndex,                    // ← exact KKS (0-based)
    chakraDay: chakraFromKey(String(canon.chakraDayKey)),
    stepsPerBeat: canon.stepsPerBeat,
    canonicalHash: hashHex,
    exportedAt: nowIso,
    expiresAtPulse: canon.pulse + 11,
    kaiSignature: kaiSignature ?? undefined,
    userPhiKey: userPhiKey ?? undefined,
  };

  const manifestUrl = makeSigilUrl(hashHex, manifestPayload);

  // Ledger + DHT
  const mintEntry: MintEntry = {
    v: 1,
    pulse: canon.pulse,
    beat: canon.beat,
    stepIndex: canon.stepIndex,
    chakraDay: canon.chakraDayKey,
    stepsPerBeat: canon.stepsPerBeat,
    kaiSignature: kaiSignature ?? undefined,
    userPhiKey: userPhiKey ?? undefined,
    ts: nowIso,
  };

  const ledger = await createLedger([mintEntry]);
  const packed = await packLedger(ledger);
  const packedBytes = b64ToUint8(packed.payload);

  const dhtBlock = await buildDhtBlock({
    ipfs,
    packedLedgerBytes: packedBytes,
    prevCid: undefined,
    pubKeyJwk: payloadObj.ownerPubKey,
    merkleRoot: ledger.root,
    pulse: canon.pulse,
    sign: async (msg: Uint8Array) => {
      const sigBuf = await crypto.subtle.sign(
        (privateKey as CryptoKey).algorithm,
        privateKey as CryptoKey,
        msg
      );
      return new Uint8Array(sigBuf);
    },
  });

  // Header.shareUrl now points to the manifest URL (coherent with modal + SVG metadata)
  const header = { ...headerBase, shareUrl: manifestUrl };

  // Build the embedded base object. Include frequency and (optionally) valuation snapshots.
  const embeddedBase = {
    $schema: "https://atlantean.lumitech/schemas/kai-sigil/1.0.json",
    contentType: "application/vnd.kai-sigil+json;v=1",
    header,
    payload: payloadB64,
    integrity,
    frequencyHzAtMint: frequencyHzCurrent,
    valuationSource: valuationSource ?? null,
    valuationSeal: mintSeal ?? null,
  };

  const len = canonicalBytes.length;
  const crcHex = crc32(canonicalBytes).toString(16).padStart(8, "0");
  const hashB58 = base58Encode(hexToBytes(hashHex));
  const creatorShort = creatorResolved.creatorId.slice(0, 12);
  const zkShort = String(payloadObj.zkPoseidonHash).slice(0, 12);

  // Inner-ring text now also uses the manifest URL for `u=`
  const inner = [
    `u=${manifestUrl}`,
    `b58=${hashB58}`,
    `len=${len}`,
    `crc32=${crcHex}`,
    `creator=${creatorShort}`,
    `zk=${zkShort}`,
    `alg=${creatorResolved.creatorAlg}`,
  ].join(" · ");

  const meta = {
    ...embeddedBase,
    // caller-visible extras
    ledger: packed,
    dht: dhtBlock,
    weekdayResolved: weekdayResolved ?? null,
  };

  return {
    // Keep the name for API compatibility, but this is the canonical manifest URL now.
    parityUrl: manifestUrl,
    payloadHashHex: hashHex,
    innerRingText: inner,
    // Also return the same URL here so all consumers align.
    sigilUrl: manifestUrl,
    hashB58,
    embeddedBase: meta,
  };
}

export function stringifyEmbeddedMeta(embedded: unknown) {
  return JSON.stringify(embedded);
}
