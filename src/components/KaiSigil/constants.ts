import type { ChakraDayKey, WeekdayName } from "./types";

export const PHI = (1 + Math.sqrt(5)) / 2;
export const TEAL = "#00FFD0";
export const FONT_STACK =
  "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
export const SPACE = 1000;
export const CENTER = SPACE / 2;

export const CHAKRAS = {
  Root: { sides: 4, hue: 0 },
  Sacral: { sides: 6, hue: 30 },
  "Solar Plexus": { sides: 5, hue: 53 },
  Heart: { sides: 8, hue: 122 },
  Throat: { sides: 12, hue: 180 },
  "Third Eye": { sides: 14, hue: 222 },
  Crown: { sides: 16, hue: 258 },
} as const;

export const CHAKRA_GATES: Record<ChakraDayKey, string> = {
  Root: "Earth Gate",
  Sacral: "Water Gate",
  "Solar Plexus": "Fire Gate",
  Heart: "Air Gate",
  Throat: "Will Gate",
  "Third Eye": "Light Gate",
  Crown: "Ether Gate",
};

export const CHAKRA_BASE_FREQ: Record<ChakraDayKey, number> = {
  Root: 194.18,
  Sacral: 210.42,
  "Solar Plexus": 378.4,
  Heart: 620.9,
  Throat: 1292.3,
  "Third Eye": 1664.7,
  Crown: 2594.2,
};

export const WEEKDAY_TO_CHAKRA: Record<WeekdayName, ChakraDayKey> = {
  Solhara: "Root",
  Aquaris: "Solar Plexus",
  Flamora: "Heart",
  Verdari: "Throat",
  Sonari: "Third Eye",
  Kaelith: "Crown",
};

export const isWeekday = (v: string): v is WeekdayName =>
  v === "Solhara" ||
  v === "Aquaris" ||
  v === "Flamora" ||
  v === "Verdari" ||
  v === "Sonari" ||
  v === "Kaelith";

export const normalizeChakraDayKey = (v: ChakraDayKey | WeekdayName): ChakraDayKey =>
  isWeekday(v as string) ? WEEKDAY_TO_CHAKRA[v as WeekdayName] : (v as ChakraDayKey);

/* small color/hsl helper */
export const hsl = (h: number, s = 100, l = 50) => `hsl(${h} ${s}% ${l}%)`;

/* simple geometry helpers */
export const polygonPath = (sides: number, rot = 0, rr = 0.38) => {
  const r = SPACE * rr;
  const cmds: string[] = [];
  for (let i = 0; i < sides; i += 1) {
    const t = (i / sides) * 2 * Math.PI + rot;
    const x = CENTER + r * Math.cos(t);
    const y = CENTER + r * Math.sin(t);
    cmds.push(`${i ? "L" : "M"}${x},${y}`);
  }
  return `${cmds.join("")}Z`;
};

export const lissajousPath = (a: number, b: number, δ: number) => {
  const pts: string[] = [];
  for (let i = 0; i < 360; i += 1) {
    const t = (i / 359) * 2 * Math.PI;
    const x = ((Math.sin(a * t + δ) + 1) / 2) * SPACE;
    const y = ((Math.sin(b * t) + 1) / 2) * SPACE;
    pts.push(`${i ? "L" : "M"}${x},${y}`);
  }
  return `${pts.join("")}Z`;
};
