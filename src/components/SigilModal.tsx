/* ────────────────────────────────────────────────────────────────
   SigilModal.tsx · Atlantean Lumitech “Kairos Sigil Viewer”
   v22.4 — Boundary-locked pulse sync (perfect rAF + aligned ticks)
   • Only change: exact φ-boundary scheduler for countdown + pulse state
   • Perfectly synced “next pulse in …” and state update at boundary
   • Visibility/sleep resilient; catches missed pulses; zero drift
   • UPDATED: imports SigilMomentRow + uses eternal Ark color for “Eternal day” bar
   • UPDATED: Close (✕) hardened to always be top-clickable
────────────────────────────────────────────────────────────────── */

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ChangeEvent,
  type FC,
} from "react";
import { createPortal } from "react-dom";
import html2canvas from "html2canvas";
import JSZip from "jszip";

/* NEW: Moment row (datetime + day-progress UI) */
import SigilMomentRow from "./SigilMomentRow";

import KaiSigil, {
  type KaiSigilProps,
  type KaiSigilHandle,
} from "./KaiSigil";
import { StargateViewer } from "./StargateViewer";
import VerifierStamper from "./VerifierStamper/VerifierStamper";
import SealMomentModal from "./SealMomentModal";
import { makeSigilUrl, type SigilSharePayload } from "../utils/sigilUrl";
import "./SigilModal.css";

/* html2canvas typing compatibility (no `any`, extra-props allowed) */
type H2COptions = NonNullable<Parameters<typeof html2canvas>[1]>;
type Loose<T> = T & Record<string, unknown>;

/* ═════════════ external props ═════════════ */
interface Props {
  initialPulse?: number;
  onClose: () => void;
}

/* ═════════════ “server shape” — locally computed ═════════════ */
type HarmonicDay =
  | "Solhara"
  | "Aquaris"
  | "Flamora"
  | "Verdari"
  | "Sonari"
  | "Kaelith";

interface KaiApiResponseLike {
  kaiPulseEternal: number;
  eternalSeal: string;
  kairos_seal_day_month: string;
  eternalMonth: string;
  eternalMonthIndex: number;
  eternalChakraArc: string;
  eternalYearName: string;
  kaiTurahPhrase: string;
  chakraStepString: string;
  chakraStep: { stepIndex: number; percentIntoStep: number; stepsPerBeat: number };
  harmonicDay: HarmonicDay;
  kaiPulseToday: number;
  eternalKaiPulseToday: number;
  chakraBeat: { beatIndex: number; pulsesIntoBeat: number; beatPulseCount: number; totalBeats: number };
  eternalChakraBeat: { beatIndex: number; pulsesIntoBeat: number; beatPulseCount: number; totalBeats: number; percentToNext: number };
  harmonicWeekProgress: { weekDay: HarmonicDay; weekDayIndex: number; pulsesIntoWeek: number; percent: number };
  harmonicYearProgress: { daysElapsed: number; daysRemaining: number; percent: number };
  eternalMonthProgress: { daysElapsed: number; daysRemaining: number; percent: number };
  weekIndex: number;
  weekName: string;
  dayOfMonth: number;
  timestamp: string;
  kaiMomentSummary: string;
  compressed_summary: string;
  phiSpiralLevel: number;
}

/* ═════════════ canon constants (offline Eternal-Klok) ═════════════ */
const GENESIS_TS = Date.UTC(2024, 4, 10, 6, 45, 41, 888); // 2024-05-10 06:45:41.888 UTC
const KAI_PULSE_SEC = 3 + Math.sqrt(5);                   // φ-exact breath (≈ 5.236067977 s)
const PULSE_MS = KAI_PULSE_SEC * 1000;

/* Exact day pulses (float, for % display in moment row) */
const DAY_PULSES = 17_491.270_421;

const STEPS_BEAT = 44;

const BEATS_DAY = 36;

const DAYS_PER_WEEK = 6;
const DAYS_PER_MONTH = 42;
const MONTHS_PER_YEAR = 8;
const DAYS_PER_YEAR = DAYS_PER_MONTH * MONTHS_PER_YEAR; // 336

const PHI = (1 + Math.sqrt(5)) / 2;

const WEEKDAY: readonly HarmonicDay[] = [
  "Solhara",
  "Aquaris",
  "Flamora",
  "Verdari",
  "Sonari",
  "Kaelith",
] as const;



const DAY_TO_CHAKRA: Record<HarmonicDay, KaiSigilProps["chakraDay"]> = {
  Solhara: "Root",
  Aquaris: "Sacral",
  Flamora: "Solar Plexus",
  Verdari: "Heart",
  Sonari: "Throat",
  Kaelith: "Crown",
};

const ETERNAL_MONTH_NAMES = [
  "Aethon", "Virelai", "Solari", "Amarin",
  "Kaelus", "Umbriel", "Noctura", "Liora",
] as const;

const ARC_NAMES = [
  "Ignite", "Integrate", "Harmonize", "Reflekt", "Purifikation", "Dream",
] as const;

const ARC_LABEL = (n: string) => `${n} Ark`;

const KAI_TURAH_PHRASES = [
  "Tor Lah Mek Ka","Shoh Vel Lah Tzur","Rah Veh Yah Dah","Nel Shaum Eh Lior","Ah Ki Tzah Reh",
  "Or Vem Shai Tuun","Ehlum Torai Zhak","Zho Veh Lah Kurei","Tuul Ka Yesh Aum","Sha Vehl Dorrah",
];

/* harmonic-breath labels (1–11 × breath) */
const BREATH_LABELS: readonly string[] = Array.from({ length: 11 }, (_, i) => {
  const t = (i * KAI_PULSE_SEC).toFixed(3);
  return `Breath ${i + 1} — ${t}s`;
});

/* ═════════════ KKS-1.0 fixed-point μpulse constants ═════════════ */
const ONE_PULSE_MICRO = 1_000_000n;                  // 1 pulse = 1e6 μpulses
const N_DAY_MICRO = 17_491_270_421n;                 // 17,491.270421 pulses/day (closure)
const PULSES_PER_STEP_MICRO = 11_000_000n;           // 11 * 1e6

/* ── EXACT μpulses-per-beat for Eternal day (rounded) ──────────── */
const MU_PER_BEAT_EXACT = (N_DAY_MICRO + 18n) / 36n; // round(N_DAY_MICRO/36) = 485,868,623 μpulses
const BEAT_PULSES_ROUNDED = Number((MU_PER_BEAT_EXACT + (ONE_PULSE_MICRO / 2n)) / ONE_PULSE_MICRO); // ≈ 486 pulses

