// src/components/valuation/rarity.ts
// φ-aligned rarity helpers — mirrors valuation.ts (vφ-5 “Harmonia”)

export const PHI = ((1 + Math.sqrt(5)) / 2) satisfies number;


// ---- Canon time approximations (for genesis lift default) ----
export const PULSES_PER_DAY_EXACT = 17491.270421;
export const YEAR_PULSES_APPROX = PULSES_PER_DAY_EXACT * 365;

// ---- φ-scaled gains (match valuation.ts) ----
export const MOMENT_FIB_EXACT_GAIN   = 1 / PHI;          // ≈ +61.8%
export const MOMENT_LUCAS_EXACT_GAIN = 1 / PHI ** 2;     // ≈ +38.2%
export const MOMENT_UNIFORM_GAIN     = 1 / PHI ** 3;     // ≈ +23.6%
export const MOMENT_PAL_GAIN         = 1 / PHI ** 4;     // ≈ +14.6%
export const MOMENT_RUN_GAIN         = 1 / PHI ** 4;     // scaled by run length
export const MOMENT_SEQ_GAIN         = 1 / PHI ** 5;     // scaled by seq length
export const MOMENT_LOW_ENTROPY_GAIN = 1 / PHI ** 6;     // scaled by (1 - entropy)
export const GENESIS_BIAS_GAIN       = 1 / PHI ** 5;

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

