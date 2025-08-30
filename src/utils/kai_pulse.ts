// src/utils/kai_pulse.ts
// Single source of truth for Kai-Klok timing & parsing (no React hooks).
// φ-exact engine: integers + fixed-point only. No float accumulation anywhere.
//
// Canon recap (normative):
//   • Breath (pulse) T = 3 + √5 seconds (φ-exact)
//   • Lattice: 11 pulses/step • 44 steps/beat • 36 beats/day
//   • Closure: N_day = 17,491.270421 pulses/day (exact, millionths)
//
// Engine rules:
//   • Track state in integer pulses, or integer μpulses (10^6 per pulse).
//   • Chronos ↔ pulses bridges use fixed-point with ties-to-even rounding.
//   • Past / future / present use the same bridge logic → v13-identical behavior.

// ─────────────────────────────────────────────────────────────
// CONSTANTS (exact / integer-safe)
// ─────────────────────────────────────────────────────────────

// Genesis epoch (Sun-origin anchor) in Unix ms (UTC).
export const GENESIS_TS = 1715323541888 as const; // 2024-05-10T06:45:41.888Z

// UTC+0 sunrise at Greenwich (0° lon) on the first morning after the flare.
// (Anchor computed via NOAA solar alg for Greenwich Observatory lat.)
// This is only a baseline reference; daily solar boundaries are computed dynamically.
export const SOLAR_GENESIS_UTC_TS = 1715400806000 as const; // 2024-05-11T04:13:26.000Z

// Semantic lattice (indexing only).
export const PULSES_STEP = 11 as const;              // pulses per step
export const STEPS_BEAT  = 44 as const;              // steps per beat
export const BEATS_DAY   = 36 as const;              // beats per day
export const PULSES_BEAT = PULSES_STEP * STEPS_BEAT; // 484

// Closure in millionths (exact fixed-point; never float).
export const N_DAY_MICRO            = 17_491_270_421n as const; // μpulses/day
export const PULSES_PER_STEP_MICRO  = 11_000_000n   as const;   // 11 * 1e6
export const PULSES_PER_BEAT_MICRO  = 484_000_000n  as const;   // 484 * 1e6
export const BASE_DAY_MICRO         = 17_424_000_000n as const; // 17,424 * 1e6

// φ-exact pulse duration (display-only ms) from T = 3 + √5 seconds.
export const PULSE_MS: number = Math.round((3 + Math.sqrt(5)) * 1000);

// There is intentionally **no** DAY_MS. Seconds/day is irrational; the engine stays in integers.

// φ-exact bridges as rationals with 60 decimal digits of precision.
// We compute with: round_half_even(x * NUM / DEN).

// T_ms = (3 + √5) * 1000  (milliseconds per pulse).
// 5236.067977499789696409173668731276235440618359611525724270897245
const T_MS_NUM = BigInt("5236067977499789696409173668731276235440618359611525724270897245");
const T_MS_DEN = 10n ** 60n;

// INV_Tx1000 = 1000 / (3 + √5)  (pulses per millisecond, scaled by 1000).
// 190.983005625052575897706582817180941139845410097118568932275689
const INV_Tx1000_NUM = BigInt("190983005625052575897706582817180941139845410097118568932275689");
const INV_Tx1000_DEN = 10n ** 60n;

// Public API (optional server path when available).
export const API_URL = "https://klock.kaiturah.com/kai" as const;

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
export type ChakraDay =
  | "Root"
  | "Sacral"
  | "Solar Plexus"
  | "Heart"
  | "Throat"
  | "Third Eye"
  | "Crown";

export type Weekday =
  | "Solhara"
  | "Aquaris"
  | "Flamora"
  | "Verdari"
  | "Sonari"
  | "Kaelith";

export type KaiMoment = {
  pulse: number;                // integer pulse index (Euclidean floor)
  beat: number;                 // 0..35
  stepIndex: number;            // 0..43
  stepPctAcrossBeat: number;    // [0,1)
  chakraDay: ChakraDay;
  weekday: Weekday;
};

// ─────────────────────────────────────────────────────────────
// MAPPINGS
// ─────────────────────────────────────────────────────────────
export const WEEKDAYS: readonly Weekday[] = [
  "Solhara",
  "Aquaris",
  "Flamora",
  "Verdari",
  "Sonari",
  "Kaelith",
];

export const DAY_TO_CHAKRA: Record<Weekday, ChakraDay> = {
  Solhara: "Root",
  Aquaris: "Sacral",
  Flamora: "Solar Plexus",
  Verdari: "Heart",
  Sonari: "Throat",
  Kaelith: "Crown",
};

// ─────────────────────────────────────────────────────────────
// INTERNAL UTILS (pure; integer-safe)
// ─────────────────────────────────────────────────────────────
/** Clamp to [0,1) with open top (never exactly 1.0). */
export const normalizePercentIntoStep = (x: number) => {
  const v = x < 0 ? 0 : x > 1 ? 1 : x;
  return v >= 1 ? 1 - 1e-12 : v;
};
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

// BigInt helpers
const b = (n: number | bigint) => BigInt(n);
const abs = (x: bigint) => (x < 0n ? -x : x);
const modE = (a: bigint, m: bigint) => {
  const r = a % m;
  return r >= 0n ? r : r + m;
};
const floorDivE = (a: bigint, d: bigint) => {
  // Euclidean floor division
  const q = a / d;
  const r = a % d;
  return (r === 0n || a >= 0n) ? q : q - 1n;
};
const toSafeNumber = (x: bigint): number => {
  const MAX = BigInt(Number.MAX_SAFE_INTEGER);
  const MIN = BigInt(Number.MIN_SAFE_INTEGER);
  if (x > MAX) return Number.MAX_SAFE_INTEGER;
  if (x < MIN) return Number.MIN_SAFE_INTEGER;
  return Number(x);
};

/** Bankers rounding on BigInt ratio: round(x * num / den) ties-to-even. */
const mulDivRoundHalfEven = (x: bigint, num: bigint, den: bigint): bigint => {
  if (den <= 0n) throw new Error("Denominator must be positive.");
  const sgn = (x < 0n ? -1n : 1n) * (num < 0n ? -1n : 1n);
  const A = abs(x) * abs(num);
  const q = A / den;
  const r = A % den;
  const twice = r * 2n;

  let n = q;
  if (twice > den) n = q + 1n;
  else if (twice === den && (q & 1n) === 1n) n = q + 1n; // tie → nearest even

  return sgn * n;
};

