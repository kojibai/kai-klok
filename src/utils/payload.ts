// src/utils/payload.ts
import { decodeSigilPayload } from "./sigilUrl";
import { STEPS_BEAT as STEPS_PER_BEAT } from "./kai_pulse";
import type {
  ExpiryUnit,
  SigilPayload,
  EmbeddedAttachment,
  ProvenanceEntry,
} from "../types/sigil";

/** Raw (possibly untrusted) payload decoded from URL */
type RawPayload = {
  stepsPerBeat?: number | string;
  stepIndex?: number | string;
  stepPct?: number;
  pulse?: number | string;
  beat?: number | string;
  chakraDay?: SigilPayload["chakraDay"];
  kaiSignature?: string;
  userPhiKey?: string;
  provenance?: unknown[];
  attachment?: unknown; // validated below
  expiresAtPulse?: number | string;
  canonicalHash?: string;
  transferNonce?: string;
  exportedAtPulse?: number | string;

  claimExtendUnit?: string;
  claimExtendAmount?: number | string;

  // zk/owner block (optional in URL; required in SigilPayload)
  zkPoseidonHash?: string;
  zkProof?: unknown;
  ownerPubKey?: unknown; // may be a JSON string or object
  ownerSig?: string;

  // Possible extras your SigilPayload may require
  eternalRecord?: unknown;
  creatorResolved?: unknown;
  origin?: unknown;
  proofHints?: unknown;
};

/* ────────────────────────────────────────────────────────────────
   Runtime guards & helpers
────────────────────────────────────────────────────────────────── */

function isEmbeddedAttachment(x: unknown): x is EmbeddedAttachment {
  if (!x || typeof x !== "object") return false;
  const obj = x as Record<string, unknown>;
  return (
    typeof obj.name === "string" &&
    typeof obj.mime === "string" &&
    typeof obj.dataUri === "string" &&
    typeof obj.size === "number"
  );
}

function isProvenanceEntry(x: unknown): x is ProvenanceEntry {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const action = o.action as string | undefined;
  const okAction = action === "mint" || action === "transfer" || action === "claim";
  return (
    typeof o.ownerPhiKey === "string" &&
    typeof o.pulse === "number" &&
    typeof o.beat === "number" &&
    typeof o.atPulse === "number" &&
    okAction
  );
}

/** Extremely loose zkProof guard; adapt to your proof schema if needed */
function isZkProof(x: unknown): x is SigilPayload["zkProof"] {
  return !!x && typeof x === "object";
}

/** Accept JWK as object or JSON string; fall back to minimal valid JsonWebKey */
function parseOwnerPubKeyJwk(raw: unknown): JsonWebKey {
  if (!raw) return {};
  if (typeof raw === "object") return raw as JsonWebKey;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed as JsonWebKey;
    } catch {
      /* ignore */
    }
  }
  return {};
}

/* ────────────────────────────────────────────────────────────────
   Main decode
────────────────────────────────────────────────────────────────── */

