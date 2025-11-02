// src/components/KaiSigil.tsx
// (QR-FREE) KaiSigil — wired with ledger + DHT embed (Atomic Build Upgrade)
// SINGLE-SOURCE STEP at runtime: use caller stepIndex if given, otherwise derive from pulse.
// Backward-compatible: stepIndex/stepPct props are optional so existing callers keep working.
// RAH • VEH • YAH • DAH — In the pattern of φ (phi), let every step agree with itself.

"use client";

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { canonicalUrlFromContext } from "../utils/sigilUrl";
import { PULSE_MS } from "../utils/kai_pulse";

import type {
  KaiSigilHandle,
  KaiSigilProps,
  Built,
  SnapshotKey,
  WeekdayName,
} from "./KaiSigil/types";
import {
  CHAKRA_GATES,
  CHAKRAS,
  CENTER,
  PHI,
  SPACE,
  hsl,
  lissajousPath,
  polygonPath,
  normalizeChakraDayKey,
} from "./KaiSigil/constants";
import { deriveFrequencyHzSafe } from "./KaiSigil/freq";
import {
  coerceInt,
  coercePct,
  getStrField,
  isPlainObj,
  safeStringify,
  clean,
} from "./KaiSigil/utils";
import { base58CheckEncode, bytesToHex, mulberry32, sha256 } from "./KaiSigil/crypto";
import {
  stepIndexFromPulseExact,
  percentIntoStepFromPulseExact,
  STEPS_SAFE,
} from "./KaiSigil/step";
import { deriveCreatorIdentity } from "./KaiSigil/identity";
import { useKaiData, useMediaPrefs, useSeed } from "./KaiSigil/hooks";
import { useStableSha256 } from "./KaiSigil/valuationBridge";
import ZKGlyph from "./KaiSigil/ZKGlyph";
import { buildEmbeddedBundle, stringifyEmbeddedMeta } from "./KaiSigil/embed";
import { makeExporters } from "./KaiSigil/exporters";

/* valuation imports */
import type { ValueSeal, SigilMetadataLite } from "../utils/valuation";
import { buildValueSeal, computeIntrinsicUnsigned } from "../utils/valuation";

/* modularized subcomponents/helpers */
import Defs from "./KaiSigil/Defs";
import MetadataBlocks from "./KaiSigil/Metadata";
import Art from "./KaiSigil/Art";
import {
  isWeekdayName,
  isRecord,
  qMap,
  hexToBinaryBits,
  makeSummary,
  toSummaryB64,
  fromSummaryB64, // UTF-8 safe decoder
  getSnapshots,
  precomputeLedgerDht,
  makeOuterRingText,
  phaseColorFrom,
} from "./KaiSigil/helpers";

/**
 * In φ-order: compute a single canonical step per render, snapshot it,
 * and carry that same step coherently through DOM, metadata, and exports.
 */
