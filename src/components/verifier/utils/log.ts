// src/components/verifier/utils/log.ts
/* ────────────────────────────────────────────────────────────────
   log.ts
   • Centralized error reporter for VerifierStamper
   • Emits kk:error CustomEvent for UI listeners / telemetry hooks
────────────────────────────────────────────────────────────────── */

export function logError(where: string, err: unknown): void {
  // eslint-disable-next-line no-console
  console.error(`[VerifierStamper] ${where}`, err);

  if (typeof window === "undefined") return;

  try {
    window.dispatchEvent(
      new CustomEvent("kk:error", {
        detail: {
          where,
          error: err instanceof Error ? err.message : String(err),
        },
      })
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`[VerifierStamper] kk:error dispatch failed in ${where}`, e);
  }
}