/* ═════════════ helpers ═════════════ */
const pad2 = (n: number) => String(n).padStart(2, "0");

const isIOS = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { vendor?: string };
  const s = (nav.userAgent || nav.vendor || "").toLowerCase();
  return /iphone|ipad|ipod/.test(s);
};

const fmtSeal = (raw: string) =>
  raw
    .trim()
    .replace(/^(\d+):(\d+)/, (_m, b, s) => `${+b}:${String(s).padStart(2, "0")}`)
    .replace(/D\s*(\d+)/, (_m, d) => `D${+d}`);

/* ── exact helpers for BigInt math (safe floor & modulo) ───────── */
const imod = (n: bigint, m: bigint) => ((n % m) + m) % m;
function floorDiv(n: bigint, d: bigint): bigint {
  const q = n / d;
  const r = n % d;
  return (r !== 0n && (r > 0n) !== (d > 0n)) ? q - 1n : q;
}

/* ties-to-even rounding Number→BigInt */
function roundTiesToEvenBigInt(x: number): bigint {
  if (!Number.isFinite(x)) return 0n;
  const s = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const i = Math.trunc(ax);
  const frac = ax - i;
  if (frac < 0.5) return BigInt(s * i);
  if (frac > 0.5) return BigInt(s * (i + 1));
  return BigInt(s * (i % 2 === 0 ? i : i + 1)); // exactly .5 -> to even
}

/* Chronos → μpulses since Genesis (bridge uses φ-exact T) */
function microPulsesSinceGenesis(date: Date): bigint {
  const deltaSec = (date.getTime() - GENESIS_TS) / 1000; // Number
  const pulses = deltaSec / KAI_PULSE_SEC;               // Number (bridge only)
  const micro = pulses * 1_000_000;                      // Number μpulses
  return roundTiesToEvenBigInt(micro);                   // BigInt μpulses
}

/* ── SVG metadata helpers (mirror SigilPage behavior) ─────────── */
const SVG_NS = "http://www.w3.org/2000/svg";
function ensureXmlns(svg: SVGSVGElement) {
  if (!svg.getAttribute("xmlns")) svg.setAttribute("xmlns", SVG_NS);
  if (!svg.getAttribute("xmlns:xlink")) svg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
}
function ensureMetadata(svg: SVGSVGElement): SVGMetadataElement {
  const doc = svg.ownerDocument || document;
  const existing = svg.querySelector("metadata");
  if (existing) return existing as SVGMetadataElement;
  const created = doc.createElementNS(SVG_NS, "metadata") as SVGMetadataElement;
  svg.insertBefore(created, svg.firstChild);
  return created;
}
function putMetadata(svg: SVGSVGElement, meta: unknown): string {
  const metaEl = ensureMetadata(svg);
  const xml = new XMLSerializer().serializeToString(svg);
  metaEl.textContent = JSON.stringify(meta);
  ensureXmlns(svg);
  return xml.startsWith("<?xml")
    ? xml
    : `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`;
}

/* ═════════════ icons ═════════════ */
const CloseIcon: FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden className="close-icon">
    <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="2" />
    <line x1="20" y1="4" x2="4" y2="20" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.2" opacity=".25" />
  </svg>
);

/* ═════════════ Stargate viewer (fullscreen) ═════════════ */
const StargateModal: FC<{
  sigilUrl: string;
  pulse: number;
  onClose: () => void;
}> = ({ sigilUrl, pulse, onClose }) => {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (el && !isIOS() && !document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    }
    return () => {
      if (!isIOS() && document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    };
  }, []);

  const swallow = (e: React.SyntheticEvent) => e.stopPropagation();

  return createPortal(
    <div
      ref={wrapRef}
      className="stargate-overlay"
      role="dialog"
      aria-modal="true"
      onMouseDown={swallow}
      onClick={swallow}
      onTouchStart={swallow}
      onKeyDown={swallow}
    >
      <button className="stargate-close" aria-label="Close" onClick={onClose}>
        <CloseIcon />
      </button>
      <div onClick={swallow}>
        <StargateViewer sigilUrl={sigilUrl} pulse={pulse} showPulse />
      </div>
    </div>,
    document.body
  );
};

/* ═════════════ sovereign Eternal-Klok compute ═════════════ */
type LocalKai = {
  pulse: number;
  beat: number;
  step: number;        // exact μpulse-derived index 0..43
  stepPct: number;
  pulsesIntoBeat: number;
  pulsesIntoDay: number;
  harmonicDay: HarmonicDay;
  chakraDay: KaiSigilProps["chakraDay"];
  chakraStepString: string; // "beat:SS" (zero-based)
  dayOfMonth: number;       // 1..42
  monthIndex0: number;      // 0..7
  monthIndex1: number;      // 1..8
  monthName: string;
  yearIndex: number;        // 0..∞ (336-day years)
  yearName: string;
  arcIndex: number;         // 0..5
  arcName: string;          // "Ignition Ark", ...
  weekIndex: number;        // 0..6 within month
  weekName: string;

  _pμ_in_day: bigint;
  _pμ_in_grid: bigint;
  _pμ_in_beat: bigint;
};

