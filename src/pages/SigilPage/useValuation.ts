// src/pages/SigilPage/useValuation.ts
/* eslint-disable */
// @ts-nocheck
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildValueSeal,
  rarityScore01FromPulse,
  explainRarity,
  explainOscillation,
  explainLineage,
  motifSimilarity,
  toExplainableScroll,
  renderKairosSpiralSVG,
  renderScrollHTML,
  renderSigilWav,
  scanKairosWindow,
  computeTrustGrade,
  classifyMarketTier,
} from "../../utils/valuation";

// NOTE: No strict linting, no strict TS — we keep this file flexible and permissive by design.

type PriceFlash = "up" | "down" | null;

type Args = {
  payload: any; // intentionally loose — upstream payloads evolve
  urlSearchParams: URLSearchParams;
  currentPulse: number | null | undefined;
  routeHash?: string | null;
};

function useStableSha256() {
  // Browsers: WebCrypto; Node 18+ also exposes crypto.subtle
  return useMemo(
    () => async (s: string) => {
      const data = new TextEncoder().encode(s);
      const buf = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    },
    []
  );
}

export function useValuation({ payload, urlSearchParams, currentPulse }: Args) {
  const [valSeal, setValSeal] = useState<any>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [priceFlash, setPriceFlash] = useState<PriceFlash>(null);

  const prevPriceRef = useRef<number | null>(null);
  const lastStampRef = useRef<string | null>(null); // ensures idempotent updates

  const hasher = useStableSha256();

  // Only the *value* we care about — not the whole, unstable URLSearchParams object
  const vpolKey: string = urlSearchParams?.get("vpol") ?? "";

  // Build the canonical valuation (ValueSeal)
  useEffect(() => {
    let alive = true;

    (async () => {
      if (!payload || !Number.isFinite(currentPulse ?? NaN)) {
        if (!alive) return;

        // Idempotent clears (no-op if already null)
        setValSeal((prev) => (prev === null ? prev : null));
        setLivePrice((prev) => (prev === null ? prev : null));
        setPriceFlash((prev) => (prev === null ? prev : null));
        prevPriceRef.current = null;
        lastStampRef.current = null;
        return;
      }

      const p: any = payload || {};

      // Deterministic, typed-enough metadata for valuation
      const meta: any = {
        // identity & rhythm
        pulse: p.pulse,
        kaiPulse: p.pulse,
        beat: p.beat,
        stepIndex: p.stepIndex,
        stepsPerBeat: p.stepsPerBeat,

        // craft signals (optional)
        seriesSize: p.seriesSize,
        quality: p.quality,
        creatorVerified: p.creatorVerified,
        creatorRep: p.creatorRep,

        // resonance (optional)
        frequencyHz: p.frequencyHz,
        chakraDay: p.chakraDay,
        chakraGate: p.chakraGate,

        // lineage (optional)
        transfers: p.transfers,
        cumulativeTransfers: p.cumulativeTransfers,

        // segmented head (optional)
        segments: p.segments,
        segmentsMerkleRoot: p.segmentsMerkleRoot,
        transfersWindowRoot: p.transfersWindowRoot,

        // intrinsic IP cashflows (optional)
        ip: p.ip,

        // signatures (optional)
        kaiSignature: p.kaiSignature,
        userPhiKey: p.userPhiKey,

        // policy pin — use stable string only
        valuationPolicyId: vpolKey || undefined,
      };

      const { seal } = await buildValueSeal(meta, currentPulse as number, hasher);
      if (!alive) return;

      // Avoid redundant sets: only update when the stamp actually changes
      if (lastStampRef.current !== seal.stamp) {
        setValSeal((prev) => (prev && prev.stamp === seal.stamp ? prev : seal));
        lastStampRef.current = seal.stamp;
      }

      const newPrice = seal.valuePhi;
      const prev = prevPriceRef.current;

      if (prev !== newPrice) {
        setLivePrice((prevLive) => (prevLive === newPrice ? prevLive : newPrice));
        if (prev != null && Math.abs(newPrice - prev) > 1e-9) {
          setPriceFlash((prevFlash) => (prevFlash === "up" && newPrice > prev ? prevFlash : newPrice > prev ? "up" : "down"));
        } else {
          setPriceFlash((prevFlash) => (prevFlash === null ? prevFlash : null));
        }
        prevPriceRef.current = newPrice;
      }
    })();

    return () => {
      alive = false;
    };
    // Critical: depend on vpolKey (stable string), not the URLSearchParams object.
  }, [payload, currentPulse, vpolKey, hasher]);

  // Convenience: claim pulse
  const claimPulse = useMemo(() => (payload as any)?.pulse, [payload]);

  // 1) Numeric rarity
  const rarity = useMemo(() => {
    if (!Number.isFinite(claimPulse ?? NaN))
      return { score: null as number | null, lines: [] as string[] };
    return {
      score: rarityScore01FromPulse(claimPulse as number),
      lines: explainRarity(claimPulse as number),
    };
  }, [claimPulse]);

  // 2) Live oscillators
  const oscillation = useMemo(() => {
    if (!Number.isFinite(claimPulse ?? NaN) || !Number.isFinite(currentPulse ?? NaN)) return null;
    const stepsPerBeat =
      valSeal?.inputs?.pulsesPerBeat
        ? Math.max(1, Math.round(valSeal.inputs.pulsesPerBeat / 11))
        : (payload as any)?.stepsPerBeat ?? 44;
    const cadence = valSeal?.inputs?.cadenceRegularity ?? 1;
    const resonance = valSeal?.inputs?.resonancePhi ?? 0.5;
    const stepIndexClaimOverride = (payload as any)?.stepIndex;
    return explainOscillation(claimPulse as number, currentPulse as number, {
      stepsPerBeat,
      cadenceRegularity: cadence,
      resonancePhi: resonance,
      stepIndexClaimOverride,
    });
  }, [claimPulse, currentPulse, valSeal, payload]);

  // 3) Lineage narrative
  const lineageNarrative = useMemo(() => {
    const transfers = (payload as any)?.transfers;
    if (!transfers || !transfers.length) return ["No closed transfers yet — lineage still forming."];
    return explainLineage(transfers, { stepsPerBeat: (payload as any)?.stepsPerBeat ?? 44 });
  }, [payload]);

  // 4) Trust & Market tier
  const trust = useMemo(() => (valSeal ? computeTrustGrade(valSeal.inputs) : null), [valSeal]);
  const marketTier = useMemo(
    () => (!Number.isFinite(claimPulse ?? NaN) ? null : classifyMarketTier(claimPulse as number, valSeal ?? undefined)),
    [claimPulse, valSeal]
  );

  // 5) Kairos scanner window
  const kairos = useMemo(() => {
    if (!Number.isFinite(currentPulse ?? NaN)) return { window: [] as any[] };
    const start = currentPulse as number;
    const window = scanKairosWindow(start, 144, 1, { stepsPerBeat: (payload as any)?.stepsPerBeat ?? 44 });
    return { window };
  }, [currentPulse, payload]);

  // 6) Visuals: spiral + scrolls
  const visuals = useMemo(() => {
    if (!valSeal || !Number.isFinite(claimPulse ?? NaN)) {
      return { spiralSVG: null, scrollSVG: null, scrollText: null, scrollHTML: null };
    }
    const spiralSVG = renderKairosSpiralSVG(claimPulse as number);
    const { scrollSVG, scrollText } = toExplainableScroll(valSeal, { title: "Kai-Sigil Valuation Scroll" });
    const scrollHTML = renderScrollHTML(valSeal, { title: "Kai-Sigil Valuation Scroll" });
    return { spiralSVG, scrollSVG, scrollText, scrollHTML };
  }, [valSeal, claimPulse]);

  // 7) Audio identity
  const audio = useMemo(() => {
    if (!Number.isFinite(claimPulse ?? NaN)) return { dataURI: null, renderWav: undefined };
    const { dataURI } = renderSigilWav(claimPulse as number, 2.0, 44100, { stereo: true });
    const renderWav = (seconds = 2.0, sampleRate = 44100, opts?: any) =>
      renderSigilWav(claimPulse as number, seconds, sampleRate, opts);
    return { dataURI, renderWav };
  }, [claimPulse]);

  // 8) Resonance pairing with another pulse
  const motifSimilarityWith = useMemo(
    () => (otherPulse: number | null | undefined) =>
      !Number.isFinite(otherPulse ?? NaN) || !Number.isFinite(claimPulse ?? NaN)
        ? null
        : motifSimilarity(claimPulse as number, otherPulse as number),
    [claimPulse]
  );

  // Handy passthrough helpers
  const helpers = useMemo(
    () => ({
      explainRarity: () => rarity.lines,
      explainLineage: () => lineageNarrative,
      scanKairos: (start: number, count: number, step = 1, stepsPerBeat?: number) =>
        scanKairosWindow(start, count, step, { stepsPerBeat: stepsPerBeat ?? (payload as any)?.stepsPerBeat ?? 44 }),
      makeScroll: (title?: string) => (valSeal ? toExplainableScroll(valSeal, { title: title ?? "Kai-Sigil Valuation Scroll" }) : null),
      makeScrollHTML: (title?: string) => (valSeal ? renderScrollHTML(valSeal, { title }) : null),
      makeSpiral: (p?: number) =>
        Number.isFinite((p ?? claimPulse) as number) ? renderKairosSpiralSVG((p ?? claimPulse) as number) : null,
    }),
    [rarity.lines, lineageNarrative, payload, valSeal, claimPulse]
  );

  return {
    // core valuation
    valSeal,
    livePrice,
    priceFlash,

    // rarity & resonance
    rarity,          // { score, lines[] }
    oscillation,     // { breathWave, dayWave, strobeWave, momentAffinity, combinedOsc, ... } | null

    // provenance & trust
    lineageNarrative, // string[]
    trust,            // { stars, score01, reasons } | null
    marketTier,       // { tier, label, reason } | null

    // kairos & media
    kairos,          // { window }
    visuals,         // { spiralSVG, scrollSVG, scrollText, scrollHTML }
    audio,           // { dataURI, renderWav(...) }

    // utilities
    motifSimilarityWith,
    helpers,
  } as const;
}
