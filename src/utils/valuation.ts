/* valuation.ts — Natural-Law valuation for Kai-sigils (vφ-5 “Harmonia”)
   Base unit: 1 coherent breath = 1 Φ

   Canon rhythm (discrete, deterministic):
     • 44 steps per beat
     • 11 breaths (pulses) per step
     • ⇒ 484 pulses per beat
     • EXACT pulses per day: 17,491.270421

   Pure φ logic:
     • Numeric-moment rarity is led by exact Fibonacci / Lucas hits (no heuristics).
     • All tunables are φ-scaled (powers of φ only).
     • Adoption, floor, and growth are monotone in Kai-time; live waves are tiny and φ-derived.
     • No randomness: the “strobe” uses the irrational Beatty sequence of φ for low-discrepancy phase.

   Structure:
     rarityFloor(now) = f(claim invariants, Δadoption(now), fib/lucas accrual(Δt), genesisBias)
     band = baselinePremium × dynamicGrowth − rarityFloor
     combinedOsc = breathOsc × dayOsc × strobeOsc × momentAffinityOsc
     premium(now) = rarityFloor + band × combinedOsc
     valuePhi(now) = 1 Φ × premium(now) + PV(IP at now)

   STEP CONSISTENCY (fix):
     • Single-source step: if the caller supplies meta.stepIndex, we always trust it.
     • Only if absent do we derive stepIndex from the claim pulse.
     • We also normalize `beat` for geometry if missing (fall back to claimPulse // pulsesPerBeat).
*/

export type HashHex = string;

/* ----------------- local types (no component imports) ----------------- */
export interface SigilPayload { name: string; mime: string; size: number; encoded?: string; }
export interface SigilTransfer {
  senderSignature: string; senderStamp: string; senderKaiPulse: number;
  payload?: SigilPayload;
  receiverSignature?: string; receiverStamp?: string; receiverKaiPulse?: number;
}

/** Optional ZK proof container (integration hook; cryptography provided by caller) */
export interface ZkProof {
  scheme: "groth16";
  curve: "bn128" | "bls12-381";
  proof: string;            // base64 or hex
  publicInputsHash: string; // Poseidon(algorithm|policyChecksum|inputs|minHead) — hex
  verifierId?: string;      // off-chain or on-chain verifier reference
}

export interface SigilMetadataLite {
  // Kai identity
  pulse?: number;
  kaiPulse?: number; // claim/creation pulse (fallback to pulse or now)
  kaiSignature?: string;
  userPhiKey?: string;

  // geometry/rhythm (optional but helpful)
  beat?: number;
  stepIndex?: number;     // 0..(stepsPerBeat-1) at claim (optional)
  stepsPerBeat?: number;  // default 44 (Kai canon)

  // craft signals
  seriesSize?: number;
  quality?: "low" | "med" | "high";
  creatorVerified?: boolean;
  creatorRep?: number; // 0..1

  // resonance
  frequencyHz?: number;
  chakraDay?: string;   // backward-compat signals (optional)
  chakraGate?: string;  // backward-compat signals (optional)

  // lineage
  transfers?: SigilTransfer[];
  cumulativeTransfers?: number;

  // segmented head references
  segments?: { index: number; root: HashHex; cid: HashHex; count: number }[];
  segmentsMerkleRoot?: HashHex;
  transfersWindowRoot?: HashHex;

  // optional intrinsic IP cashflows (in Φ at future Kai pulses)
  ip?: {
    expectedCashflowPhi?: { atPulse: number; amountPhi: number }[];
    expectedCashflowKS?: { atPulse: number; amountKS: number }[]; // legacy alias
  };

  // policy id (let mints pin parameter presets)
  valuationPolicyId?: string;
}


/* --------------------------- valuation structures --------------------------- */
export type ValueUnit = "Φ";

export interface ValueInputs {
  // Diagnostics
  size: number; quality: "low" | "med" | "high"; creatorVerified: boolean; creatorRep: number;
  uniqueHolders: number; closedFraction: number; cadenceRegularity: number;
  medianHoldBeats: number; velocityPerBeat: number; resonancePhi: number;
  pulsesPerBeat: number; agePulses: number; geometryLift: number; momentLift: number; pv_phi: number;

  // Growth & rarity diagnostics
  algorithmVersion: "phi/kosmos-vφ-5";
  adoptionAtClaim: number; adoptionNow: number; adoptionDelta: number;
  rarityScore01: number;
  fibAccrualLevels: number; lucasAccrualLevels: number;
  indexScarcity: number; adoptionLift: number; fibAccrualLift: number; lucasAccrualLift: number;

  // Live moment diagnostics
  breathPhase01: number; breathWave: number;
  dayPhase01: number; dayWave: number;
  strobePhase01: number; strobeWave: number;
  momentAffinitySim01: number; momentAffinityAmp: number; momentAffinityOsc: number;
  combinedOsc: number;

  // Band/floor
  dynamicGrowth: number; rarityFloor: number; premiumBandBase: number;
}

export interface ValueSeal {
  version: 1;
  unit: ValueUnit; // "Φ"
  algorithm: "phi/kosmos-vφ-5";
  policyId?: string;
  policyChecksum: string;

  // result
  valuePhi: number; premium: number;

  // inputs (diagnostic & reproducibility)
  inputs: ValueInputs;

  // timing/head binding
  computedAtPulse: number;
  headRef: { headHash?: HashHex; transfersWindowRoot?: HashHex; cumulativeTransfers: number; };

  // recomputable integrity stamp over (algorithm|policy|inputs|minHead)
  stamp: HashHex;

  // optional ZK proof (privacy-preserving verification)
  zkProof?: ZkProof;
}

/* ----------------------------- φ tunables (POLICY) -------------------------- */

const PHI = (1 + Math.sqrt(5)) / 2;

// Canon rhythm (constants)
const DEFAULT_STEPS_PER_BEAT = 44 as const;
const PULSES_PER_STEP = 11 as const;
const PULSES_PER_BEAT_CANON = DEFAULT_STEPS_PER_BEAT * PULSES_PER_STEP; // 484
const PULSES_PER_DAY_EXACT = 17491.270421;

// Rarity curve — stronger φ disparity
const RARITY_ONE_OF_ONE = PHI;          // ≈ 1.618 base lift for 1/1
const RARITY_EXP = 1 / PHI;             // size^-1/φ (≈ size^-0.618)

// Craft factors anchored to φ
const QUALITY_MAP: Record<"low" | "med" | "high", number> = {
  low: 1 - 1 / PHI ** 6,
  med: 1.0,
  high: 1 + 1 / PHI ** 6,
};
const CREATOR_VERIFIED_LIFT = 1 / PHI ** 6;
const CREATOR_REP_MAX       = 1 / PHI ** 5;

// Provenance & stewardship
const PROV_LOG_SLOPE = 1 / PHI ** 3;     // ≈ 0.236
const HOLD_SLOPE     = 1 / PHI ** 4;     // ≈ 0.146
const HOLD_CAP       = 1 + 1 / PHI ** 4; // ≈ +14.6%

// Coherence (closure & cadence)
const CLOSURE_CENTER    = 0.7;
const CLOSURE_RANGE     = 0.3;
const CLOSURE_RANGE_INV = 1 / CLOSURE_RANGE;
const CLOSURE_GAIN      = 1 / PHI ** 6;
const CADENCE_GAIN      = 1 / PHI ** 6;

// Anti-churn & age
const CHURN_KAPPA = 0.15;
const AGE_EPS     = 1 / PHI ** 5; // ≈ 0.090
const AGE_CAP     = 1 + 1 / PHI ** 3; // ≈ +23.6%

// Frequency φ-resonance lift (neutral at 0.5)
const RESONANCE_GAIN = 1 / PHI ** 5;

// Discount for future IP cashflows — gentle, Kai-local
const DISCOUNT_PULSE_HALFSPAN = PULSES_PER_DAY_EXACT;

// Geometry (moment rarity) — tiny, principled lifts
const GEOM_EDGE_GAIN  = 1 / PHI ** 7;
const GEOM_PHI_GAIN   = 1 / PHI ** 7;
const GEOM_PRIME_GAIN = 1 / PHI ** 8;

/* Numeric-moment rarity (exact) — emphasis on Fib/Lucas.
   UPDATE: add φ-spiral *transition* pulses only (n where pulse = ceil(φ^n)). */
const MOMENT_FIB_EXACT_GAIN   = 1 / PHI;      // ≈ +61.8%
const MOMENT_LUCAS_EXACT_GAIN = 1 / PHI ** 2; // ≈ +38.2%
const MOMENT_PHI_TRANSITION_GAIN = 1 / PHI ** 2; // gentle lift at exact φ-spiral transition pulses
const MOMENT_UNIFORM_GAIN     = 1 / PHI ** 3; // ≈ +23.6%
const MOMENT_PAL_GAIN         = 1 / PHI ** 4; // ≈ +14.6%
const MOMENT_RUN_GAIN         = 1 / PHI ** 4; // scaled by run length
const MOMENT_SEQ_GAIN         = 1 / PHI ** 5; // scaled by sequence length
const MOMENT_LOW_ENTROPY_GAIN = 1 / PHI ** 6; // scaled by (1 - entropy)

