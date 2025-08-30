"use client";

/**
 * Sigil Context — tiny, fast, SVG-first staging area (TS-only, no JSX)
 * - Holds a single staged sigil to attach to the next message
 * - Parses <svg> opening tag only (no DOMParser cost)
 * - Extracts canonical Kai metadata attributes when present
 * - Zero external dependencies; object URLs are auto cleaned up
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** Minimal metadata we care about for quick UIs. Extend as needed. */
export type SigilMetaLite = {
  pulse?: number | null;
  beat?: number | null;
  stepIndex?: number | null; // 0..43 if present
  kaiSignature?: string | null;
  phiKey?: string | null;
  payloadHash?: string | null;

  // Extra hints frequently present in sigils (optional)
  frequencyHz?: number | null;
  chakraGate?: string | null;
  quality?: string | null;
  zkScheme?: string | null;
  zkPoseidonHash?: string | null;
  stepIndexCanonical?: number | null;
  shareUrl?: string | null;

  noncanonical?: boolean | null;
};

export type SigilAsset = {
  kind: "svg" | "image" | "blob";
  name: string;
  size: number;
  mime: string;
  /** For SVG only, original text (kept for hashing/verification UIs). */
  svgText?: string;
  /** Object URL for quick previews; auto-revoked on replace/unmount. */
  objectUrl: string;
  /** Parsed attributes from the <svg> tag (if available). */
  meta: SigilMetaLite;
  /** Epoch ms when staged. */
  stagedAt: number;
};

type Ctx = {
  /** Primary, current staged sigil (preferred API) */
  stagedSigil: SigilAsset | null;
  /** Set (or replace) the staged sigil directly. */
  setStagedSigil: (asset: SigilAsset | null) => void;
  /** Load a user file, parse/prepare, and stage it. */
  loadSigilFile: (file: File) => Promise<SigilAsset>;
  /** Clear and revoke object URL. */
  clearSigil: () => void;
  /**
   * Returns the current staged sigil and clears it atomically.
   * Useful when attaching to a just-sent message.
   */
  consumeStagedSigil: () => SigilAsset | null;

  // ── Compatibility aliases for legacy components (e.g. SigilUploader) ──
  /** Alias of stagedSigil for older components */
  attachedSigil: SigilAsset | null;
  /** Alias setter for older components */
  setAttachedSigil: (asset: SigilAsset | null) => void;
  /** Alias consumer for older components */
  consumeAttachedSigil: () => SigilAsset | null;
};

const SigilContext = createContext<Ctx | null>(null);

/** Parse only the first `<svg ...>` opening tag for metadata, super fast. */
function parseSvgOpenTag(svgText: string): SigilMetaLite {
  const openTagMatch = svgText.match(/<svg\b[^>]*>/i);
  if (!openTagMatch) return {};
  const tag = openTagMatch[0];

  // Helper: read attribute value by name using a light regex (case-insensitive)
  const readAttr = (name: string): string | null => {
    const re = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i");
    const m = tag.match(re);
    if (!m) return null;
    return (m[2] ?? m[3] ?? "").trim();
  };

  const toInt = (s: string | null): number | null =>
    s != null && s !== "" && !Number.isNaN(Number(s)) ? Math.trunc(Number(s)) : null;

  const toFloat = (s: string | null): number | null =>
    s != null && s !== "" && !Number.isNaN(Number(s)) ? Number(s) : null;

  const truey = (s: string | null): boolean | null =>
    s != null ? (s === "" || s === "1" || s.toLowerCase() === "true") : null;

  // Canonical attrs seen in your sample
  const pulse = toInt(readAttr("data-pulse"));
  const beat = toInt(readAttr("data-beat"));
  const stepIndex = toInt(readAttr("data-step-index"));
  const kaiSignature = readAttr("data-kai-signature");
  const phiKey = readAttr("data-phi-key");
  const payloadHash = readAttr("data-payload-hash");

  const frequencyHz = toFloat(readAttr("data-frequency-hz"));
  const chakraGate = readAttr("data-chakra-gate");
  const quality = readAttr("data-quality");
  const zkScheme = readAttr("data-zk-scheme");
  const zkPoseidonHash = readAttr("data-zk-poseidon-hash");
  const stepIndexCanonical = toInt(readAttr("data-step-index-canonical"));
  const shareUrl = readAttr("data-share-url");
  const noncanonical = truey(readAttr("data-noncanonical"));

  return {
    pulse,
    beat,
    stepIndex,
    kaiSignature: kaiSignature ?? null,
    phiKey: phiKey ?? null,
    payloadHash: payloadHash ?? null,
    frequencyHz,
    chakraGate: chakraGate ?? null,
    quality: quality ?? null,
    zkScheme: zkScheme ?? null,
    zkPoseidonHash: zkPoseidonHash ?? null,
    stepIndexCanonical,
    shareUrl: shareUrl ?? null,
    noncanonical,
  };
}

