// src/pages/SigilPage/exportZip.ts
"use client";

import { svgBlobForExport, pngBlobFromSvg, EXPORT_PX } from "../../utils/qrExport";
import { makeProvenanceEntry } from "../../utils/provenance";
import { retagSvgIdsForStep, ensureCanonicalMetadataFirst } from "./svgOps";
import { loadJSZip, signal } from "./utils";
import { makeSigilUrl, type SigilSharePayload } from "../../utils/sigilUrl";
import { rewriteUrlPayload } from "../../utils/shareUrl";
import {
  sha256HexCanon,
  derivePhiKeyFromSigCanon,
  verifierSigmaString,
  readIntentionSigil,
} from "./verifierCanon";
import type { SigilPayload } from "../../types/sigil";

/** Chakra day union required by SigilSharePayload */
type ChakraDay =
  | "Root"
  | "Sacral"
  | "Solar Plexus"
  | "Heart"
  | "Throat"
  | "Third Eye"
  | "Crown";

/** Narrow interface with only the fields we actually read/write in this module. */
export type ExportableSigilMeta = {
  pulse: number;
  beat: number;
  chakraDay?: string | null;

  /** canonical / evolving */
  stepsPerBeat?: number;
  stepIndex?: number | null;
  exportedAtPulse?: number | null;
  canonicalHash?: string | null;

  /** identity / signing */
  userPhiKey?: string | null;
  kaiSignature?: string | null;

  /** transfer / expiry (URL token is NOT part of SigilSharePayload) */
  transferNonce?: string | null; // token goes in URL only
  expiresAtPulse?: number | null;
  claimExtendUnit?: "breaths" | "steps";
  claimExtendAmount?: number | null;

  /** misc */
  attachment?: { name?: string | null } | null;
  provenance?: Array<Record<string, unknown>> | null;
};

/** Coerce any free-form value into a valid ChakraDay; default to "Root". */
function asChakraDay(v: unknown): ChakraDay {
  const s = String(v ?? "").trim().toLowerCase();
  switch (s) {
    case "root":
      return "Root";
    case "sacral":
      return "Sacral";
    case "solar plexus":
    case "solar_plexus":
    case "solar-plexus":
      return "Solar Plexus";
    case "heart":
      return "Heart";
    case "throat":
      return "Throat";
    case "third eye":
    case "third_eye":
    case "third-eye":
      return "Third Eye";
    case "crown":
      return "Crown";
    default:
      return "Root";
  }
}

/** Build a strict SigilPayload (no nulls, correct unions) from ExportableSigilMeta. */
function toSigilPayloadStrict(meta: ExportableSigilMeta, sealedStepIndex: number): SigilPayload {
  const out: Record<string, unknown> = {
    pulse: meta.pulse,
    beat: meta.beat,
    chakraDay: asChakraDay(meta.chakraDay),
    stepsPerBeat: meta.stepsPerBeat ?? undefined,
    stepIndex: sealedStepIndex, // MUST be a number for SigilPayload
    userPhiKey: meta.userPhiKey ?? undefined,
    kaiSignature: meta.kaiSignature ?? undefined,
    canonicalHash: meta.canonicalHash ?? undefined,
    transferNonce: meta.transferNonce ?? undefined, // allowed in SVG payload; not in SigilSharePayload
    expiresAtPulse: meta.expiresAtPulse ?? undefined,
    claimExtendUnit: meta.claimExtendUnit ?? undefined,
    claimExtendAmount: meta.claimExtendAmount ?? undefined,
    attachment: meta.attachment ?? undefined,
    provenance: meta.provenance ?? undefined,
  };

  // Strip undefineds to keep payload tidy
  Object.keys(out).forEach((k) => {
    if (out[k] === undefined) delete out[k];
  });

  return out as SigilPayload;
}

/** Helper for building the minimal SigilSharePayload (NO canonicalHash, NO token, NO expiry/claim fields). */
function toSharePayload(
  claimed: Required<Pick<ExportableSigilMeta, "pulse" | "beat">> &
    Pick<ExportableSigilMeta, "chakraDay" | "stepsPerBeat" | "userPhiKey" | "kaiSignature"> & {
      stepIndex: number;
    }
): SigilSharePayload {
  return {
    pulse: claimed.pulse,
    beat: claimed.beat,
    stepIndex: claimed.stepIndex,
    chakraDay: asChakraDay(claimed.chakraDay),
    stepsPerBeat: claimed.stepsPerBeat ?? undefined,
    userPhiKey: claimed.userPhiKey ?? undefined,
    kaiSignature: claimed.kaiSignature ?? undefined,
  };
}