const KaiSigil = forwardRef<KaiSigilHandle, KaiSigilProps>((props, ref) => {
  const {
    id: htmlId,
    pulse: pulseProp,
    beat: beatProp,
    stepIndex: stepIndexProp,
    stepPct: stepPctProp,
    chakraDay,
    size = 240,
    hashOverride,
    strict = process.env.NODE_ENV !== "production",
    quality = "high",
    animate = true,
    debugOutline = false,
    goldenId,
    hashMode = "moment",
    userPhiKey: propPhiKey,
    kaiSignature: propSignature,
    intentionSigil,
    creatorPublicKey,
    origin,
    onReady,
    onError,
    showZKBadge = true,
    qrHref,
    klock,
    embed,
  } = props;

  // Inputs coerced to ints for stable math.
  const pulse = coerceInt(pulseProp);
  const beat = coerceInt(beatProp);

  // Derivations from pulse when caller didn't specify.
  const derivedStepIndexFromPulse = useMemo(
    () => stepIndexFromPulseExact(pulse),
    [pulse]
  );
  const derivedStepPctFromPulse = useMemo(
    () => percentIntoStepFromPulseExact(pulse),
    [pulse]
  );

  // Canonicalized stepIndex for this render.
  const stepIndex = useMemo(() => {
    let raw = coerceInt(stepIndexProp, Number.NaN);
    if (!Number.isFinite(raw) || raw < 0 || raw >= STEPS_SAFE) raw = derivedStepIndexFromPulse;
    return Math.trunc((((raw % STEPS_SAFE) + STEPS_SAFE) % STEPS_SAFE));
  }, [stepIndexProp, derivedStepIndexFromPulse]);

  // Visual phase (clamped) for animations/graphics only.
  const stepPct = useMemo(() => {
    let v = coercePct(stepPctProp, Number.NaN);
    if (!Number.isFinite(v)) v = derivedStepPctFromPulse;
    return Math.max(0, Math.min(1 - Number.EPSILON, v));
  }, [stepPctProp, derivedStepPctFromPulse]);

  const chakraDayKey = normalizeChakraDayKey(chakraDay);
  const weekdayResolved: WeekdayName | undefined = isWeekdayName(chakraDay) ? chakraDay : undefined;

  // Canonical (render-time) state used across visuals and attributes.
  const canon = useMemo(
    () => ({
      pulse,
      beat,
      stepIndex,
      chakraDayKey,
      stepsPerBeat: STEPS_SAFE,
      visualClamped: stepPct, // used locally for visuals only (not exported)
    }),
    [pulse, beat, stepIndex, chakraDayKey, stepPct]
  );

  const { prefersReduce, prefersContrast } = useMediaPrefs();
  const { kaiData, kaiDataRef } = useKaiData(hashMode);

  /* Seeds & visuals */
  const seedKey = `${canon.pulse}|${canon.beat}|${canon.stepIndex}|${canon.chakraDayKey}`;
  const seed = useSeed(seedKey);
  const rnd = useMemo(() => mulberry32(seed), [seed]);

  const { sides, hue } = CHAKRAS[chakraDayKey];
  const a = (canon.pulse % 7) + 1;
  const b = (canon.beat % 5) + 2;
  const delta = canon.visualClamped * 2 * Math.PI;
  const rotation = (PHI ** 2 * Math.PI * (canon.pulse % 97)) % (2 * Math.PI);
  const light = 50 + 15 * Math.sin(canon.visualClamped * 2 * Math.PI);
  const baseColor = hsl((hue + 360 * 0.03 * canon.visualClamped) % 360, 100, light);
  const chakraGate = CHAKRA_GATES[chakraDayKey];
  const frequencyHzCurrent = useMemo(
    () => deriveFrequencyHzSafe(chakraDayKey, stepIndex),
    [chakraDayKey, stepIndex]
  );

  const dpr = typeof window !== "undefined" ? window.devicePixelRatio ?? 1 : 1;
  const doAnim = animate && !prefersReduce;
  const resolvedGoldenId = goldenId ? `${goldenId}-${stepIndex}` : undefined;
  const uid = resolvedGoldenId ?? `ks-${canon.pulse}-${canon.beat}-${stepIndex}`;

  const pad = Math.max(10, Math.floor((size ?? 240) * 0.08));
  const safeTextWidth = Math.max(40, (size ?? 240) - pad * 2);
  const outlineWidth = Math.max(0.6, (size ?? 240) * 0.003);
  const strokeCore = Math.max(1.4, (size ?? 240) * 0.009);
  const dotR = Math.max(2.5, (size ?? 240) * 0.016);

  const durMs = 5000 + Math.floor(rnd() * 800) + Math.floor((seed % 436) / 2);
  const offMs = Math.floor((seed >>> 1) % durMs);

  const corePath = useMemo(() => polygonPath(sides, rotation), [sides, rotation]);
  const auraPath = useMemo(() => lissajousPath(a, b, delta), [a, b, delta]);

  /* identity fallbacks */
  const [autoSig, setAutoSig] = useState<string>();
  const [autoPhi, setAutoPhi] = useState<string>();
  useEffect(() => {
    (async () => {
      let sigLocal = propSignature;
      if (!sigLocal) {
        const base = `${canon.pulse}|${canon.beat}|${stepIndex}|${chakraDayKey}|${intentionSigil ?? ""}`;
        sigLocal = bytesToHex(await sha256(base));
        setAutoSig(sigLocal);
      }
      let phiLocal = propPhiKey;
      if (!phiLocal && sigLocal) {
        const hashBytes = await sha256(`${sigLocal}φ`);
        phiLocal = await base58CheckEncode(hashBytes.slice(0, 20));
        setAutoPhi(phiLocal);
      }
    })().catch(onError);
  }, [propSignature, propPhiKey, canon.pulse, canon.beat, stepIndex, chakraDayKey, intentionSigil, onError]);

  const kaiSignature = propSignature ?? autoSig;
  const userPhiKey = propPhiKey ?? autoPhi;

  /* valuation */
  const hasher = useStableSha256();
  const mintPulseRef = useRef<number>(canon.pulse);
  const [liveValuePhi, setLiveValuePhi] = useState<number | null>(null);
  const [mintSeal, setMintSeal] = useState<ValueSeal | null>(null);
  const valuationMetaRef = useRef<SigilMetadataLite | null>(null);

  useEffect(() => {
    valuationMetaRef.current = {
      pulse: mintPulseRef.current,
      kaiPulse: mintPulseRef.current,
      kaiSignature: kaiSignature ?? undefined,
      userPhiKey: userPhiKey ?? undefined,
      beat: canon.beat,
      stepIndex: canon.stepIndex,
      stepsPerBeat: canon.stepsPerBeat,
      quality: qMap(quality),
      frequencyHz: frequencyHzCurrent,
      chakraDay: canon.chakraDayKey,
      chakraGate,
    };
  }, [canon.beat, canon.stepIndex, kaiSignature, userPhiKey, frequencyHzCurrent, canon.chakraDayKey, chakraGate, quality]);

  const stateKey: SnapshotKey = useMemo(
    () => `${canon.pulse}|${canon.beat}|${canon.stepIndex}|${canon.chakraDayKey}`,
    [canon.pulse, canon.beat, canon.stepIndex, canon.chakraDayKey]
  );
  const [built, setBuilt] = useState<Built | null>(null);

  /**
   * FIX #1 (Atomic Build): snapshot this render’s exact inputs and build once.
   * All exported metadata uses the same stepIndex the DOM uses.
   */
  useEffect(() => {
    let cancelled = false;

    // Snapshot for coherent export.
    const pulse0 = canon.pulse;
    const beat0 = canon.beat;
    const step0 = canon.stepIndex;
    const day0 = canon.chakraDayKey;
    const stepsPerBeat0 = canon.stepsPerBeat;
    const freq0 = frequencyHzCurrent;
    const state0 = stateKey;
    const weekday0: WeekdayName | null = isWeekdayName(chakraDay) ? chakraDay : null;

    (async () => {
      try {
        const creatorMeta = await deriveCreatorIdentity({
          creatorPublicKey,
          userPhiKey,
          kaiSignature,
          origin,
          pulse: pulse0,
          beat: beat0,
          chakraDay: day0,
          stepIndex: step0,
        });

        const kd = kaiDataRef.current;
        const title =
          clean(getStrField(kd, "kaiMomentSummary")) ??
          clean(getStrField(kd, "kairos_seal")) ??
          clean(getStrField(kd, "kairos_seal_day_month_percent")) ??
          `Kairos HarmoniK Sigil • ${day0} • Beat ${beat0} • Step ${step0}`;

        const valuationSource: SigilMetadataLite = {
          pulse: mintPulseRef.current,
          kaiPulse: mintPulseRef.current,
          kaiSignature: kaiSignature ?? undefined,
          userPhiKey: userPhiKey ?? undefined,

          // ✅ always take these from the current render, not canon or props
          beat: beat0,
          stepsPerBeat: stepsPerBeat0,

          quality: quality === "low" ? "low" : "high",
          frequencyHz: freq0,
          chakraDay: day0,
          chakraGate,
        };

        try {
          const { seal } = await buildValueSeal(valuationSource, mintPulseRef.current, hasher);
          setMintSeal(seal);
        } catch (e) {
          onError?.(e);
        }

        const rawBundle: unknown = await buildEmbeddedBundle({
          canon: {
            pulse: pulse0,
            beat: beat0,
            stepIndex: step0, // ← SAME step as DOM
            chakraDayKey: day0,
            stepsPerBeat: stepsPerBeat0,
            // NOTE: do NOT include visualClamped here; it's not part of the type.
          },
          hashMode,
          chakraGate,
          kaiSignature,
          userPhiKey,
          intentionSigil,
          origin,
          title,
          klockSnapshot: isPlainObj(klock) ? (JSON.parse(safeStringify(klock)) as Record<string, unknown>) : null,
          kaiApiSnapshot: isPlainObj(kaiData) ? (JSON.parse(safeStringify(kaiData)) as Record<string, unknown>) : null,
          weekdayResolved: weekday0,
          valuationSource,
          mintSeal: null, // seal JSON added outside for clarity
          frequencyHzCurrent: freq0,
          qrHref,
          canonicalUrlFromContext,
          creatorResolved: creatorMeta,
        });

        // Narrow bundle safely
        let embeddedBase: Record<string, unknown> = {};
        let payloadHashHex = "";
        let parityUrl = "";
        let innerRingText = "";
        let sigilUrl = "";
        let hashB58 = "";
        if (isRecord(rawBundle)) {
          const eb = rawBundle["embeddedBase"];
          if (isRecord(eb)) embeddedBase = eb;
          const ph = rawBundle["payloadHashHex"];
          if (typeof ph === "string") payloadHashHex = ph;
          const pu = rawBundle["parityUrl"];
          if (typeof pu === "string") parityUrl = pu;
          const ir = rawBundle["innerRingText"];
          if (typeof ir === "string") innerRingText = ir;
          const su = rawBundle["sigilUrl"];
          if (typeof su === "string") sigilUrl = su;
          const hb = rawBundle["hashB58"];
          if (typeof hb === "string") hashB58 = hb;
        }

        const headerValuationRuntime = {
          PULSE_MS,
          STEPS_BEAT: stepsPerBeat0,
          PHI,
          algorithm: "computeIntrinsicUnsigned" as const,
          version: "1",
        };

        const valuationLiveAtExport = valuationSource
          ? computeIntrinsicUnsigned(valuationSource, pulse0).unsigned.valuePhi
          : null;

        const embedded = {
          ...embeddedBase,
          valuation: mintSeal ?? null,
          valuationSource,
          valuationRuntime: headerValuationRuntime,
          valuationLiveAtExport,
        };

        const embeddedMetaJson = stringifyEmbeddedMeta(embedded);

        const next: Built = {
          createdFor: {
            pulse: pulse0,
            beat: beat0,
            stepIndex: step0, // ← SAME step as DOM
            chakraDayKey: day0,
            stateKey: state0,
          },
          payloadHashHex,
          shareUrl: parityUrl,
          embeddedMetaJson,
          valuationSourceJson: JSON.stringify(valuationSource),
          zkScheme: "groth16-poseidon",
          zkPoseidonHash:
            "7110303097080024260800444665787206606103183587082596139871399733998958991511",
          innerRingText,
          sigilUrl,
          hashB58,
          frequencyHz: freq0,
        };

        if (!cancelled && next.createdFor.stateKey === state0) {
          setBuilt(next);
          onReady?.({
            hash: next.payloadHashHex,
            url: next.shareUrl,
            metadataJson: next.embeddedMetaJson,
          });
        }
      } catch (e) {
        onError?.(e);
        if (strict) {
          throw e instanceof Error ? e : new Error(String(e));
        }
      }
    })().catch((e) => {
      onError?.(e);
      if (strict) throw (e instanceof Error ? e : new Error(String(e)));
    });

    return () => {
      cancelled = true;
    };
    // Note: deps include canon.* and frequency; visualClamped does not affect exports.
  }, [
    stateKey,
    canon.pulse,
    canon.beat,
    canon.stepIndex,
    canon.chakraDayKey,
    canon.stepsPerBeat,
    frequencyHzCurrent,
    kaiSignature,
    userPhiKey,
    hashMode,
    creatorPublicKey,
    origin,
    qrHref,
    strict,
    onReady,
    onError,
    chakraDayKey,
    quality,
    klock,
    kaiData,
    kaiDataRef,
    hasher,
    chakraGate,
    chakraDay,
  ]);

  /* Prefer the built snapshot for display (DOM/summary), otherwise use live canon */
  const displayStepIndex = useMemo(() => {
    const b = built;
    return b && b.createdFor.stateKey === stateKey ? b.createdFor.stepIndex : canon.stepIndex;
  }, [built, stateKey, canon.stepIndex]);

  const displayFrequencyHz = useMemo(() => {
    const b = built;
    return b && b.createdFor.stateKey === stateKey ? b.frequencyHz : frequencyHzCurrent;
  }, [built, stateKey, frequencyHzCurrent]);

  /* LIVE value each pulse */
  useEffect(() => {
    try {
      if (!valuationMetaRef.current || !Number.isFinite(canon.pulse)) {
        setLiveValuePhi(null);
        return;
      }
      const { unsigned } = computeIntrinsicUnsigned(valuationMetaRef.current, canon.pulse);
      setLiveValuePhi(unsigned.valuePhi);
    } catch (e) {
      onError?.(e);
      setLiveValuePhi(null);
    }
  }, [canon.pulse, onError]);

  /* summary + snapshots
     FIX #2: Use two summaries.
     - summaryDisplay (visible): reflects displayStepIndex
     - summaryForAttrs (data-*): uses built step when available to avoid race
  */
  const eternalSeal =
    getStrField(klock, "eternalSeal") ??
    getStrField(klock, "seal") ??
    getStrField(kaiData, "kairos_seal");

  const summaryDisplay = useMemo(
    () => makeSummary(eternalSeal, canon.beat, displayStepIndex, canon.pulse),
    [eternalSeal, canon.beat, displayStepIndex, canon.pulse]
  );

  const summaryForAttrs = useMemo(() => {
    const stepForAttrs =
      built && built.createdFor.stateKey === stateKey
        ? built.createdFor.stepIndex   // ← prefer built step
        : displayStepIndex;
    return makeSummary(eternalSeal, canon.beat, stepForAttrs, canon.pulse);
  }, [built, stateKey, eternalSeal, canon.beat, displayStepIndex, canon.pulse]);
  

  const summaryB64 = useMemo(() => toSummaryB64(summaryForAttrs), [summaryForAttrs]);

  const {
    klockIsoSnapshot,
    apiSnapshot,
    klockDataAttrs,
    eternalMonth,
    harmonicDay,
    kaiPulseEternal,
    solarChakraStepString,
    chakraArc,
  } = useMemo(() => getSnapshots(klock, kaiData), [klock, kaiData]);

  /* Optional full-SVG hash check */
  const svgRef = useRef<SVGSVGElement>(null!);
  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!el || !hashOverride) return;
    let cancelled = false;
    (async () => {
      try {
        const clone = el.cloneNode(true) as SVGSVGElement;
        clone.removeAttribute("data-svg-hash");
        clone.removeAttribute("data-svg-valid");
        const xml = new XMLSerializer().serializeToString(clone);
        const calc = bytesToHex(await sha256(xml));
        if (cancelled) return;
        el.dataset.svgHash = calc;
        el.dataset.svgValid = String(calc === hashOverride.toLowerCase());
        if (calc !== hashOverride.toLowerCase() && strict) {
          throw new Error(`[KaiSigil] SVG HASH MISMATCH (${calc})`);
        }
      } catch (e) {
        onError?.(e);
        if (strict) throw (e instanceof Error ? e : new Error(String(e)));
      }
    })().catch((e) => {
      onError?.(e);
      if (strict) throw (e instanceof Error ? e : new Error(String(e)));
    });
    return () => {
      cancelled = true;
    };
  }, [hashOverride, strict, stateKey, onError]);

  /* Post-render invariants — ensure DOM and built snapshot agree. */
  useLayoutEffect(() => {
    if (!strict) return;
    const el = svgRef.current;
    if (!el) return;

    const b = built;
    if (!b || b.createdFor.stateKey !== stateKey) return;

    const stepAttrStr = el.getAttribute("data-step-index");
    const freqAttrStr = el.getAttribute("data-frequency-hz");
    const sumB64Attr = el.getAttribute("data-summary-b64") ?? "";

    const stepAttr = stepAttrStr != null && stepAttrStr !== "" ? Number(stepAttrStr) : NaN;
    const freqAttr = freqAttrStr != null && freqAttrStr !== "" ? Number(freqAttrStr) : NaN;
    const shareAttr = el.getAttribute("data-share-url") || undefined;
    const sigAttr = el.getAttribute("data-payload-hash") || undefined;

    // Decode the summary (UTF-8 safe) and compare against the attribute-target summary.
    let decoded = "";
    try {
      decoded = fromSummaryB64(sumB64Attr);
    } catch {
      decoded = "";
    }

    // The attribute should match summaryForAttrs exactly.
    const expectedSummary = summaryForAttrs;

    // Be tolerant of any legacy cached bad encodes (bullet variants)
    const normalize = (s: string) => s.replace(/â¢|·|\u2022/g, "•");

    const problems: string[] = [];
    if (normalize(decoded) !== normalize(expectedSummary)) {
      problems.push(`summary mismatch (“${decoded}” != “${expectedSummary}”)`);
    }

    if (!Number.isFinite(stepAttr)) {
      problems.push("missing/invalid data-step-index");
    } else if (stepAttr !== b.createdFor.stepIndex) {
      problems.push(`data-step-index(${stepAttr}) != built(${b.createdFor.stepIndex})`);
    }

    if (!Number.isFinite(freqAttr)) {
      problems.push("missing/invalid data-frequency-hz");
    } else {
      const freqFromStep = deriveFrequencyHzSafe(chakraDayKey, stepAttr);
      if (Math.abs(freqAttr - b.frequencyHz) > 1e-6 || Math.abs(freqFromStep - freqAttr) > 1e-6) {
        problems.push(`frequency/step mismatch (${freqAttr} vs step ${stepAttr})`);
      }
    }

    if (shareAttr !== b.shareUrl) problems.push("data-share-url != built.shareUrl");
    if (sigAttr && sigAttr !== b.payloadHashHex) problems.push("data-payload-hash != built.payloadHashHex");

    if (problems.length) throw new Error(`[KaiSigil] Invariant violation → ${problems.join("; ")}`);
  }, [
    strict,
    built,
    stateKey,
    chakraDayKey,
    canon.beat,
    canon.pulse,
    displayFrequencyHz,
    summaryForAttrs,
  ]);

  const { toDataURL, exportBlob, verifySvgHash } = makeExporters(svgRef, size);

  const extraEmbed = useMemo(
    () => (isPlainObj(embed) ? (JSON.parse(safeStringify(embed)) as Record<string, unknown>) : null),
    [embed]
  );

  const payloadHashHex = built?.createdFor.stateKey === stateKey ? built?.payloadHashHex : undefined;
  const zkScheme = built?.createdFor.stateKey === stateKey ? built?.zkScheme : undefined;
  const zkPoseidonHash = built?.createdFor.stateKey === stateKey ? built?.zkPoseidonHash : undefined;
  const shareUrl = built?.createdFor.stateKey === stateKey ? built?.shareUrl : undefined;
  const frequencyHz =
    (built?.createdFor.stateKey === stateKey ? built?.frequencyHz : undefined) ?? frequencyHzCurrent;

  const binaryForRender = useMemo(() => {
    if (!kaiSignature) return "";
    const bin = hexToBinaryBits(kaiSignature);
    const circumference = 2 * Math.PI * ((size ?? 240) * 0.46);
    const approxCharWidth = Math.max(3.5, (size ?? 240) * 0.028 * 0.55);
    const maxChars = Math.max(24, Math.floor(circumference / approxCharWidth));
    return bin.length > maxChars ? bin.slice(0, maxChars) : bin;
  }, [kaiSignature, size]);

  const phaseColor = phaseColorFrom(hue, canon.visualClamped, built?.payloadHashHex);

  const sigPathId = kaiSignature ? `${uid}-sig-path` : undefined;
  const descId = `${uid}-desc`;

  const absoluteShareUrl = built?.createdFor.stateKey === stateKey ? built?.shareUrl : undefined;
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    absoluteShareUrl ? (
      <a href={absoluteShareUrl} target="_self" aria-label={`Open canonical sigil ${built?.payloadHashHex ?? ""}`}>
        {children}
      </a>
    ) : (
      <g tabIndex={0} role="button" aria-label="Sigil not yet canonicalized">
        {children}
      </g>
    );

  const stateKeyOk = Boolean(built?.createdFor.stateKey === stateKey);
  const outerRingText = makeOuterRingText(
    payloadHashHex,
    stateKeyOk,
    chakraDayKey,
    frequencyHz,
    canon.pulse,
    canon.beat,
    zkPoseidonHash
  );

  const { ledgerJson, dhtJson } = useMemo(
    () => precomputeLedgerDht(stateKeyOk ? built?.embeddedMetaJson : undefined),
    [built, stateKeyOk]
  );

  /* Imperative API */
  useImperativeHandle(ref, () => ({
    toDataURL,
    exportBlob,
    verifySvgHash,
    verifyConsistency: () => {
      const b = built;
      if (!b) throw new Error("No built snapshot yet");
      if (b.createdFor.stateKey !== stateKey) throw new Error("Built snapshot does not match current stateKey");
    },
    uid,
    stepIndex,
    payloadHashHex: built?.payloadHashHex,
    sigilUrl: built?.sigilUrl,
    userPhiKey,
    kaiSignature,
  }));

  return (
    <svg
      ref={svgRef}
      id={htmlId ?? uid}
      role="img"
      aria-describedby={descId}
      lang="en"
      aria-label={`Kairos sigil — pulse ${canon.pulse}`}
      viewBox={`0 0 ${SPACE} ${SPACE}`}
      width={size}
      height={size}
      shapeRendering="geometricPrecision"
      style={
        {
          background: "transparent",
          "--dur": `${durMs}ms`,
          "--off": `${offMs}ms`,
          "--pulse": `${PULSE_MS}ms`,
          cursor: shareUrl ? "pointer" : "default",
        } as React.CSSProperties
      }
      data-pulse={String(canon.pulse)}
      data-beat={String(canon.beat)}
      data-step-index={String(displayStepIndex)}
      data-frequency-hz={String(displayFrequencyHz)}
      data-chakra-day={chakraDayKey}
      data-weekday={weekdayResolved ?? undefined}
      data-chakra-gate={chakraGate}
      data-quality={quality}
      data-golden-id={goldenId ?? undefined}
      data-kai-signature={kaiSignature ?? undefined}
      data-phi-key={userPhiKey ?? undefined}
      data-payload-hash={payloadHashHex ?? undefined}
      data-zk-scheme={zkScheme ?? undefined}
      data-zk-poseidon-hash={zkPoseidonHash ?? undefined}
      data-share-url={shareUrl || undefined}
      data-eternal-seal={eternalSeal ?? undefined}
      data-eternal-month={eternalMonth ?? undefined}
      data-harmonic-day={harmonicDay ?? undefined}
      data-kai-pulse-eternal={typeof kaiPulseEternal === "number" ? String(kaiPulseEternal) : undefined}
      data-solar-chakra-step={solarChakraStepString ?? undefined}
      data-arc={chakraArc ?? undefined}
      data-summary-b64={summaryB64}
      {...klockDataAttrs}
      data-valuation-algorithm={mintSeal?.algorithm ?? undefined}
      data-valuation-policy={mintSeal?.policyId ?? undefined}
      data-valuation-policy-checksum={mintSeal?.policyChecksum ?? undefined}
      data-valuation-stamp={mintSeal?.stamp ?? undefined}
      data-valuation-premium={mintSeal?.premium ?? undefined}
      data-valuation-value-phi={mintSeal?.valuePhi != null ? String(mintSeal.valuePhi) : undefined}
      data-valuation-computed-at={
        mintSeal?.computedAtPulse != null ? String(mintSeal.computedAtPulse) : undefined
      }
      data-value-phi-live={liveValuePhi != null ? String(liveValuePhi) : undefined}
    >
      <title>{`Kairos HarmoniK Sigil • Pulse ${canon.pulse}`}</title>
      <desc id={descId}>↳ {summaryDisplay}</desc>

      <MetadataBlocks
        uid={uid}
        stateKeyOk={stateKeyOk}
        embeddedMetaJson={stateKeyOk ? built?.embeddedMetaJson : undefined}
        klockIsoSnapshot={klockIsoSnapshot}
        apiSnapshot={apiSnapshot}
        extraEmbed={extraEmbed}
        mintSealJson={mintSeal ? JSON.stringify(mintSeal) : null}
        valuationSourceJson={stateKeyOk ? built?.valuationSourceJson : undefined}
        displayStepIndex={displayStepIndex}
        stepsPerBeat={canon.stepsPerBeat}
        eternalSeal={eternalSeal ?? undefined}
        ledgerJson={ledgerJson}
        dhtJson={dhtJson}
      />

      {/* defs (creates gradient/filter IDs based on uid) */}
      <Defs
        uid={uid}
        hue={hue}
        visualClamped={canon.visualClamped}
        doAnim={doAnim}
        quality={quality}
        dpr={dpr}
        seed={seed}
        payloadHashHex={built?.payloadHashHex}
        auraPath={auraPath}
      />

      {/* Optional signature path */}
      {kaiSignature && (
        <defs>
          <path
            id={sigPathId}
            d={`M ${CENTER} ${CENTER - SPACE * 0.46}
                a ${SPACE * 0.46} ${SPACE * 0.46} 0 1 1 0 ${SPACE * 0.92}
                a ${SPACE * 0.46} ${SPACE * 0.46} 0 1 1 0 -${SPACE * 0.92}`}
            fill="none"
          />
        </defs>
      )}

      <Wrapper>
        <g id={`${uid}-tilt`} style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}>
          {doAnim && (
            <animateTransform
              attributeName="transform"
              type="rotate"
              values={`-2 ${CENTER} ${CENTER};2 ${CENTER} ${CENTER};-2 ${CENTER} ${CENTER}`}
              dur={`var(--dur)`}
              begin={`var(--off)`}
              repeatCount="indefinite"
            />
          )}

          <Art
            uid={uid}
            size={size}
            baseColor={baseColor}
            corePath={corePath}
            auraId={`${uid}-aura`}
            sigPathId={sigPathId}
            doAnim={doAnim}
            quality={quality}
            dpr={dpr}
            pad={pad}
            safeTextWidth={safeTextWidth}
            outlineWidth={prefersContrast ? outlineWidth * 1.2 : outlineWidth}
            strokeCore={strokeCore}
            dotR={dotR}
            debugOutline={debugOutline}
            prefersContrast={prefersContrast}
            haloId={`${uid}-halo`}
            netId={`${uid}-net`}
            warpId={`${uid}-warp`}
            glowId={`${uid}-glow`}
            maskId={`${uid}-mask`}
            rotation={rotation}
            chakraSides={CHAKRAS[chakraDayKey].sides}
            binaryForRender={binaryForRender}
            summary={summaryDisplay}
            pulse={canon.pulse}
          />
        </g>
      </Wrapper>

      {/* ZK glyph */}
      {showZKBadge && (
        <ZKGlyph
          uid={uid}
          size={size}
          phaseColor={phaseColor}
          outerRingText={outerRingText}
          innerRingText={built && built.createdFor.stateKey === stateKey ? built.innerRingText : "initializing…"}
          animate={animate}
          prefersReduce={prefersReduce}
        />
      )}
    </svg>
  );
});

KaiSigil.displayName = "KaiSigil";
export default KaiSigil;

// Re-export types so callers can `import { KaiSigilHandle, KaiSigilProps } from "./KaiSigil"`
export type { KaiSigilHandle, KaiSigilProps, Built, SnapshotKey, WeekdayName } from "./KaiSigil/types";