const chakraForWeekdayIndex = (idx: number): { weekday: Weekday; chakraDay: ChakraDay } => {
  const w = WEEKDAYS[(idx % WEEKDAYS.length + WEEKDAYS.length) % WEEKDAYS.length];
  return { weekday: w, chakraDay: DAY_TO_CHAKRA[w] };
};

// ─────────────────────────────────────────────────────────────
// BIGINT ISO-8601 PARSER (signed/zero years; proleptic Gregorian)
//   - No reliance on JS Date for strings
//   - Unlimited range (BigInt ms since Unix epoch)
// ─────────────────────────────────────────────────────────────
const MS_PER_DAY_BI  = 91_584_000n;
const MS_PER_HOUR_BI = 3_600_000n;
const MS_PER_MIN_BI  = 60_000n;
const MS_PER_SEC_BI  = 1_000n;

/** Signed ISO with optional seconds/fraction and Z/+hh:mm/-hh:mm */
const SIGNED_ISO =
  /^([+-]?\d{4,})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})$/;

const div = floorDivE;

// Days since 1970-01-01 for proleptic Gregorian date (Howard Hinnant algo, BigInt).
function daysFromCivilBI(year: bigint, month: bigint, day: bigint): bigint {
  const y = month <= 2n ? year - 1n : year;
  const m = month <= 2n ? month + 12n : month;

  const era = div(y >= 0n ? y : y - 399n, 400n);
  const yoe = y - era * 400n;                                       // [0, 399]
  const doy = div(153n * (m - 3n) + 2n, 5n) + day - 1n;             // [0, 365]
  const doe = yoe * 365n + div(yoe, 4n) - div(yoe, 100n) + doy;     // [0, 146096]
  return era * 146097n + doe - 719468n;                             // 719468: 0000-03-01 → 1970-01-01
}

function parseSignedIsoToEpochMs(iso: string): bigint {
  const m = SIGNED_ISO.exec(iso);
  if (!m) {
    const d = new Date(iso);
    const t = d.getTime();
    if (Number.isFinite(t)) return BigInt(t);
    throw new Error("Invalid ISO datetime.");
  }

  const [, yStr, MM, DD, hh, mm, ss = "00", frac = "0", tz] = m;
  const year = BigInt(yStr);
  const month = BigInt(MM);
  const day = BigInt(DD);
  const hour = BigInt(hh);
  const minute = BigInt(mm);
  const second = BigInt(ss);

  // Fractional seconds → ms (rounded to nearest ms)
  let ms = 0n;
  if (frac && frac !== "0") {
    const fracPadded = (frac + "000000000").slice(0, 9); // ns scale
    const nanos = BigInt(fracPadded);
    ms = (nanos + 500_000n) / 1_000_000n;
  }

  const todMs =
    hour * MS_PER_HOUR_BI +
    minute * MS_PER_MIN_BI +
    second * MS_PER_SEC_BI +
    ms;

  let offsetMin = 0n;
  if (tz !== "Z") {
    const sign = tz[0] === "-" ? -1n : 1n;
    const [tzh, tzm] = tz.slice(1).split(":");
    offsetMin = sign * (BigInt(tzh) * 60n + BigInt(tzm));
  }

  const days = daysFromCivilBI(year, month, day);
  const epochMsLocal = days * MS_PER_DAY_BI + todMs;
  const epochMsUTC = epochMsLocal - offsetMin * MS_PER_MIN_BI;
  return epochMsUTC;
}

// ─────────────────────────────────────────────────────────────
/** Convert Unix ms (UTC) → integer μpulses since Genesis using φ-exact bridge.
 * μpulses = round_half_even( Δms * (1/T) * 1000 )  with T = 3 + √5.
 */
export function microPulsesSinceGenesis(utc: string | Date | bigint): bigint {
  let msEpoch: bigint;
  if (typeof utc === "bigint") {
    msEpoch = utc;
  } else if (typeof utc === "string") {
    msEpoch = parseSignedIsoToEpochMs(utc);
  } else {
    const t = utc.getTime();
    if (!Number.isFinite(t)) throw new Error(`Invalid Date: ${String(utc)}`);
    msEpoch = BigInt(t);
  }
  const deltaMs = msEpoch - BigInt(GENESIS_TS);
  return mulDivRoundHalfEven(deltaMs, INV_Tx1000_NUM, INV_Tx1000_DEN);
}

/** Convert an integer pulse index → Unix ms offset using φ-exact bridge. */
export function epochMsFromPulse(pulse: number | bigint): bigint {
  const p = BigInt(Math.trunc(typeof pulse === "bigint" ? Number(pulse) : pulse));
  const deltaMs = mulDivRoundHalfEven(p, T_MS_NUM, T_MS_DEN);
  return BigInt(GENESIS_TS) + deltaMs;
}

/** Indexing on the semantic lattice from μpulses (integers only). */
export function latticeFromMicroPulses(pμ: bigint): {
  beat: number;
  stepIndex: number;
  percentIntoStep: number; // [0,1)
} {
  const pulsesInDay  = modE(pμ, N_DAY_MICRO);
  const pulsesInGrid = pulsesInDay % BASE_DAY_MICRO;

  const beatBI       = pulsesInGrid / PULSES_PER_BEAT_MICRO;                // 0..35
  const pulsesInBeat = pulsesInGrid - beatBI * PULSES_PER_BEAT_MICRO;

  const stepBI       = pulsesInBeat / PULSES_PER_STEP_MICRO;                // 0..43
  const pulsesInStep = pulsesInBeat - stepBI * PULSES_PER_STEP_MICRO;

  const percentIntoStep = Number(pulsesInStep) / Number(PULSES_PER_STEP_MICRO);
  return { beat: Number(beatBI), stepIndex: Number(stepBI), percentIntoStep };
}