/* Genesis & adoption field */
const GENESIS_BIAS_GAIN = 1 / PHI ** 5;
const YEAR_PULSES_APPROX = PULSES_PER_DAY_EXACT * 365;

const ADOPTION_TAU_PULSES = YEAR_PULSES_APPROX;
const ADOPTION_GAIN_BASE  = 1 / PHI ** 3;
const ADOPTION_GAIN_RARE  = 1 / PHI ** 2;

// Index scarcity & accrual steps
const INDEX_SCARCITY_GAIN = 1 / PHI ** 4;
const FIB_STEP_GAIN       = 1 / PHI ** 6;
const LUCAS_STEP_GAIN     = 1 / PHI ** 7;

/* Live waves (φ-derived, tiny) */
const BREATH_WAVE_GAIN = 1 / PHI ** 8;
const DAY_WAVE_GAIN    = 1 / PHI ** 8;
const STROBE_WAVE_GAIN = 1 / PHI ** 9; // φ-Beatty strobe (no RNG)

/* Moment Affinity */
const MOMENT_AFFINITY_GAIN_BASE   = 1 / PHI ** 4;
const MOMENT_AFFINITY_DIGIT_WEIGHT = 1 / PHI;

/* ----------------------------- POLICY checksum ----------------------------- */
const POLICY = {
  RARITY_ONE_OF_ONE, RARITY_EXP,
  QUALITY_MAP, CREATOR_VERIFIED_LIFT, CREATOR_REP_MAX,
  PROV_LOG_SLOPE, HOLD_SLOPE, HOLD_CAP,
  CLOSURE_CENTER, CLOSURE_RANGE, CLOSURE_GAIN, CADENCE_GAIN,
  CHURN_KAPPA, AGE_EPS, AGE_CAP,
  RESONANCE_GAIN,
  DISCOUNT_PULSE_HALFSPAN,
  GEOM_EDGE_GAIN, GEOM_PHI_GAIN, GEOM_PRIME_GAIN,
  MOMENT_FIB_EXACT_GAIN, MOMENT_LUCAS_EXACT_GAIN, MOMENT_PHI_TRANSITION_GAIN, MOMENT_UNIFORM_GAIN,
  MOMENT_PAL_GAIN, MOMENT_RUN_GAIN, MOMENT_SEQ_GAIN, MOMENT_LOW_ENTROPY_GAIN,
  GENESIS_BIAS_GAIN, YEAR_PULSES_APPROX,
  ADOPTION_TAU_PULSES, ADOPTION_GAIN_BASE, ADOPTION_GAIN_RARE,
  INDEX_SCARCITY_GAIN, FIB_STEP_GAIN, LUCAS_STEP_GAIN,
  BREATH_WAVE_GAIN, DAY_WAVE_GAIN, STROBE_WAVE_GAIN,
  MOMENT_AFFINITY_GAIN_BASE, MOMENT_AFFINITY_DIGIT_WEIGHT,
  DEFAULT_STEPS_PER_BEAT, PULSES_PER_STEP, PULSES_PER_BEAT_CANON, PULSES_PER_DAY_EXACT,
  PHI
};
// ---------- Strong JSON typings ----------
type JSONPrimitive = string | number | boolean | null;
export type JSONValue = JSONPrimitive | { [key: string]: JSONValue } | JSONValue[];

// ---------- Internal impl (no overloads) ----------
function stableStringifyImpl(x: unknown): string {
  if (x === null) return "null";

  switch (typeof x) {
    case "string":
    case "number":
    case "boolean":
      return JSON.stringify(x);

    case "object": {
      if (Array.isArray(x)) {
        const arr = x as readonly unknown[];
        return "[" + arr.map(stableStringifyImpl).join(",") + "]";
      }
      const obj = x as Record<string, unknown>;
      const keys = Object.keys(obj).sort();
      return "{" + keys.map(k => JSON.stringify(k) + ":" + stableStringifyImpl(obj[k])).join(",") + "}";
    }

    // undefined, function, symbol, bigint → encode as null for determinism
    default:
      return "null";
  }
}

// ---------- Public API (overloads) ----------
export function stableStringify(x: JSONValue): string;
export function stableStringify(x: unknown): string;
export function stableStringify(x: unknown): string {
  return stableStringifyImpl(x);
}

// Domain-separated FNV-like checksum (prevents cross-domain reuse)
function policyChecksum(): string {
  const s = "val-policy:" + stableStringify(POLICY as unknown);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ("00000000" + (h >>> 0).toString(16)).slice(-8);
}

/* ---- NEW: hoist checksum once (stability + micro perf; no behavior change) --- */
const POLICY_CHECKSUM = policyChecksum();

/* --------------------------------- helpers --------------------------------- */
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const log1p = (x: number) => Math.log(1 + Math.max(0, x));
const frac = (x: number) => x - Math.floor(x);

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const a = arr.slice().sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function distinctReceivers(transfers: SigilTransfer[]): number {
  const uniq = new Set<string>();
  for (const t of transfers) if (t.receiverSignature) uniq.add(t.receiverSignature);
  return Math.max(uniq.size, 1);
}
function closedTransfers(transfers: SigilTransfer[]): SigilTransfer[] {
  return transfers.filter((t) => t.receiverSignature && t.receiverKaiPulse != null);
}
function interSendDeltas(transfers: SigilTransfer[]): number[] {
  if (transfers.length < 2) return [];
  const deltas: number[] = [];
  for (let i = 1; i < transfers.length; i++) {
    const a = transfers[i - 1].senderKaiPulse;
    const b = transfers[i].senderKaiPulse;
    if (Number.isFinite(a) && Number.isFinite(b) && b >= a) deltas.push(b - a);
  }
  return deltas;
}
function cadenceRegularity01(deltas: number[]): number {
  if (deltas.length === 0) return 1.0;
  const m = median(deltas) || 1;
  let sum = 0;
  for (const d of deltas) sum += Math.abs(d - m) / m;
  const madNorm = sum / deltas.length;
  return 1 / (1 + madNorm);
}

/* present value of intrinsic IP in Φ; supports legacy KS alias */
function presentValueIP(ip: SigilMetadataLite["ip"], nowPulse: number): number {
  const cfPhi = ip?.expectedCashflowPhi?.map((c) => ({ atPulse: c.atPulse, amount: c.amountPhi })) ?? [];
  const cfKS  = ip?.expectedCashflowKS?.map((c) => ({ atPulse: c.atPulse, amount: c.amountKS })) ?? [];
  const cf = [...cfPhi, ...cfKS];
  return cf.reduce((s, c) => {
    const dp = c.atPulse - nowPulse;
    const disc = 1 / (1 + Math.max(0, dp) / DISCOUNT_PULSE_HALFSPAN);
    return s + c.amount * disc;
  }, 0);
}

/* φ-resonance (0.5 neutral, 1 peak aligned) */
function phiResonance01(f?: number): number {
  if (!f || !Number.isFinite(f) || f <= 0) return 0.5;
  const x = Math.log(f) / Math.log(PHI);
  const dist = Math.abs(x - Math.round(x));
  const closeness = clamp(1 - 2 * dist, 0, 1);
  return 0.5 + 0.5 * closeness;
}
function isPrime(n?: number): boolean {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 2) return false;
  const k = Math.floor(n);
  if (k % 2 === 0) return k === 2;
  for (let i = 3; i * i <= k; i += 2) if (k % i === 0) return false;
  return true;
}

/* geometric rarity: tiny, principled lifts */
function geometryLift(meta: SigilMetadataLite, stepsPerBeat: number, resonancePhi: number): number {
  let lift = 1.0;
  const isEdge =
    typeof meta.stepIndex === "number" &&
    (meta.stepIndex === 0 || meta.stepIndex === (stepsPerBeat > 0 ? stepsPerBeat - 1 : -1));
  if (isEdge) lift *= 1 + GEOM_EDGE_GAIN;
  if (isPrime(meta.beat)) lift *= 1 + GEOM_PRIME_GAIN;
  if (resonancePhi > 0.9) {
    const t = (resonancePhi - 0.9) / 0.1;
    lift *= 1 + GEOM_PHI_GAIN * clamp(t, 0, 1);
  }
  return lift;
}

/* ---------------------- Numeric-moment rarity helpers (exact) ----------------*/

// BigInt sqrt helpers
function bigintSqrt(n: bigint): bigint {
  if (n < 0n) throw new Error("sqrt of negative");
  if (n < 2n) return n;
  let x0 = n, x1 = (n >> 1n) + 1n;
  while (x1 < x0) { x0 = x1; x1 = (x1 + n / x1) >> 1n; }
  return x0;
}
function isPerfectSquareBig(n: bigint): boolean {
  if (n < 0n) return false;
  const r = bigintSqrt(n);
  return r * r === n;
}
// Add near your other module-level state:
const __fibMemo = new Map<number, boolean>();