function inferKind(mime: string): SigilAsset["kind"] {
  if (mime === "image/svg+xml") return "svg";
  if (mime.startsWith("image/")) return "image";
  return "blob";
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error);
    fr.onload = () => resolve(String(fr.result ?? ""));
    fr.readAsText(file);
  });
}

export function SigilContextProvider({ children }: { children: ReactNode }) {
  const [stagedSigil, _setStagedSigil] = useState<SigilAsset | null>(null);
  const lastUrlRef = useRef<string | null>(null);

  const revokeLastUrl = useCallback(() => {
    const url = lastUrlRef.current;
    if (url) {
      URL.revokeObjectURL(url);
      lastUrlRef.current = null;
    }
  }, []);

  const setStagedSigil = useCallback(
    (asset: SigilAsset | null) => {
      revokeLastUrl();
      _setStagedSigil(asset);
      if (asset) lastUrlRef.current = asset.objectUrl;
    },
    [revokeLastUrl]
  );

  const clearSigil = useCallback(() => {
    setStagedSigil(null);
  }, [setStagedSigil]);

  const loadSigilFile = useCallback(
    async (file: File): Promise<SigilAsset> => {
      const mime = file.type || "application/octet-stream";
      const objectUrl = URL.createObjectURL(file);
      const kind = inferKind(mime);

      let svgText: string | undefined;
      let meta: SigilMetaLite = {};
      if (kind === "svg") {
        svgText = await readFileAsText(file);
        meta = parseSvgOpenTag(svgText);
      }

      const asset: SigilAsset = {
        kind,
        name: file.name,
        size: file.size,
        mime,
        svgText,
        objectUrl,
        meta,
        stagedAt: Date.now(),
      };

      setStagedSigil(asset);
      return asset;
    },
    [setStagedSigil]
  );

  const consumeStagedSigil = useCallback((): SigilAsset | null => {
    const current = stagedSigil;
    if (!current) return null;
    // Intentionally do NOT revoke here; a consumer component may still render it briefly.
    _setStagedSigil(null);
    lastUrlRef.current = null;
    return current;
  }, [stagedSigil]);

  // Cleanup on unmount
  React.useEffect(() => revokeLastUrl, [revokeLastUrl]);

  // Compatibility aliases
  const attachedSigil = stagedSigil;
  const setAttachedSigil = setStagedSigil;
  const consumeAttachedSigil = consumeStagedSigil;

  const value: Ctx = useMemo(
    () => ({
      stagedSigil,
      setStagedSigil,
      loadSigilFile,
      clearSigil,
      consumeStagedSigil,
      attachedSigil,
      setAttachedSigil,
      consumeAttachedSigil,
    }),
    [
      stagedSigil,
      setStagedSigil,
      loadSigilFile,
      clearSigil,
      consumeStagedSigil,
      attachedSigil,
      setAttachedSigil,
      consumeAttachedSigil,
    ]
  );

  // No JSX so this compiles as .ts in strict environments
  return React.createElement(SigilContext.Provider, { value }, children);
}

export function useSigilContext(): Ctx {
  const ctx = useContext(SigilContext);
  if (!ctx) {
    throw new Error("useSigilContext must be used within <SigilContextProvider>");
  }
  return ctx;
}
