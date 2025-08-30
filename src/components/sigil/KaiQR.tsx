"use client";
import React, { useMemo } from "react";
import QRCode from "qrcode-generator";
import { makeCanonicalQrUrl } from "../../utils/sigilUrl";
import { getDisplayAlignedCounters, getKaiPulseToday, getSolarArcName } from "../../SovereignSolar";

type ChakraName = "red" | "orange" | "yellow" | "green" | "blue" | "purple";

export type KaiQRProps = {
  uid: string;
  url?: string | null;
  size?: number;
  phaseHue?: number;
  phaseColor?: string;
  chakraName?: ChakraName;
  chakraColor?: string;
  moduleColor?: string;
  polarity?: "auto" | "dark-on-light" | "light-on-dark";
  animate?: boolean;
  pulseMs?: number;

  /** NEW: fade the QR modules (0..1). Defaults to 0.5 for this test. */
  moduleOpacity?: number;

  /* Scan reliability */
  minModulePx?: number;
  quietVeilAlpha?: number;

  /* Atlantean art */
  templeGapPx?: number;
  latticeOpacity?: number;
  showHalo?: boolean;
  showLattice?: boolean;
  showTempleCorners?: boolean;
  showCornerFlares?: boolean;
  showChakraRing?: boolean;
  showGlyphRays?: boolean;

  /** Sacred seal ring/glow */
  showSeal?: boolean;

  /* Embedding */
  mode?: "svg" | "group";
  parentSize?: number;
  cx?: number;
  cy?: number;
};

const hsl = (h: number, s = 100, l = 50, a?: number) =>
  `hsl(${h} ${s}% ${l}%${a != null ? ` / ${a}` : ""})`;

const CHAKRA_HEX: Record<ChakraName, string> = {
  red: "#FF3B3B",
  orange: "#FF7A1A",
  yellow: "#FFD400",
  green: "#00E676",
  blue: "#00A9FF",
  purple: "#7A5CFF",
};

const DAY_TO_CHAKRA: ChakraName[] = ["red", "orange", "yellow", "green", "blue", "purple"];

function arkHueShift(name: string): number {
  if (name.includes("Ignition")) return +8;
  if (name.includes("Integration")) return +2;
  if (name.includes("Harmonization")) return +4;
  if (name.includes("Reflektion")) return -6;
  if (name.includes("Purifikation")) return -10;
  if (name.includes("Dream")) return +12;
  return 0;
}

function hexToRgb(hex?: string) {
  if (!hex) return null;
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}
function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2, d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) { case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break; }
    h = Math.round((h * 60 + 360) % 360);
  }
  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** bright but still colored (for light-on-dark) */
function brightChakraInk(hex: string) {
  const rgb = hexToRgb(hex) ?? { r: 122, g: 92, b: 255 };
  const { h } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  let L = 76; if (h >= 45 && h <= 70) L = 70; else if (h >= 15 && h < 45) L = 72; else if (h < 15 || h > 345) L = 72;
  return hsl(h, 100, L);
}