function isFibonacciExact(pulse: number): boolean {
  if (!Number.isFinite(pulse) || pulse < 0) return false;
  const nSafe = Math.trunc(Math.abs(pulse));
  const cached = __fibMemo.get(nSafe);
  if (cached !== undefined) return cached;

  const n = BigInt(nSafe);
  const a = 5n * n * n + 4n;
  const b = 5n * n * n - 4n;
  const ok = isPerfectSquareBig(a) || isPerfectSquareBig(b);
  __fibMemo.set(nSafe, ok);
  return ok;
}

// Add near the Fibonacci memo:
const __lucMemo = new Map<number, boolean>();

function isLucasExact(pulse: number): boolean {
  if (!Number.isFinite(pulse) || pulse < 0) return false;
  const nSafe = Math.trunc(Math.abs(pulse));
  const cached = __lucMemo.get(nSafe);
  if (cached !== undefined) return cached;

  const n = BigInt(nSafe);
  let a = 2n, b = 1n;
  while (b < n) { const t = a + b; a = b; b = t; }
  const ok = (b === n);
  __lucMemo.set(nSafe, ok);
  return ok;
}


function absDigits(pulse: number): string {
  return Math.abs(Math.trunc(pulse)).toString();
}
function allSameDigit(s: string): boolean {
  if (s.length <= 1) return false;
  for (let i = 1; i < s.length; i++) if (s[i] !== s[0]) return false;
  return true;
}
function isPalindromeDigits(s: string): boolean {
  if (s.length <= 1) return false;
  for (let i = 0, j = s.length - 1; i < j; i++, j--) if (s[i] !== s[j]) return false;
  return true;
}
function longestRunSameDigit(s: string): number {
  if (s.length === 0) return 0;
  let max = 1, cur = 1;
  for (let i = 1; i < s.length; i++) {
    if (s[i] === s[i - 1]) { cur++; if (cur > max) max = cur; }
    else cur = 1;
  }
  return max;
}
function longestRunDigitInfo(s: string): { len: number; digit: string } {
  if (s.length === 0) return { len: 0, digit: "" };
  let maxLen = 1, curLen = 1, digit = s[0], curDigit = s[0];
  for (let i = 1; i < s.length; i++) {
    if (s[i] === s[i - 1]) { curLen++; curDigit = s[i]; if (curLen > maxLen) { maxLen = curLen; digit = curDigit; } }
    else { curLen = 1; curDigit = s[i]; }
  }
  return { len: maxLen, digit };
}
function longestConsecutiveSequenceLen(s: string): number {
  if (s.length <= 1) return 1;
  let maxLen = 1, curLen = 1, dir = 0;
  for (let i = 1; i < s.length; i++) {
    const prev = s.charCodeAt(i - 1) - 48;
    const curr = s.charCodeAt(i) - 48;
    const step = curr - prev;
    if (step === dir && (step === 1 || step === -1)) curLen++;
    else if (step === 1 || step === -1) { dir = step; curLen = 2; }
    else { dir = 0; curLen = 1; }
    if (curLen > maxLen) maxLen = curLen;
  }
  return maxLen;
}
function digitEntropy01(s: string): number {
  if (s.length === 0) return 1;
  const cnt = Array(10).fill(0);
  for (const ch of s) cnt[ch.charCodeAt(0) - 48]++;
  let H = 0;
  for (const c of cnt) if (c) { const p = c / s.length; H -= p * Math.log(p); }
  const Hmax = Math.log(Math.min(10, s.length));
  return clamp(H / (Hmax || 1), 0, 1);
}

// Gentle Genesis proximity lift/discount
function genesisProximityLift(claimPulse: number): number {
  if (!Number.isFinite(claimPulse) || claimPulse < 0) return 1.0;
  const t = claimPulse / (claimPulse + YEAR_PULSES_APPROX);
  return 1 + GENESIS_BIAS_GAIN * (1 - 2 * t);
}

/* φ-spiral transition membership:
   EXACT transition integers s_n = ceil(φ^n), n ≥ 1. Only these pulses qualify. */
// Add near the other memos:
const __phiTransMemo = new Map<number, number | null>();

function phiTransitionIndexFromPulse(pulse: number): number | null {
  if (!Number.isFinite(pulse) || pulse < 1) return null;
  const nSafe = Math.trunc(pulse);
  const cached = __phiTransMemo.get(nSafe);
  if (cached !== undefined) return cached;

  const N = nSafe;
  const nApprox = Math.log(N) / Math.log(PHI);
  const start = Math.max(1, Math.floor(nApprox) - 2);
  let hit: number | null = null;
  for (let k = start; k <= start + 6; k++) {
    const s = Math.ceil(Math.pow(PHI, k));
    if (s === N) { hit = k; break; }
  }
  __phiTransMemo.set(nSafe, hit);
  return hit;
}


/* Moment rarity (deterministic, multiplicative) */
function momentRarityLiftFromPulse(pulse: number): number {
  if (!Number.isFinite(pulse) || pulse < 0) return 1.0;
  const s = absDigits(pulse), len = s.length;
  let lift = 1.0;

  // Exact numeric sets
  if (isFibonacciExact(pulse)) lift *= 1 + MOMENT_FIB_EXACT_GAIN;
  if (isLucasExact(pulse))     lift *= 1 + MOMENT_LUCAS_EXACT_GAIN;

  // φ-spiral transition ONLY (update)
  if (phiTransitionIndexFromPulse(pulse) !== null) {
    lift *= 1 + MOMENT_PHI_TRANSITION_GAIN;
  }

  // Digit geometry motifs
  if (allSameDigit(s))         lift *= 1 + MOMENT_UNIFORM_GAIN;
  if (isPalindromeDigits(s))   lift *= 1 + MOMENT_PAL_GAIN;

  const run = longestRunSameDigit(s);
  if (run >= 3) {
    const norm = clamp((run - 2) / Math.max(3, len - 2), 0, 1);
    lift *= 1 + MOMENT_RUN_GAIN * norm;
  }
  const seq = longestConsecutiveSequenceLen(s);
  if (seq >= 4) {
    const norm = clamp((seq - 3) / Math.max(4, len - 3), 0, 1);
    lift *= 1 + MOMENT_SEQ_GAIN * norm;
  }
  const ent = digitEntropy01(s);
  lift *= 1 + MOMENT_LOW_ENTROPY_GAIN * (1 - ent);

  return lift;
}

/* rarity score in [0..1] (for adoption exponent shaping) — unchanged.
   (φ-spiral transition does NOT affect this shaping signal.) */
function momentRarityScore01FromPulse(pulse: number): number {
  if (!Number.isFinite(pulse) || pulse < 0) return 0;
  const s = absDigits(pulse), len = s.length;

  let score = 0, weightSum = 0;

  const fib = isFibonacciExact(pulse) ? 1 : 0;
  score += 1.0 * fib;        weightSum += 1.0;

  const luc = isLucasExact(pulse) ? 1 : 0;
  score += (1 / PHI) * luc;  weightSum += 1 / PHI;

  const uniform = allSameDigit(s) ? 1 : 0;
  score += (1 / PHI) * uniform; weightSum += 1 / PHI;

  const pal = isPalindromeDigits(s) ? 1 : 0;
  score += (1 / PHI ** 2) * pal; weightSum += 1 / PHI ** 2;

  const run = longestRunSameDigit(s);
  const runNorm = clamp((run - 2) / Math.max(3, len - 2), 0, 1);
  score += (1 / PHI ** 2) * runNorm; weightSum += 1 / PHI ** 2;

  const seq = longestConsecutiveSequenceLen(s);
  const seqNorm = clamp((seq - 3) / Math.max(4, len - 3), 0, 1);
  score += (1 / PHI ** 3) * seqNorm; weightSum += 1 / PHI ** 3;

  const ent = digitEntropy01(s);
  score += (1 / PHI ** 3) * (1 - ent); weightSum += 1 / PHI ** 3;

  if (weightSum <= 0) return 0;
  return clamp(score / weightSum, 0, 1);
}

function geometricMean(xs: number[]): number {
  if (!xs.length) return 1.0;
  let sum = 0; for (const x of xs) sum += Math.log(Math.max(x, 1e-12));
  return Math.exp(sum / xs.length);
}

/* --------------------- moment affinity primitives --------------------------- */

