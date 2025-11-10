// src/components/KaiRealms/GlyphUtils.ts
// Verified parity with VerifierStamper + SigilLogin

import { parseSvgFile } from "../VerifierStamper/svg";
import {
  computeKaiSignature,
  derivePhiKeyFromSig,
} from "../VerifierStamper/sigilUtils";
import type { SigilMeta } from "../VerifierStamper/types";

/** Narrowed core fields we require from the primary <metadata> JSON */
export type SigilMetaCore = SigilMeta & {
  pulse: number;
  beat: number;
  stepIndex: number;
  chakraDay: string;
  kaiSignature: string;
  userPhiKey?: string;
};

export interface GlyphData {
  svgText: string;
  meta: SigilMetaCore;
  phiKey: string;
}

/* --------------------------- tiny type helpers --------------------------- */
function lower(s: string | undefined | null): string {
  return typeof s === "string" ? s.toLowerCase() : "";
}
function hasOwn<T extends object, K extends PropertyKey>(
  obj: T,
  key: K
): obj is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(obj, key);
}
function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}
function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
/* ------------------------------------------------------------------------ */

/** Runtime assertion to guarantee the minimal, safe shape */
function assertIsSigilMetaCore(m: unknown): asserts m is SigilMetaCore {
  if (typeof m !== "object" || m === null) throw new Error("Malformed sigil metadata.");

  const o = m as Record<string, unknown>;
  for (const k of ["pulse", "beat", "stepIndex", "chakraDay"] as const) {
    if (!hasOwn(o, k)) throw new Error(`Missing Kai field: ${k}`);
  }
  if (!hasOwn(o, "kaiSignature")) {
    throw new Error("Invalid Kai Signature — tampered or unsigned sigil.");
  }

  if (!isFiniteNumber(o.pulse)) throw new Error("Invalid field: pulse");
  if (!isFiniteNumber(o.beat)) throw new Error("Invalid field: beat");
  if (!isFiniteNumber(o.stepIndex)) throw new Error("Invalid field: stepIndex");
  if (!isNonEmptyString(o.chakraDay)) throw new Error("Invalid field: chakraDay");
  if (!isNonEmptyString(o.kaiSignature)) throw new Error("Invalid field: kaiSignature");
}

/** Extract ONLY the primary root <metadata> JSON (skip valuation/ledger/dht/source blobs) */
function extractPrimaryMetaFromSvgText(svgText: string): SigilMeta | null {
  try {
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    const nodes = Array.from(doc.getElementsByTagName("metadata"));
    const skipIds = ["valuation", "ledger", "dht", "source"];

    for (const el of nodes) {
      const idAttr = el.getAttribute("id") ?? "";
      if (skipIds.some((k) => idAttr.includes(k))) continue;

      const raw = (el.textContent ?? "").trim();
      if (!raw) continue;

      const peeled = raw.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
      try {
        const obj = JSON.parse(peeled) as unknown;
        if (
          typeof obj === "object" &&
          obj !== null &&
          hasOwn(obj, "pulse") &&
          hasOwn(obj, "beat") &&
          hasOwn(obj, "stepIndex") &&
          hasOwn(obj, "chakraDay") &&
          hasOwn(obj, "kaiSignature")
        ) {
          return obj as SigilMeta;
        }
      } catch {
        // not JSON — ignore and continue
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Public: Parse + verify a sigil SVG file into game-ready GlyphData */
export async function parseSigilGlyph(file: File): Promise<GlyphData> {
  // 1) keep full text for downstream use
  const svgText = await file.text();

  // 2) use same parse helper as VerifierStamper
  const { meta, contextOk, typeOk } = await parseSvgFile(file);

  // 3) If parser returned a non-primary blob, peel the root <metadata> directly
  const primary =
    meta &&
    hasOwn(meta as Record<string, unknown>, "kaiSignature") &&
    hasOwn(meta as Record<string, unknown>, "pulse")
      ? (meta as SigilMeta)
      : extractPrimaryMetaFromSvgText(svgText);

  if (!primary || !contextOk || !typeOk) {
    throw new Error("Invalid glyph or missing metadata.");
  }

  // 4) Assert minimal safe shape
  assertIsSigilMetaCore(primary);
  const core: SigilMetaCore = primary;

  // 5) Recompute signature from PRIMARY <metadata> JSON (never data-* attrs)
  const expectedSig = await computeKaiSignature(core);
  if (!expectedSig || lower(expectedSig) !== lower(core.kaiSignature)) {
    throw new Error("Invalid Kai Signature — tampered or unsigned sigil.");
  }

  // 6) Derive Φ-Key **from the signature** (parity with VerifierStamper/SigilLogin)
  const phiKey = await derivePhiKeyFromSig(core.kaiSignature);

  // 7) If sigil carried a userPhiKey, ensure it matches; else patch canonical
  if (typeof core.userPhiKey === "string") {
    if (lower(core.userPhiKey) !== lower(phiKey)) {
      throw new Error("Φ-Key mismatch — identity invalid.");
    }
  } else {
    core.userPhiKey = phiKey;
  }

  return { svgText, meta: core, phiKey };
}
