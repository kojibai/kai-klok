// src/utils/provenance.ts
import { STEPS_BEAT as STEPS_PER_BEAT } from "./kai_pulse";
import type { ProvenanceEntry, SigilPayload } from "../types/sigil";
import { stepIndexFromPulse } from "./kaiMath";

// ⬇️ add this single re-export so other modules can import the type from here
export type { ProvenanceEntry };

const isFiniteNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

const asNumber = (v: unknown, def = 0): number => {
  if (isFiniteNumber(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  }
  return def;
};

type ProvenanceLike = {
  ownerPhiKey?: unknown;
  kaiSignature?: unknown;
  pulse?: unknown;
  beat?: unknown;
  stepIndex?: unknown;
  atPulse?: unknown;
  attachmentName?: unknown;
  action?: unknown;
};

const isAction = (a: unknown): a is ProvenanceEntry["action"] =>
  a === "mint" || a === "transfer" || a === "claim";

export function readProvenance(
  meta: { provenance?: unknown; pulse?: unknown },
  fallbackPulseOverride?: number
): ProvenanceEntry[] {
  const fallbackPulse = fallbackPulseOverride ?? asNumber(meta.pulse, 0);
  const arr = Array.isArray(meta.provenance)
    ? (meta.provenance as unknown[])
    : [];

  return arr.flatMap((val) => {
    if (!val || typeof val !== "object") return [];
    const e = val as ProvenanceLike;

    const ownerPhiKey = typeof e.ownerPhiKey === "string" ? e.ownerPhiKey : "";
    const kaiSignature =
      typeof e.kaiSignature === "string" ? e.kaiSignature : undefined;
    const pulse = asNumber(e.pulse, fallbackPulse);
    const beat = asNumber(e.beat, 0);

    let stepIndex: number | undefined;
    if (isFiniteNumber(e.stepIndex)) stepIndex = e.stepIndex;
    else if (typeof e.stepIndex === "string" && e.stepIndex.trim() !== "") {
      const n = asNumber(e.stepIndex, NaN);
      if (Number.isFinite(n)) stepIndex = n;
    }

    const atPulse =
      (typeof e.atPulse === "string" && e.atPulse.trim() !== "") ||
      isFiniteNumber(e.atPulse)
        ? asNumber(e.atPulse, pulse)
        : pulse;

    const attachmentName =
      typeof e.attachmentName === "string" ? e.attachmentName : undefined;
    const action = isAction(e.action) ? e.action : "mint";

    const pe: ProvenanceEntry = {
      ownerPhiKey,
      kaiSignature,
      pulse,
      beat,
      stepIndex,
      atPulse,
      attachmentName,
      action,
    };
    return [pe];
  });
}

export function makeProvenanceEntry(
  ownerPhiKey: string,
  kaiSignature: string | undefined,
  sigil: SigilPayload,
  action: ProvenanceEntry["action"],
  attachmentName: string | undefined,
  eventAtPulse: number
): ProvenanceEntry {
  const steps = sigil.stepsPerBeat ?? STEPS_PER_BEAT;
  const stepIndex = stepIndexFromPulse(sigil.pulse, steps);
  return {
    ownerPhiKey,
    kaiSignature,
    pulse: sigil.pulse,
    beat: sigil.beat,
    stepIndex,
    atPulse: eventAtPulse,
    attachmentName,
    action,
  };
}