function circularSim01(a: number, b: number, period: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b) || period <= 0) return 0.5;
  const da = ((a - b) % period + period) % period;
  const theta = (2 * Math.PI * da) / period;
  return 0.5 * (1 + Math.cos(theta));
}
function stepIndexFromPulse(pulse: number, stepsPerBeat: number): number {
  if (!Number.isFinite(pulse) || stepsPerBeat <= 0) return 0;
  const step = Math.floor(Math.floor(Math.max(0, pulse)) / PULSES_PER_STEP) % stepsPerBeat;
  return step;
}
function breathResidFromPulse(pulse: number): number {
  if (!Number.isFinite(pulse)) return 0;
  return Math.floor(Math.max(0, pulse)) % PULSES_PER_STEP; // 0..10
}
function logPhiFrac01(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  const x = Math.log(n) / Math.log(PHI);
  return frac(x);
}
function jaccard01(featuresA: Set<string>, featuresB: Set<string>): number {
  if (featuresA.size === 0 && featuresB.size === 0) return 0;
  const u = new Set([...featuresA, ...featuresB]);
  let inter = 0;
  for (const f of featuresA) if (featuresB.has(f)) inter++;
  return inter / u.size;
}
function motifFeatureSet(pulse: number): Set<string> {
  const s = new Set<string>();
  if (isFibonacciExact(pulse)) s.add("fib");
  if (isLucasExact(pulse))     s.add("lucas");
  const ds = absDigits(pulse);
  if (allSameDigit(ds)) s.add("uniform");
  if (isPalindromeDigits(ds)) s.add("pal");
  if (longestRunSameDigit(ds) >= 4) s.add("longrun");
  if (longestConsecutiveSequenceLen(ds) >= 5) s.add("longseq");
  return s;
}

/* --------------------- φ-adoption compounding primitives -------------------- */
function adoptionIndex01(pulse: number): number {
  if (!Number.isFinite(pulse) || pulse <= 0) return 0;
  return 1 - Math.pow(PHI, -pulse / ADOPTION_TAU_PULSES);
}
function countFibLevelsSince(agePulses: number): number {
  if (!Number.isFinite(agePulses) || agePulses <= 0) return 0;
  let a = 1n, b = 1n, levels = 0;
  const A = BigInt(Math.trunc(agePulses));
  while (b <= A) { levels++; const t = a + b; a = b; b = t; }
  return levels;
}
function countLucasLevelsSince(agePulses: number): number {
  if (!Number.isFinite(agePulses) || agePulses <= 0) return 0;
  let a = 2n, b = 1n, levels = 0;
  const A = BigInt(Math.trunc(agePulses));
  while (b <= A) { levels++; const t = a + b; a = b; b = t; }
  return levels;
}

/* --------------------- φ-Beatty “strobe” (no randomness) -------------------- */
/* Use the irrational rotation by φ to get an equidistributed phase:
   u = frac( (claimPulse + nowPulse) * φ ), strobe = 1 + ε*(2u − 1)
*/
function strobeWave(claimPulse: number, nowPulse: number): { phase01: number; wave: number } {
  const u = frac((claimPulse + nowPulse) * PHI);
  const wave = 1 + STROBE_WAVE_GAIN * (2 * u - 1);
  return { phase01: u, wave };
}

/* --------------------- normalization (single-source step) ------------------- */

function coerceStepsPerBeat(metaSteps?: number): number {
  return Number.isFinite(metaSteps) && (metaSteps as number) > 0
    ? Math.trunc(metaSteps as number)
    : DEFAULT_STEPS_PER_BEAT;
}

function resolveClaimPulse(meta: SigilMetadataLite, nowPulse: number): number {
  return typeof meta.kaiPulse === "number"
    ? meta.kaiPulse
    : typeof meta.pulse === "number"
      ? meta.pulse
      : nowPulse;
}

function resolveStepIndex(meta: SigilMetadataLite, stepsPerBeat: number, claimPulse: number): number {
  if (typeof meta.stepIndex === "number" && Number.isFinite(meta.stepIndex)) {
    return clamp(Math.trunc(meta.stepIndex), 0, stepsPerBeat - 1);
  }
  return stepIndexFromPulse(claimPulse, stepsPerBeat);
}

function resolveBeat(meta: SigilMetadataLite, pulsesPerBeat: number, claimPulse: number): number {
  if (typeof meta.beat === "number" && Number.isFinite(meta.beat)) {
    return Math.trunc(meta.beat);
  }
  return Math.floor(claimPulse / pulsesPerBeat);
}


/* ------------------ NEW: lightweight deep-freeze for cache safety ------------ */
function freezeUnsigned<T extends { inputs: ValueInputs; headRef: ValueSeal["headRef"] }>(u: T): T {
  Object.freeze(u.inputs);
  Object.freeze(u.headRef);
  return Object.freeze(u);
}


/* ------------------ NEW: memo cache for referential stability ---------------- */
type UnsignedSeal =
  Omit<ValueSeal, "stamp" | "policyChecksum" | "algorithm"> &
  { algorithm: "phi/kosmos-vφ-5"; policyChecksum: string };

const __unsignedCache = new Map<string, UnsignedSeal>();