function computeLocalKai(date: Date): LocalKai {
  const pμ_total = microPulsesSinceGenesis(date);

  // Position within the exact eternal day (μpulses)
  const pμ_in_day = imod(pμ_total, N_DAY_MICRO);
  const dayIndex = floorDiv(pμ_total, N_DAY_MICRO);

  // ── Exact beat/step math (NO grid): derived from N_DAY_MICRO ──
  const beat = Number(floorDiv(pμ_in_day, MU_PER_BEAT_EXACT)); // 0..35
  const pμ_in_beat = pμ_in_day - BigInt(beat) * MU_PER_BEAT_EXACT;

  // Step within beat (11-pulse steps, clamped to 0..43)
  const rawStep = Number(pμ_in_beat / PULSES_PER_STEP_MICRO);
  const step = Math.min(Math.max(rawStep, 0), STEPS_BEAT - 1);

  const pμ_in_step = pμ_in_beat - BigInt(step) * PULSES_PER_STEP_MICRO;
  const stepPct = Number(pμ_in_step) / Number(PULSES_PER_STEP_MICRO);

  // Pulses (whole) derived from μpulses
  const pulse = Number(floorDiv(pμ_total, ONE_PULSE_MICRO));
  const pulsesIntoBeat = Number(pμ_in_beat / ONE_PULSE_MICRO);
  const pulsesIntoDay  = Number(pμ_in_day  / ONE_PULSE_MICRO);

  // Calendar mappings
  const harmonicDayIndex = Number(imod(dayIndex, BigInt(DAYS_PER_WEEK)));
  const harmonicDay = WEEKDAY[harmonicDayIndex];
  const chakraDay = DAY_TO_CHAKRA[harmonicDay];

  const dayIndexNum = Number(dayIndex);
  const dayOfMonth = ((dayIndexNum % DAYS_PER_MONTH) + DAYS_PER_MONTH) % DAYS_PER_MONTH + 1;

  const monthsSinceGenesis = Math.floor(dayIndexNum / DAYS_PER_MONTH);
  const monthIndex0 = ((monthsSinceGenesis % MONTHS_PER_YEAR) + MONTHS_PER_YEAR) % MONTHS_PER_YEAR;
  const monthIndex1 = monthIndex0 + 1;
  const monthName = ETERNAL_MONTH_NAMES[monthIndex0];

  const yearIndex = Math.floor(dayIndexNum / DAYS_PER_YEAR);
  const yearName =
    yearIndex < 1 ? "Year of Harmonik Restoration"
    : yearIndex === 1 ? "Year of Harmonik Embodiment"
    : `Year ${yearIndex}`;

  const arcIndex = Number((pμ_in_day * 6n) / N_DAY_MICRO);
  const arcName = ARC_LABEL(ARC_NAMES[Math.min(5, Math.max(0, arcIndex))]);

  const weekIndex = Math.floor((dayOfMonth - 1) / DAYS_PER_WEEK);
  const weekName = [
    "Awakening Flame","Flowing Heart","Radiant Will",
    "Harmonic Voice","Inner Mirror","Dreamfire Memory","Krowned Light",
  ][weekIndex];

  const chakraStepString = `${beat}:${pad2(step)}`; // zero-based display (exact)

  return {
    pulse, beat, step, stepPct, pulsesIntoBeat, pulsesIntoDay,
    harmonicDay, chakraDay, chakraStepString, dayOfMonth,
    monthIndex0, monthIndex1, monthName, yearIndex, yearName,
    arcIndex, arcName, weekIndex, weekName,
    _pμ_in_day: pμ_in_day, _pμ_in_grid: pμ_in_day, _pμ_in_beat: pμ_in_beat,
  };
}

function buildLocalKairosLike(now: Date): KaiApiResponseLike {
  const k = computeLocalKai(now);

  const kairos_seal_day_month = `${k.chakraStepString} — D${k.dayOfMonth}/M${k.monthIndex1}`;

  const chakraBeat = {
    beatIndex: k.beat,
    pulsesIntoBeat: k.pulsesIntoBeat,
    beatPulseCount: BEAT_PULSES_ROUNDED, // nearest whole pulses in exact beat
    totalBeats: BEATS_DAY,
  };

  const percentIntoBeat = Number(k._pμ_in_beat) / Number(MU_PER_BEAT_EXACT) * 100;
  const percentToNextBeat = (1 - Number(k._pμ_in_beat) / Number(MU_PER_BEAT_EXACT)) * 100;

  const daysIntoWeek = (k.dayOfMonth - 1) % DAYS_PER_WEEK;
  const pμ_into_week = BigInt(daysIntoWeek) * N_DAY_MICRO + k._pμ_in_day;
  const harmonicWeekProgress = {
    weekDay: k.harmonicDay,
    weekDayIndex: WEEKDAY.indexOf(k.harmonicDay),
    pulsesIntoWeek: Number(pμ_into_week / ONE_PULSE_MICRO),
    percent: Number(pμ_into_week) / Number(N_DAY_MICRO * BigInt(DAYS_PER_WEEK)) * 100,
  };

  const daysElapsedInMonth = k.dayOfMonth - 1;
  const eternalMonthProgress = {
    daysElapsed: daysElapsedInMonth,
    daysRemaining: DAYS_PER_MONTH - k.dayOfMonth,
    percent: (daysElapsedInMonth / DAYS_PER_MONTH) * 100,
  };

  const dayOfYear = (k.monthIndex0 * DAYS_PER_MONTH) + k.dayOfMonth;
  const harmonicYearProgress = {
    daysElapsed: dayOfYear - 1,
    daysRemaining: DAYS_PER_YEAR - dayOfYear,
    percent: ((dayOfYear - 1) / DAYS_PER_YEAR) * 100,
  };

  const chakraStep = {
    stepIndex: k.step,                 // exact 0..43
    percentIntoStep: k.stepPct * 100,  // 0..100
    stepsPerBeat: STEPS_BEAT,          // 44
  };

  const kaiMomentSummary =
    `Beat ${k.beat + 1}/${BEATS_DAY} • Step ${k.step + 1}/${STEPS_BEAT} • ` +
    `${k.harmonicDay}, ${k.arcName} • D${k.dayOfMonth}/M${k.monthIndex1} (${k.monthName}) • ${k.yearName}`;

  const compressed_summary =
    `Kai:${k.chakraStepString} D${k.dayOfMonth}/M${k.monthIndex1} ${k.harmonicDay} ${k.monthName} y${k.yearIndex}`;

  const phiSpiralLevel = Math.floor(Math.log(Math.max(k.pulse, 1)) / Math.log(PHI));

  const baseArc = (s: string) => s.replace(/\s*Ark$/, "");
  const arcDisp = (s: string, variant: "kairos" | "solar") => {
    let n = baseArc(s);
    if (n === "Harmonization") n = "Harmonize";
    if (variant === "solar" && n === "Reflection") n = "Reflekt";
    return `${n} Ark`;
  };

  const eternalSeal =
    `Eternal Seal: ` +
    `Kairos:${k.chakraStepString}, ${k.harmonicDay}, ${arcDisp(k.arcName, "kairos")} • ` +
    `D${k.dayOfMonth}/M${k.monthIndex1} • ` +
    `Beat:${k.beat}/${BEATS_DAY}(${percentIntoBeat.toFixed(6)}%) ` +
    `Step:${k.step}/${STEPS_BEAT} ` +
    `Kai(Today):${k.pulsesIntoDay} • ` +
    `Y${k.yearIndex} PS${phiSpiralLevel} • ` +
    `Eternal Pulse:${k.pulse}`;

  return {
    kaiPulseEternal: k.pulse,
    kaiPulseToday: k.pulsesIntoDay,
    eternalKaiPulseToday: k.pulsesIntoDay,
    eternalSeal,
    kairos_seal_day_month,
    eternalMonth: k.monthName,
    eternalMonthIndex: k.monthIndex1,
    eternalChakraArc: k.arcName,
    eternalYearName: k.yearName,
    kaiTurahPhrase: KAI_TURAH_PHRASES[k.yearIndex % KAI_TURAH_PHRASES.length],
    chakraStepString: k.chakraStepString,
    chakraStep,
    harmonicDay: k.harmonicDay,
    chakraBeat,
    eternalChakraBeat: { ...chakraBeat, percentToNext: percentToNextBeat },
    harmonicWeekProgress,
    harmonicYearProgress,
    eternalMonthProgress,
    weekIndex: k.weekIndex,
    weekName: k.weekName,
    dayOfMonth: k.dayOfMonth,
    timestamp: new Date().toISOString(),
    kaiMomentSummary,
    compressed_summary,
    phiSpiralLevel,
  };
}

