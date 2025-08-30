// KaiKlock.tsx — 120-px “Atlantean Lumitech” dial (100% responsive & mobile-safe)
import React, { useMemo, useEffect } from "react";
import "./KaiKlock.css";

// If you have BREATH_SEC elsewhere, it's no longer used to derive day pulses here.
// We pin to canonical continuous day pulses so Eternal/Solar math stays in perfect lock.
export const HARMONIC_DAY_PULSES = 17491.270421 as const;

/* ─── Arc model (IDs never change) ───────────────────────────── */
export type ArcName =
  | "Ignition Ark"
  | "Integration Ark"
  | "Harmonization Ark"
  | "Reflektion Ark"
  | "Purifikation Ark"
  | "Dream Ark";

/* HEX neons for hardware/orb/needle */
const ARC_COLORS: Record<ArcName, string> = {
  "Ignition Ark":      "#ff1559",
  "Integration Ark":   "#ff6d00",
  "Harmonization Ark": "#ffd900",
  "Reflektion Ark":    "#00ff66",
  "Purifikation Ark":  "#05e6ff",
  "Dream Ark":         "#c300ff",
};

/* UI-friendly captions */
const ARC_SHORT: Record<ArcName, string> = {
  "Ignition Ark":      "Ignite",
  "Integration Ark":   "Integrate",
  "Harmonization Ark": "Harmony",
  "Reflektion Ark":    "Reflekt",
  "Purifikation Ark":  "Purify",
  "Dream Ark":         "Dream",
};

/* ─── Geometry & constants ───────────────────────────────────── */
const SIZE        = 120;
const C           = SIZE / 2;
const HALO_R      = 22;
const HALO_STROKE = 4.5;
const RING_MARGIN = 2;
const OUTER_R     = C - 0.5;
const R           = C - RING_MARGIN;

const DOTS          = 36;
const DOT_OFFSET    = -3;
const NUM_FONT_SIZE = 3;
const DOT_R         = R - 2;
const LABEL_R       = ((HALO_R + HALO_STROKE + OUTER_R) / 2) - 4;

/* ─── Eternal beat/step canon (continuous) ───────────────────── */
const ETERNAL_BEATS_PER_DAY   = 36;
const ETERNAL_STEPS_PER_BEAT  = 44;
const ETERNAL_PULSES_PER_BEAT = HARMONIC_DAY_PULSES / ETERNAL_BEATS_PER_DAY;
const ETERNAL_PULSES_PER_STEP = ETERNAL_PULSES_PER_BEAT / ETERNAL_STEPS_PER_BEAT;

/* ─── Helpers ───────────────────────────────────────────────── */
const rad  = (deg: number) => (deg * Math.PI) / 180;
const slug = (s: string) => s.toLowerCase().replace(/\s+/g, "-");
function lerpColor(a: string, b: string, t: number): string {
  const ah = parseInt(a.slice(1),16), bh = parseInt(b.slice(1),16);
  const ar = ah>>16, ag=(ah>>8)&0xff, ab=ah&0xff;
  const br = bh>>16, bg=(bh>>8)&0xff, bb=bh&0xff;
  const rr = Math.round(ar + (br-ar)*t),
        rg = Math.round(ag + (bg-ag)*t),
        rb = Math.round(ab + (bb-ab)*t);
  return `rgb(${rr},${rg},${rb})`;
}
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const parseStepFromString = (s?: string): number | undefined => {
  if (!s) return undefined;
  const m = s.match(/(\d{2})$/);
  if (!m) return undefined;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n)) return undefined;
  return clamp(n, 0, 43);
};

/* ─── Props ─────────────────────────────────────────────────── */
export interface KaiKlockProps {
  hue: string;
  pulse: number;                         // local solar-aligned pulses today (for solar needle/day ring)
  harmonicDayPercent: number;            // day progress 0–100 (for rim progress)
  microCyclePercent: number;             // micro percent (for orb delay)
  dayLabel: string;
  monthLabel: string;
  monthDay: number;
  kaiPulseEternal: number;               // global eternal pulses (for Eternal hand)
  glowPulse?: boolean;
  rotationOverride?: number;             // solar needle override (center-of-beat)
  /** Animation rhythm in SECONDS (defaults to φ-exact breath) */
  pulseIntervalSec?: number;
  rimFlash?: boolean;