/** Full KaiMoment from any UTC input (string/Date/bigint). */
export function momentFromUTC(utc: string | Date | bigint): KaiMoment {
  const pμ = microPulsesSinceGenesis(utc);

  // Integer pulse index (Euclidean floor toward −∞)
  const pulse = toSafeNumber(floorDivE(pμ, 1_000_000n));

  // Lattice breakdown
  const { beat, stepIndex, percentIntoStep } = latticeFromMicroPulses(pμ);
  const stepPctAcrossBeat = normalizePercentIntoStep(
    (stepIndex + percentIntoStep) / STEPS_BEAT
  );

  // Weekday/chakra from absolute day index (ETERNAL path)
  const dayIndexBI = floorDivE(pμ, N_DAY_MICRO);
  const weekdayIdx = toSafeNumber(modE(dayIndexBI, b(WEEKDAYS.length)));
  const { weekday, chakraDay } = chakraForWeekdayIndex(weekdayIdx);

  return { pulse, beat, stepIndex, stepPctAcrossBeat, chakraDay, weekday };
}

/** Convert a pulse index (±) → KaiMoment using exact bridges. */
export function momentFromPulse(pulse: number | bigint): KaiMoment {
  const msEpoch = epochMsFromPulse(pulse);
  return momentFromUTC(msEpoch);
}

/**
 * Snap a base minute (any timezone or Z) to the exact Kai "breath within minute" slot.
 * Uses φ-exact pulse to move ahead by (breathIdx-1) pulses from the minute boundary.
 * Returns Zulu ISO string.
 */
export function utcFromBreathSlot(baseMinuteISO: string, breathIdx: number): string {
  const base = new Date(baseMinuteISO);
  if (Number.isNaN(base.getTime())) return "";
  const t = base.getTime();
  const minuteTrunc = t - (t % 60_000);

  const n = Math.max(1, Math.floor(breathIdx)) - 1;
  const delta = mulDivRoundHalfEven(BigInt(n), T_MS_NUM, T_MS_DEN);
  const out = BigInt(minuteTrunc) + delta;
  return new Date(Number(out)).toISOString();
}

// ─────────────────────────────────────────────────────────────
// SERVER PARSE (online path → KaiMoment) — integer-safe
// ─────────────────────────────────────────────────────────────
export function parseKaiFromServer(json: {
  kaiPulseEternal: number;                 // integer pulse index
  chakraStepString: string;                // "B:SS"
  chakraStep?: { percentIntoStep?: number }; // 0..100 or 0..1
  harmonicDay: Weekday;
  eternalChakraArc?: string;
}): KaiMoment {
  const pulseNum = Number(json.kaiPulseEternal) || 0;

  const raw = (json.chakraStepString ?? "").trim();
  const [bStr, sStr] = raw.split(":");
  const beat = Math.max(0, Math.min(BEATS_DAY - 1, Math.floor(Number(bStr)) || 0));
  const stepIndex = Math.max(0, Math.min(STEPS_BEAT - 1, Math.floor(Number(sStr)) || 0));

  let percentIntoStep = 0;
  if (typeof json.chakraStep?.percentIntoStep === "number") {
    const v = json.chakraStep.percentIntoStep;
    percentIntoStep = v > 1.0000001 ? v / 100 : v;
    percentIntoStep = clamp01(percentIntoStep);
  }

  const stepPctAcrossBeat = normalizePercentIntoStep(
    (stepIndex + percentIntoStep) / STEPS_BEAT
  );

  const toChakra = (s?: string): ChakraDay | null => {
    if (!s) return null;
    const norm = s.trim().toLowerCase();
    const table: Record<string, ChakraDay> = {
      "root": "Root",
      "sacral": "Sacral",
      "solar plexus": "Solar Plexus",
      "heart": "Heart",
      "throat": "Throat",
      "third eye": "Third Eye",
      "thirdeye": "Third Eye",
      "crown": "Crown",
    };
    return table[norm] ?? null;
  };

  const weekday = json.harmonicDay;
  const chakraDay = toChakra(json.eternalChakraArc) ?? DAY_TO_CHAKRA[weekday];

  // Derive weekday from pulse using integer day math (parity guard).
  const pμ = BigInt(Math.trunc(pulseNum)) * 1_000_000n;
  const dayIndexBI = floorDivE(pμ, N_DAY_MICRO);
  const weekdayIdx = toSafeNumber(modE(dayIndexBI, b(WEEKDAYS.length)));
  const derivedWeekday = WEEKDAYS[weekdayIdx];

  return {
    pulse: Math.trunc(pulseNum),
    beat,
    stepIndex,
    stepPctAcrossBeat,
    chakraDay,
    weekday: (weekday ?? derivedWeekday) as Weekday,
  };
}