/* ═════════════ High-precision φ-pulse countdown (6 decimals) ═════════════
   NOTE: unchanged API, but it reads the same boundary math the scheduler uses.
*/
function useKaiPulseCountdown(active: boolean) {
  const [secsLeft, setSecsLeft] = useState<number | null>(active ? KAI_PULSE_SEC : null);
  const nextRef = useRef<number>(0);
  const rafRef  = useRef<number | null>(null);
  const intRef  = useRef<number | null>(null);

  const epochNow = () => performance.timeOrigin + performance.now();

  const computeNextBoundary = (nowMs: number) => {
    const elapsed = nowMs - GENESIS_TS;
    const periods = Math.ceil(elapsed / PULSE_MS);
    return GENESIS_TS + periods * PULSE_MS;
  };

  useEffect(() => {
    if (!active) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (intRef.current) clearInterval(intRef.current);
      rafRef.current = null; intRef.current = null;
      setSecsLeft(null);
      return;
    }

    // Share global CSS pulse duration for any breathing effects
    if (typeof document !== "undefined" && document.documentElement) {
      document.documentElement.style.setProperty("--kai-pulse", `${PULSE_MS}ms`);
    }

    nextRef.current = computeNextBoundary(epochNow());

    const tick = () => {
      const now = epochNow();

      if (now >= nextRef.current) {
        const missed = Math.floor((now - nextRef.current) / PULSE_MS) + 1;
        nextRef.current += missed * PULSE_MS;
      }
      const diffMs = Math.max(0, nextRef.current - now);
      setSecsLeft(diffMs / 1000);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        if (!intRef.current) {
          intRef.current = window.setInterval(() => {
            const now = Date.now();
            if (now >= nextRef.current) {
              const missed = Math.floor((now - nextRef.current) / PULSE_MS) + 1;
              nextRef.current += missed * PULSE_MS;
            }
            setSecsLeft(Math.max(0, (nextRef.current - now) / 1000));
          }, 33);
        }
      } else {
        if (intRef.current) { clearInterval(intRef.current); intRef.current = null; }
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        nextRef.current = computeNextBoundary(epochNow());
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    document.addEventListener('visibilitychange', onVis);

    return () => {
      document.removeEventListener('visibilitychange', onVis);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (intRef.current) clearInterval(intRef.current);
    };
  }, [active]);

  return secsLeft;
}

/* ═════════════ hash helpers ═════════════ */
const getSubtle = (): SubtleCrypto | undefined => {
  const g = globalThis as unknown as { crypto?: Crypto };
  return g.crypto?.subtle;
};

