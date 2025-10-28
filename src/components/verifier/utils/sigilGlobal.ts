// src/components/verifier/utils/sigilGlobal.ts
/* ────────────────────────────────────────────────────────────────
   sigilGlobal.ts
   • Runtime bridge into window.__SIGIL__
   • Lets Verifier register sends / share URLs for other UI parts
────────────────────────────────────────────────────────────────── */

export type SendRecord = {
  parentCanonical: string;
  childCanonical: string;
  amountPhiScaled: string;
  senderKaiPulse: number;
  transferNonce: string;
  senderStamp: string;
  previousHeadRoot: string;
  transferLeafHashSend: string;
};

export type SigilGlobal = {
  registerSigilUrl?: (url: string) => void;
  registerSend?: (rec: SendRecord) => void;
};

/**
 * Access (and lazy-create) window.__SIGIL__ in a typed way.
 */
export function getSigilGlobal(): SigilGlobal {
  const w = window as unknown as {
    __SIGIL__?: Record<string, unknown>;
  };
  if (!w.__SIGIL__) w.__SIGIL__ = {};

  const base = w.__SIGIL__ as Record<string, unknown>;
  const regUrl =
    typeof base.registerSigilUrl === "function"
      ? (base.registerSigilUrl as (url: string) => void)
      : undefined;
  const regSend =
    typeof base.registerSend === "function"
      ? (base.registerSend as (rec: SendRecord) => void)
      : undefined;

  return { registerSigilUrl: regUrl, registerSend: regSend };
}
