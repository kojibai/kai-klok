// src/verifier/validator.ts
import type { SigilMetadataLite } from "../utils/valuation";

/* Public constants (kept identical to Verifier) */
export const SIGIL_CTX = "https://schema.phi.network/sigil/v1" as const;
export const SIGIL_TYPE = "application/phi.kairos.sigil+svg" as const;

type HashHex = string;

/* Minimal transfer/segment shapes used by the metadata union */
type SigilTransfer = {
  senderSignature: string;
  senderStamp: string;
  senderKaiPulse: number;
  payload?: { name: string; mime: string; size: number; encoded?: string };
  receiverSignature?: string;
  receiverStamp?: string;
  receiverKaiPulse?: number;
};

type SegmentEntry = { index: number; root: HashHex; cid: HashHex; count: number };

/* Full metadata union (Verifier-compatible for importer/validator) */
export type SigilMetadata = SigilMetadataLite & {
  ["@context"]?: string;
  type?: string;

  kaiPulse?: number;
  kaiSignature?: string;
  userPhiKey?: string;

  creatorPublicKey?: string;
  origin?: string;
  transfers?: SigilTransfer[];

  segmentSize?: number;
  segments?: SegmentEntry[];
  segmentsMerkleRoot?: HashHex;
  transfersWindowRoot?: HashHex;
  cumulativeTransfers?: number;

  canonicalHash?: string;
  exportedAtPulse?: number;

  valuation?: unknown;
  intentionSigil?: string;

  [k: string]: unknown;
};

/* ── tiny crypto helpers ── */
const bytesToHex = (u8: Uint8Array) => Array.from(u8).map((b) => b.toString(16).padStart(2, "0")).join("");
export async function sha256Hex(msg: string | Uint8Array): Promise<string> {
  const data = typeof msg === "string" ? new TextEncoder().encode(msg) : msg;
  const buf = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(buf));
}

/* Producer-compatible Σ (Verifier semantics: uses stepIndex as parsed) */
async function computeKaiSignature(meta: SigilMetadata): Promise<string | null> {
  const { pulse, beat, stepIndex, chakraDay } = meta;
  if (
    typeof pulse !== "number" ||
    typeof beat !== "number" ||
    typeof stepIndex !== "number" ||
    typeof chakraDay !== "string"
  ) {
    return null;
  }
  const base = `${pulse}|${beat}|${stepIndex}|${chakraDay}|${typeof meta.intentionSigil === "string" ? meta.intentionSigil : ""}`;
  return sha256Hex(base);
}