// ----------------------------- BigInt helpers ------------------------------
function bigintSqrt(n: bigint): bigint {
  if (n < 0n) throw new Error("sqrt negative");
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

// ----------------------------- Motif tests ---------------------------------
export function isFibonacciExact(n: number): boolean {
  if (!Number.isFinite(n) || n < 0) return false;
  const k = BigInt(Math.trunc(Math.abs(n)));
  const a = 5n * k * k + 4n;
  const b = 5n * k * k - 4n;
  return isPerfectSquareBig(a) || isPerfectSquareBig(b);
}

export function isLucasExact(n: number): boolean {
  if (!Number.isFinite(n) || n < 0) return false;
  const target = BigInt(Math.trunc(Math.abs(n)));
  let a = 2n, b = 1n; // L0=2, L1=1
  while (b < target) { const t = a + b; a = b; b = t; }
  return b === target;
}

export function absDigits(n: number): string {
  return Math.abs(Math.trunc(n)).toString();
}

export const allSameDigit = (s: string) =>
  s.length > 1 && s.split("").every((c) => c === s[0]);

export function isPalindromeDigits(s: string): boolean {
  if (s.length <= 1) return false;
  for (let i = 0, j = s.length - 1; i < j; i++, j--) if (s[i] !== s[j]) return false;
  return true;
}

// Longest run of the same digit (compat + info)
export function longestRunSameDigit(s: string): { run: number; digit: string } {
  if (s.length === 0) return { run: 0, digit: "" };
  let max = 1, digit = s[0], cur = 1, curDigit = s[0];
  for (let i = 1; i < s.length; i++) {
    if (s[i] === s[i - 1]) { cur++; curDigit = s[i]; if (cur > max) { max = cur; digit = curDigit; } }
    else { cur = 1; curDigit = s[i]; }
  }
  return { run: max, digit };
}
export function longestRunDigitInfo(s: string): { len: number; digit: string } {
  const { run, digit } = longestRunSameDigit(s);
  return { len: run, digit };
}

// Longest consecutive sequence (±1 step)
export function longestConsecutiveSequence(s: string): { len: number; dir: "up" | "down" | "none" } {
  if (s.length <= 1) return { len: 1, dir: "none" };
  let maxLen = 1, curLen = 1, dir: -1 | 0 | 1 = 0, best: "up" | "down" | "none" = "none";
  for (let i = 1; i < s.length; i++) {
    const a = s.charCodeAt(i - 1) - 48;
    const b = s.charCodeAt(i) - 48;
    const step = b - a;
    if (step === dir && (step === 1 || step === -1)) curLen++;
    else if (step === 1 || step === -1) { dir = step; curLen = 2; }
    else { dir = 0; curLen = 1; }
    if (curLen > maxLen) { maxLen = curLen; best = dir === 1 ? "up" : dir === -1 ? "down" : best; }
  }
  return { len: maxLen, dir: best };
}
export function longestConsecutiveSequenceLen(s: string): number {
  return longestConsecutiveSequence(s).len;
}

// Digit entropy in [0..1]
export function digitEntropy01(s: string): number {
  if (s.length === 0) return 1;
  const cnt = Array(10).fill(0);
  for (const ch of s) cnt[ch.charCodeAt(0) - 48]++;
  let H = 0;
  for (const c of cnt) if (c) { const p = c / s.length; H -= p * Math.log(p); }
  const Hmax = Math.log(Math.min(10, s.length));
  return clamp(H / (Hmax || 1), 0, 1);
}

// ----------------------------- Rarity lifts ---------------------------------
export function momentRarityLiftFromPulse(pulse: number): number {
  if (!Number.isFinite(pulse) || pulse < 0) return 1.0;
  const s = absDigits(pulse), len = s.length;
  let lift = 1.0;

  if (isFibonacciExact(pulse)) lift *= 1 + MOMENT_FIB_EXACT_GAIN;
  if (isLucasExact(pulse))     lift *= 1 + MOMENT_LUCAS_EXACT_GAIN;

  if (allSameDigit(s))       lift *= 1 + MOMENT_UNIFORM_GAIN;
  if (isPalindromeDigits(s)) lift *= 1 + MOMENT_PAL_GAIN;

  const { len: runLen } = longestRunDigitInfo(s);
  if (runLen >= 3) {
    const norm = clamp((runLen - 2) / Math.max(3, len - 2), 0, 1);
    lift *= 1 + MOMENT_RUN_GAIN * norm;
  }

  const seqLen = longestConsecutiveSequenceLen(s);
  if (seqLen >= 4) {
    const norm = clamp((seqLen - 3) / Math.max(4, len - 3), 0, 1);
    lift *= 1 + MOMENT_SEQ_GAIN * norm;
  }

  const ent = digitEntropy01(s);
  lift *= 1 + MOMENT_LOW_ENTROPY_GAIN * (1 - ent);

  return lift;
}

// Score in [0..1] used by valuation for adoption shaping
export function rarityScore01FromPulse(pulse: number): number {
  if (!Number.isFinite(pulse) || pulse < 0) return 0;
  const s = absDigits(pulse), len = s.length;
  let score = 0, wsum = 0;

  const w1   = 1.0;          // Fib
  const wLuc = 1 / PHI;      // Lucas
  const wUni = 1 / PHI;      // uniform digits
  const wPal = 1 / PHI ** 2; // palindrome
  const wRun = 1 / PHI ** 2; // run
  const wSeq = 1 / PHI ** 3; // sequence
  const wEnt = 1 / PHI ** 3; // low entropy

  const fib = isFibonacciExact(pulse) ? 1 : 0; score += w1 * fib;   wsum += w1;
  const luc = isLucasExact(pulse) ? 1 : 0;     score += wLuc * luc; wsum += wLuc;

  const uni = allSameDigit(s) ? 1 : 0;         score += wUni * uni; wsum += wUni;
  const pal = isPalindromeDigits(s) ? 1 : 0;   score += wPal * pal; wsum += wPal;

  const { len: runLen } = longestRunDigitInfo(s);
  const runNorm = clamp((runLen - 2) / Math.max(3, len - 2), 0, 1);
  score += wRun * runNorm; wsum += wRun;

  const seqLen = longestConsecutiveSequenceLen(s);
  const seqNorm = clamp((seqLen - 3) / Math.max(4, len - 3), 0, 1);
  score += wSeq * seqNorm; wsum += wSeq;

  const ent = digitEntropy01(s);
  score += wEnt * (1 - ent); wsum += wEnt;

  return wsum > 0 ? clamp(score / wsum, 0, 1) : 0;
}

// Genesis proximity (default uses year pulses from canon)
export function genesisProximityLift(claimPulse: number, yearPulsesApprox: number = YEAR_PULSES_APPROX): number {
  if (!Number.isFinite(claimPulse) || claimPulse < 0) return 1.0;
  const t = claimPulse / (claimPulse + yearPulsesApprox);
  return 1 + GENESIS_BIAS_GAIN * (1 - 2 * t);
}