  solarSpiralStepString?: string;
  solarSpiralStep?: {
    percentIntoStep: number;
    stepIndex: number;       // 0–43
    stepsPerBeat: number;    // 44
    beatIndex: number;       // 0–35
  };

  /** Optional external indices (App.tsx live ticker may pass these).
      If omitted, they are derived from kaiPulseEternal. */
  eternalBeatIndex?: number; // 0..35
  eternalStepIndex?: number; // 0..43

  eternalWeekDescription?: string;
}

/* ─── φ-exact breath unit ──────────────────────────────────────
   T = 3 + √5 seconds; also provide ms for timers and Hz for reference. */
export const BREATH_SEC = 3 + Math.sqrt(5);                 // ≈ 5.23606797749979…
export const BREATH_MS  = Math.round(BREATH_SEC * 1000);    // 5236 ms (rounded)
export const BREATH_HZ  = 1 / BREATH_SEC;                   // ≈ 0.190983005625…

/* ─── Component ─────────────────────────────────────────────── */
const KaiKlock: React.FC<KaiKlockProps> = ({
  hue,
  pulse,
  kaiPulseEternal,
  harmonicDayPercent,
  microCyclePercent,
  dayLabel,
  monthLabel,
  monthDay,
  glowPulse        = true,
  // IMPORTANT: this is SECONDS; default to φ-exact BREATH_SEC
  pulseIntervalSec = BREATH_SEC,
  rimFlash         = false,
  rotationOverride,
  solarSpiralStepString,
  solarSpiralStep,
  eternalBeatIndex,
  eternalStepIndex,
}) => {
  // keep CSS in sync with the exact φ cycle
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--cycle", `${pulseIntervalSec}s`);
    }
  }, [pulseIntervalSec]);

  const cycle = `${pulseIntervalSec}s`;

  /* ────────────────────────────────────────────────────────────
     NON-BLOCKING FALLBACKS
     - If solar 'pulse' (or percents) aren’t ready yet, we render
       immediately using a UTC-safe Eternal baseline derived from
       kaiPulseEternal. As soon as real solar values arrive, the
       UI updates seamlessly. The API remains unchanged.
  ─────────────────────────────────────────────────────────────*/
  const normalizedEternal =
    ((kaiPulseEternal % HARMONIC_DAY_PULSES) + HARMONIC_DAY_PULSES) % HARMONIC_DAY_PULSES;

  const hasSolarPulse = Number.isFinite(pulse);
  const effectivePulse =
    hasSolarPulse ? pulse : normalizedEternal; // ← immediate render with baseline

  const derivedDayFraction = effectivePulse / HARMONIC_DAY_PULSES;
  const effectiveHarmonicDayPercent = Number.isFinite(harmonicDayPercent)
    ? harmonicDayPercent
    : derivedDayFraction * 100;

  // Micro-cycle fallback: progress within the current step (0–100)
  const pulsesIntoBeatFallback =
    effectivePulse - Math.floor(effectivePulse / ETERNAL_PULSES_PER_BEAT) * ETERNAL_PULSES_PER_BEAT;
  const stepFracFallback =
    (pulsesIntoBeatFallback % ETERNAL_PULSES_PER_STEP) / ETERNAL_PULSES_PER_STEP;
  const effectiveMicroCyclePercent = Number.isFinite(microCyclePercent)
    ? microCyclePercent
    : stepFracFallback * 100;

  /* ── Solar (local) needle & rim progress (unchanged visuals) ─ */
  const dayPulse    = ((effectivePulse % HARMONIC_DAY_PULSES) + HARMONIC_DAY_PULSES) % HARMONIC_DAY_PULSES;
  const dayFraction = dayPulse / HARMONIC_DAY_PULSES;

  const solarBeatIndex     = Math.floor(dayFraction * ETERNAL_BEATS_PER_DAY) % ETERNAL_BEATS_PER_DAY;
  const solarBeatCenterDeg = ((solarBeatIndex + 0.5) / ETERNAL_BEATS_PER_DAY) * 360;
  const needleDeg          = typeof rotationOverride === "number" ? rotationOverride : solarBeatCenterDeg;

  const arcSpan      = 360 / ARCS.length;
  const arcIndex     = Math.floor(needleDeg / arcSpan) % ARCS.length;
  const nextArcIndex = (arcIndex + 1) % ARCS.length;
  const localDeg     = (needleDeg - arcIndex * arcSpan + 360) % 360;
  const arcFraction  = Math.min(1, localDeg / arcSpan);
  const startColor   = ARC_COLORS[ARCS[arcIndex]];
  const endColor     = ARC_COLORS[ARCS[nextArcIndex]];
  const needleColor  = lerpColor(startColor, endColor, arcFraction);

  const circumference = 2 * Math.PI * R;
  const dashOff       = circumference * (1 - effectiveHarmonicDayPercent / 100);

  const orbDelay = -(effectiveMicroCyclePercent / 100) * pulseIntervalSec;
  const pulseKey = effectivePulse;

  const months     = ["Aethon", "Virelai", "Solari", "Amarin", "Kaelus", "Umbriel", "Noctura", "Liora"];
  const monthIndexRaw = months.indexOf(monthLabel) + 1;
  const monthIndex    = monthIndexRaw > 0 ? monthIndexRaw : 1; // safe fallback to 1

  const spacing = 14;
  const xBeat   = C - spacing;
  const xDay    = C;
  const xMonth  = C + spacing;
  const yNums   = C + 28;

  /* ── Eternal hand (mirror EternalKlock) ────────────────────── */
  // Allow external indices from App ticker; otherwise derive from kaiPulseEternal
  const etBeatIdxDerived   = Math.floor(normalizedEternal / ETERNAL_PULSES_PER_BEAT) % ETERNAL_BEATS_PER_DAY;
  const etBeatIdx          = Number.isFinite(eternalBeatIndex!)
    ? clamp(eternalBeatIndex!, 0, 35)
    : etBeatIdxDerived;

  const pulsesIntoBeatET   = normalizedEternal - etBeatIdx * ETERNAL_PULSES_PER_BEAT;
  const fracIntoBeat       = pulsesIntoBeatET / ETERNAL_PULSES_PER_BEAT;

  const etStepIdxDerived   = Math.floor(pulsesIntoBeatET / ETERNAL_PULSES_PER_STEP) % ETERNAL_STEPS_PER_BEAT; // 0–43
  const etStepIdx          = Number.isFinite(eternalStepIndex!)
    ? clamp(eternalStepIndex!, 0, 43)
    : etStepIdxDerived;

  const stepLabel          = etStepIdx.toString().padStart(2, "0");
  const eternalDeg         = ((etBeatIdx + 0.5) / ETERNAL_BEATS_PER_DAY) * 360;

  const beatHue   = `hsl(${(solarBeatIndex / ETERNAL_BEATS_PER_DAY) * 360}, 100%, 50%)`;

  /* ── Hand geometry ─────────────────────────────────────────── */
  const ETHERIK_FILL   = "#ebfdff";
  const ETHERIK_STROKE = "#bff7ff";

  const handThickness = 1.6;
  const handLength    = OUTER_R - (HALO_R + HALO_STROKE) + 0.5;

  const baseY   = C - (HALO_R + HALO_STROKE);
  const fillH   = handLength * fracIntoBeat;
  const fillY   = baseY - fillH;

  const labelYFactor = 0.82;
  const labelY       = C - (HALO_R + HALO_STROKE) - handLength * labelYFactor;
  const labelX       = C;
  const percentY     = labelY + 6;

  const uid = useMemo(() => Math.random().toString(36).slice(2), []);

  /* ── Eternal readouts ─────────────────────────────────────── */
  const etStepStr = stepLabel;                                   // SS
  const etBeatStr = etBeatIdx.toString().padStart(2, "0");       // BB
  const eternalPulsesToday = Math.floor(normalizedEternal);      // 0–17491
  const pulsesIntoStepET = pulsesIntoBeatET - etStepIdx * ETERNAL_PULSES_PER_STEP;
  const fracIntoStepET   = Math.max(0, Math.min(1, pulsesIntoStepET / ETERNAL_PULSES_PER_STEP));
  const etPercentIntoStep = fracIntoStepET * 100;
  const NEON_CYAN   = "#00faff" as const;
  const SOLAR_AMBER = "#ff6d00" as const; // ☀ color

  /* ── Solar step for SOLAR hand (clean, lint-safe) ──────────── */
  // 1) Fallback from effectivePulse (works before geolocation resolves)
  const pulsesIntoBeatSolar = dayPulse - solarBeatIndex * ETERNAL_PULSES_PER_BEAT;
  const normalizedSolarPulsesIntoBeat =
    ((pulsesIntoBeatSolar % ETERNAL_PULSES_PER_BEAT) + ETERNAL_PULSES_PER_BEAT) % ETERNAL_PULSES_PER_BEAT;
  const fallbackSolarStepIndex =
    Math.floor(normalizedSolarPulsesIntoBeat / ETERNAL_PULSES_PER_STEP) % ETERNAL_STEPS_PER_BEAT;

  // 2) Resolve priority: explicit prop → string tail → computed fallback
  const propStep = Number.isFinite(solarSpiralStep?.stepIndex)
    ? clamp(solarSpiralStep!.stepIndex, 0, 43)
    : undefined;
  const strStep = parseStepFromString(solarSpiralStepString);
  const solarStepIdx = propStep ?? strStep ?? fallbackSolarStepIndex;

  const solarStepLabel = solarStepIdx.toString().padStart(2, "0");

  // Solar hand label geometry (same placement pattern as eternal)
  const solarLabelY = C - (HALO_R + HALO_STROKE) - handLength * labelYFactor;
  const solarLabelX = C;

  return (
    <div
      className="kai-klock-shell"
      style={
        {
          "--hue": hue,
          "--arc": startColor, // dynamic solar arc color
          "--cycle": cycle,
          width: "100%",
          aspectRatio: "1 / 1",
          overflow: "hidden", // iOS: clip filter/shadow bleed
        } as React.CSSProperties
      }
    >
      <svg
        className="kai-svg"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        role="img"
      >
        {/* Rim + day progress */}
        <circle cx={C} cy={C} r={OUTER_R} className={`rim-ring ${rimFlash ? "rim-flash" : ""}`} />
        <circle cx={C} cy={C} r={R} className="day-progress" strokeDasharray={circumference} strokeDashoffset={dashOff} />

        {/* Beat numbers (0–35) */}
        {Array.from({ length: 36 }).map((_, i) => {
          const ang = rad(i * (360 / DOTS) - 90);
          const cf  = ((i + DOT_OFFSET + DOTS) % DOTS) / DOTS;
          return (
            <text
              key={i}
              x={C + DOT_R * Math.cos(ang)}
              y={C + DOT_R * Math.sin(ang) + NUM_FONT_SIZE / 2}
              className="beat-number"
              textAnchor="middle"
              fontSize={NUM_FONT_SIZE}
              style={{ fill: `hsl(${cf * 360},100%,50%)` }}>
              {i}
            </text>
          );
        })}

        {/* Halo + micro orb */}
        <circle cx={C} cy={C} r={HALO_R + HALO_STROKE} className="inner-halo" />
        <g className="orb-spin" style={{ animationDelay: `${orbDelay}s` }}>
          <circle cx={C} cy={C - (HALO_R + HALO_STROKE)} r={3.6} className="micro-orb orb-glow" />
        </g>

        {/* Solar needle + solar step label */}
        <g style={{ transform: `rotate(${needleDeg}deg)`, transformOrigin: `${C}px ${C}px`, transition: `transform 1s ease-out` }}>
          <rect
            x={C - 1}
            y={C - (HALO_R + HALO_STROKE) - (OUTER_R - (HALO_R + HALO_STROKE))}
            width={2}
            height={OUTER_R - (HALO_R + HALO_STROKE)}
            rx={1}
            className="needle"
            style={{ fill: needleColor }}
          />
          {/* Solar step digits on the SOLAR hand (upright, ☀ color + symbol) */}
          <g
            className="solar-hand-label-wrap"
            style={{
              transform: `rotate(${-needleDeg}deg)`,
              transformOrigin: `${solarLabelX}px ${solarLabelY}px`,
            }}
          >
            <text
              x={solarLabelX}
              y={solarLabelY - 3.6}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={3}
              fontWeight={900}
              style={{
                fill: SOLAR_AMBER,
                paintOrder: "stroke",
                stroke: "rgba(0,0,0,0.65)",
                strokeWidth: 0.8,
                filter: `drop-shadow(0 0 2px ${SOLAR_AMBER})`,
              }}
            >
              ☀
            </text>
            <text
              x={solarLabelX - 2.2}
              y={solarLabelY}
              textAnchor="middle"
              dominantBaseline="central"
              className="solar-hand-label-digit"
              fontSize={4.4}
              fontWeight={900}
              style={{
                fill: SOLAR_AMBER,
                paintOrder: "stroke",
                stroke: "rgba(0,0,0,0.65)",
                strokeWidth: 0.9,
                letterSpacing: "0.4px",
                filter: `drop-shadow(0 0 2px ${SOLAR_AMBER}) drop-shadow(0 0 5px ${SOLAR_AMBER})`,
              }}
            >
              {solarStepLabel[0]}
            </text>
            <text
              x={solarLabelX + 2.2}
              y={solarLabelY}
              textAnchor="middle"
              dominantBaseline="central"
              className="solar-hand-label-digit"
              fontSize={4.4}
              fontWeight={900}
              style={{
                fill: SOLAR_AMBER,
                paintOrder: "stroke",
                stroke: "rgba(0,0,0,0.65)",
                strokeWidth: 0.9,
                letterSpacing: "0.4px",
                filter: `drop-shadow(0 0 2px ${SOLAR_AMBER}) drop-shadow(0 0 5px ${SOLAR_AMBER})`,
              }}
            >
              {solarStepLabel[1]}
            </text>
          </g>
        </g>

        {/* Eternal hand */}
        <g
          className="eternal-hand-group"
          style={{
            transform: `rotate(${eternalDeg}deg)`,
            transformOrigin: `${C}px ${C}px`,
            transition: `transform 0.6s cubic-bezier(.22,.61,.36,1)`,
          }}
        >
          {/* Outline */}
          <rect
            x={C - handThickness / 2}
            y={C - (HALO_R + HALO_STROKE) - handLength}
            width={handThickness}
            height={handLength}
            rx={handThickness / 1.5}
            className="eternal-hand"
            style={{
              fill: "transparent",
              stroke: ETHERIK_STROKE,
              strokeWidth: 0.7,
              filter: `drop-shadow(0 0 2px #eaffff) drop-shadow(0 0 6px #d9fbff)`,
              mixBlendMode: "screen",
            }}
          />

          {/* Fill (% into beat) */}
          <defs>
            <linearGradient id={`eternalFill-${uid}`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%"  stopColor={ETHERIK_FILL} stopOpacity={0.15} />
              <stop offset="100%" stopColor={ETHERIK_FILL} stopOpacity={0.95} />
            </linearGradient>
          </defs>
          <rect
            x={C - handThickness / 2}
            y={fillY}
            width={handThickness}
            height={Math.max(0, fillH)}
            rx={handThickness / 2}
            className="eternal-hand-fill"
            style={{
              fill: `url(#eternalFill-${uid})`,
              filter: `drop-shadow(0 0 3px #eaffff) drop-shadow(0 0 6px #eaffff)`,
              mixBlendMode: "screen",
            }}
          />

          {/* Tip jewel */}
          <circle
            cx={C}
            cy={C - (HALO_R + HALO_STROKE) - handLength - 0.8}
            r={1.35}
            className="eternal-hand-tip"
            style={{
              fill: "#ffffff",
              filter: `drop-shadow(0 0 4px #eaffff) drop-shadow(0 0 8px #eaffff)`,
              mixBlendMode: "screen",
            }}
          />

          {/* Step digits on hand (upright) */}
          <g
            className="eternal-hand-label-wrap"
            style={{
              transform: `rotate(${-eternalDeg}deg)`,
              transformOrigin: `${labelX}px ${labelY}px`,
            }}
          >
            <text
              x={labelX - 2.2}
              y={labelY}
              textAnchor="middle"
              dominantBaseline="central"
              className="eternal-hand-label-digit"
              fontSize={4.4}
              fontWeight={900}
              style={{
                fill: "#e8feff",
                paintOrder: "stroke",
                stroke: "rgba(0,0,0,0.45)",
                strokeWidth: 0.9,
                letterSpacing: "0.4px",
                filter: `drop-shadow(0 0 2px #eaffff) drop-shadow(0 0 5px #c8fbff)`,
              }}
            >
              {stepLabel[0]}
            </text>
            <text
              x={labelX + 2.2}
              y={labelY}
              textAnchor="middle"
              dominantBaseline="central"
              className="eternal-hand-label-digit"
              fontSize={4.4}
              fontWeight={900}
              style={{
                fill: "#e8feff",
                paintOrder: "stroke",
                stroke: "rgba(0,0,0,0.45)",
                strokeWidth: 0.9,
                letterSpacing: "0.4px",
                filter: `drop-shadow(0 0 2px #eaffff) drop-shadow(0 0 5px #c8fbff)`,
              }}
            >
              {stepLabel[1]}
            </text>
          </g>

          {/* Small % badge (upright) */}
          <g transform={`rotate(${-eternalDeg} ${labelX} ${percentY})`}>
            <text
              x={labelX}
              y={percentY}
              textAnchor="middle"
              dominantBaseline="central"
              className="eternal-hand-percent"
              fontSize={3.2}
              fontWeight={800}
              style={{
                fill: "#dafeff",
                paintOrder: "stroke",
                stroke: "rgba(0,0,0,0.4)",
                strokeWidth: 0.7,
                letterSpacing: "0.25px",
                filter: `drop-shadow(0 0 2px #eaffff)`,
              }}
            >
              {/* intentionally blank per current UI */}
            </text>
          </g>
        </g>

        {/* TOP SMALL READOUT (was solar beat:step "29:00") → Eternal Pulses Today */}
        <text
          x={C}
          y={C - 15}
          className="center-sub"
          textAnchor="middle"
          fontSize={6}
          fontWeight={800}
          style={{
            fill: NEON_CYAN,
            paintOrder: "stroke",
            stroke: "#000",
            strokeWidth: 0.9,
            letterSpacing: "0.4px",
            filter: `drop-shadow(0 0 2px ${NEON_CYAN}) drop-shadow(0 0 6px ${NEON_CYAN})`,
          }}
        >
          {eternalPulsesToday}
        </text>

        {/* Big center stays Eternal beat:step (BB:SS) */}
        <text
          key={`et-${pulseKey}`}
          x={C}
          y={C - 3}
          className={`center-pulse ${glowPulse ? "pulse-flash" : ""}`}
          textAnchor="middle"
        >
          {etBeatStr}:{etStepStr}
        </text>

        <text x={C} y={C + 8} className={`center-day day-${slug(dayLabel)}`} textAnchor="middle">
          {dayLabel}
        </text>
        <text x={C} y={C + 18} className={`center-month month-${slug(monthLabel)}`} textAnchor="middle">
          {monthLabel}
        </text>

        {/* Eternal pulse number (raw, global) */}
        <text x={C} y={yNums + 8} className="eternal-pulse" textAnchor="middle">
          {kaiPulseEternal}
        </text>

        {/* Bottom trio */}
        <text
          x={xBeat}
          y={yNums}
          className="step-percent"
          textAnchor="middle"
          fontSize={5.5}
          fill={beatHue}
          fontWeight={800}
          style={{
            filter: `drop-shadow(0 0 2px ${beatHue}) drop-shadow(0 0 5px #00faff)`,
            letterSpacing: "0.25px",
          }}
        >
          {`${etPercentIntoStep.toFixed(1)}%`}
        </text>

        <text x={xDay} y={yNums} className={`day-of-month day-${slug(dayLabel)}`} textAnchor="middle">
          {monthDay}
        </text>
        <text x={xMonth} y={yNums} className={`day-of-month month-${slug(monthLabel)}`} textAnchor="middle">
          {monthIndex}
        </text>

        {/* Arc labels + optional solarKairos string under Ignition */}
        {ARCS.map((name, i) => {
          const ang = rad(i*(360/ARCS.length)-90);
          const x   = C + LABEL_R*Math.cos(ang);
          const y   = C + LABEL_R*Math.sin(ang) + (i === 3 ? 7 : 3);
          return (
            <React.Fragment key={name}>
              <text x={x} y={y} className={`arc-label arc-${slug(name.split(" ")[0])} ${i === arcIndex ? "active" : ""}`} textAnchor="middle">
                {ARC_SHORT[name]}
              </text>
              {name === "Ignition Ark" && solarSpiralStepString && (
                <text
                  x={x}
                  y={y + 8}
                  textAnchor="middle"
                  dominantBaseline="hanging"
                  fontSize={10}
                  fill="#00faff"
                  fontWeight={900}
                  style={{
                    filter: `drop-shadow(0 0 2px #00faff) drop-shadow(0 0 4px #00faff) drop-shadow(0 0 8px #00faff)`,
                    paintOrder: 'stroke',
                    stroke: '#000',
                    strokeWidth: 1,
                    vectorEffect: 'non-scaling-stroke',
                    letterSpacing: '0.5px',
                  }}
                >
                  {solarSpiralStepString}
                </text>
              )}
            </React.Fragment>
          );
        })}
      </svg>
    </div>
  );
};

const ARCS: readonly ArcName[] = [
  "Ignition Ark",
  "Integration Ark",
  "Harmonization Ark",
  "Reflektion Ark",
  "Purifikation Ark",
  "Dream Ark",
];

export default KaiKlock;