export async function exportZIP(ctx: {
  expired: boolean;
  exporting: boolean;
  setExporting: (b: boolean) => void;
  svgEl: SVGSVGElement | null;
  payload: ExportableSigilMeta | null;
  isFutureSealed: boolean;
  linkStatus: "checking" | "active" | "archived";
  setToast: (s: string) => void;
  expiryUnit: "breaths" | "steps";
  expiryAmount: number;
  localHash: string | null;
  routeHash: string | null;
  transferToken: string | null;
  getKaiPulseEternalInt: (d: Date) => number;
  stepIndexFromPulse: (p: number, steps: number) => number;
  STEPS_PER_BEAT: number;
}) {
  const {
    expired,
    exporting,
    setExporting,
    svgEl,
    payload,
    isFutureSealed,
    linkStatus,
    setToast,
    expiryUnit,
    expiryAmount,
    localHash,
    routeHash,
    transferToken,
    getKaiPulseEternalInt,
    stepIndexFromPulse,
    STEPS_PER_BEAT,
  } = ctx;

  if (expired) return signal(setToast, "Seal window closed");
  if (exporting) return;
  if (!svgEl) return signal(setToast, "No SVG found");
  if (!payload) return signal(setToast, "No payload");
  if (isFutureSealed) return signal(setToast, "Opens after the moment—claim unlocks then");
  if (linkStatus !== "active") return signal(setToast, "Archived link — cannot claim from here");

  try {
    setExporting(true);

    const base = `sigil_${(localHash || routeHash || "mint").slice(0, 16)}`;
    const stepsNum = (payload.stepsPerBeat ?? STEPS_PER_BEAT) as number;

    const sealedStepIndex = stepIndexFromPulse(payload.pulse, stepsNum);
    const nowPulse = getKaiPulseEternalInt(new Date());
    const claimStepIndex = stepIndexFromPulse(nowPulse, stepsNum);

    // Build a strict SigilPayload for provenance computation
    const payloadForProv = toSigilPayloadStrict(payload, sealedStepIndex);

    const provEntry = {
      ...makeProvenanceEntry(
        payload.userPhiKey || "",
        payload.kaiSignature ?? undefined,
        payloadForProv,
        "claim",
        payload.attachment?.name ?? undefined,
        nowPulse
      ),
      stepIndex: sealedStepIndex,
      atStepIndex: claimStepIndex,
    };

    const claimedMeta: ExportableSigilMeta = {
      ...payload,
      exportedAtPulse: nowPulse,
      stepIndex: sealedStepIndex,
      provenance: [...(payload.provenance ?? []), provEntry],
      claimExtendUnit: payload.claimExtendUnit ?? expiryUnit,
      claimExtendAmount: payload.claimExtendAmount ?? expiryAmount,
      canonicalHash: (localHash || payload.canonicalHash || routeHash || null)?.toString() ?? null,
    };

    // canonical Σ and Φ (0-based stepIndex)
    const canonicalSig = await sha256HexCanon(
      verifierSigmaString(
        claimedMeta.pulse,
        claimedMeta.beat,
        sealedStepIndex,
        String(claimedMeta.chakraDay ?? ""),
        // readIntentionSigil expects a SigilPayload
        readIntentionSigil(toSigilPayloadStrict(claimedMeta, sealedStepIndex))
      )
    );
    const phiKeyCanon = await derivePhiKeyFromSigCanon(canonicalSig);

    const claimedMetaCanon: ExportableSigilMeta = {
      ...claimedMeta,
      kaiSignature: canonicalSig,
      userPhiKey: claimedMeta.userPhiKey || phiKeyCanon,
    };

    // Canonical payload write only (single call)
    const { putMetadata } = await import("../../utils/svgMeta");
    putMetadata(svgEl, claimedMetaCanon);

    // Display-only exposure (non-canonical marker)
    try {
      svgEl.setAttribute("data-step-index", String(sealedStepIndex));
      const NS = "http://www.w3.org/2000/svg";
      let dispMeta = svgEl.querySelector("metadata#sigil-display");
      if (!dispMeta) {
        dispMeta = document.createElementNS(NS, "metadata");
        dispMeta.setAttribute("id", "sigil-display");
        dispMeta.setAttribute("data-noncanonical", "1");
        svgEl.appendChild(dispMeta);
      }
      dispMeta.textContent = JSON.stringify({
        stepIndex: sealedStepIndex,
        stepsPerBeat: stepsNum,
      });
    } catch {
      console.debug("Display metadata write failed");
    }

    retagSvgIdsForStep(svgEl, claimedMetaCanon.pulse, claimedMetaCanon.beat, sealedStepIndex);
    ensureCanonicalMetadataFirst(svgEl);

    // Build the canonical share URL for manifest — canonical is in the path, NOT the payload
    const canonicalLower = (localHash || routeHash || "").toLowerCase();
    const sharePayloadForManifest = toSharePayload({
      pulse: claimedMetaCanon.pulse,
      beat: claimedMetaCanon.beat,
      stepIndex: sealedStepIndex,
      chakraDay: claimedMetaCanon.chakraDay ?? null,
      stepsPerBeat: stepsNum,
      userPhiKey: claimedMetaCanon.userPhiKey ?? null,
      kaiSignature: claimedMetaCanon.kaiSignature ?? null,
    });

    const baseUrlForManifest = makeSigilUrl(canonicalLower, sharePayloadForManifest);
    const tokenForManifest: string | undefined =
      claimedMetaCanon.transferNonce ?? transferToken ?? undefined;

    const fullUrlForManifest = rewriteUrlPayload(
      baseUrlForManifest,
      sharePayloadForManifest,
      tokenForManifest
    );

    let pValue: string | null = null;
    let tValue: string | null = null;
    try {
      const u = new URL(fullUrlForManifest);
      pValue = u.searchParams.get("p");
      tValue = u.searchParams.get("t");
    } catch {
      console.debug("URL parse failed");
    }

    // Create artifacts
    const svgBlob = await svgBlobForExport(svgEl, EXPORT_PX, {
      metaOverride: claimedMetaCanon,
      addQR: false,
      addPulseBar: false,
      title: "Kairos Sigil-Glyph — Sealed KairosMoment",
      desc: "Deterministic sigil-glyph with sovereign metadata. Exported as archived key.",
    });
    const pngBlob = await pngBlobFromSvg(svgBlob, EXPORT_PX);

    // Build ZIP (add manifest before generate)
    const JSZip = await loadJSZip();
    const zip = new JSZip();
    zip.file(`${base}.svg`, svgBlob);
    zip.file(`${base}.png`, pngBlob);

    const manifest = {
      // ids
      hash: localHash || routeHash || "",
      canonicalHash: claimedMetaCanon.canonicalHash ?? null,
      // moment (sealed)
      pulse: claimedMetaCanon.pulse,
      beat: claimedMetaCanon.beat,
      stepIndex: sealedStepIndex,
      atStepIndex: claimStepIndex,
      chakraDay: claimedMetaCanon.chakraDay ?? null,
      // ownership
      userPhiKey: claimedMetaCanon.userPhiKey ?? null,
      kaiSignature: claimedMetaCanon.kaiSignature ?? null,
      transferNonce: claimedMetaCanon.transferNonce ?? null,
      // timing
      expiresAtPulse: claimedMetaCanon.expiresAtPulse ?? null,
      exportedAtPulse: claimedMetaCanon.exportedAtPulse ?? null,
      claimedAtPulse: nowPulse,
      // overlays
      overlays: { qr: false, eternalPulseBar: false },
      // claim controls
      claimExtendUnit: claimedMetaCanon.claimExtendUnit ?? null,
      claimExtendAmount: claimedMetaCanon.claimExtendAmount ?? null,
      // canonical share refs
      fullUrl: fullUrlForManifest,
      p: pValue,
      urlQuery: { p: pValue, t: tValue },
    };
    zip.file(`${base}.manifest.json`, JSON.stringify(manifest, null, 2));

    const zipBlob = await zip.generateAsync({ type: "blob" });

    // Download
    const dlUrl = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = dlUrl;
    a.download = `${base}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    requestAnimationFrame(() => URL.revokeObjectURL(dlUrl));

    signal(setToast, "Access key generated");
  } catch (e) {
    console.error(e);
    signal(setToast, "Claim failed");
  } finally {
    setExporting(false);
  }
}
