// src/components/verifier/hooks/useMetaSignals.ts
/* ────────────────────────────────────────────────────────────────
   useMetaSignals
   • Extracts live "frequencyHz" + "chakraGate" / "Spiral Gate"
   • Falls back to inline <svg data-*> attributes
   • Cleans gate label (kill "gate 5", punctuation, etc.)
────────────────────────────────────────────────────────────────── */

import { useMemo } from "react";
import type { SigilMetadata } from "../../VerifierStamper/types";
import type { SigilMetadataWithOptionals } from "../types/local";
import {
  getFirst,
  fromSvgDataset,
} from "../utils/metaDataset";

/**
 * Returns { frequencyHz, chakraGate }
 * All strings, "" if not present.
 */
export function useMetaSignals(meta: SigilMetadata | null): {
  frequencyHz: string;
  chakraGate: string;
} {
  const frequencyHz = useMemo(() => {
    return (
      getFirst(meta, ["frequencyHz", "valuationSource.frequencyHz"]) ||
      fromSvgDataset(meta as SigilMetadataWithOptionals, "data-frequency-hz")
    );
  }, [meta]);

  const chakraGate = useMemo(() => {
    const raw =
      getFirst(meta, ["chakraGate", "valuationSource.chakraGate"]) ||
      fromSvgDataset(meta as SigilMetadataWithOptionals, "data-chakra-gate");

    // strip things like "Gate 4", weird punctuation dashes, collapse whitespace
    return (raw || "")
      .replace(/\bgate\b[\s\-_:]*\d*/gi, "")
      .replace(/^[\s\-_,:–—]+|[\s\-_,:–—]+$/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }, [meta]);

  return { frequencyHz, chakraGate };
}