// ─────────────────────────────────────────────────────────────
// FETCH HELPERS — server first, φ-exact local fallback
// ─────────────────────────────────────────────────────────────
export async function fetchKai(iso?: string): Promise<KaiMoment> {
  const url = iso ? `${API_URL}?override_time=${encodeURIComponent(iso)}` : API_URL;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Kai API error: ${res.status}`);
  const json = await res.json();
  return parseKaiFromServer(json);
}

/** Try server; if it fails, compute locally with φ-exact bridges. */
export async function fetchKaiOrLocal(iso?: string, now: Date = new Date()): Promise<KaiMoment> {
  try {
    return await fetchKai(iso);
  } catch {
    if (typeof iso === "string" && iso) return momentFromUTC(iso);
    return momentFromUTC(now);
  }
}

// ─────────────────────────────────────────────────────────────
// DERIVED HELPERS (UI glue / legacy compat)
// ─────────────────────────────────────────────────────────────
export function stepIndexFromPct(stepPctAcrossBeat: number): number {
  const s = Math.floor(clamp01(stepPctAcrossBeat) * STEPS_BEAT);
  return Math.max(0, Math.min(STEPS_BEAT - 1, s));
}

export function formatBeatStep(beat: number, stepIndex: number): string {
  const bNum = Math.max(0, Math.min(BEATS_DAY - 1, Math.floor(beat)));
  const sNum = Math.max(0, Math.min(STEPS_BEAT - 1, Math.floor(stepIndex)));
  return `${bNum}:${String(sNum).padStart(2, "0")}`;
}

/** Legacy helper kept for compatibility with older UI math. */
export function buildBreathIso(minuteLocalISO: string, breathIdx: number): string {
  return utcFromBreathSlot(minuteLocalISO, breathIdx);
}

/** Back-compat export for sigil page (`computeKaiLocally`) */
export function computeKaiLocally(date: Date): KaiMoment {
  return momentFromUTC(date);
}

// ─────────────────────────────────────────────────────────────
/** Greenwich sunrise (UTC) for a given UTC calendar date using NOAA equation.
 * Returns Unix ms at sunrise for date (Y-M-D) at lat 51.4769°N, lon 0°E.
 * Uses doubles internally but returns BigInt ms; memoized per date.
 */
const GREENWICH_LAT = 51.4769; // Royal Observatory Greenwich
const GREENWICH_LON = 0.0;
const DEG2RAD = Math.PI / 180;
const RAD2DAY = 1 / (2 * Math.PI); // rad → fraction of day
const JULIAN_UNIX_EPOCH = 2440587.5;

const sunriseCache = new Map<string, bigint>();

function toJulianDay(msUTC: number): number {
  return msUTC / 86400000 + JULIAN_UNIX_EPOCH;
}
function fromJulianDay(J: number): number {
  return (J - JULIAN_UNIX_EPOCH) * 86400000;
}
function normalizeAngleDeg(a: number): number {
  const x = a % 360;
  return x < 0 ? x + 360 : x;
}
function clamp(x: number, min: number, max: number) {
  return x < min ? min : x > max ? max : x;
}
function getUTCYMD(msUTC: bigint): { y: number; m: number; d: number } {
  const d = new Date(Number(msUTC));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

function julianNoonApprox(J: number, lonDeg: number): number {
  // J* ≈ 2451545.0009 - Lw/360 + n ; where Lw = -lon
  const Lw = -lonDeg * DEG2RAD;
  const n = Math.round(J - 2451545.0009 - Lw * RAD2DAY);
  return 2451545.0009 + Lw * RAD2DAY + n;
}

/** NOAA sunrise equation (with standard refraction h0 = -0.833°). */
function sunriseJulianForDate(y: number, m: number, d: number, latDeg = GREENWICH_LAT, lonDeg = GREENWICH_LON): number {
  // Julian day at 00:00 UTC for Y-M-D
  const J0 = toJulianDay(Date.UTC(y, m - 1, d));
  const Jnoon = julianNoonApprox(J0, lonDeg);

  const Mdeg = 357.5291 + 0.98560028 * (Jnoon - 2451545);
  const Mrad = Mdeg * DEG2RAD;

  const C = 1.9148 * Math.sin(Mrad) + 0.0200 * Math.sin(2 * Mrad) + 0.0003 * Math.sin(3 * Mrad);
  const lambda = normalizeAngleDeg(Mdeg + C + 180 + 102.9372) * DEG2RAD;

  const Jtransit = Jnoon + 0.0053 * Math.sin(Mrad) - 0.0069 * Math.sin(2 * lambda);

  const epsilon = 23.4397 * DEG2RAD; // obliquity
  const delta = Math.asin(Math.sin(lambda) * Math.sin(epsilon)); // solar declination

  const phi = latDeg * DEG2RAD;
  const h0 = -0.833 * DEG2RAD; // sunrise altitude (deg) incl. refraction
  const cos_omega0 = (Math.sin(h0) - Math.sin(phi) * Math.sin(delta)) / (Math.cos(phi) * Math.cos(delta));
  const omega0 = Math.acos(clamp(cos_omega0, -1, 1)); // hour angle at sunrise

  const Jrise = Jtransit - omega0 * RAD2DAY; // sunrise
  return Jrise;
}

/** Unix ms (BigInt) at Greenwich sunrise for the date carrying msUTC's UTC calendar.
 * Memoized by "YYYY-MM-DD".
 */
function sunriseUtcMsForEpochMs(msUTC: bigint): bigint {
  const { y, m, d } = getUTCYMD(msUTC);
  const key = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const cached = sunriseCache.get(key);
  if (cached !== undefined) return cached;

  const Jrise = sunriseJulianForDate(y, m, d);
  const ms = BigInt(Math.round(fromJulianDay(Jrise))); // nearest ms
  sunriseCache.set(key, ms);
  return ms;
}

// ─────────────────────────────────────────────────────────────
// HARMONIC LABELS & MAPPINGS (names only; math stays φ-exact)
// ─────────────────────────────────────────────────────────────

const ARC_NAMES = [
  "Ignition Ark",
  "Integration Ark",
  "Harmonization Ark",
  "Reflection Ark",
  "Purification Ark",
  "Dream Ark",
] as const;

const ARC_SEAL_NAMES: Record<(typeof ARC_NAMES)[number], string> = {
  "Ignition Ark": "Ignite Ark",
  "Integration Ark": "Integration Ark",
  "Harmonization Ark": "Harmonization Ark",
  "Reflection Ark": "Reflection Ark",
  "Purification Ark": "Purify Ark",
  "Dream Ark": "Dream Ark",
};

const ARC_DESC: Record<(typeof ARC_NAMES)[number], string> = {
  "Ignition Ark": "Resurrection, will, awakening",
  "Integration Ark": "Emotional grounding, emergence",
  "Harmonization Ark": "Radiance, balance, coherent action",
  "Reflection Ark": "Union, compassion, spoken resonance",
  "Purification Ark": "Truth, remembrance, etheric light",
  "Dream Ark": "Divine memory, lucid integration, dreaming awake",
};

const MONTHS = [
  { name: "Aethon",  desc: "Resurrection fire: Root awakening" },
  { name: "Virelai", desc: "Waters of becoming: Emotional emergence" },
  { name: "Solari",  desc: "Solar ignition: Radiant embodiment" },
  { name: "Amarin",  desc: "Heart bloom: Sacred balance" },
  { name: "Kaelus",  desc: "Voice of stars: Resonant expression" },
  { name: "Umbriel", desc: "Divine remembrance: Crown alignment" },
  { name: "Noctura", desc: "Light spiral: Celestial flow" },
  { name: "Liora",   desc: "Eternal mirror: Infinite now" },
] as const;

const WEEK_SPIRALS = [
  { name: "Awakening Flame",  desc: "Root fire of ignition, will, resurrection" },
  { name: "Flowing Heart",    desc: "Emotional waters, intimacy, surrender" },
  { name: "Radiant Will",     desc: "Solar clarity, aligned confidence, embodiment" },
  { name: "Harmonic Voice",   desc: "Spoken truth, vibration, coherence in sound" },
  { name: "Inner Mirror",     desc: "Reflection, purification, self-seeing" },
  { name: "Dreamfire Memory", desc: "Lucid vision, divine memory, encoded light" },
  { name: "Krowned Light",    desc: "Integration, sovereignty, harmonic ascension" },
] as const;

// ─────────────────────────────────────────────────────────────
// INTERNAL HELPERS (formatting only — math stays in μpulses)
// ─────────────────────────────────────────────────────────────

const STEPS_PER_BEAT = STEPS_BEAT; // 44
const BEATS_PER_DAY = BEATS_DAY;   // 36
const DAYS_PER_WEEK = 6;
const WEEKS_PER_MONTH = 7;
const DAYS_PER_MONTH = DAYS_PER_WEEK * WEEKS_PER_MONTH; // 42
const MONTHS_PER_YEAR = 8;
const DAYS_PER_YEAR = DAYS_PER_MONTH * MONTHS_PER_YEAR; // 336

function arcFromBeat(beat: number) {
  const idx = Math.max(0, Math.min(5, Math.floor(beat / 6)));
  const name = ARC_NAMES[idx];
  return { idx, name, desc: ARC_DESC[name] };
}

function percent(numer: bigint, denom: bigint): number {
  if (denom === 0n) return 0;
  const v = Number(numer) / Number(denom);
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function pct(n: number, digits = 2) {
  return (n * 100).toFixed(digits);
}

function leftPad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function safeInt(bi: bigint) {
  return Number(
    bi > 9007199254740991n
      ? 9007199254740991n
      : bi < -9007199254740991n
      ? -9007199254740991n
      : bi
  );
}

function phiSpiralLevelFromPulse(pulse: number): number {
  const PHI = (1 + Math.sqrt(5)) / 2;
  const p = Math.max(1, pulse);
  return Math.floor(Math.log(p) / Math.log(PHI));
}

// Gregorian UTC day indexing helper (BigInt days since epoch)
function utcMidnightDaysSinceEpoch(msUTC: bigint): bigint {
  return floorDivE(msUTC, MS_PER_DAY_BI);
}

// Inverse of daysFromCivil (to get Y-M-D from a days count), using Hinnant's algo.
function civilFromDaysBI(z: bigint): { year: bigint; month: bigint; day: bigint } {
  z += 719468n;
  const era = div(z, 146097n);
  const doe = z - era * 146097n;                           // [0, 146096]
  const yoe = div(doe - div(doe, 1460n) + div(doe, 36524n) - div(doe, 146096n), 365n); // [0, 399]
  const y = yoe + era * 400n;
  const doy = doe - (365n * yoe + div(yoe, 4n) - div(yoe, 100n));         // [0, 365]
  const mp = div(5n * doy + 2n, 153n);                                    // [0, 11]
  const d = doy - div(153n * mp + 2n, 5n) + 1n;                           // [1, 31]
  const m = mp < 10n ? mp + 3n : mp - 9n;                                 // [1, 12]
  const year = m <= 2n ? y + 1n : y;
  const month = m <= 2n ? m + 12n - 12n : m;                              // normalize
  return { year, month, day: d };
}

// ─────────────────────────────────────────────────────────────
// SOLAR (UTC-ALIGNED) INDICES — sunrise-driven boundaries
// ─────────────────────────────────────────────────────────────

// Solar genesis UTC date (for day counting)
const SOLAR_GENESIS_Y = 2024n;
const SOLAR_GENESIS_M = 5n;
const SOLAR_GENESIS_D = 11n;
const SOLAR_GENESIS_DAYIDX = daysFromCivilBI(SOLAR_GENESIS_Y, SOLAR_GENESIS_M, SOLAR_GENESIS_D);

/** Determine the “solar day” civil date for an instant:
 * If msUTC is before today's Greenwich sunrise, use previous day's date; else today's.
 */
function solarCivilDateForInstant(msUTC: bigint): { y: bigint; m: bigint; d: bigint; sunriseMs: bigint } {
  // Calendar date of the instant
  const { y, m, d } = getUTCYMD(msUTC);
  const todaySunrise = sunriseUtcMsForEpochMs(msUTC);

  if (msUTC < todaySunrise) {
    // Use previous day
    const dayIdx = utcMidnightDaysSinceEpoch(msUTC) - 1n;
    const prev = civilFromDaysBI(dayIdx);
    const prevMs = BigInt(Date.UTC(Number(prev.year), Number(prev.month) - 1, Number(prev.day)));
    const prevSunrise = sunriseUtcMsForEpochMs(prevMs);
    return { y: prev.year, m: prev.month, d: prev.day, sunriseMs: prevSunrise };
  }
  return { y: BigInt(y), m: BigInt(m), d: BigInt(d), sunriseMs: todaySunrise };
}

/** Solar (UTC-aligned) indices with sunrise boundaries at Greenwich.
 * Day/week/month/year counting follows the harmonic 6/7/8 structure,
 * but rollovers happen at actual sunrise time each UTC day.
 */
function solarIndices(msUTC: bigint) {
  const base = solarCivilDateForInstant(msUTC);

  // Count solar days since solar genesis by pure civil-day difference
  // (one sunrise per civil day at Greenwich; we anchor at 2024-05-11).
  const dayIdx = daysFromCivilBI(base.y, base.m, base.d) - SOLAR_GENESIS_DAYIDX;

  const weekIdx = floorDivE(dayIdx, BigInt(DAYS_PER_WEEK));
  const monthIdx = floorDivE(dayIdx, BigInt(DAYS_PER_MONTH));

  const dayOfWeek   = toSafeNumber(modE(dayIdx, BigInt(DAYS_PER_WEEK)));    // 0..5
  const dayOfMonth  = toSafeNumber(modE(dayIdx, BigInt(DAYS_PER_MONTH))) + 1; // 1..42
  const monthIndex  = toSafeNumber(modE(monthIdx, BigInt(MONTHS_PER_YEAR))); // 0..7
  const weekInMonth = toSafeNumber(modE(weekIdx,  BigInt(WEEKS_PER_MONTH))); // 0..6

  return {
    solarDayIdx: dayIdx,
    solarWeekIdx: weekIdx,
    solarMonthIdx: monthIdx,
    dayOfWeek,
    dayOfMonth,
    monthIndex,
    weekInMonth,
    weekdayName: WEEKDAYS[dayOfWeek],
    weekName: WEEK_SPIRALS[weekInMonth].name,
    weekDesc: WEEK_SPIRALS[weekInMonth].desc,
    monthName: MONTHS[monthIndex].name,
    monthDesc: MONTHS[monthIndex].desc,
    sunriseMs: base.sunriseMs, // for optional UI display/debug
  };
}

// ─────────────────────────────────────────────────────────────
// ETERNAL INDICES (unchanged; μpulse day math)
// ─────────────────────────────────────────────────────────────
function eternalIndices(pμ: bigint) {
  const dayIdx = floorDivE(pμ, N_DAY_MICRO); // can be negative
  const inDay = modE(pμ, N_DAY_MICRO);
  const pulsesToday = floorDivE(inDay, 1_000_000n);

  const weekIdx = floorDivE(dayIdx, BigInt(DAYS_PER_WEEK));
  const monthIdx = floorDivE(dayIdx, BigInt(DAYS_PER_MONTH));
  const yearIdx = floorDivE(dayIdx, BigInt(DAYS_PER_YEAR));

  const weekdayIndex = toSafeNumber(modE(dayIdx, BigInt(DAYS_PER_WEEK))); // 0..5
  const dayOfMonth = toSafeNumber(modE(dayIdx, BigInt(DAYS_PER_MONTH))) + 1; // 1..42
  const weekInMonth = toSafeNumber(modE(weekIdx, BigInt(WEEKS_PER_MONTH)));  // 0..6
  const monthIndex = toSafeNumber(modE(monthIdx, BigInt(MONTHS_PER_YEAR)));  // 0..7

  return {
    dayIdx,
    weekdayIndex,
    weekdayName: WEEKDAYS[weekdayIndex],
    pulsesToday,
    weekInMonth,
    weekIdx,
    monthIndex,
    monthName: MONTHS[monthIndex].name,
    monthDesc: MONTHS[monthIndex].desc,
    yearIndex: toSafeNumber(yearIdx),
    dayOfMonth,
    weekName: WEEK_SPIRALS[weekInMonth].name,
    weekDesc: WEEK_SPIRALS[weekInMonth].desc,
  };
}

// ─────────────────────────────────────────────────────────────
// ETERNAL SEAL & NARRATIVE FORMATTERS (strings shown to users)
// ─────────────────────────────────────────────────────────────

function formatKairosSeal(
  beat: number,
  stepIndex: number,
  weekday: Weekday,
  arcNameCanonical: (typeof ARC_NAMES)[number],
  dayOfMonth: number,
  monthIndex: number,
  pulsesToday: number,
  phiLevel: number,
  yearIndex: number
) {
  const bStr = `${beat}`;             // 0..35
  const sStr = leftPad2(stepIndex);   // 00..43
  const beatPct = (beat + stepIndex / STEPS_PER_BEAT) / BEATS_PER_DAY;
  const beatPctStr = pct(beatPct);
  const arcSeal = ARC_SEAL_NAMES[arcNameCanonical];

  // NOTE: No "Eternal Pulse" here; it's appended after the Solar line to match the spec's exact order.
  return `Eternal Seal: Kairos:${bStr}:${sStr}, ${weekday}, ${arcSeal} • D${dayOfMonth}/M${monthIndex + 1} • Beat:${beat}/${BEATS_PER_DAY}(${beatPctStr}%) Step:${stepIndex}/${STEPS_PER_BEAT} Kai(Today):${pulsesToday} • Y${yearIndex + 1} PS${phiLevel}`;
}

function formatSolarKairos(
  beat: number,
  stepIndex: number,
  solarWeekday: Weekday,
  solarDOM: number,
  solarMonthIndex: number,
  arcNameCanonical: (typeof ARC_NAMES)[number]
) {
  const bStr = `${beat}`;
  const sStr = leftPad2(stepIndex);
  const arcSeal = ARC_SEAL_NAMES[arcNameCanonical];
  return `Solar Kairos (UTC-aligned): ${bStr}:${sStr} ${solarWeekday} D${solarDOM}/M${solarMonthIndex + 1}, ${arcSeal}  Beat:${beat}/${BEATS_PER_DAY} Step:${stepIndex}/${STEPS_PER_BEAT}`;
}

function formatKairosSealPercentStep(beat: number, stepIndex: number, percentIntoStep: number) {
  const sPct = pct(percentIntoStep);
  return `Kairos:${beat}:${leftPad2(stepIndex)} • Step ${stepIndex + 1}/${STEPS_PER_BEAT} (${sPct}%)`;
}

// ─────────────────────────────────────────────────────────────
// PUBLIC: Build full JSON like your OpenAPI from local φ-exact
// ─────────────────────────────────────────────────────────────
function epochMsFromUTCInput(utc: string | Date | bigint): bigint {
  if (typeof utc === "bigint") return utc;
  if (typeof utc === "string") return parseSignedIsoToEpochMs(utc);
  const t = utc.getTime();
  if (!Number.isFinite(t)) throw new Error(`Invalid Date: ${String(utc)}`);
  return BigInt(t);
}

export async function buildKaiKlockResponse(utc?: string | Date | bigint) {
  // 1) Real UTC instant (no pulse snapping) and exact lattice & μpulses
  const msUTC = (typeof utc === "undefined") ? BigInt(Date.now()) : epochMsFromUTCInput(utc);
  const pμ = microPulsesSinceGenesis(msUTC);

  const pulse = toSafeNumber(floorDivE(pμ, 1_000_000n));
  const { beat, stepIndex } = latticeFromMicroPulses(pμ);
  const { weekday: eternalWeekday } = ((): { weekday: Weekday } => {
    const dayIndexBI = floorDivE(pμ, N_DAY_MICRO);
    const weekdayIdx = toSafeNumber(modE(dayIndexBI, b(WEEKDAYS.length)));
    return { weekday: WEEKDAYS[weekdayIdx] };
  })();

  // 2) Eternal (harmonic) indices
  const eternal = eternalIndices(pμ);

  // 3) Solar (UTC-aligned, **sunrise-driven**) indices from the real UTC instant
  const solar = solarIndices(msUTC);

  // 4) Arc
  const { name: arcName, idx: arcIdx, desc: arcDesc } = arcFromBeat(beat);

  // 5) Beat/Step μpulse breakdown for % to next
  const pulsesInDay = modE(pμ, N_DAY_MICRO);
  const pulsesInGrid = pulsesInDay % BASE_DAY_MICRO;
  const beatBI = pulsesInGrid / PULSES_PER_BEAT_MICRO;
  const pulsesInBeat = pulsesInGrid - beatBI * PULSES_PER_BEAT_MICRO;
  const pulsesInStep = pulsesInBeat - BigInt(stepIndex) * PULSES_PER_STEP_MICRO;

  const beatPercent = percent(pulsesInBeat, PULSES_PER_BEAT_MICRO);
  const stepPercent = percent(pulsesInStep, PULSES_PER_STEP_MICRO);

  // 6) Derived counts
  const kaiPulseEternal = pulse;
  const kaiPulseToday = safeInt(floorDivE(modE(pμ, N_DAY_MICRO), 1_000_000n));
  const eternalKaiPulseToday = kaiPulseToday;

  // 7) Year/Month/Week progress (eternal)
  const daysIntoYear = toSafeNumber(modE(eternal.dayIdx, BigInt(DAYS_PER_YEAR)));
  const yearDaysRemaining = DAYS_PER_YEAR - 1 - daysIntoYear;
  const yearPct = (daysIntoYear + Number(pulsesInDay) / Number(N_DAY_MICRO)) / DAYS_PER_YEAR;

  const monthDaysElapsed = eternal.dayOfMonth - 1;
  const monthDaysRemaining = DAYS_PER_MONTH - eternal.dayOfMonth;
  const monthPct = (monthDaysElapsed + Number(pulsesInDay) / Number(N_DAY_MICRO)) / DAYS_PER_MONTH;

  // 8) Phi spiral level
  const phiSpiralLevel = phiSpiralLevelFromPulse(kaiPulseEternal);

  // 9) Seals & narratives (match spec wording/order)
  const kairosSeal = formatKairosSeal(
    beat,
    stepIndex,
    eternalWeekday, // use eternal weekday
    arcName,
    eternal.dayOfMonth,
    eternal.monthIndex,
    kaiPulseToday,
    phiSpiralLevel,
    eternal.yearIndex
  );
  const solarSeal = formatSolarKairos(
    beat,
    stepIndex,
    solar.weekdayName,
    solar.dayOfMonth,
    solar.monthIndex,
    arcName
  );
  const kairosSealPercentStep = formatKairosSealPercentStep(beat, stepIndex, stepPercent);
  const kairosSealPercentStepSolar = formatKairosSealPercentStep(beat, stepIndex, stepPercent);

  // Compose with Solar first, then append final Eternal Pulse to match the examples exactly.
  const eternalSeal = `${kairosSeal} • ${solarSeal} • Eternal Pulse:${kaiPulseEternal}`;

  const kaiMomentSummary =
    `Kai:${kaiPulseEternal} • B:${beat}/${BEATS_PER_DAY} S:${stepIndex}/${STEPS_PER_BEAT} (${pct(stepPercent)}%) • ` +
    `${eternalWeekday}, ${ARC_SEAL_NAMES[arcName]} • D${eternal.dayOfMonth}/M${eternal.monthIndex + 1} • Y${eternal.yearIndex + 1}`;

  const harmonicTimestampDescription =
    `Harmonic Kairos: Beat ${beat}/${BEATS_PER_DAY}, Step ${stepIndex}/${STEPS_PER_BEAT} in the ${ARC_NAMES[arcIdx]} ` +
    `(${ARC_DESC[ARC_NAMES[arcIdx]]}). Weekday: ${eternalWeekday}. ` +
    `Eternal Month ${eternal.monthIndex + 1} (${eternal.monthName}), Day ${eternal.dayOfMonth}. ` +
    `Eternal pulses today: ${kaiPulseToday}.`;

  // 10) Harmonic levels (cycles shown as pulses; percent ∈ [0,1])
  const cycleArcLen = PULSES_PER_BEAT_MICRO * 6n;
  const cycleArcPos = modE(pulsesInGrid, cycleArcLen);
  const arcPercent = percent(cycleArcPos, cycleArcLen);

  const cycleBeatLen = PULSES_PER_BEAT_MICRO;
  const cycleBeatPos = pulsesInBeat;
  const beatPctToNext = percent(cycleBeatPos, cycleBeatLen);

  const cycleStepLen = PULSES_PER_STEP_MICRO;
  const cycleStepPos = pulsesInStep;
  const stepPctLocal = percent(cycleStepPos, cycleStepLen);

  const cycleDayLen = N_DAY_MICRO;
  const cycleDayPos = pulsesInDay;
  const dayPercent = percent(cycleDayPos, cycleDayLen);

  // 11) Subdivisions table (display helpers)
  // Compute seconds per pulse using exact ratio → ms, then divide by 1000.
  const T_PULSE_MS = Number(mulDivRoundHalfEven(1_000_000n, T_MS_NUM, T_MS_DEN)) / 1_000_000; // ms/pulse
  const T_PULSE_S = T_PULSE_MS / 1000;

  const subdivisions = {
    kai_pulse: {
      duration: T_PULSE_S,
      count: 1,
      frequencyHz: 1 / T_PULSE_S,
      wavelengthSound_m: 343 * T_PULSE_S,
      wavelengthLight_m: 299_792_458 * T_PULSE_S,
      resonantName: "Full harmonic breath",
    },
    chakra_step: {
      duration: T_PULSE_S * 11,
      count: 11,
      frequencyHz: 1 / (T_PULSE_S * 11),
      wavelengthSound_m: 343 * T_PULSE_S * 11,
      wavelengthLight_m: 299_792_458 * T_PULSE_S * 11,
      resonantName: "Chakra Step",
    },
    chakra_beat: {
      duration: T_PULSE_S * Number(PULSES_BEAT),
      count: Number(PULSES_BEAT),
      frequencyHz: 1 / (T_PULSE_S * Number(PULSES_BEAT)),
      wavelengthSound_m: 343 * T_PULSE_S * Number(PULSES_BEAT),
      wavelengthLight_m: 299_792_458 * T_PULSE_S * Number(PULSES_BEAT),
      resonantName: "Chakra Beat",
    },
    harmonic_day: {
      duration: T_PULSE_S * 17_491.270421,
      count: 17_491.270421,
      frequencyHz: 1 / (T_PULSE_S * 17_491.270421),
      wavelengthSound_m: 343 * T_PULSE_S * 17_491.270421,
      wavelengthLight_m: 299_792_458 * T_PULSE_S * 17_491.270421,
      resonantName: "Harmonic Day",
    },
  } as const;

  // 12) Compose response (keys match your OpenAPI names)
  const res = {
    // — compact seals (and variants) —
    kairos_seal: kairosSeal,
    kairos_seal_percent_step: kairosSealPercentStep,
    kairos_seal_percent_step_solar: kairosSealPercentStepSolar,
    kairos_seal_solar: solarSeal,

    // — canonical strings —
    eternalSeal,
    seal: eternalSeal,

    // — narration & summaries —
    harmonicNarrative: harmonicTimestampDescription,
    kaiMomentSummary,
    compressed_summary: `${beat}:${leftPad2(stepIndex)} • D${eternal.dayOfMonth}/M${eternal.monthIndex + 1} • ${eternalWeekday} • ${ARC_NAMES[arcIdx]}`,

    // — eternal (harmonic) calendar —
    eternalMonth: MONTHS[eternal.monthIndex].name,
    eternalMonthIndex: eternal.monthIndex,
    eternalMonthDescription: MONTHS[eternal.monthIndex].desc,
    eternalChakraArc: ARC_NAMES[arcIdx],
    eternalWeekDescription: eternal.weekDesc,
    eternalYearName: `Y${eternal.yearIndex + 1}`,
    eternalKaiPulseToday,
    kaiPulseEternal,
    eternalMonthProgress: {
      daysElapsed: monthDaysElapsed,
      daysRemaining: monthDaysRemaining,
      percent: monthPct,
    },
    kaiPulseToday,

    // — solar (UTC-aligned, sunrise) view —
    solarChakraArc: ARC_NAMES[arcIdx],
    solarDayOfMonth: solar.dayOfMonth,
    solarMonthIndex: solar.monthIndex,
    solarHarmonicDay: solar.weekdayName,
    solar_week_index: solar.weekInMonth,
    solar_week_name: solar.weekName,
    solar_week_description: solar.weekDesc,
    solar_month_name: solar.monthName,
    solar_month_description: solar.monthDesc,
    solar_day_name: solar.weekdayName,
    solar_day_description: DAY_TO_CHAKRA[solar.weekdayName] + " focus",
    solar_day_start_iso: new Date(Number(solar.sunriseMs)).toISOString(), // optional debug/export

    // — harmonic day / arc context (eternal) —
    harmonicDay: eternalWeekday,
    harmonicDayDescription: DAY_TO_CHAKRA[eternalWeekday] + " focus",
    chakraArc: ARC_NAMES[arcIdx],
    chakraArcDescription: arcDesc,
    weekIndex: eternal.weekInMonth,
    weekName: eternal.weekName,
    dayOfMonth: eternal.dayOfMonth,

    harmonicWeekProgress: {
      weekDay: eternalWeekday,
      weekDayIndex: eternal.weekdayIndex,
      pulsesIntoWeek: safeInt(
        modE(pμ, N_DAY_MICRO * BigInt(DAYS_PER_WEEK)) / 1_000_000n
      ),
      percent:
        Number(modE(pμ, N_DAY_MICRO * BigInt(DAYS_PER_WEEK))) /
        Number(N_DAY_MICRO * BigInt(DAYS_PER_WEEK)),
    },

    // — beat / step (eternal + copy to solar strings) —
    chakraBeat: {
      beatIndex: beat,
      pulsesIntoBeat: Number(pulsesInBeat) / 1_000_000, // display only
      beatPulseCount: Number(PULSES_PER_BEAT_MICRO) / 1_000_000,
      totalBeats: BEATS_PER_DAY,
    },
    eternalChakraBeat: {
      beatIndex: beat,
      pulsesIntoBeat: Number(pulsesInBeat) / 1_000_000,
      beatPulseCount: Number(PULSES_PER_BEAT_MICRO) / 1_000_000,
      totalBeats: BEATS_PER_DAY,
      percentToNext: beatPctToNext,
    },
    chakraStep: {
      stepIndex,
      percentIntoStep: stepPercent,
      stepsPerBeat: STEPS_PER_BEAT,
    },
    chakraStepString: `${beat}:${leftPad2(stepIndex)}`,
    solarChakraStep: {
      stepIndex,
      percentIntoStep: stepPercent,
      stepsPerBeat: STEPS_PER_BEAT,
    },
    solarChakraStepString: `${beat}:${leftPad2(stepIndex)}`,

    // — phi spiral & kai-turah —
    phiSpiralLevel,
    kaiTurahPhrase: "Rah veh yah dah",

    // — epochs (sampled structure aligned to spec narrative) —
    phiSpiralEpochs: [
      { unit: "Eternal Year", pulses: 5_877_066.9, approx_days: 373.1 },
      { unit: "Φ Epoch", pulses: 9_510_213.0, approx_days: 956.1 },
      { unit: "Φ² Resonance Epoch", pulses: 15_386_991.0, approx_days: 1542.0 },
    ],

    // — nested harmonic levels —
    harmonicLevels: {
      arcBeat: {
        pulseInCycle: Number(cycleArcPos) / 1_000_000, // display only
        cycleLength: Number(cycleArcLen) / 1_000_000,
        percent: arcPercent,
      },
      microCycle: {
        pulseInCycle: Number(cycleStepPos) / 1_000_000,
        cycleLength: Number(cycleStepLen) / 1_000_000,
        percent: stepPctLocal,
      },
      chakraLoop: {
        pulseInCycle: Number(cycleBeatPos) / 1_000_000,
        cycleLength: Number(cycleBeatLen) / 1_000_000,
        percent: beatPercent,
      },
      harmonicDay: {
        pulseInCycle: Number(cycleDayPos) / 1_000_000,
        cycleLength: Number(cycleDayLen) / 1_000_000,
        percent: dayPercent,
      },
    },

    harmonicYearProgress: {
      daysElapsed: daysIntoYear,
      daysRemaining: yearDaysRemaining,
      percent: yearPct,
    },

    // — canonical timestamp & narratives —
    harmonicTimestampDescription,

    // — subdivisions —
    subdivisions,
  };

  return res;
}
