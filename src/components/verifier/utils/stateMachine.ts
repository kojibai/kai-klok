// src/components/verifier/utils/stateMachine.ts
/* ────────────────────────────────────────────────────────────────
   stateMachine.ts
   • deriveState(...) -> UiState
   • Encodes SEND / RECEIVE / COMPLETE logic, including:
     - derivative children
     - promotion after RECEIVE
     - unsigned case
     - expiry locks
   EXACT v23.1 CONTINUOUS FLOW semantics
────────────────────────────────────────────────────────────────── */

import type { UiState } from "../../VerifierStamper/types";

/**
 * Returns the Verifier UI mode ("readySend", "readyReceive", "complete", etc.)
 * WITHOUT auto-archiving after segmentation.
 */
export function deriveState(params: {
  contextOk: boolean;
  typeOk: boolean;
  hasCore: boolean;
  contentSigMatches: boolean | null;
  isOwner: boolean | null;
  hasTransfers: boolean;
  lastOpen: boolean;
  lastClosed: boolean;
  isUnsigned: boolean;
  childUsed: boolean;
  childExpired: boolean;
  parentOpenExpired: boolean;
  isChildContext: boolean;
}): UiState {
  const {
    contextOk,
    typeOk,
    hasCore,
    contentSigMatches,
    isOwner,
    hasTransfers,
    lastOpen,
    lastClosed,
    isUnsigned,
    childUsed,
    childExpired,
    parentOpenExpired,
    isChildContext,
  } = params;

  if (!contextOk || !typeOk) return "invalid";
  if (!hasCore) return "structMismatch";
  if (contentSigMatches === false) return "sigMismatch";
  if (isOwner === false) return "notOwner";
  if (isUnsigned) return "unsigned";

  // An open transfer exists
  if (lastOpen) {
    // If expired (child or parent), it's effectively sealed
    if (childExpired || parentOpenExpired) return "complete";
    return "readyReceive";
  }

  // No open transfer:
  if (isChildContext) {
    // Promotion rule: once received (closed) OR lock consumed -> can send
    if (childUsed || (hasTransfers && lastClosed)) return "readySend";
    // Unused child that hasn't been inhaled yet cannot send
    return "complete";
  }

  // Parent context and not expired -> can SEND
  return "readySend";
}