/* -------------------------- intrinsic computation -------------------------- */
export function computeIntrinsicUnsigned(
  meta: SigilMetadataLite,
  nowPulse: number
): { unsigned: UnsignedSeal; stampPayload: string } {
  // Rhythm derivation (allows alternative stepsPerBeat if provided)
  const STEPS_PER_BEAT = coerceStepsPerBeat(meta.stepsPerBeat);
  const pulsesPerBeat = STEPS_PER_BEAT * PULSES_PER_STEP; // default 484

  const claimPulse = resolveClaimPulse(meta, nowPulse);

  const transfers = meta.transfers ?? [];
  const closed = closedTransfers(transfers);

  const beatsSinceClaim = Math.max(1, (nowPulse - claimPulse) / pulsesPerBeat);
  const velocityPerBeat = transfers.length / beatsSinceClaim;

  // provenance diversity
  const uniqueHolders = distinctReceivers(transfers);

  // closure coherence
  const closedFraction = transfers.length === 0 ? 1 : closed.length / transfers.length;

  // cadence regularity (sender timing)
  const cadenceRegularity = cadenceRegularity01(interSendDeltas(transfers));

  // stewardship (median holds) in beats
  const holdBeats = closed
    .map((t) => (t.receiverKaiPulse! - t.senderKaiPulse) / pulsesPerBeat)
    .filter((x) => x >= 0);
  const medHoldBeats = median(holdBeats);

  // φ-resonance from frequency if present
  const resonancePhi = phiResonance01(meta.frequencyHz);

  // ---- STEP CONSISTENCY: resolve step & beat once, and use everywhere ----
  const claimStepResolved = resolveStepIndex(meta, STEPS_PER_BEAT, claimPulse);
  const claimBeatResolved = resolveBeat(meta, pulsesPerBeat, claimPulse);
  const metaForGeometry: SigilMetadataLite = {
    ...meta,
    stepIndex: claimStepResolved,
    beat: claimBeatResolved,
  };

  // (optional) geometry lift (uses normalized meta)
  const geomLift = geometryLift(metaForGeometry, STEPS_PER_BEAT, resonancePhi);

  // age pulses
  const agePulses = Math.max(0, nowPulse - claimPulse);

  // present value of intrinsic cashflows (local IP) in Φ
  const pv_phi = presentValueIP(meta.ip, nowPulse);

  /* ----------------------------- baseline premium --------------------------- */

  const size = meta.seriesSize ?? 1;
  const rarity = size <= 1 ? RARITY_ONE_OF_ONE : Math.pow(size, -RARITY_EXP);

  const quality = (meta.quality ?? "med") as "low" | "med" | "high";
  const qf = QUALITY_MAP[quality];
  const creator = (meta.creatorVerified ? 1 + CREATOR_VERIFIED_LIFT : 1) + (meta.creatorRep ?? 0) * CREATOR_REP_MAX;

  const prov = 1 + PROV_LOG_SLOPE * log1p(uniqueHolders - 1);

  const closureCentered = clamp((closedFraction - CLOSURE_CENTER) * CLOSURE_RANGE_INV, -1, 1);
  const closureLift = 1 + CLOSURE_GAIN * closureCentered;

  const cadenceLift = 1 + CADENCE_GAIN * (2 * cadenceRegularity - 1);

  const holdLift = clamp(1 + HOLD_SLOPE * log1p(medHoldBeats), 1, HOLD_CAP);

  const resonanceLift = 1 + RESONANCE_GAIN * (2 * resonancePhi - 1);

  const ageBeats = agePulses / pulsesPerBeat;
  const ageLift = Math.min(AGE_CAP, 1 + AGE_EPS * log1p(ageBeats));

  const churnPenalty = 1 / (1 + CHURN_KAPPA * Math.max(0, velocityPerBeat));

  const claimMoment = momentRarityLiftFromPulse(claimPulse);
  const lineageMoments = closed
    .map((t) => (Number.isFinite(t.receiverKaiPulse) ? momentRarityLiftFromPulse(t.receiverKaiPulse as number) : 1));
  const lineageGM = geometricMean(lineageMoments);
  const genesisBias = genesisProximityLift(claimPulse);
  const momentLift = claimMoment * Math.max(1, lineageGM) * genesisBias;

  const baselinePremium =
    rarity *
    qf *
    creator *
    prov *
    closureLift *
    cadenceLift *
    holdLift *
    resonanceLift *
    ageLift *
    churnPenalty *
    geomLift *
    momentLift;

  /* ------------------------ dynamic φ-compounding & floor -------------------- */

  const adoptionAtClaim = adoptionIndex01(claimPulse);
  const adoptionNow = adoptionIndex01(nowPulse);
  const adoptionDelta = Math.max(0, adoptionNow - adoptionAtClaim);

  const rarityScore01 = momentRarityScore01FromPulse(claimPulse);
  const k = ADOPTION_GAIN_BASE + ADOPTION_GAIN_RARE * rarityScore01;

  const adoptionLift = Math.exp(k * adoptionDelta);
  const indexScarcity = 1 + INDEX_SCARCITY_GAIN * (1 - adoptionAtClaim);

  const fibLevels   = countFibLevelsSince(agePulses);
  const lucasLevels = countLucasLevelsSince(agePulses);
  const fibAccrualLift   = Math.exp(FIB_STEP_GAIN   * fibLevels);
  const lucasAccrualLift = Math.exp(LUCAS_STEP_GAIN * lucasLevels);

  const dynamicGrowth = indexScarcity * adoptionLift * fibAccrualLift * lucasAccrualLift;

  // Strict monotone rarity floor
  const rarityFloor = 1 * claimMoment * indexScarcity * adoptionLift * fibAccrualLift * lucasAccrualLift * Math.max(1, genesisBias);

  /* --------------------------- live oscillations (φ) ------------------------- */

  // Breath wave
  const breathPhase01 = pulsesPerBeat > 0 ? ((nowPulse % pulsesPerBeat) / pulsesPerBeat) : 0;
  const breathAmp = BREATH_WAVE_GAIN * (0.5 + 0.5 * cadenceRegularity);
  const breathWave = 1 + breathAmp * Math.sin(2 * Math.PI * breathPhase01);

  // Kai-day wave (claim-day ↔ now-day alignment)
  const dayPhase01 = frac(nowPulse / PULSES_PER_DAY_EXACT);
  const claimDayPhase01 = frac(claimPulse / PULSES_PER_DAY_EXACT);
  const daySim = 1 - Math.abs(((dayPhase01 - claimDayPhase01 + 1) % 1) - 0.5) * 2;
  const dayAmp = DAY_WAVE_GAIN * (0.5 + 0.5 * resonancePhi) * (0.5 + 0.5 * cadenceRegularity);
  const dayWave = 1 + dayAmp * (2 * daySim - 1);

  // φ-Beatty strobe (no RNG)
  const { phase01: strobePhase01, wave: strobeWaveVal } = strobeWave(claimPulse, nowPulse);

  // Moment Affinity (use resolved claim step)
  const claimStep = claimStepResolved;
  const nowStep = stepIndexFromPulse(nowPulse, STEPS_PER_BEAT);
  const stepSim = circularSim01(nowStep, claimStep, STEPS_PER_BEAT);

  const claimResid = breathResidFromPulse(claimPulse);
  const nowResid = breathResidFromPulse(nowPulse);
  const breathSim = circularSim01(nowResid, claimResid, PULSES_PER_STEP);

  const phiFracSim = 1 - Math.abs(
    (logPhiFrac01(nowPulse + 1) - logPhiFrac01(claimPulse + 1) + 1) % 1 - 0.5
  ) * 2;

  const claimRareScore = rarityScore01;
  const nowRareScore = momentRarityScore01FromPulse(nowPulse);
  const rareSim = 1 - Math.abs(claimRareScore - nowRareScore);

  const claimMotifs = motifFeatureSet(claimPulse);
  const nowMotifs = motifFeatureSet(nowPulse);
  const motifSim = jaccard01(claimMotifs, nowMotifs);

  const w_step = 0.30, w_breath = 0.30, w_phi = 0.20, w_digit = 0.20;
  const digitBlend = (MOMENT_AFFINITY_DIGIT_WEIGHT * motifSim + (1 - MOMENT_AFFINITY_DIGIT_WEIGHT) * rareSim);
  const momentAffinitySim01 = w_step * stepSim + w_breath * breathSim + w_phi * phiFracSim + w_digit * digitBlend;

  const momentAffinityAmp =
    MOMENT_AFFINITY_GAIN_BASE *
    (0.5 + 0.5 * claimRareScore) *
    (0.5 + 0.5 * resonancePhi);

  const momentAffinityOsc = 1 + momentAffinityAmp * (2 * momentAffinitySim01 - 1);

  // Combine waves (strictly positive; preserves floor)
  const combinedOsc = breathWave * dayWave * strobeWaveVal * momentAffinityOsc;

  /* ----------------------- compose premium with living band ------------------ */

  const premiumPreWave = baselinePremium * dynamicGrowth;
  const premiumBandBase = Math.max(0, premiumPreWave - rarityFloor);
  const premium = rarityFloor + premiumBandBase * combinedOsc;

  // Final value in Φ
  const valuePhi = 1 * premium + pv_phi;

  const headRef = {
    headHash: undefined as HashHex | undefined,
    transfersWindowRoot: meta.transfersWindowRoot,
    cumulativeTransfers: meta.cumulativeTransfers ?? transfers.length,
  };

  const inputs: ValueInputs = {
    // existing
    size,
    quality,
    creatorVerified: !!meta.creatorVerified,
    creatorRep: meta.creatorRep ?? 0,
    uniqueHolders,
    closedFraction,
    cadenceRegularity,
    medianHoldBeats: medHoldBeats,
    velocityPerBeat,
    resonancePhi,
    pulsesPerBeat,
    agePulses,
    geometryLift: geomLift,
    momentLift,
    pv_phi,

    // growth & rarity diagnostics
    algorithmVersion: "phi/kosmos-vφ-5",
    adoptionAtClaim,
    adoptionNow,
    adoptionDelta,
    rarityScore01,
    fibAccrualLevels: fibLevels,
    lucasAccrualLevels: lucasLevels,
    indexScarcity,
    adoptionLift,
    fibAccrualLift,
    lucasAccrualLift,

    // live moment diagnostics
    breathPhase01,
    breathWave,
    dayPhase01,
    dayWave,
    strobePhase01,
    strobeWave: strobeWaveVal,
    momentAffinitySim01,
    momentAffinityAmp,
    momentAffinityOsc,
    combinedOsc,

    // band/floor
    dynamicGrowth,
    rarityFloor,
    premiumBandBase,
  };

  // ---- use hoisted checksum (unchanged value, stable reference) ----
  const checksum = POLICY_CHECKSUM;

  const unsignedRaw: UnsignedSeal = {
    version: 1 as const,
    unit: "Φ" as const,
    algorithm: "phi/kosmos-vφ-5" as const,
    policyId: meta.valuationPolicyId,
    policyChecksum: checksum,
    valuePhi,
    premium,
    inputs,
    computedAtPulse: nowPulse,
    headRef,
  };

  const stampPayload = stableStringify({
    algorithm: unsignedRaw.algorithm,
    policy: unsignedRaw.policyId ?? null,
    policyChecksum: unsignedRaw.policyChecksum,
    inputs: unsignedRaw.inputs,
    minimalHead: {
      headHash: unsignedRaw.headRef.headHash ?? null,
      transfersWindowRoot: unsignedRaw.headRef.transfersWindowRoot ?? null,
      cumulativeTransfers: unsignedRaw.headRef.cumulativeTransfers,
    },
  });

  // ---- MEMOIZATION for referential stability (prevents render loops) ----
  const cached = __unsignedCache.get(stampPayload);
  if (cached) {
    return { unsigned: cached, stampPayload };
  }
  const stableUnsigned = freezeUnsigned({
    ...unsignedRaw,
    inputs: { ...unsignedRaw.inputs },
    headRef: { ...unsignedRaw.headRef },
  });
  __unsignedCache.set(stampPayload, stableUnsigned);
  return { unsigned: stableUnsigned, stampPayload };
}

/** Build a full ValueSeal by hashing the canonical payload with the provided hasher. */
export async function buildValueSeal(
  meta: SigilMetadataLite,
  nowPulse: number,
  hasher: (s: string) => Promise<string>,
  headHash?: HashHex
): Promise<{ seal: ValueSeal }> {
  const { unsigned, stampPayload } = computeIntrinsicUnsigned(meta, nowPulse);
  // Do NOT mutate cached unsigned; clone when injecting headHash
  const unsignedWithHead: UnsignedSeal = {
    ...unsigned,
    headRef: { ...unsigned.headRef, headHash },
  };
  const stamp = await hasher(stampPayload);
  return { seal: { ...(unsignedWithHead as ValueSeal), stamp } };
}

/** Attach a valuation into metadata (typed; no `any`). */
export function attachValuation<T extends object>(meta: T, seal: ValueSeal): T & { valuation: ValueSeal } {
  return { ...(meta as T), valuation: seal };
}

