// src/components/verifier/utils/notePayload.ts
/* ────────────────────────────────────────────────────────────────
   notePayload.ts
   • Builds the Banknote / ExhaleNote printable payload
   • Pure function, so VerifierStamper can just call it
────────────────────────────────────────────────────────────────── */

import type { SigilMetadata } from "../../VerifierStamper/types";
import type {
  SigilMetadataWithOptionals,
} from "../types/local";

import type {
  BanknoteInputs as NoteBanknoteInputs,
} from "../../exhale-note/types";

import { readStrObj, readNumObj } from "./safeRead";

/**
 * Build NotePrinter payload (banknote view) from sigil metadata
 */
export function buildNotePayload(opts: {
  meta: SigilMetadata | null;
  sigilSvgRaw: string | null;
  verifyUrl?: string;
  pulseNow: number;
}): NoteBanknoteInputs {
  const { meta: m, sigilSvgRaw, verifyUrl, pulseNow } = opts;
  if (!m) return { nowPulse: String(pulseNow) };

  const valuation = (m.valuation ?? null) as {
    valuePhi?: number;
    premiumPhi?: number;
    algorithm?: string | number;
    stamp?: string | number;
  } | null;

  const safeBeat = readNumObj(m as unknown, "beat") ?? m.beat ?? 0;
  const safeStepIndex =
    readNumObj(m as unknown, "stepIndex") ?? m.stepIndex ?? 0;
  const safePulse = readNumObj(m as unknown, "pulse") ?? m.pulse ?? 0;

  const prov = (m.transfers ?? []).map((t) => ({
    action: t.receiverSignature
      ? ("receive" as const)
      : ("send" as const),
    pulse: t.senderKaiPulse,
    beat: safeBeat,
    stepIndex: safeStepIndex,
    ownerPhiKey: (m as SigilMetadataWithOptionals).userPhiKey,
  }));

  const extraObj = m as Record<string, unknown>;
  const maybeZk = extraObj.zk as unknown;
  let zkField:
    | {
        scheme?: string;
        poseidon?: string;
      }
    | undefined;
  if (typeof maybeZk === "object" && maybeZk !== null) {
    const zkMap = maybeZk as Record<string, unknown>;
    const scheme =
      typeof zkMap.scheme === "string" ? zkMap.scheme : undefined;
    const poseidonVal =
      typeof zkMap.poseidon === "string"
        ? zkMap.poseidon
        : undefined;
    zkField = scheme
      ? { scheme, poseidon: poseidonVal }
      : undefined;
  }

  return {
    purpose: readStrObj(m, "purpose"),
    to: readStrObj(m, "to"),
    from: readStrObj(m, "from"),
    location: readStrObj(m, "location"),
    witnesses: readStrObj(m, "witnesses"),
    reference: readStrObj(m, "reference"),
    remark: readStrObj(
      m,
      "remark",
      "In Yahuah We Trust — Secured by Φ, not man-made law"
    ),
    valuePhi:
      typeof valuation?.valuePhi === "number"
        ? String(valuation.valuePhi)
        : "",
    premiumPhi:
      typeof valuation?.premiumPhi === "number"
        ? String(valuation.premiumPhi)
        : "",
    computedPulse:
      typeof safePulse === "number" ? String(safePulse) : "",
    nowPulse: String(pulseNow),

    kaiSignature:
      typeof (m as SigilMetadataWithOptionals).kaiSignature === "string"
        ? (m as SigilMetadataWithOptionals).kaiSignature
        : "",
    userPhiKey:
      typeof (m as SigilMetadataWithOptionals).userPhiKey === "string"
        ? (m as SigilMetadataWithOptionals).userPhiKey
        : "",

    sigmaCanon: readStrObj(extraObj, "sigmaCanon"),
    shaHex: readStrObj(extraObj, "shaHex"),
    phiDerived: readStrObj(extraObj, "phiDerived"),
    valuationAlg:
      valuation?.algorithm != null
        ? String(valuation.algorithm)
        : "",
    valuationStamp:
      valuation?.stamp != null
        ? String(valuation.stamp)
        : "",
    provenance: prov.slice(-7),
    zk: zkField,

    sigilSvg: sigilSvgRaw ?? "",
    verifyUrl: verifyUrl || "",
  };
}
