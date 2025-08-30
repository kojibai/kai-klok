// src/utils/transferPackage.ts
import type { SigilPayload } from "../types/sigil";

/**
 * Canonicalized debit entry for transfer packages.
 * Optional fields in source payload are normalized to explicit nulls here.
 */
export type CanonicalDebit = {
  amount: number;
  recipientPhiKey: string | null;
  timestamp: number | null;
  nonce: string;
};

export type CanonicalPackage = {
  canonicalHash: string | null;
  kaiSignature: string | null;
  ownerPhiKey: string | null;
  transferNonce: string | null;
  expiresAtPulse: number | null;
  originalAmount?: number | null;
  debits?: CanonicalDebit[] | null;
  /** Optional lineage commitment/root if your app uses one. */
  lineageRoot?: string | null;
};

/** Internal helper: extend SigilPayload with optional fields that may or may not exist. */
type SigilPayloadWithExtras = SigilPayload & {
  originalAmount?: number | null;
  debits?:
    | ReadonlyArray<{
        amount: number;
        recipientPhiKey?: string | null;
        timestamp?: number;
        nonce: string;
      }>
    | null;
  lineageRoot?: string | null;

  // These typically exist on SigilPayload, but we mark them optional for safety
  kaiSignature?: string | null;
  userPhiKey?: string | null;
  transferNonce?: string | null;
  expiresAtPulse?: number | null;
};

/** Normalize a possibly-missing string to lowercased value or null. */
const toLowerOrNull = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 ? v.toLowerCase() : null;

/** Normalize a possibly-missing string to string or null (no lowercasing). */
const toStringOrNull = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 ? v : null;

/** Normalize a possibly-missing number to number or null. */
const toNumberOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** Map and sort debits deterministically (timestamp asc, then nonce lexicographically). */
function normalizeAndSortDebits(
  debits: SigilPayloadWithExtras["debits"]
): CanonicalDebit[] | null {
  if (!Array.isArray(debits) || debits.length === 0) return null;

  const list: CanonicalDebit[] = debits.map((d) => ({
    amount: Number(d.amount), // ensure numeric
    recipientPhiKey: toStringOrNull(d.recipientPhiKey),
    timestamp: toNumberOrNull(d.timestamp),
    nonce: String(d.nonce),
  }));

  list.sort((a, b) => {
    const ta = a.timestamp ?? 0;
    const tb = b.timestamp ?? 0;
    if (ta !== tb) return ta - tb;
    return a.nonce.localeCompare(b.nonce);
  });

  return list;
}

/**
 * Build a strictly typed, deterministic transfer package from a Sigil payload.
 * - Lowercases the canonical hash
 * - Normalizes optionals to explicit nulls
 * - Copies and stably sorts debits
 */
export function buildTransferPackage(meta: SigilPayload): CanonicalPackage {
  const m = meta as SigilPayloadWithExtras;

  const canonicalHash = toLowerOrNull(m.canonicalHash);
  const kaiSignature = toStringOrNull(m.kaiSignature);
  const ownerPhiKey = toStringOrNull(m.userPhiKey);
  const transferNonce = toStringOrNull(m.transferNonce);
  const expiresAtPulse = toNumberOrNull(m.expiresAtPulse);

  const originalAmount =
    typeof m.originalAmount === "number" && Number.isFinite(m.originalAmount)
      ? m.originalAmount
      : null;

  const debits = normalizeAndSortDebits(m.debits);

  const lineageRoot = toStringOrNull(m.lineageRoot);

  return {
    canonicalHash,
    kaiSignature,
    ownerPhiKey,
    transferNonce,
    expiresAtPulse,
    originalAmount,
    debits,
    lineageRoot,
  };
}