export function decodePayloadFromQuery(search: string): SigilPayload | null {
  try {
    const qs = new URLSearchParams(search);
    const p = qs.get("p");
    if (!p) return null;

    const raw = decodeSigilPayload(p) as RawPayload | null;
    if (!raw || typeof raw !== "object") return null;

    // steps/stepIndex/stepPct
    const stepsRaw = raw.stepsPerBeat;
    const steps =
      stepsRaw != null && !Number.isNaN(Number(stepsRaw))
        ? Math.max(1, Math.floor(Number(stepsRaw)))
        : STEPS_PER_BEAT;

    const rawStepIndex = raw.stepIndex;
    const stepIndex =
      rawStepIndex != null && !Number.isNaN(Number(rawStepIndex))
        ? Math.max(0, Math.min(steps - 1, Math.floor(Number(rawStepIndex))))
        : undefined;

    const derivedPct =
      typeof raw.stepPct === "number"
        ? Math.max(0, Math.min(1, raw.stepPct))
        : stepIndex != null
        ? (stepIndex + 1e-9) / steps
        : 0;

    // expiry/exported
    const exp = raw.expiresAtPulse != null ? Number(raw.expiresAtPulse) : NaN;
    const expd = raw.exportedAtPulse != null ? Number(raw.exportedAtPulse) : NaN;

    // claim extend
    const rxUnit = (raw.claimExtendUnit || "").toString().toLowerCase();
    const claimExtendUnit: ExpiryUnit | undefined =
      rxUnit === "steps" ? "steps" : rxUnit === "breaths" ? "breaths" : undefined;

    const claimExtendAmount =
      raw.claimExtendAmount != null && !Number.isNaN(Number(raw.claimExtendAmount))
        ? Math.max(0, Math.floor(Number(raw.claimExtendAmount)))
        : undefined;

    // complex optionals
    const provenance: ProvenanceEntry[] | undefined = Array.isArray(raw.provenance)
      ? raw.provenance.filter(isProvenanceEntry)
      : undefined;

    const attachment: EmbeddedAttachment | undefined = isEmbeddedAttachment(raw.attachment)
      ? (raw.attachment as EmbeddedAttachment)
      : undefined;

    // zk/owner block with safe defaults (match SigilPayload types)
    const zkPoseidonHash = typeof raw.zkPoseidonHash === "string" ? raw.zkPoseidonHash : "0x";
    const zkProof = isZkProof(raw.zkProof)
      ? (raw.zkProof as SigilPayload["zkProof"])
      : ({} as SigilPayload["zkProof"]);
    const ownerPubKey = parseOwnerPubKeyJwk(raw.ownerPubKey);
    const ownerSig = typeof raw.ownerSig === "string" ? raw.ownerSig : "";

    // pass-through/backs-fill possible extras your SigilPayload may require
    const eternalRecord = (raw as { eternalRecord?: unknown }).eternalRecord ?? null;
    const creatorResolved =
      typeof (raw as { creatorResolved?: unknown }).creatorResolved === "boolean"
        ? (raw as { creatorResolved?: boolean }).creatorResolved
        : false;
    const origin =
      typeof (raw as { origin?: unknown }).origin === "string"
        ? (raw as { origin?: string }).origin
        : "";
    const proofHints = Array.isArray((raw as { proofHints?: unknown }).proofHints)
      ? ((raw as { proofHints?: unknown[] }).proofHints ?? [])
      : [];

    // Build with known fields, then include extras when present.
    // Cast at the end so we don't fight local repo-required fields.
    const payload = {
      pulse: Number(raw.pulse) || 0,
      beat: Number(raw.beat) || 0,
      chakraDay: raw.chakraDay as SigilPayload["chakraDay"],
      stepIndex,
      stepPct: derivedPct,
      kaiSignature:
        typeof raw.kaiSignature === "string" ? raw.kaiSignature : undefined,
      userPhiKey:
        typeof raw.userPhiKey === "string" ? raw.userPhiKey : undefined,
      stepsPerBeat: steps,
      provenance,
      attachment,
      expiresAtPulse: Number.isFinite(exp) ? exp : undefined,
      canonicalHash:
        typeof raw.canonicalHash === "string" ? raw.canonicalHash : undefined,
      transferNonce:
        typeof raw.transferNonce === "string" ? raw.transferNonce : undefined,
      exportedAtPulse: Number.isFinite(expd) ? expd : undefined,

      claimExtendUnit,
      claimExtendAmount,

      // required zk/owner fields
      zkPoseidonHash,
      zkProof,
      ownerPubKey,
      ownerSig,

      // extras (only if your SigilPayload declares them)
      eternalRecord,
      creatorResolved,
      origin,
      proofHints,
    } as unknown as SigilPayload;

    // If URL has token "?t=" but payload omitted it, lift it.
    const urlToken = qs.get("t");
    if (urlToken && !(payload as unknown as { transferNonce?: string }).transferNonce) {
      (payload as unknown as { transferNonce?: string }).transferNonce = urlToken;
    }

    return payload;
  } catch {
    return null;
  }
}
