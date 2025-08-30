// Deterministic debit helpers (strictly typed, no 'any')

import type { DebitRecord, DebitQS } from "../../utils/cryptoLedger";

export const EPS = 1e-9;

export type DebitLoose = {
  amount: number;
  nonce: string;
  timestamp?: number;
  recipientPhiKey?: string;
};

export function isValidDebit(d: unknown): d is DebitLoose {
  if (!d || typeof d !== "object") return false;
  const o = d as Record<string, unknown>;
  return (
    typeof o.amount === "number" &&
    Number.isFinite(o.amount) &&
    o.amount > 0 &&
    typeof o.nonce === "string" &&
    o.nonce.length > 0 &&
    typeof o.timestamp === "number" &&
    Number.isFinite(o.timestamp) &&
    (typeof o.recipientPhiKey === "string" || typeof o.recipientPhiKey === "undefined")
  );
}

export function sumDebits(list: ReadonlyArray<DebitLoose> | undefined): number {
  if (!Array.isArray(list)) return 0;
  let s = 0;
  for (const d of list) if (isValidDebit(d)) s += d.amount;
  return s;
}

export function sortDebitsStable(list: ReadonlyArray<DebitLoose>): DebitLoose[] {
  return [...list].sort((a, b) => {
    const t = (a.timestamp || 0) - (b.timestamp || 0);
    return t !== 0 ? t : a.nonce.localeCompare(b.nonce);
  });
}

export function dedupeByNonce(list: ReadonlyArray<DebitLoose>): DebitLoose[] {
  const seen = new Set<string>();
  const out: DebitLoose[] = [];
  for (const d of list) {
    if (!isValidDebit(d)) continue;
    if (seen.has(d.nonce)) continue;
    seen.add(d.nonce);
    out.push(d);
  }
  return out;
}

export function capDebitsQS(qs: DebitQS): DebitQS {
  const orig =
    typeof qs.originalAmount === "number" && Number.isFinite(qs.originalAmount)
      ? qs.originalAmount
      : Number.NaN;

  const rawList =
    Array.isArray(qs.debits) ? (dedupeByNonce(qs.debits as unknown as DebitLoose[]) as DebitLoose[]) : [];
  const list = sortDebitsStable(rawList);

  if (!Number.isFinite(orig)) {
    return {
      originalAmount: qs.originalAmount,
      debits: list.length ? (list as unknown as DebitRecord[]) : undefined,
    };
  }

  const kept: DebitLoose[] = [];
  let acc = 0;
  for (const d of list) {
    if (!isValidDebit(d)) continue;
    if (acc + d.amount <= orig + EPS) {
      kept.push(d);
      acc += d.amount;
    } else {
      // deterministically drop overage
    }
  }

  return {
    originalAmount: orig,
    debits: kept.length ? (kept as unknown as DebitRecord[]) : undefined,
  };
}
