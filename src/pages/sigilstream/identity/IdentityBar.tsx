// /src/pages/sigilstream/identity/IdentityBar.tsx
"use client";

import type React from "react";
import "./IdentityBar.css";

type SigilColors = {
  /** Primary hue from the sigil (hex like "#aabbcc" or "aabbcc") */
  primary: string;
  /** Optional companions (will be derived if omitted) */
  secondary?: string;
  accent?: string;
};

type ChakraName =
  | "root"        // 1 — red
  | "sacral"      // 2 — orange
  | "solar"       // 3 — yellow
  | "heart"       // 4 — green
  | "throat"      // 5 — blue/cyan
  | "thirdEye"    // 6 — indigo
  | "crown"       // 7 — violet
  | "krown";      // alias for crown

type Props = {
  /** Session-derived ΦKey (string rendered as-is) */
  phiKey?: string;
  /** Session-derived Kai Signature / ΣSig (string rendered as-is) */
  kaiSignature?: string;
  /** Live colors from the current sigil (optional; chakra overrides if provided) */
  sigilColors?: SigilColors;
  /** Chakra of the sigil: name or 1..7 (root=1 … crown=7). */
  chakra?: ChakraName | number;
};

/** Allow custom CSS variables without `any`. */
type CSSVarStyle = React.CSSProperties & Record<`--${string}`, string>;

/* -------------------- color helpers -------------------- */
function hexToRgbTuple(hex: string): [number, number, number] | null {
  let h = hex.trim();
  if (h.startsWith("#")) h = h.slice(1);
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const clamp = (v: number, a = 0, b = 255) => Math.max(a, Math.min(b, v));
function mixRGB(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [
    clamp(a[0] + (b[0] - a[0]) * t),
    clamp(a[1] + (b[1] - a[1]) * t),
    clamp(a[2] + (b[2] - a[2]) * t),
  ];
}
const toRGBVar = (t: [number, number, number]) => `${t[0]}, ${t[1]}, ${t[2]}`;

/* -------------------- chakra mapping -------------------- */
/** Tailored, vivid chakra anchors (root → crown/krown). */
const CHAKRA_HEX: Record<Exclude<ChakraName, "krown">, string> = {
  root: "#FF3B3B",     // radiant red
  sacral: "#FF8A33",   // deep orange
  solar: "#FFD60A",    // golden yellow
  heart: "#22C55E",    // emerald green
  throat: "#0EA5E9",   // azure/cyan
  thirdEye: "#6366F1", // indigo
  crown: "#C084FC",    // violet
};
const KROWN_ALIAS: ChakraName = "crown";

/** Resolve chakra → primary RGB tuple */
function chakraPrimary(ch?: ChakraName | number): [number, number, number] | null {
  if (ch == null) return null;
  let key: ChakraName;
  if (typeof ch === "number") {
    const names: ChakraName[] = ["root", "sacral", "solar", "heart", "throat", "thirdEye", "crown"];
    key = names[Math.min(7, Math.max(1, ch)) - 1]!;
  } else {
    key = ch === "krown" ? (KROWN_ALIAS as ChakraName) : ch;
  }
  const hx = CHAKRA_HEX[(key as Exclude<ChakraName, "krown">)] ?? CHAKRA_HEX.crown;
  return hexToRgbTuple(hx);
}

type Triad = { s1: string; s2: string; s3: string };

/** Derive a triad from chakra: secondary = lighter; accent = warm gold blend. */
function paletteFromChakra(ch?: ChakraName | number): Triad | null {
  const p = chakraPrimary(ch);
  if (!p) return null;
  const white: [number, number, number] = [255, 255, 255];
  const gold: [number, number, number] = [255, 215, 128];
  const secondary = mixRGB(p, white, 0.28); // gentle lift
  const accent = mixRGB(p, gold, 0.42);     // Atlantean warmth
  return { s1: toRGBVar(p), s2: toRGBVar(secondary), s3: toRGBVar(accent) };
}

/** Fallback triad (cyan → violet → gold) used when nothing else is provided. */
const DEFAULT_TRIAD: Triad = { s1: "154, 230, 255", s2: "196, 181, 253", s3: "255, 215, 128" };

/** If both are provided, chakra takes precedence. Otherwise sigilColors, then default. */
function resolvePalette(chakra: Props["chakra"], sigilColors?: SigilColors): Triad {
  const fromChakra = paletteFromChakra(chakra);
  if (fromChakra) return fromChakra;

  if (sigilColors?.primary) {
    const primary = hexToRgbTuple(sigilColors.primary) ?? hexToRgbTuple("#9AE6FF")!;
    const secondary = sigilColors.secondary
      ? (hexToRgbTuple(sigilColors.secondary) ?? primary)
      : mixRGB(primary, [255, 255, 255], 0.28);
    const gold: [number, number, number] = [255, 215, 128];
    const accent = sigilColors.accent
      ? (hexToRgbTuple(sigilColors.accent) ?? gold)
      : mixRGB(primary, gold, 0.45);
    return { s1: toRGBVar(primary), s2: toRGBVar(secondary), s3: toRGBVar(accent) };
  }

  return DEFAULT_TRIAD;
}

/* -------------------- component -------------------- */
export function IdentityBar({
  phiKey,
  kaiSignature,
  sigilColors,
  chakra,
}: Props): React.JSX.Element {
  const palette = resolvePalette(chakra, sigilColors);

  const cssVars: CSSVarStyle = {
    "--sigil-1": palette.s1, // primary (chakra)
    "--sigil-2": palette.s2, // secondary (lift)
    "--sigil-3": palette.s3, // accent (golden warmth)
  };

  const empty = !phiKey && !kaiSignature;

  return (
    <div className="sf-identity" style={cssVars} {...(empty ? { "data-empty": "" } : {})}>
      <div
        className="sf-reply-id"
        style={{ rowGap: ".4rem", columnGap: ".4rem", display: "flex", flexWrap: "wrap" }}
        aria-label={empty ? "No identity loaded" : "Identity chips"}
      >
        {empty && <span className="sf-muted">No ΦKey loaded this session.</span>}

        {phiKey && (
          <span className="sf-pill sf-pill--phikey" title="Your ΦKey (session)">
            <strong className="sf-pill__label">ΦKey</strong>&nbsp;
            <span className="sf-key">{phiKey}</span>
          </span>
        )}

        {kaiSignature && (
          <span className="sf-pill sf-pill--ksig" title="Kai Signature (session)">
            <strong className="sf-pill__label">ΣSig</strong>&nbsp;
            <span className="sf-key">{kaiSignature}</span>
          </span>
        )}
      </div>
    </div>
  );
}

export default IdentityBar;
