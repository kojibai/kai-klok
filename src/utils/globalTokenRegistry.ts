// src/utils/globalTokenRegistry.ts
// ✨ Sovereign Global Token Registry (Kai-Klok only, no server)
// Works across all apps/devices with no central DB, based on immutable Kai-Klok pulse logic.

import { computeKaiLocally } from "./kai_pulse"; // must accept a Date argument

/* ────────────────────────────────────────────────────────────────
   Types
────────────────────────────────────────────────────────────────── */
export type TokenRecord = {
  token: string;
  pulse: number;         // exact pulse at moment of sealing
  stepIndex: number;
  beat: number;
  chakraDay: string;
  updatedAt?: number;
  canonicalHash?: string;
  userPhiKey?: string;
  kaiSignature?: string;
  parentHash?: string;
};

const CLAIM_WINDOW_STEPS = 1; // ⏳ Set claim window in steps (~5.2s per step)

/* ────────────────────────────────────────────────────────────────
   Sovereign Token Logic
────────────────────────────────────────────────────────────────── */

/**
 * Deterministically compute canonical token hash
 */
export async function computeCanonicalToken(payload: Omit<TokenRecord, "token">): Promise<string> {
  const json = JSON.stringify({
    pulse: payload.pulse,
    beat: payload.beat,
    stepIndex: payload.stepIndex,
    chakraDay: payload.chakraDay,
    userPhiKey: payload.userPhiKey ?? "",
    kaiSignature: payload.kaiSignature ?? "",
    parentHash: payload.parentHash ?? "",
  });

  const encoded = new TextEncoder().encode(json);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);

  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * ❓ Get token that is valid for the current Kai-Klok moment
 */
export async function getLatestToken(canonical: string): Promise<string | null> {
  if (!canonical) return null;
  try {
    const now = computeKaiLocally(new Date());
    const local = getLocalToken(canonical);
    if (!local) return null;

    const expired =
      now.beat !== local.beat ||
      now.stepIndex > local.stepIndex + CLAIM_WINDOW_STEPS;

    return expired ? null : local.token;
  } catch {
    return null;
  }
}

/**
 * 🧿 Seal and rotate a new token for current Kai-Klok pulse
 */
export async function putLatestToken(
  canonical: string,
  chakraDay: string,
  extra?: Partial<Omit<TokenRecord, "token">>
): Promise<void> {
  const now = computeKaiLocally(new Date());

  const rawPayload: Omit<TokenRecord, "token"> = {
    pulse: now.pulse,
    stepIndex: now.stepIndex,
    beat: now.beat,
    chakraDay,
    updatedAt: now.pulse,
    ...extra,
  };

  const token = await computeCanonicalToken(rawPayload);
  const full: TokenRecord = { ...rawPayload, token };

  setLocalToken(canonical, full);
}

/* ────────────────────────────────────────────────────────────────
   Local Fallback — for restoring previous seal if browser persists
────────────────────────────────────────────────────────────────── */
function getLocalToken(canonical: string): TokenRecord | null {
  try {
    const raw = localStorage.getItem(`token:${canonical}`);
    if (!raw) return null;
    return JSON.parse(raw) as TokenRecord;
  } catch {
    return null;
  }
}

function setLocalToken(canonical: string, record: TokenRecord): void {
  try {
    localStorage.setItem(`token:${canonical}`, JSON.stringify(record));
  } catch {
    // fail silently
  }
}