export default function KaiQR({
  uid,
  url,
  size = 360,
  phaseHue = 192,
  phaseColor = "#7A5CFF",
  chakraName,
  chakraColor,
  moduleColor,
  polarity = "light-on-dark",
  animate = true,
  pulseMs = 5236,

  /** default 0.5 so you can test the fade */
  moduleOpacity = 0.2,

  minModulePx = 7,
  quietVeilAlpha,
  templeGapPx = 24,
  latticeOpacity = 0.14,
  showHalo = true,
  showLattice = true,
  showTempleCorners = true,
  showCornerFlares = true,
  showChakraRing = true,
  showGlyphRays = true,
  showSeal = true,
  mode = "group",
  parentSize = 1000,
  cx,
  cy,
}: KaiQRProps) {
  const finalUrl = useMemo(() => {
    if (url && typeof url === "string") return url;
    if (typeof window !== "undefined")
      return makeCanonicalQrUrl(window.location.href);
    return null;
  }, [url]);

  const content = useMemo(() => {
    if (!finalUrl) return null;

    const now = new Date();
    const { display } = getDisplayAlignedCounters(now);
    const arkName = getSolarArcName(now);
    const { stepIndex } = getKaiPulseToday(now);

    const dayIdx1 = display.dayIndex1;
    const autoChakraName =
      DAY_TO_CHAKRA[(Math.max(1, Math.min(6, dayIdx1)) - 1) as 0 | 1 | 2 | 3 | 4 | 5];
    const baseChakraHex =
      chakraColor ?? (chakraName ? CHAKRA_HEX[chakraName] : CHAKRA_HEX[autoChakraName]);

    let usePolarity = polarity;
    if (polarity === "auto") {
      const prgb = hexToRgb(phaseColor);
      const pHsl = prgb ? rgbToHsl(prgb.r, prgb.g, prgb.b) : { h: phaseHue, s: 90, l: 50 };
      usePolarity = pHsl.l > 60 ? "dark-on-light" : "light-on-dark";
    }

    // ink color
    const rgbForHue = hexToRgb(baseChakraHex) ?? { r: 0, g: 0, b: 0 };
    const baseHueForDarkInk = rgbToHsl(rgbForHue.r, rgbForHue.g, rgbForHue.b).h;
    const ink = moduleColor
      ? moduleColor
      : usePolarity === "light-on-dark"
      ? brightChakraInk(baseChakraHex)
      : hsl(baseHueForDarkInk, 85, 10);

    // aura/veil
    const baseRGB = hexToRgb(baseChakraHex);
    const baseHSL = baseRGB ? rgbToHsl(baseRGB.r, baseRGB.g, baseRGB.b) : { h: phaseHue, s: 90, l: 50 };
    const haloHue = (baseHSL.h + arkHueShift(arkName)) % 360;
    const deepLine = hsl(baseHSL.h, 92, 20);
    const haloTint = hsl(haloHue, Math.min(98, baseHSL.s + 6), Math.min(70, baseHSL.l + 8));
    const flareEdge = hsl((haloHue + 18) % 360, 90, 48);

    // If modules are translucent, slightly darken the veil for contrast on dark backgrounds
    const veilAlphaBase = usePolarity === "light-on-dark" ? 0.26 : 0.08;
    const veilContrastBoost =
      usePolarity === "light-on-dark" && moduleOpacity < 0.7 ? 0.06 : 0;
    const veilAlphaEff = quietVeilAlpha ?? (veilAlphaBase + veilContrastBoost);
    const veilHue = (haloHue + 180) % 360;
    const veilDark = hsl(veilHue, 40, 14);

    const breathe = 0.85 + (stepIndex % 11) * 0.015;

    // QR geometry
    const qr = QRCode(0, "H");
    qr.addData(finalUrl);
    qr.make();

    const count = qr.getModuleCount();
    const QUIET = 4;
    const modulesWithQuiet = count + QUIET * 2;
    const qrSide = Math.max(Math.ceil(modulesWithQuiet * minModulePx), size);
    const unit = qrSide / modulesWithQuiet;
    const offset = (size - qrSide) / 2;
    const qrRect = { x: (size - qrSide) / 2, y: (size - qrSide) / 2, s: qrSide };
    const innerRect = {
      x: Math.round(qrRect.x + QUIET * unit),
      y: Math.round(qrRect.y + QUIET * unit),
      s: Math.round(count * unit),
    };

    // modules
    const rects: React.ReactElement[] = [];
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (!qr.isDark(r, c)) continue;
        const x = Math.round(offset + (c + QUIET) * unit);
        const y = Math.round(offset + (r + QUIET) * unit);
        const w = Math.ceil(unit);
        const h = Math.ceil(unit);
        rects.push(
          <rect
            key={`${r}-${c}`}
            className="qr-mod"
            x={x}
            y={y}
            width={w}
            height={h}
            fill={ink}
            fillOpacity={Math.max(0, Math.min(1, moduleOpacity))}
            shapeRendering="crispEdges"
            pointerEvents="none"
          />
        );
      }
    }

    // defs (incl. seal)
    const haloGrad = `${uid}-halo-grad`;
    const bloomFilter = `${uid}-bloom`;
    const flareGrad = `${uid}-flare-grad`;
    const veilGrad = `${uid}-veil-grad`;
    const ringGrad = `${uid}-ring-grad`;
    const raysGrad = `${uid}-rays-grad`;
    const sealGrad = `${uid}-seal-grad`;
    const sealBloom = `${uid}-seal-bloom`;

    const Defs = (
      <defs>
        <radialGradient id={haloGrad} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor={haloTint} stopOpacity="0.18" />
          <stop offset="60%" stopColor={haloTint} stopOpacity="0.07" />
          <stop offset="100%" stopColor={haloTint} stopOpacity="0" />
        </radialGradient>

        <filter id={bloomFilter} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.1" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>

        <linearGradient id={flareGrad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={baseChakraHex} />
          <stop offset="100%" stopColor={flareEdge} />
        </linearGradient>

        <linearGradient id={veilGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={veilDark} stopOpacity={veilAlphaEff} />
          <stop offset="100%" stopColor={veilDark} stopOpacity={veilAlphaEff * 0.9} />
        </linearGradient>

        <radialGradient id={ringGrad} cx="50%" cy="50%" r="60%">
          <stop offset="70%" stopColor={baseChakraHex} stopOpacity="0.0" />
          <stop offset="92%" stopColor={baseChakraHex} stopOpacity="0.45" />
          <stop offset="100%" stopColor={flareEdge} stopOpacity="0.0" />
        </radialGradient>

        <linearGradient id={raysGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={baseChakraHex} stopOpacity="0.26" />
          <stop offset="100%" stopColor={baseChakraHex} stopOpacity="0.0" />
        </linearGradient>

        <linearGradient id={sealGrad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={baseChakraHex} />
          <stop offset="100%" stopColor={flareEdge} />
        </linearGradient>
        <filter id={sealBloom} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
      </defs>
    );

    // ornaments
    const Halo = (
      showHalo && <circle cx={size/2} cy={size/2} r={size*0.58} fill={`url(#${haloGrad})`} opacity={breathe} pointerEvents="none" />
    );
    const ContrastVeil = (
      (quietVeilAlpha ?? veilAlphaEff) > 0 &&
      <rect x={qrRect.x} y={qrRect.y} width={qrRect.s} height={qrRect.s}
            rx={Math.max(6, unit*1.5)} ry={Math.max(6, unit*1.5)}
            fill={`url(#${veilGrad})`} pointerEvents="none" />
    );

    const Lattice = showLattice ? (
      <g opacity={latticeOpacity} transform={`rotate(45 ${size/2} ${size/2})`} pointerEvents="none">
        {Array.from({ length: 44 }, (_, i) => {
          const d = (i - 22) * Math.max(22, Math.round(unit * 3.2));
          return <line key={i} x1={-size} y1={size/2 + d} x2={size*2} y2={size/2 + d} stroke={deepLine} strokeWidth={1} />;
        })}
      </g>
    ) : null;

    const Temples = showTempleCorners ? (
      <>
        {[
          [qrRect.x - templeGapPx, qrRect.y - templeGapPx, 45],
          [qrRect.x + qrRect.s + templeGapPx, qrRect.y - templeGapPx, 135],
          [qrRect.x - templeGapPx, qrRect.y + qrRect.s + templeGapPx, -45],
          [qrRect.x + qrRect.s + templeGapPx, qrRect.y + qrRect.s + templeGapPx, -135],
        ].map(([px, py, rot], i) => (
          <g key={i} transform={`translate(${px},${py}) rotate(${rot as number})`} filter={`url(#${bloomFilter})`} pointerEvents="none" opacity={breathe}>
            <path d="M0,-14 L9,0 L0,14" fill="none" stroke={baseChakraHex} strokeWidth={2.2} strokeLinecap="round" />
          </g>
        ))}
      </>
    ) : null;

    const corner = (cxF:number, cyF:number, a0:number, sweep:number) => {
      const r = Math.max(12, unit*3.6);
      const rad = (deg:number)=>deg*Math.PI/180;
      const a1 = a0+sweep;
      const x0 = cxF + r*Math.cos(rad(a0)), y0 = cyF + r*Math.sin(rad(a0));
      const x1 = cxF + r*Math.cos(rad(a1)), y1 = cyF + r*Math.sin(rad(a1));
      const large = Math.abs(sweep)>180 ? 1 : 0;
      return `M ${x0},${y0} A ${r},${r} 0 ${large} 1 ${x1},${y1}`;
    };
    const CornerFlares = showCornerFlares ? (
      <>
        {[
          [qrRect.x, qrRect.y, 0, 90],
          [qrRect.x + qrRect.s, qrRect.y, 90, 90],
          [qrRect.x, qrRect.y + qrRect.s, -90, 90],
          [qrRect.x + qrRect.s, qrRect.y + qrRect.s, 180, 90],
        ].map(([x,y,a,s], i) => (
          <path key={i} d={corner(x as number, y as number, a as number, s as number)}
                fill="none" stroke={`url(#${flareGrad})`} strokeWidth={3}
                opacity={0.95*breathe} filter={`url(#${bloomFilter})`} pointerEvents="none" />
        ))}
      </>
    ) : null;

    const ChakraRing = showChakraRing ? (
      <rect x={qrRect.x - unit*2.2} y={qrRect.y - unit*2.2}
            width={qrRect.s + unit*4.4} height={qrRect.s + unit*4.4}
            rx={unit*2} ry={unit*2} fill="none"
            stroke={`url(#${ringGrad})`} strokeWidth={Math.max(2, unit*0.9)}
            filter={`url(#${bloomFilter})`} opacity={0.95*breathe} pointerEvents="none" />
    ) : null;

    const GlyphRays = showGlyphRays ? (
      <g pointerEvents="none" opacity={0.22*breathe} filter={`url(#${bloomFilter})`}>
        {Array.from({ length: 22 }, (_, i) => {
          const t = (i/22)*Math.PI*2, r1 = qrRect.s*0.62, r2 = qrRect.s*0.86;
          const cx0 = size/2 + Math.cos(t)*r1, cy0 = size/2 + Math.sin(t)*r1;
          const cx1 = size/2 + Math.cos(t)*r2, cy1 = size/2 + Math.sin(t)*r2;
          return <line key={i} x1={cx0} y1={cy0} x2={cx1} y2={cy1} stroke={`url(#${raysGrad})`} strokeWidth={1.6} strokeLinecap="round" />;
        })}
      </g>
    ) : null;

    // sacred seal (outside quiet zone)
    const sealPad = Math.max(unit*2.0, 8);
    const sealStroke = Math.max(unit*0.9, 2);
    const sealRadius = Math.max(6, unit*1.8);
    const SealBorder = showSeal ? (
      <g pointerEvents="none">
        <rect x={innerRect.x - sealPad} y={innerRect.y - sealPad}
              width={innerRect.s + sealPad*2} height={innerRect.s + sealPad*2}
              rx={sealRadius} ry={sealRadius} fill="none"
              stroke={baseChakraHex} strokeOpacity={0.35}
              strokeWidth={sealStroke*1.8} filter={`url(#${sealBloom})`} />
        <rect x={innerRect.x - sealPad} y={innerRect.y - sealPad}
              width={innerRect.s + sealPad*2} height={innerRect.s + sealPad*2}
              rx={sealRadius} ry={sealRadius} fill="none"
              stroke={`url(#${sealGrad})`} strokeWidth={sealStroke} opacity={0.85} />
      </g>
    ) : null;

    const StyleGuard = (
      <style>{`
        #${uid}-svg .qr-mod, #${uid}-group .qr-mod {
          fill: ${ink} !important;
          mix-blend-mode: normal !important;
        }
        #${uid}-svg .qr-mod-layer, #${uid}-group .qr-mod-layer {
          mix-blend-mode: normal !important;
          isolation: isolate !important;
        }
      `}</style>
    );

    const Modules = (
      <g className="qr-mod-layer" shapeRendering="crispEdges" style={{ mixBlendMode: "normal", isolation: "isolate" }}>
        {rects}
      </g>
    );

    return (
      <>
        <title>{finalUrl}</title>
        <desc>Chakra-tinted QR with ~50% module opacity and contrast-preserving veil. Sacred seal sits outside the quiet zone.</desc>
        {Defs}
        {Halo}
        {Lattice}
        {Temples}
        {CornerFlares}
        {ChakraRing}
        {GlyphRays}
        {ContrastVeil}
        {SealBorder}
        {StyleGuard}
        {Modules}
        <rect x={innerRect.x} y={innerRect.y} width={innerRect.s} height={innerRect.s}
              fill="transparent" pointerEvents="auto"
              onClick={() => finalUrl && window.open(finalUrl, "_blank")} />
      </>
    );
  }, [
    finalUrl, size, phaseHue, phaseColor, chakraName, chakraColor,
    moduleColor, polarity, animate, pulseMs, moduleOpacity,
    minModulePx, quietVeilAlpha, templeGapPx, latticeOpacity,
    showHalo, showLattice, showTempleCorners, showCornerFlares,
    showChakraRing, showGlyphRays, showSeal, uid
  ]);

  if (!content) return null;

  if (mode === "group") {
    const centerX = cx ?? parentSize/2, centerY = cy ?? parentSize/2;
    const tx = centerX - size/2, ty = centerY - size/2;
    return (
      <g id={`${uid}-group`} transform={`translate(${tx},${ty})`}
         style={{ cursor: "pointer" }}
         aria-label="Scannable QR code (Atlantean, chakra-tinted, sealed)"
         data-qr-url={finalUrl || ""}>
        {content}
      </g>
    );
  }

  return (
    <svg id={`${uid}-svg`} xmlns="http://www.w3.org/2000/svg"
         width={size} height={size} viewBox={`0 0 ${size} ${size}`}
         shapeRendering="crispEdges" style={{ background: "none", cursor: "pointer" }}
         aria-label="Scannable QR code (Atlantean, chakra-tinted, sealed)"
         data-qr-url={finalUrl || ""}
         onClick={() => finalUrl && window.open(finalUrl, "_blank")}>
      {content}
    </svg>
  );
}