/* ── SVG parse helpers ── */
function getAttr(svg: string, key: string): string | undefined {
  const m = svg.match(new RegExp(`${key}="([^"]+)"`, "i"));
  return m ? m[1] : undefined;
}
function getIntAttr(svg: string, key: string): number | undefined {
  const v = getAttr(svg, key);
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function extractFirstMetadataJSON(svg: string): string | null {
  try {
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const meta = doc.querySelector("metadata");
    return meta ? meta.textContent ?? null : null;
  } catch {
    return null;
  }
}

/* Parse SVG ▶ meta (JSON first, then data-* fallbacks; mirrors Verifier) */
function parseSvgTextVerifierStyle(svg: string): SigilMetadata {
  let meta: SigilMetadata = {};
  const raw = extractFirstMetadataJSON(svg);
  if (raw) {
    try {
      meta = { ...(JSON.parse(raw) as SigilMetadata) };
    } catch {
      /* continue with attr fallbacks */
    }
  }

  meta.pulse ??= getIntAttr(svg, "data-pulse");
  meta.beat ??= getIntAttr(svg, "data-beat");
  meta.stepIndex ??= getIntAttr(svg, "data-step-index");

  if (meta.frequencyHz == null) {
    const v = getAttr(svg, "data-frequency-hz");
    if (v) meta.frequencyHz = Number(v);
  }
  meta.chakraGate ??= getAttr(svg, "data-chakra-gate");

  if (!meta.chakraDay) {
    const dayAttr = getAttr(svg, "data-harmonic-day") || getAttr(svg, "data-chakra-day");
    if (dayAttr) meta.chakraDay = dayAttr;
  }

  // JSON has precedence; only fill these from attrs if missing
  meta.kaiSignature ??= getAttr(svg, "data-kai-signature");
  meta.userPhiKey ??= getAttr(svg, "data-phi-key");

  const intention = getAttr(svg, "data-intention-sigil");
  if (intention && typeof meta.intentionSigil !== "string") {
    meta.intentionSigil = intention;
  }

  return meta;
}

/* Prefer producer-provided canonical/payload hash if present */
async function canonicalHash(meta: SigilMetadata, svgText?: string): Promise<string> {
  const hAttr = svgText ? getAttr(svgText, "data-payload-hash") : undefined;
  if (hAttr) return hAttr.toLowerCase();
  if (typeof meta.canonicalHash === "string" && meta.canonicalHash.length >= 32) {
    return meta.canonicalHash.toLowerCase();
  }
  const s = `${meta.pulse ?? 0}|${meta.beat ?? 0}|${meta.stepIndex ?? 0}|${meta.chakraDay ?? ""}`;
  return (await sha256Hex(s)).toLowerCase();
}

/* Public validator API used by GlyphImportModal (and optionally Verifier) */
export type Validation =
  | { ok: true; unsigned: boolean; meta: SigilMetadata; canonical: string }
  | { ok: false; reason: string };

/** Verifier-aligned validator for raw SVG text. */
export async function validateMeta(svgText: string): Promise<Validation> {
  // Tolerant SVG check (allow prolog/doctype); require an <svg> element.
  try {
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    if (!doc.querySelector("svg")) return { ok: false, reason: "Unrecognized SVG content." };
  } catch {
    return { ok: false, reason: "Unrecognized SVG content." };
  }

  const meta = parseSvgTextVerifierStyle(svgText);

  // context/type
  const contextOk = !meta["@context"] || meta["@context"] === SIGIL_CTX;
  const typeOk = !meta.type || meta.type === SIGIL_TYPE;
  if (!contextOk || !typeOk) {
    return { ok: false, reason: "Invalid sigil context/type." };
  }

  // core fields
  const hasCore =
    typeof meta.pulse === "number" &&
    typeof meta.beat === "number" &&
    typeof meta.stepIndex === "number" &&
    typeof meta.chakraDay === "string";
  if (!hasCore) {
    return { ok: false, reason: "Missing core fields (pulse/beat/stepIndex/chakraDay)." };
  }

  // Σ check (Verifier semantics)
  const expected = await computeKaiSignature(meta);
  let sigMismatch = false;
  if (expected && meta.kaiSignature) {
    sigMismatch = expected.toLowerCase() !== meta.kaiSignature.toLowerCase();
  }

  // Grace path: canonical step index + data-kai-signature (some producers emit both)
  if (sigMismatch) {
    const stepCanonical = getIntAttr(svgText, "data-step-index-canonical");
    const sigAttr = getAttr(svgText, "data-kai-signature");
    if (typeof stepCanonical === "number" && sigAttr) {
      const alt: SigilMetadata = { ...meta, stepIndex: stepCanonical, kaiSignature: sigAttr };
      const altExpected = await computeKaiSignature(alt);
      if (altExpected && altExpected.toLowerCase() === sigAttr.toLowerCase()) {
        meta.stepIndex = stepCanonical;
        meta.kaiSignature = sigAttr;
        sigMismatch = false;
      }
    }
  }

  if (sigMismatch) return { ok: false, reason: "Content signature mismatch (Σ)." };

  // Defaults mirrored from Verifier
  meta.segmentSize ??= 2000;
  if (typeof meta.cumulativeTransfers !== "number") {
    const segCount = ((meta.segments as SegmentEntry[]) ?? []).reduce((a, s) => a + (s.count || 0), 0);
    meta.cumulativeTransfers = segCount + ((meta.transfers as SigilTransfer[])?.length ?? 0);
  }

  const canon = await canonicalHash(meta, svgText);
  return { ok: true, unsigned: !meta.kaiSignature, meta, canonical: canon };
}