/** Verify an embedded valuation: recompute at its original pulse and compare + restamp. */
export async function verifyValuation<T extends SigilMetadataLite & { valuation?: ValueSeal }>(
  meta: T,
  hasher: (s: string) => Promise<string>
) {
  if (!meta.valuation) return { ok: false as const, reason: "absent" as const };
  const v = meta.valuation;
  const { unsigned, stampPayload } = computeIntrinsicUnsigned(meta, v.computedAtPulse);
  const expectedStamp = await hasher(stampPayload);

  const ok =
    Math.abs(unsigned.valuePhi - v.valuePhi) < 1e-12 &&
    Math.abs(unsigned.premium - v.premium) < 1e-12 &&
    expectedStamp === v.stamp &&
    unsigned.policyChecksum === v.policyChecksum;

  return { ok, expected: { ...unsigned, stamp: expectedStamp } };
}

/* ------------------------------ Explainability ------------------------------ */
/** Human-readable evidence so rarity feels *earned* (truth shown). */
export function explainValuation(seal: ValueSeal): string {
  const i = seal.inputs;
  const lines = [
    `Algorithm: ${seal.algorithm} • Policy checksum: ${seal.policyChecksum}`,
    `Series rarity: size=${i.size} → rarityFactor≈${(i.size <= 1 ? RARITY_ONE_OF_ONE : Math.pow(i.size, -RARITY_EXP))}`,
    `Moment lifts: geometry=${i.geometryLift} × numericMoment=${i.momentLift} × genesis/baseline floor=${i.rarityFloor}`,
    `Adoption field: ΔA=${i.adoptionDelta} → adoptionLift=${i.adoptionLift} • indexScarcity=${i.indexScarcity} • fibLevels=${i.fibAccrualLevels} • lucasLevels=${i.lucasAccrualLevels}`,
    `Live alignment: breath=${i.breathWave} • day=${i.dayWave} • strobe=${i.strobeWave} • affinity=${i.momentAffinityOsc} → combined=${i.combinedOsc}`,
    `Premium: floor=${i.rarityFloor} + band=${i.premiumBandBase} × combined=${i.combinedOsc} ⇒ premium=${seal.premium} → valueΦ=${seal.valuePhi}`
  ];
  return lines.join("\n");
}

/* ====================== PUBLIC ENHANCEMENTS (requested) ===================== */

/** 1) Public rarity score accessor (pre-mint planners) */
export function rarityScore01FromPulse(pulse: number): number {
  return momentRarityScore01FromPulse(pulse);
}

/** 2) Human-friendly rarity breakdown */
export function explainRarity(pulse: number): string[] {
  const out: string[] = [];
  const s = absDigits(pulse);
  const len = s.length;

  if (isFibonacciExact(pulse)) out.push(`✓ Fibonacci exact (+${(MOMENT_FIB_EXACT_GAIN*100)}%)`);
  if (isLucasExact(pulse))     out.push(`✓ Lucas exact (+${(MOMENT_LUCAS_EXACT_GAIN*100)}%)`);
  if (phiTransitionIndexFromPulse(pulse) !== null) out.push(`✓ φ-spiral transition (+${(MOMENT_PHI_TRANSITION_GAIN*100)}%)`);

  if (allSameDigit(s)) out.push(`✓ Uniform digits (${s[0].repeat(Math.max(1, len))}) (+${(MOMENT_UNIFORM_GAIN*100)}%)`);
  if (isPalindromeDigits(s)) out.push(`✓ Palindrome (+${(MOMENT_PAL_GAIN*100)}%)`);

  const { len: runLen, digit } = longestRunDigitInfo(s);
  if (runLen >= 3) {
    const norm = clamp((runLen - 2) / Math.max(3, len - 2), 0, 1);
    out.push(`✓ Long digit run (${runLen}×${digit}) (+${(MOMENT_RUN_GAIN*norm*100)}%)`);
  }

  const seq = longestConsecutiveSequenceLen(s);
  if (seq >= 4) {
    const norm = clamp((seq - 3) / Math.max(4, len - 3), 0, 1);
    out.push(`✓ Consecutive sequence (len ${seq}) (+${(MOMENT_SEQ_GAIN*norm*100)}%)`);
  }

  const ent = digitEntropy01(s);
  if (ent < 1) out.push(`✓ Low entropy (digit uniformity) (+${(MOMENT_LOW_ENTROPY_GAIN*(1-ent)*100)}%)`);

  if (out.length === 0) out.push("• Clean moment (no special digit motifs)");
  return out;
}
/** 3) Live resonance breakdown of oscillators (pure φ; no RNG)
    Optional overrides for cadence/resonance/steps for custom contexts.
*/
export function explainOscillation(
  claimPulse: number,
  nowPulse: number,
  opts?: { stepsPerBeat?: number; cadenceRegularity?: number; resonancePhi?: number; stepIndexClaimOverride?: number }
): {
  breathWave: number; dayWave: number; strobeWave: number; momentAffinity: number; combinedOsc: number;
  breathPhase01: number; dayPhase01: number; strobePhase01: number; momentAffinitySim01: number; momentAffinityAmp: number;
} {
  const STEPS = coerceStepsPerBeat(opts?.stepsPerBeat);
  const pulsesPerBeat = STEPS * PULSES_PER_STEP;
  const cadence = typeof opts?.cadenceRegularity === "number" ? clamp(opts.cadenceRegularity, 0, 1) : 1;
  const resonance = typeof opts?.resonancePhi === "number" ? clamp(opts.resonancePhi, 0, 1) : 0.5;

  // breath
  const breathPhase01 = pulsesPerBeat > 0 ? ((nowPulse % pulsesPerBeat) / pulsesPerBeat) : 0;
  const breathAmp = BREATH_WAVE_GAIN * (0.5 + 0.5 * cadence);
  const breathWave = 1 + breathAmp * Math.sin(2 * Math.PI * breathPhase01);

  // day
  const dayPhase01 = frac(nowPulse / PULSES_PER_DAY_EXACT);
  const claimDayPhase01 = frac(claimPulse / PULSES_PER_DAY_EXACT);
  const daySim = 1 - Math.abs(((dayPhase01 - claimDayPhase01 + 1) % 1) - 0.5) * 2;
  const dayAmp = DAY_WAVE_GAIN * (0.5 + 0.5 * resonance) * (0.5 + 0.5 * cadence);
  const dayWave = 1 + dayAmp * (2 * daySim - 1);

  // affinity
  const claimStep = typeof opts?.stepIndexClaimOverride === "number"
    ? clamp(Math.trunc(opts.stepIndexClaimOverride), 0, STEPS - 1)
    : stepIndexFromPulse(claimPulse, STEPS);
  const nowStep = stepIndexFromPulse(nowPulse, STEPS);
  const stepSim = circularSim01(nowStep, claimStep, STEPS);

  const claimResid = breathResidFromPulse(claimPulse);
  const nowResid = breathResidFromPulse(nowPulse);
  const breathSim = circularSim01(nowResid, claimResid, PULSES_PER_STEP);

  const phiFracSim = 1 - Math.abs((logPhiFrac01(nowPulse + 1) - logPhiFrac01(claimPulse + 1) + 1) % 1 - 0.5) * 2;

  const claimRareScore = momentRarityScore01FromPulse(claimPulse);
  const nowRareScore = momentRarityScore01FromPulse(nowPulse);
  const rareSim = 1 - Math.abs(claimRareScore - nowRareScore);

  const claimMotifs = motifFeatureSet(claimPulse);
  const nowMotifs = motifFeatureSet(nowPulse);
  const motifSim = jaccard01(claimMotifs, nowMotifs);

  // φ-Beatty strobe
  const { phase01: strobePhase01, wave: strobeWaveVal } = strobeWave(claimPulse, nowPulse);

  const w_step = 0.30, w_breath = 0.30, w_phi = 0.20, w_digit = 0.20;
  const digitBlend = (MOMENT_AFFINITY_DIGIT_WEIGHT * motifSim + (1 - MOMENT_AFFINITY_DIGIT_WEIGHT) * rareSim);
  const momentAffinitySim01 = w_step * stepSim + w_breath * breathSim + w_phi * phiFracSim + w_digit * digitBlend;

  const momentAffinityAmp = MOMENT_AFFINITY_GAIN_BASE * (0.5 + 0.5 * claimRareScore) * (0.5 + 0.5 * resonance);
  const momentAffinity = 1 + momentAffinityAmp * (2 * momentAffinitySim01 - 1);

  const combinedOsc = breathWave * dayWave * strobeWaveVal * momentAffinity;

  return {
    breathWave,
    dayWave,
    strobeWave: strobeWaveVal,
    momentAffinity,
    combinedOsc,
    breathPhase01,
    dayPhase01,
    strobePhase01,
    momentAffinitySim01,
    momentAffinityAmp,
  };
}