const sha256Hex = async (text: string): Promise<string> => {
  const encoded = new TextEncoder().encode(text);
  const subtle = getSubtle();
  if (subtle) {
    try {
      const buf = await subtle.digest("SHA-256", encoded);
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch {
      /* fall through to JS fallback */
    }
  }
  let h1 = 0x811c9dc5;
  for (let i = 0; i < encoded.length; i++) {
    h1 ^= encoded[i];
    h1 = Math.imul(h1, 16777619);
  }
  return (h1 >>> 0).toString(16).padStart(8, "0");
};

/* ═════════════ NEW: Ark colors (used for Eternal day bar) ═════════════ */
const ARK_COLORS: Record<string, string> = {
  "Ignition Ark": "#ff0024",
  "Integration Ark": "#ff6f00",
  "Harmonization Ark": "#ffd600",
  "Reflection Ark": "#00c853",
  "Purification Ark": "#00b0ff",
  "Dream Ark": "#c186ff",
  // tolerate older “ArK” spelling
  "Ignition ArK": "#ff0024",
  "Integration ArK": "#ff6f00",
  "Harmonization ArK": "#ffd600",
  "Reflection ArK": "#00c853",
  "Purification ArK": "#00b0ff",
  "Dream ArK": "#c186ff",
};
const getArkColor = (label?: string): string => {
  if (!label) return "#ffd600"; // solar default
  return ARK_COLORS[label] ?? ARK_COLORS[(label.replace(/\s*ArK?$/i, " Ark"))] ?? "#ffd600";
};

/* ═════════════ NEW: local CSS for sticky FAB dock (bottom) + Close hardening */
const FabDockStyles = () => (
  <style>{`
    .sigil-modal { position: relative; isolation: isolate; }

    /* Close (✕) must be above all UI layers */
    .sigil-modal .close-btn {
      z-index: 99999 !important;
      pointer-events: auto;
      touch-action: manipulation;
    }
    .sigil-modal .close-btn svg { pointer-events: none; }

    /* Leave room so content never hides behind the dock */
    .modal-bottom-spacer {
      height: clamp(86px, 13vh, 120px);
    }

    /* Sticky dock pinned to the bottom INSIDE scrollable modal */
    .fab-dock {
      position: sticky;
      bottom: max(10px, env(safe-area-inset-bottom));
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 12px;
      padding: 0 12px;
      pointer-events: none; /* buttons re-enable */
      z-index: 6;
      contain: layout paint style;
      -webkit-transform: translateZ(0);
              transform: translateZ(0);
      flex-wrap: wrap;
    }
    .fab-dock > * { pointer-events: auto; }

    /* When verifier is open, block the dock beneath to prevent accidental taps */
    .fab-dock[data-blocked="true"] {
      pointer-events: none;
    }
    .fab-dock[data-blocked="true"] > * {
      pointer-events: none;
    }

    /* Common sacred FAB styling */
    .fab, .verifier-fab {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: clamp(52px, 8.5vw, 68px);
      height: clamp(52px, 8.5vw, 68px);
      border-radius: 999px;
      border: 0;
      cursor: pointer;
      color: inherit;
      background:
        radial-gradient(140% 140% at 50% 0%, rgba(255,255,255,.14), rgba(255,255,255,.06)),
        linear-gradient(180deg, rgba(255,255,255,.15), rgba(255,255,255,.05));
      backdrop-filter: blur(8px) saturate(120%);
      -webkit-backdrop-filter: blur(8px) saturate(120%);
      box-shadow:
        0 8px 28px rgba(0,0,0,.35),
        inset 0 0 0 1px rgba(255,255,255,.25),
        0 0 40px rgba(255, 215, 120, .08);
      transition: transform .2s ease, box-shadow .2s ease, filter .2s ease, opacity .2s ease;
      will-change: transform;
      touch-action: manipulation;
    }
    .fab::before, .verifier-fab::before {
      content: "";
      position: absolute; inset: -8px;
      border-radius: inherit;
      background: radial-gradient(120% 120% at 50% 20%, rgba(255,230,150,.35), rgba(255,255,255,0));
      filter: blur(12px);
      opacity: .55;
      transition: opacity .2s ease;
      pointer-events: none;
    }
    .fab:hover, .verifier-fab:hover { transform: translateY(-2px) scale(1.02); }
    .fab:active, .verifier-fab:active { transform: translateY(0) scale(.98); }
    .fab:hover::before, .verifier-fab:hover::before { opacity: .85; }

    /* Active ring for toggled states (used visually by Verify) */
    .fab[data-active="true"], .verifier-fab[data-active="true"] {
      box-shadow:
        0 0 0 2px rgba(255,255,255,.55),
        0 10px 34px rgba(0,0,0,.45),
        0 0 44px rgba(255, 215, 120, .18);
    }

    /* SVG inside FABs */
    .fab img, .fab svg,
    .verifier-fab img, .verifier-fab svg {
      width: 56%;
      height: 56%;
      display: block;
      user-select: none;
      -webkit-user-drag: none;
    }

    /* Optional subtle per-action accent */
    .fab--seal::before { background: radial-gradient(120% 120% at 50% 20%, rgba(255,210,160,.40), rgba(255,255,255,0)); }
    .fab--gate::before { background: radial-gradient(120% 120% at 50% 20%, rgba(160,220,255,.35), rgba(255,255,255,0)); }

    @media (pointer: coarse) {
      .fab, .verifier-fab { width: 68px; height: 68px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .fab, .verifier-fab { transition: none; }
      .fab::before, .verifier-fab::before { transition: none; }
    }
  `}</style>
);

/* ═════════════ main component ═════════════ */
const SigilModal: FC<Props> = ({ initialPulse = 0, onClose }) => {
  /* ── state ─────────────────────────────────────────────── */
  const [pulse, setPulse] = useState(initialPulse);
  const [beat, setBeat] = useState(0);
  const [stepPct, setStepPct] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [chakraDay, setChakraDay] = useState<KaiSigilProps["chakraDay"]>("Root");

  const [kairos, setKairos] = useState<KaiApiResponseLike | null>(null);

  /* static-mode controls */
  const [dateISO, setDateISO] = useState("");
  const [breathIdx, setBreathIdx] = useState(1);

  /* stargate */
  const [stargateOpen, setStargateOpen] = useState(false);
  const [stargateURL, setStargateURL] = useState("");

  /* verifier */
  const [showVerifier, setShowVerifier] = useState(false);
  const [verifySvgOk, setVerifySvgOk] = useState(true);

  /* seal/stargate asset fallbacks */
  const [sealSvgOk, setSealSvgOk] = useState(true);
  const [gateSvgOk, setGateSvgOk] = useState(true);

  /* SealMomentModal */
  const [sealOpen, setSealOpen] = useState(false);
  const [sealUrl, setSealUrl] = useState("");
  const [sealHash, setSealHash] = useState("");

  /* NEW: canonical child hash from KaiSigil.onReady() */
  const [lastHash, setLastHash] = useState("");

  /* RICH DATA toggle */
  const [showRich, setShowRich] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null); // legacy; not used for live timing
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const sigilRef = useRef<KaiSigilHandle | null>(null);
  const anchorRef = useRef(Date.now());

  /* NEW: boundary-aligned scheduler refs */
  const timeoutRef = useRef<number | null>(null);
  const targetBoundaryRef = useRef<number>(0);

  /* ── HARD-LOCK shielding ───────────────────────────────── */
  useEffect(() => {
    const shield = (e: Event) => {
      const ov = overlayRef.current;
      if (!ov || !ov.contains(e.target as Node)) return;
      if (closeBtnRef.current?.contains(e.target as Node)) return;
      e.stopPropagation();
    };

    ["click", "mousedown", "touchstart"].forEach((ev) =>
      document.addEventListener(ev, shield, { passive: true } as AddEventListenerOptions)
    );

    const escTrap = (e: KeyboardEvent) => {
      if (e.key === "Escape" && overlayRef.current) e.stopPropagation();
    };
    window.addEventListener("keydown", escTrap, true);

    return () => {
      ["click", "mousedown", "touchstart"].forEach((ev) =>
        document.removeEventListener(ev, shield, false)
      );
      window.removeEventListener("keydown", escTrap, true);
    };
  }, []);

  /* ── close-button pulse sync (aligned to Genesis φ-boundary) ── */
  const syncCloseBtn = () => {
    const btn = closeBtnRef.current;
    if (!btn) return;
    const now = Date.now();
    const elapsed = ((now - GENESIS_TS) % PULSE_MS + PULSE_MS) % PULSE_MS;
    const lag = PULSE_MS - elapsed;
    btn.style.setProperty("--pulse-dur", `${PULSE_MS}ms`);
    btn.style.setProperty("--pulse-offset", `-${Math.round(lag)}ms`);
  };

  /* NEW: global CSS vars so the whole modal can “breathe” in phase (no visual change required) */
  const syncGlobalPulseVars = (nowMs: number) => {
    const root = document.documentElement;
    const elapsed = ((nowMs - GENESIS_TS) % PULSE_MS + PULSE_MS) % PULSE_MS;
    const lag = PULSE_MS - elapsed;
    root.style.setProperty("--pulse-dur", `${PULSE_MS}ms`);
    root.style.setProperty("--pulse-offset", `-${Math.round(lag)}ms`);
  };

  /* ── apply Kai (core render state) ─────────────────────── */
  const applyKai = (d: {
    pulse: number;
    beat: number;
    stepPct: number;
    step: number;
    chakraDay: KaiSigilProps["chakraDay"];
  }) => {
    setPulse(d.pulse);
    setBeat(d.beat);
    setStepPct(d.stepPct);
    setStepIdx(d.step);
    setChakraDay(d.chakraDay);
    anchorRef.current = Date.now();
  };

  /* ── sovereign “query” — compute locally only ──────────── */
  const queryKai = useCallback((iso?: string) => {
    const dt = iso ? new Date(iso) : new Date();
    const local = computeLocalKai(dt);
    applyKai({
      pulse: local.pulse,
      beat: local.beat,
      stepPct: local.stepPct,
      step: local.step,
      chakraDay: local.chakraDay,
    });
    setKairos(buildLocalKairosLike(dt));
    syncCloseBtn();
  }, []);

  /* ═════════════ perfectly aligned φ-boundary scheduler ═════════════ */
  const epochNow = () => performance.timeOrigin + performance.now();
  const computeNextBoundary = (nowMs: number) => {
    const elapsed = nowMs - GENESIS_TS;
    const periods = Math.ceil(elapsed / PULSE_MS);
    return GENESIS_TS + periods * PULSE_MS;
  };

  const clearAlignedTimer = () => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const scheduleAlignedTick = useCallback(() => {
    clearAlignedTimer();
    // Establish the next boundary and sync CSS vars
    const now = epochNow();
    targetBoundaryRef.current = computeNextBoundary(now);
    syncGlobalPulseVars(now);

    const fire = () => {
      // On fire, catch up any missed boundaries (sleep/wake) and apply state
      const nowMs = epochNow();

      // Number of boundaries that passed since the last target (0+)
      const missed = Math.floor((nowMs - targetBoundaryRef.current) / PULSE_MS);
      // Always run at least once
      const runs = Math.max(0, missed) + 1;

      for (let i = 0; i < runs; i++) {
        queryKai();
        targetBoundaryRef.current += PULSE_MS;
      }

      // Reschedule precisely for the next boundary
      const delay = Math.max(0, targetBoundaryRef.current - epochNow());
      timeoutRef.current = window.setTimeout(fire, delay) as unknown as number;
    };

    // First schedule to the upcoming boundary
    const initialDelay = Math.max(0, targetBoundaryRef.current - now);
    timeoutRef.current = window.setTimeout(fire, initialDelay) as unknown as number;
  }, [queryKai]);

  /* ── public live control: startLive() uses aligned scheduler only ─────── */
  const startLive = useCallback(() => {
    setDateISO("");
    if (intervalRef.current) clearInterval(intervalRef.current); // legacy guard
    // Initial immediate compute (no phase change), then align to next boundary
    queryKai();
    scheduleAlignedTick();
  }, [queryKai, scheduleAlignedTick]);

  /* ── mount/unmount: start aligned live updates ─────────────────────────── */
  useEffect(() => {
    startLive();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearAlignedTimer();
    };
  }, [startLive]);

  /* ── visibility changes: re-align boundary and countdown in sync ──────── */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && !dateISO) {
        scheduleAlignedTick();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [dateISO, scheduleAlignedTick]);

  /* ── datetime picker (UNCHANGED UX) ───────────────────── */
  const onDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDateISO(val);

    if (!val) {
      // Resume live with aligned scheduler
      startLive();
      return;
    }

    // Pause live updates while in static mode
    if (intervalRef.current) clearInterval(intervalRef.current);
    clearAlignedTimer();
    queryKai(buildBreathIso(val, breathIdx));
  };

  const onBreathChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const idx = Number(e.target.value);
    setBreathIdx(idx);
    if (!dateISO) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    clearAlignedTimer();
    queryKai(buildBreathIso(dateISO, idx));
  };

  /* ── “Now” reset ───────────────────────────────────────── */
  const resetToNow = () => {
    const card =
      overlayRef.current?.querySelector(".sigil-modal") as HTMLElement | null;
    if (card) {
      card.classList.remove("flash-now");
      void card.offsetWidth;
      card.classList.add("flash-now");
    }
    setDateISO("");
    setBreathIdx(1);
    startLive();
  };

  /* ── next-pulse countdown (μs-style precision) ─────────── */
  const secsLeft = useKaiPulseCountdown(!dateISO);

  /* ── helpers ───────────────────────────────────────────── */
  const copy = (txt: string) => void navigator.clipboard.writeText(txt);
  const copyJSON = (obj: unknown) => copy(JSON.stringify(obj, null, 2));

  const buildBreathIso = (minuteLocal: string, breathIndex: number) => {
    const base = new Date(minuteLocal);
    if (Number.isNaN(base.getTime())) return "";
    const utc =
      base.getTime() -
      base.getTimezoneOffset() * 60_000 +
      (breathIndex - 1) * PULSE_MS;
    return new Date(utc).toISOString().slice(0, 23);
  };

  /* -- asset builders ------------------------------------------------------- */
  const getSVGElement = (): SVGSVGElement | null =>
    document.querySelector<SVGSVGElement>("#sigil-export svg");

  const getSVGStringWithMetadata = (meta: unknown): string | null => {
    const svg = getSVGElement();
    if (!svg) return null;
    return putMetadata(svg, meta);
  };

  const buildSVGBlob = (meta: unknown): Blob | null => {
    const xml = getSVGStringWithMetadata(meta);
    if (!xml) return null;
    return new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  };

  const buildPNGBlob = async (): Promise<Blob | null> => {
    const el = document.getElementById("sigil-export");
    if (!el) return null;

    const opts: Loose<H2COptions> = {
      background: undefined,
      backgroundColor: null,
    };

    const canvas = await html2canvas(el as HTMLElement, opts);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png")
    );
    if (blob) return blob;

    const dataUrl = canvas.toDataURL("image/png");
    const base64 = dataUrl.split(",")[1] ?? "";
    const byteStr = atob(base64);
    const buf = new ArrayBuffer(byteStr.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < byteStr.length; i++) view[i] = byteStr.charCodeAt(i);
    return new Blob([buf], { type: "image/png" });
  };

  /* -- canonical share payload (matching v22.0 semantics) ------------------ */
  const makeSharePayload = (canonicalHash: string): SigilSharePayload & {
    canonicalHash: string;
    exportedAt: string;
    expiresAtPulse: number;
  } => {
    const stepsPerBeat = STEPS_BEAT;
    const stepIndex = Math.floor(stepPct * stepsPerBeat) % stepsPerBeat;

    return {
      pulse,
      beat,
      stepIndex,
      chakraDay,
      stepsPerBeat,
      canonicalHash,
      exportedAt: new Date().toISOString(),
      expiresAtPulse: pulse + 11,
    };
  };

  const openSealMoment = async () => {
    let hash = (lastHash || "").toLowerCase();
    if (!hash) {
      const svg = getSVGElement();
      const basis =
        svg
          ? new XMLSerializer().serializeToString(svg)
          : JSON.stringify({ pulse, beat, stepPct, chakraDay });
      hash = (await sha256Hex(basis)).toLowerCase();
    }
    const payload = makeSharePayload(hash);
    const url = makeSigilUrl(hash, payload);
    setSealHash(hash);
    setSealUrl(url);
    setSealOpen(true);
  };

  const saveZipBundle = async () => {
    const canonical = (lastHash || "").toLowerCase();
    const canonicalHash =
      canonical || (await sha256Hex(JSON.stringify({ pulse, beat, stepPct, chakraDay })));

    const meta = makeSharePayload(canonicalHash);

    const [svgBlob, pngBlob] = await Promise.all([buildSVGBlob(meta), buildPNGBlob()]);
    if (!svgBlob || !pngBlob) return;

    const zip = new JSZip();
    zip.file(`sigil_${pulse}.svg`, svgBlob);
    zip.file(`sigil_${pulse}.png`, pngBlob);

    const manifest = {
      ...meta,
      overlays: { qr: false, eternalPulseBar: false },
    };
    zip.file(`sigil_${pulse}.manifest.json`, JSON.stringify(manifest, null, 2));

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);

    Object.assign(document.createElement("a"), {
      href: url,
      download: `sigil_${pulse}.zip`,
    } as HTMLAnchorElement).click();

    requestAnimationFrame(() => URL.revokeObjectURL(url));
  };

  const openStargate = () => {
    if (!sigilRef.current) return;
    setStargateURL(sigilRef.current.toDataURL());
    setStargateOpen(true);
  };

  const handleClose = () => {
    setShowVerifier(false);
    onClose();
  };

  /* ── derived strings (μpulse-accurate beat:step) ───────── */
  const beatStepFromSeal = (raw: string): string | null => {
    const m = raw.trim().match(/^(\d+):(\d{1,2})/);
    return m ? `${+m[1]}:${m[2].padStart(2, "0")}` : null;
    // zero-based display (beat:SS)
  };

  const sealBeatStep = kairos ? beatStepFromSeal(kairos.kairos_seal_day_month) : null;
  const localBeatStep = `${beat}:${pad2(stepIdx)}`;
  const beatStepDisp = sealBeatStep ?? localBeatStep;
  const kairosDisp = fmtSeal(kairos ? kairos.kairos_seal_day_month : beatStepDisp);

  /* Progress + colors for SigilMomentRow */
  const solarColor = "#ffd600"; // unchanged (Solar)
  const eternalArkColor = getArkColor(kairos?.eternalChakraArc);
  const dayPct =
    kairos ? Math.max(0, Math.min(100, (kairos.kaiPulseToday / DAY_PULSES) * 100)) : 0;

  /* ── dock actions ─────────────────────────── */
  const openVerifier = () => setShowVerifier(true); // open-only (no toggle)

  /* ── render ───────────────────────────────── */
  return createPortal(
    <>
      <FabDockStyles />
      {/* ========= overlay ========= */}
      <div
        ref={overlayRef}
        role="dialog"
        aria-modal="true"
        className="sigil-modal-overlay"
        onMouseDown={(e) => { if (e.target === e.currentTarget) e.stopPropagation(); }}
        onClick={(e) => { if (e.target === e.currentTarget) e.stopPropagation(); }}
        onTouchStart={(e) => { if (e.target === e.currentTarget) e.stopPropagation(); }}
        onKeyDown={(e) => e.key === "Escape" && e.stopPropagation()}
      >
        <div
          className="sigil-modal"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {/* ✕ */}
          <button
            ref={closeBtnRef}
            aria-label="Close"
            className="close-btn"
            onClick={handleClose}
          >
            <CloseIcon />
          </button>

          {/* ── Moment Row (datetime + live day bars) ── */}
          <SigilMomentRow
            dateISO={dateISO}
            onDateChange={onDateChange}
            secondsLeft={secsLeft ?? undefined}
            solarPercent={dayPct}
            eternalPercent={dayPct}
            solarColor={solarColor}
            eternalColor={eternalArkColor}
            eternalArkLabel={kairos?.eternalChakraArc || "Ignition Ark"}
          />

          {dateISO && (
            <>
              <label style={{ marginLeft: "12px" }}>
                Breath within minute:&nbsp;
                <select value={breathIdx} onChange={onBreathChange}>
                  {BREATH_LABELS.map((lbl, i) => (
                    <option key={i} value={i + 1}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </label>
              <button className="now-btn" onClick={resetToNow}>
                Now
              </button>
            </>
          )}

          {secsLeft !== null && (
            <p className="countdown">
              next pulse in <strong>{secsLeft.toFixed(6)}</strong>s
            </p>
          )}

          {/* sigil canvas */}
          <div
            id="sigil-export"
            style={{ position: "relative", width: 240, margin: "16px auto" }}
          >
            <KaiSigil
              ref={sigilRef}
              pulse={pulse}
              beat={beat}
              stepPct={stepPct}
              chakraDay={chakraDay}
              size={240}
              hashMode="deterministic"
              origin=""
              onReady={(payload: { hash?: string; pulse?: number }) => {
                const hash = payload?.hash ? String(payload.hash).toLowerCase() : "";
                if (hash) setLastHash(hash);
                if (typeof payload?.pulse === "number" && payload.pulse !== pulse) {
                  setPulse(payload.pulse);
                }
              }}
            />
            <span className="pulse-tag">{pulse.toLocaleString()}</span>
          </div>

          {/* metadata (legacy visible block — μpulse-correct) */}
          <div className="sigil-meta-block">
            <p>
              <strong>Kairos:</strong>&nbsp;
              {beatStepDisp}
              <button className="copy-btn" onClick={() => copy(beatStepDisp)}>
                Copy
              </button>
            </p>
            <p>
              <strong>Kairos/Date:</strong>&nbsp;
              {kairosDisp}
              <button className="copy-btn" onClick={() => copy(kairosDisp)}>
                Copy
              </button>
            </p>

            {kairos && (
              <>
                <p>
                  <strong>Seal:</strong>&nbsp;
                  {kairos.eternalSeal}
                  <button className="copy-btn" onClick={() => copy(kairos.eternalSeal)}>
                    Copy
                  </button>
                </p>
                <p>
                  <strong>Day:</strong> {kairos.harmonicDay}
                </p>
                <p>
                  <strong>Month:</strong> {kairos.eternalMonth}
                </p>
                <p>
                  <strong>Arc:</strong> {kairos.eternalChakraArc}
                </p>
                <p>
                  <strong>Year:</strong> {kairos.eternalYearName}
                </p>
                <p>
                  <strong>Kai-Turah:</strong>&nbsp;
                  {kairos.kaiTurahPhrase}
                  <button className="copy-btn" onClick={() => copy(kairos.kaiTurahPhrase)}>
                    Copy
                  </button>
                </p>
              </>
            )}
          </div>

          {/* RICH DATA */}
          {kairos && (
            <details
              className="rich-data"
              open={showRich}
              onToggle={(e) => setShowRich((e.currentTarget as HTMLDetailsElement).open)}
            >
              <summary>Memory</summary>
              <div className="rich-grid">
                <div>
                  <code>kaiPulseEternal</code>
                  <span>{kairos.kaiPulseEternal.toLocaleString()}</span>
                </div>
                <div>
                  <code>kaiPulseToday</code>
                  <span>{kairos.kaiPulseToday}</span>
                </div>
                <div>
                  <code>kairos_seal_day_month</code>
                  <span>{kairos.kairos_seal_day_month}</span>
                </div>
                <div>
                  <code>chakraStepString</code>
                  <span>{kairos.chakraStepString}</span>
                </div>
                <div>
                  <code>chakraStep.stepIndex</code>
                  <span>{kairos.chakraStep.stepIndex}</span>
                </div>
                <div>
                  <code>chakraStep.percentIntoStep</code>
                  <span>{kairos.chakraStep.percentIntoStep.toFixed(2)}%</span>
                </div>
                <div>
                  <code>chakraBeat.beatIndex</code>
                  <span>{kairos.chakraBeat.beatIndex}</span>
                </div>
                <div>
                  <code>chakraBeat.pulsesIntoBeat</code>
                  <span>{kairos.chakraBeat.pulsesIntoBeat}</span>
                </div>
                <div>
                  <code>weekIndex</code>
                  <span>{kairos.weekIndex}</span>
                </div>
                <div>
                  <code>weekName</code>
                  <span>{kairos.weekName}</span>
                </div>
                <div>
                  <code>dayOfMonth</code>
                  <span>{kairos.dayOfMonth}</span>
                </div>
                <div>
                  <code>eternalMonthIndex</code>
                  <span>{kairos.eternalMonthIndex}</span>
                </div>
                <div>
                  <code>harmonicWeekProgress.percent</code>
                  <span>{kairos.harmonicWeekProgress.percent.toFixed(2)}%</span>
                </div>
                <div>
                  <code>eternalMonthProgress.percent</code>
                  <span>{kairos.eternalMonthProgress.percent.toFixed(2)}%</span>
                </div>
                <div>
                  <code>harmonicYearProgress.percent</code>
                  <span>{kairos.harmonicYearProgress.percent.toFixed(2)}%</span>
                </div>
                <div>
                  <code>phiSpiralLevel</code>
                  <span>{kairos.phiSpiralLevel}</span>
                </div>
                <div className="span-2">
                  <code>kaiMomentSummary</code>
                  <span>{kairos.kaiMomentSummary}</span>
                </div>
                <div className="span-2">
                  <code>compressed_summary</code>
                  <span>{kairos.compressed_summary}</span>
                </div>
                <div className="span-2">
                  <code>eternalSeal</code>
                  <span className="truncate">{kairos.eternalSeal}</span>
                </div>
              </div>

              <div className="rich-actions">
                <button onClick={() => copyJSON(kairos)}>Copy JSON</button>
              </div>
            </details>
          )}

          {/* Spacer so content doesn't collide with dock on small screens */}
          <div className="modal-bottom-spacer" aria-hidden="true" />

          {/* ===== Sticky FAB Dock (bottom) ===== */}
          <div className="fab-dock" aria-hidden={false} data-blocked={showVerifier ? "true" : "false"}>
            {/* Verify (opens-only; no toggle) */}
            <button
              className="fab verifier-fab"
              type="button"
              aria-label={showVerifier ? "Verifier open" : "Open verifier"}
              title={showVerifier ? "Verifier open" : "Open verifier"}
              data-active={showVerifier ? "true" : "false"}
              onClick={openVerifier}
            >
              {verifySvgOk ? (
                <img
                  src="/assets/verify.svg"
                  alt=""
                  loading="eager"
                  decoding="async"
                  onError={() => setVerifySvgOk(false)}
                />
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M7.5 12.2l3.2 3.2 5.8-6.9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>

            {/* Seal This Moment */}
            <button
              className="fab fab--seal"
              type="button"
              aria-label="Seal this moment"
              title="Seal this moment"
              onClick={openSealMoment}
            >
              {sealSvgOk ? (
                <img
                  src="/assets/seal.svg"
                  alt=""
                  loading="eager"
                  decoding="async"
                  onError={() => setSealSvgOk(false)}
                />
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M12 6v6l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8.2 15.8l2.1-2.1" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              )}
            </button>

            {/* Stargate */}
            <button
              className="fab fab--gate"
              type="button"
              aria-label="View in Stargate"
              title="View in Stargate"
              onClick={openStargate}
            >
              {gateSvgOk ? (
                <img
                  src="/assets/stargate.svg"
                  alt=""
                  loading="eager"
                  decoding="async"
                  onError={() => setGateSvgOk(false)}
                />
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
                  <circle cx="12" cy="12" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.7" />
                  <path d="M12 7.2a4.8 4.8 0 0 1 4.8 4.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ========= Stargate viewer ========= */}
      {stargateOpen && (
        <StargateModal
          sigilUrl={stargateURL}
          pulse={pulse}
          onClose={() => setStargateOpen(false)}
        />
      )}

      {/* ========= Verifier overlay ========= */}
      {showVerifier && (
        <div
          className="verifier-container"
          role="dialog"
          aria-modal="true"
          aria-label="Kai-Sigil Verifier"
          /* HARD-LOCK: clicks/keys here never bubble to background */
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              // do NOT close on Escape per spec
              e.stopPropagation();
              e.preventDefault();
            }
          }}
        >
          {/* No click-to-close background anymore */}
          <div className="verifier-bg" aria-hidden="true" />
          <button
            className="verifier-exit"
            aria-label="Close verifier"
            onClick={() => setShowVerifier(false)}
          >
            ✕
          </button>
          <div className="container-shell" onClick={(e) => e.stopPropagation()}>
            <VerifierStamper />
          </div>
        </div>
      )}

      {/* ========= Seal Moment modal ========= */}
      <SealMomentModal
        open={sealOpen}
        url={sealUrl}
        hash={sealHash}
        onClose={() => setSealOpen(false)}
        onDownloadZip={saveZipBundle}
      />
    </>,
    document.body
  );
};

export default SigilModal;
