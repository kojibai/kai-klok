/* ────────────────────────────────────────────────────────────────
   SigilRenderer.tsx · Atlantean Lumitech “Kairos Harmonic Sigil”
   v5.0 — **canonical implementation** per the Kairos spec
   • Lissajous path + chakra-based glow exactly as described
   • Step-% tolerant of 0-1 *or* 0-100 inputs
   • Pure-function, no hooks — safe for SSR / memo
───────────────────────────────────────────────────────────────── */

import React from "react";

/* ── Props reflect the live Kai-API payload ───────────────────── */
export interface SigilRendererProps {
  pulse: number;    // Eternal Kai-Pulse (e.g. 6578601)
  beat: number;     // Chakra Beat index within day (0 – 35)
  stepPct: number;  // Percent (0-1 or 0-100) into the beat
  size?: number;    // px (edge length of the square viewBox)
}

/* ── Chakra color & geometry maps (Root→Crown) ───────────────── */
const CHAKRA_COLORS = [
  "#FF0000", // Root – crimson
  "#FF7F00", // Sacral – orange
  "#FFD700", // Solar Plexus – gold
  "#00FF00", // Heart – emerald
  "#00FFFF", // Throat – cyan
  "#8A2BE2", // Third-Eye – violet
  "#FFFFFF", // Crown – white
];

/**
 * Polygon side-count chosen to echo classic chakra symbolism:
 *   • Root   → 4 (square)     • Throat → 16
 *   • Sacral → 6              • Third-Eye → 2 (lens)
 *   • Solar  → 3 (triangle)   • Crown → 1 (circle/ring)
 */
const CHAKRA_SIDES = [4, 6, 3, 8, 16, 2, 1];

/* ── Helpers ──────────────────────────────────────────────────── */
const toPath = (
  pulse: number,
  beat: number,
  stepPct: number,
  resolution = 300,
  size = 160,
) => {
  // Ensure stepPct is a 0–1 fraction
  const pct = stepPct > 1 ? stepPct / 100 : stepPct;

  // Harmonic coefficients (spec §3, PDF) :contentReference[oaicite:0]{index=0}
  const a = (pulse % 7) + 1;
  const b = (beat % 5) + 2;
  const delta = pct * 2 * Math.PI; // phase offset (“breath”)

  // Generate modified Lissajous curve
  const coords: string[] = [];
  for (let i = 0; i < resolution; i++) {
    const t = (i / (resolution - 1)) * 2 * Math.PI;
    const x = Math.sin(a * t + delta);
    const y = Math.sin(b * t);
    const px = ((x + 1) / 2) * size;
    const py = ((y + 1) / 2) * size;
    coords.push(`${i === 0 ? "M" : "L"}${px},${py}`);
  }
  return coords.join(" ");
};

/* ═══════════════════════════════════════════════════════════════
   <SigilRenderer/>
════════════════════════════════════════════════════════════════ */
export const SigilRenderer: React.FC<SigilRendererProps> = ({
  pulse,
  beat,
  stepPct,
  size = 160,
}) => {
  const colorIndex = pulse % CHAKRA_COLORS.length;
  const glowColor  = CHAKRA_COLORS[colorIndex];
  const pathData   = toPath(pulse, beat, stepPct, 300, size);

  /* ── Optional chakra-polygon backdrop (geometry layer) ─────── */
  const sides = CHAKRA_SIDES[colorIndex];
  const polygon =
    sides < 2
      ? null // Crown → skip polygon (use ring glow instead)
      : Array.from({ length: sides })
          .map((_, i) => {
            const angle = (i / sides) * 2 * Math.PI - Math.PI / 2;
            const r = size * 0.38; // radius factor
            const x = size / 2 + r * Math.cos(angle);
            const y = size / 2 + r * Math.sin(angle);
            return `${i === 0 ? "M" : "L"}${x},${y}`;
          })
          .join(" ") + " Z";

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label="Kairos Harmonic Sigil"
    >
      {/* Ambient glow */}
      <defs>
        <radialGradient id="sigil-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor={glowColor} stopOpacity="0.38" />
          <stop offset="100%" stopColor="#000"      stopOpacity="0.00" />
        </radialGradient>
      </defs>
      <rect width={size} height={size} fill="url(#sigil-glow)" />

      {/* Chakra geometry layer */}
      {polygon && (
        <path
          d={polygon}
          fill="none"
          stroke={glowColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 4px ${glowColor}AA)` }}
        />
      )}

      {/* Lissajous motion field */}
      <path
        d={pathData}
        stroke="#00FFD0"
        fill="none"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: "drop-shadow(0 0 6px #00FFD0AA)" }}
      />

      {/* Core nexus point */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r="3"
        fill={glowColor}
        style={{ filter: "drop-shadow(0 0 4px white)" }}
      />
    </svg>
  );
};