/** 4) Provenance diagnostic narrative (per-transfer) */
export function explainLineage(
  transfers: SigilTransfer[],
  opts?: { stepsPerBeat?: number }
): string[] {
  const STEPS = coerceStepsPerBeat(opts?.stepsPerBeat);
  const pulsesPerBeat = STEPS * PULSES_PER_STEP;
  const closed = closedTransfers(transfers);

  const lines: string[] = [];
  closed.forEach((t, idx) => {
    const n = idx + 1;
    const holdBeats = (t.receiverKaiPulse! - t.senderKaiPulse) / pulsesPerBeat;
    const moments: string[] = [];
    if (isFibonacciExact(t.receiverKaiPulse!)) moments.push("Fibonacci pulse");
    if (isLucasExact(t.receiverKaiPulse!)) moments.push("Lucas pulse");
    const ds = absDigits(t.receiverKaiPulse!);
    if (allSameDigit(ds)) moments.push("uniform digits");
    if (isPalindromeDigits(ds)) moments.push("palindrome");
    const run = longestRunSameDigit(ds);
    if (run >= 4) { const { digit } = longestRunDigitInfo(ds); moments.push(`long run (${run}×${digit})`); }

    let stewardship = "";
    if (holdBeats < 5) stewardship = "quick flip → churn penalty";
    else if (holdBeats < 20) stewardship = `held ${holdBeats} beats`;
    else stewardship = `held ${holdBeats} beats (strong stewardship)`;

    const momentStr = moments.length ? ` + ${moments.join(" • ")}` : "";
    lines.push(`Transfer ${n}: ${stewardship}${momentStr}`);
  });
  if (!lines.length) lines.push("No closed transfers yet — lineage still forming.");
  return lines;
}

/** 5) Resonance pairing score between two pulses */
export function motifSimilarity(pulseA: number, pulseB: number): number {
  const sA = motifFeatureSet(pulseA), sB = motifFeatureSet(pulseB);
  const j = jaccard01(sA, sB);
  const rA = momentRarityScore01FromPulse(pulseA);
  const rB = momentRarityScore01FromPulse(pulseB);
  const rareSim = 1 - Math.abs(rA - rB);
  const sim = MOMENT_AFFINITY_DIGIT_WEIGHT * j + (1 - MOMENT_AFFINITY_DIGIT_WEIGHT) * rareSim;
  return sim;
}

/** 6) Export an “Explainable Scroll”: JSON + Markdown + SVG */
export function toExplainableScroll(
  seal: ValueSeal,
  opts?: { title?: string; width?: number; padding?: number }
): { seal: ValueSeal; scrollText: string; scrollSVG: string } {
  const title = opts?.title ?? "Kai-Sigil Valuation Scroll";
  const md = [
    `# ${title}`,
    "",
    "```",
    explainValuation(seal),
    "```",
    "",
    "### Rarity Evidence",
    ...explainRarity(seal.computedAtPulse).map(s => "- " + s)
  ].join("\n");

  // simple, printable SVG with φ-aesthetics
  const W = opts?.width ?? 800, P = opts?.padding ?? 24, LH = 20;
  const lines = explainValuation(seal).split("\n");
  const body = lines.map((ln, i) =>
    `<text x="${P}" y="${P + 60 + i*LH}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="14">${escapeXML(ln)}</text>`
  ).join("");
  const header = `<text x="${P}" y="${P + 24}" font-family="serif" font-size="24" font-weight="600">` +
                 `${escapeXML(title)} · φ</text>`;
  const h = P + 80 + lines.length*LH + P;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-opacity="0.06"/><stop offset="1" stop-opacity="0.12"/></linearGradient>
    </defs>
    <rect x="0" y="0" width="${W}" height="${h}" fill="white"/>
    <rect x="${P/2}" y="${P/2}" width="${W-P}" height="${h-P}" fill="url(#g)" rx="${P/2}"/>
    ${header}
    ${body}
  </svg>`;

  return { seal, scrollText: md, scrollSVG: svg };
}

function escapeXML(s: string): string {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

/* ----------------------------- TRUST & TIERING ------------------------------ */

/** 13) Trust grade (1–5 stars) */
export function computeTrustGrade(
  inputs: ValueInputs,
  opts?: {
    weights?: {
      creatorRep?: number; closedFraction?: number; medianHoldBeats?: number; pv_phi?: number; verified?: number;
    };
  }
): { stars: 1|2|3|4|5; score01: number; reasons: string[] } {
  const w = Object.assign({
    creatorRep: 0.30,
    closedFraction: 0.25,
    medianHoldBeats: 0.20,
    pv_phi: 0.15,
    verified: 0.10
  }, opts?.weights ?? {});

  const holdScore = clamp(log1p(inputs.medianHoldBeats) / Math.log(1 + 55), 0, 1); // ~50 beats ~ 0.9
  const pvScore = inputs.pv_phi > 0 ? clamp(log1p(inputs.pv_phi) / Math.log(1 + 3), 0, 1) : 0;
  const verified = inputs.creatorVerified ? 1 : 0;

  const score01 = clamp(
    w.creatorRep*clamp(inputs.creatorRep,0,1) +
    w.closedFraction*clamp(inputs.closedFraction,0,1) +
    w.medianHoldBeats*holdScore +
    w.pv_phi*pvScore +
    w.verified*verified, 0, 1
  );

  const stars = ((): 1|2|3|4|5 => {
    if (score01 >= 0.86) return 5;
    if (score01 >= 0.70) return 4;
    if (score01 >= 0.50) return 3;
    if (score01 >= 0.30) return 2;
    return 1;
  })();

  const reasons: string[] = [];
  if (inputs.creatorVerified) reasons.push("Creator verified");
  if (inputs.creatorRep > 0.7) reasons.push(`High creator rep (${inputs.creatorRep*100}%)`);
  if (inputs.closedFraction > 0.66) reasons.push(`Strong closure (${inputs.closedFraction*100}%)`);
  if (inputs.medianHoldBeats > 20) reasons.push(`Good stewardship (${inputs.medianHoldBeats} beats)`);
  if (inputs.pv_phi > 0) reasons.push(`Intrinsic IP present (${inputs.pv_phi} Φ)`);

  return { stars, score01, reasons };
}

/** 14) Market tiering by rarity type */
export function classifyMarketTier(
  claimPulse: number,
  seal?: ValueSeal
): { tier: "I"|"II"|"III"|"IV"|"V"; label: string; reason: string } {
  const inputs = seal?.inputs;
  if (isFibonacciExact(claimPulse)) return { tier: "I", label: "Fibonacci Moment", reason: "Claim pulse is an exact Fibonacci number." };
  if (isLucasExact(claimPulse))     return { tier: "I", label: "Lucas Moment",     reason: "Claim pulse is an exact Lucas number." };

  if (inputs && inputs.closedFraction >= 0.66 && inputs.medianHoldBeats >= 20) {
    return { tier: "II", label: "Lineage Stewardship", reason: "High closure and long median holds." };
  }

  if (seal && inputs && inputs.combinedOsc >= 1.0 + MOMENT_AFFINITY_GAIN_BASE*0.5) {
    return { tier: "III", label: "High Oscillation", reason: "Strong live alignment (combined oscillators > baseline)." };
  }

  const s = absDigits(claimPulse);
  if (allSameDigit(s) || isPalindromeDigits(s)) {
    return { tier: "IV", label: "Digit Geometry", reason: allSameDigit(s) ? "Uniform digits" : "Palindrome digits" };
  }

  return { tier: "V", label: "Clean Moment", reason: "No special numeric motif (still pure)." };
}

/* ------------------------------ KAIROS SCANNER ------------------------------ */

/** 7) Kairos Mint Scanner data generator */
export function scanKairosWindow(
  startPulse: number,
  count: number,
  step = 1,
  opts?: { stepsPerBeat?: number }
): Array<{
  pulse: number; rarity01: number; tags: string[]; breathPhase01: number; strobeWave: number; dayPhase01: number;
}> {
  const STEPS = coerceStepsPerBeat(opts?.stepsPerBeat);
  const pulsesPerBeat = STEPS * PULSES_PER_STEP;
  const arr: Array<{ pulse: number; rarity01: number; tags: string[]; breathPhase01: number; strobeWave: number; dayPhase01: number; }> = [];
  for (let i = 0, p = startPulse; i < count; i++, p += step) {
    const tags: string[] = [];
    if (isFibonacciExact(p)) tags.push("FIB");
    if (isLucasExact(p)) tags.push("LUC");
    if (phiTransitionIndexFromPulse(p) !== null) tags.push("PHI△");
    const ds = absDigits(p);
    if (allSameDigit(ds)) tags.push("UNI");
    if (isPalindromeDigits(ds)) tags.push("PAL");
    const breathPhase01 = pulsesPerBeat > 0 ? ((p % pulsesPerBeat) / pulsesPerBeat) : 0;
    const { wave: stro } = strobeWave(startPulse, p);
    const dayPhase01 = frac(p / PULSES_PER_DAY_EXACT);
    arr.push({
      pulse: p,
      rarity01: momentRarityScore01FromPulse(p),
      tags,
      breathPhase01,
      strobeWave: stro,
      dayPhase01,
    });
  }
  return arr;
}

/* ------------------------------ SIGIL AUDIO -------------------------------- */

/** 8) Sigil Sound Generator — render a short WAV (16-bit PCM) */
export function renderSigilWav(
  pulse: number,
  seconds = 2.0,
  sampleRate = 44100,
  opts?: { stepsPerBeat?: number; stereo?: boolean; baseHz?: number }
): { wav: Uint8Array; dataURI: string } {
  const stereo = opts?.stereo ?? true;
  const channels = stereo ? 2 : 1;
  const N = Math.max(1, Math.floor(seconds * sampleRate));
  const baseHz = opts?.baseHz ?? 220; // A3-like base

  // Map φ-fraction + stepIndex to a musical frequency
  const STEPS = coerceStepsPerBeat(opts?.stepsPerBeat);
  const stepIdx = stepIndexFromPulse(pulse, STEPS);
  const phiFrac = logPhiFrac01(pulse + 1); // [0..1)
  const semitoneSpan = 24; // 2 octaves
  const detune = (phiFrac - 0.5) * semitoneSpan;
  const freq = baseHz * Math.pow(2, (stepIdx / STEPS) * 12 / 12) * Math.pow(2, detune / 12);

  const buf = new Int16Array(N * channels);
  for (let i = 0; i < N; i++) {
    const t = i / sampleRate;
    // gentle φ-chorus: two close sines detuned by φ cents
    const s1 = Math.sin(2*Math.PI*freq*t);
    const s2 = Math.sin(2*Math.PI*(freq*Math.pow(2, 1/(1200*PHI)))*t);
    const mono = (s1 + s2) * 0.5 * 0.6; // headroom
    if (stereo) {
      const pan = 0.5 + 0.5 * Math.sin(2*Math.PI*phiFrac*t); // phi-based slow pan
      const L = mono * (1 - pan);
      const R = mono * pan;
      buf[i*2]   = (L * 32767) | 0;
      buf[i*2+1] = (R * 32767) | 0;
    } else {
      buf[i] = (mono * 32767) | 0;
    }
  }

  // WAV header
  const byteRate = sampleRate * channels * 2;
  const blockAlign = channels * 2;
  const dataLen = buf.byteLength;
  const riffLen = 36 + dataLen;
  const header = new Uint8Array(44);
  writeStr(header, 0, "RIFF");
  writeU32LE(header, 4, riffLen);
  writeStr(header, 8, "WAVE");
  writeStr(header, 12, "fmt ");
  writeU32LE(header, 16, 16);      // PCM chunk size
  writeU16LE(header, 20, 1);       // PCM
  writeU16LE(header, 22, channels);
  writeU32LE(header, 24, sampleRate);
  writeU32LE(header, 28, byteRate);
  writeU16LE(header, 32, blockAlign);
  writeU16LE(header, 34, 16);      // bits per sample
  writeStr(header, 36, "data");
  writeU32LE(header, 40, dataLen);

  const wav = new Uint8Array(44 + dataLen);
  wav.set(header, 0);
  wav.set(new Uint8Array(buf.buffer), 44);

  const dataURI = "data:audio/wav;base64," + base64FromBytes(wav);
  return { wav, dataURI };
}

function writeStr(a: Uint8Array, off: number, s: string) { for (let i=0;i<s.length;i++) a[off+i] = s.charCodeAt(i); }
function writeU16LE(a: Uint8Array, off: number, v: number) { a[off] = v & 0xff; a[off+1] = (v>>8)&0xff; }
function writeU32LE(a: Uint8Array, off: number, v: number) { a[off] = v & 0xff; a[off+1] = (v>>8)&0xff; a[off+2] = (v>>16)&0xff; a[off+3] = (v>>24)&0xff; }
function base64FromBytes(u8: Uint8Array): string {
  let s = ""; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return typeof btoa === "function" ? btoa(s) : Buffer.from(s, "binary").toString("base64");
}

/* ------------------------- KAIROS SPIRAL VISUALIZER ------------------------- */

/** 9) Golden (log) spiral SVG with pulse marker and hotspots */
export function renderKairosSpiralSVG(
  pulse: number,
  opts?: { width?: number; height?: number; turns?: number; stroke?: number }
): string {
  const W = opts?.width ?? 800, H = opts?.height ?? 800, CX = W/2, CY = H/2;
  const turns = opts?.turns ?? 3.5;
  const stroke = opts?.stroke ?? 1.5;

  // Log spiral: r = a * φ^(k*θ), choose a so that radius fits canvas
  const a = Math.min(W, H) * 0.02;
  const k = 1 / (Math.PI/2); // quadrant -> φ scaling
  const steps = 1200;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const θ = (i/steps) * (2*Math.PI*turns);
    const r = a * Math.pow(PHI, k*θ);
    const x = CX + r * Math.cos(θ);
    const y = CY + r * Math.sin(θ);
    d += (i===0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
  }

  const fib = isFibonacciExact(pulse);
  const luc = isLucasExact(pulse);
  const phiTran = phiTransitionIndexFromPulse(pulse) !== null;
  const ds = absDigits(pulse);
  const pal = isPalindromeDigits(ds);
  const uni = allSameDigit(ds);

  const markerR = 5 + 6*rarityScore01FromPulse(pulse);
  // place marker at angle by φ-fraction
  const θp = 2*Math.PI*logPhiFrac01(pulse + 1);
  const rp = a * Math.pow(PHI, k*θp);
  const mx = CX + rp*Math.cos(θp), my = CY + rp*Math.sin(θp);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="white"/>
    <path d="${d}" fill="none" stroke="black" stroke-width="${stroke}"/>
    <circle cx="${mx}" cy="${my}" r="${markerR}" fill="none" stroke="black" stroke-width="1.25"/>
    <text x="${mx+10}" y="${my-10}" font-size="12" font-family="ui-sans-serif, system-ui">pulse ${pulse}</text>
    <g font-size="12" font-family="ui-sans-serif, system-ui">
      <text x="${W-260}" y="${H-108}">Fibonacci: ${fib ? "✓" : "–"}</text>
      <text x="${W-260}" y="${H-90}">Lucas: ${luc ? "✓" : "–"}</text>
      <text x="${W-260}" y="${H-72}">φ transition: ${phiTran ? "✓" : "–"}</text>
      <text x="${W-260}" y="${H-54}">Palindrome: ${pal ? "✓" : "–"}</text>
      <text x="${W-260}" y="${H-36}">Uniform: ${uni ? "✓" : "–"}</text>
      <text x="${W-260}" y="${H-18}">Rarity score: ${rarityScore01FromPulse(pulse)}</text>
    </g>
  </svg>`;
}

/* -------------------------- FRONTEND-FRIENDLY UTIL -------------------------- */

/** 10) HTML scroll renderer (print to PDF externally if desired) */
export function renderScrollHTML(seal: ValueSeal, opts?: { title?: string }): string {
  const { scrollText, scrollSVG } = toExplainableScroll(seal, { title: opts?.title });
  const pre = escapeHTML(scrollText).replace(/\n/g, "<br/>");
  return `<!doctype html><html><head><meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>${escapeHTML(opts?.title ?? "Kai-Sigil Scroll")}</title>
    <style>
      body{font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto; margin:0; color:#111;}
      .wrap{max-width:900px; margin:40px auto; padding:24px}
      h1{font-size:28px; margin:0 0 12px}
      .card{background:#fafafa; border:1px solid #eee; border-radius:16px; padding:16px}
      pre{font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:14px; white-space:pre-wrap}
      svg{width:100%; height:auto; display:block}
    </style></head><body>
      <div class="wrap">
        <h1>${escapeHTML(opts?.title ?? "Kai-Sigil Scroll")}</h1>
        <div class="card"><pre>${pre}</pre></div>
        <div style="height:18px"></div>
        <div class="card">${scrollSVG}</div>
      </div>
    </body></html>`;
}
function escapeHTML(s: string): string {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

/* ---------------------- ZK PROOF INTEGRATION HOOKS ------------------------- */

/** Attach a ZK proof produced externally (e.g., snarkjs) */
export function attachZkProof(seal: ValueSeal, proof: ZkProof): ValueSeal {
  return { ...seal, zkProof: proof };
}

/** Verify a provided ZK proof via caller-supplied verifier (typed hook).
    The verifier should ensure the Poseidon(publicInputs) equals proof.publicInputsHash. */
export async function verifyZkProof(
  seal: ValueSeal,
  verifier: (proof: ZkProof, publicInputs: JSONValue) => Promise<boolean>
): Promise<boolean> {
  if (!seal.zkProof) return false;
  const publicInputs: JSONValue = {
    algorithm: seal.algorithm,
    policyChecksum: seal.policyChecksum,
    inputs: seal.inputs as unknown as JSONValue, // structurally JSON-serializable
    minimalHead: {
      headHash: seal.headRef.headHash ?? null,
      transfersWindowRoot: seal.headRef.transfersWindowRoot ?? null,
      cumulativeTransfers: seal.headRef.cumulativeTransfers
    }
  };
  return verifier(seal.zkProof, publicInputs);
}

/* ============================ THAT’S THE SCROLL ============================ */
