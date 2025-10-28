// src/components/verifier/ui/StatusChips.tsx
/* ────────────────────────────────────────────────────────────────
   StatusChips
   • Icon badges shown in the Verifier modal top strip
   • v23.1 CONTINUOUS FLOW rules:
     - segmentation never implies archival
     - SEND-sigil cannot segment (chip "ban")
   • Exports:
     - default StatusChips (React component)
     - Svg, IconCircle (UI bits)
     - buildStatusChips (logic, reusable)
────────────────────────────────────────────────────────────────── */

import React from "react";
import type { UiState } from "../../VerifierStamper/types";
import type { SigilMetadataWithOptionals, HeadProofInfo } from "../types/local";

/* ───────────────────────── Icons ───────────────────────── */

export const Svg: React.FC<{
  path:
    | "check"
    | "x"
    | "warn"
    | "shield"
    | "sigma"
    | "phi"
    | "send"
    | "recv"
    | "done"
    | "stack"
    | "hash"
    | "zk"
    | "paperclip"
    | "lock"
    | "timer"
    | "ban";
  label?: string;
}> = ({ path, label }) => {
  const p: Record<string, string> = {
    check: "M5 13l4 4L19 7",
    x: "M6 6l12 12M6 18L18 6",
    warn: "M12 9v4m0 4h.01M12 3l9 16H3z",
    shield: "M12 3l7 4v6l-7 4-7-4V7l7-4z",
    sigma: "M18 6H9l5 6-5 6h9M6 6h2M6 18h2",
    phi: "M12 4a8 8 0 100 16 8 8 0 000-16zm0 0v16",
    send: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
    recv: "M2 22l11-11M2 22l20-7-9-4-4-9-7 20z",
    done: "M12 21c4.97 0 9-4.03 9-9S16.97 3 12 3 3 7.03 3 12s4.03 9 9 9zm-1-6l6-6M8 12l3 3",
    stack: "M12 3l9 4-9 4-9-4 9-4zm-9 8l9 4 9-4M3 19l9 4 9-4",
    hash: "M10 3L8 21M16 3l-2 18M3 8h18M3 16h18",
    zk: "M12 3l7 4v6l-7 4-7-4V7l7-4zM9 12h6",
    paperclip:
      "M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.2a2 2 0 01-2.83-2.83l8.49-8.49",
    lock: "M7 10V7a5 5 0 0110 0v3h1a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7a2 2 0 012-2h1zm3 0h4V7a3 3 0 00-6 0v3z",
    timer: "M12 8v5l3 3M12 2a10 10 0 100 20 10 10 0 000-20",
    ban: "M4.93 4.93l14.14 14.14M12 2a10 10 0 110 20 10 10 0 010-20",
  };

  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
      className="ico"
    >
      <path
        d={p[path]}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Accessible tooltip label for screen readers */}
      {label ? <title>{label}</title> : null}
    </svg>
  );
};

type IconKind = "ok" | "warn" | "err" | "info";

export const IconCircle: React.FC<{
  title: string;
  kind?: IconKind;
  children: React.ReactNode;
  badge?: number | null;
}> = ({ title, kind = "info", children, badge = null }) => (
  <span
    className={`chip icon ${kind}`}
    role="img"
    aria-label={title}
    title={title}
    {...(badge != null ? { "data-badge": String(badge) } : {})}
  >
    {children}
  </span>
);

/* ───────────────────────── Logic ───────────────────────── */

export interface BuildStatusChipsArgs {
  uiState: UiState;
  meta: SigilMetadataWithOptionals | null;
  contentSigMatches: boolean | null;
  phiKeyMatches: boolean | null;
  headProof: HeadProofInfo | null;
  canonicalContext: "parent" | "derivative" | null;
  childUsed: boolean;
  childExpired: boolean;
  parentOpenExpired: boolean;
  isSendFilename: boolean;
}

/**
 * buildStatusChips(...)
 * Produces the <IconCircle/> list for the modal header strip.
 * Idempotent + safe for null/partial data.
 */
export function buildStatusChips({
  uiState,
  meta,
  contentSigMatches,
  phiKeyMatches,
  headProof,
  canonicalContext,
  childUsed,
  childExpired,
  parentOpenExpired,
  isSendFilename,
}: BuildStatusChipsArgs): React.ReactNode[] {
  const chips: React.ReactNode[] = [];
  const push = (n: React.ReactNode) => chips.push(n);

  // Core UI state
  if (uiState === "invalid")
    push(
      <IconCircle key="inv" kind="err" title="Invalid">
        <Svg path="x" />
      </IconCircle>
    );

  if (uiState === "structMismatch")
    push(
      <IconCircle key="struct" kind="err" title="Structure mismatch">
        <Svg path="warn" />
      </IconCircle>
    );

  if (uiState === "sigMismatch")
    push(
      <IconCircle key="sigm" kind="err" title="Signature mismatch">
        <Svg path="x" />
      </IconCircle>
    );

  if (uiState === "notOwner")
    push(
      <IconCircle key="owner" kind="warn" title="Not owner">
        <Svg path="shield" />
      </IconCircle>
    );

  if (uiState === "unsigned")
    push(
      <IconCircle key="unsigned" kind="warn" title="Unsigned">
        <Svg path="hash" />
      </IconCircle>
    );

  if (uiState === "readySend")
    push(
      <IconCircle key="send" kind="info" title="Ready to send">
        <Svg path="send" />
      </IconCircle>
    );

  if (uiState === "readyReceive")
    push(
      <IconCircle key="recv" kind="info" title="Ready to receive">
        <Svg path="recv" />
      </IconCircle>
    );

  if (uiState === "complete")
    push(
      <IconCircle key="done" kind="ok" title="Receipt">
        <Svg path="done" />
      </IconCircle>
    );

  if (uiState === "verified")
    push(
      <IconCircle key="ver" kind="ok" title="Verified">
        <Svg path="check" />
      </IconCircle>
    );

  // Content + Φ-key checks
  if (contentSigMatches === true)
    push(
      <IconCircle key="sigok" kind="ok" title="Content Σ match">
        <Svg path="sigma" />
      </IconCircle>
    );

  if (contentSigMatches === false)
    push(
      <IconCircle key="sigerr" kind="err" title="Content Σ mismatch">
        <Svg path="sigma" />
      </IconCircle>
    );

  if (phiKeyMatches === true)
    push(
      <IconCircle key="phiok" kind="ok" title="Φ-Key match">
        <Svg path="phi" />
      </IconCircle>
    );

  if (phiKeyMatches === false)
    push(
      <IconCircle key="phierr" kind="err" title="Φ-Key mismatch">
        <Svg path="phi" />
      </IconCircle>
    );

  // Activity counters / roots
  if (meta?.cumulativeTransfers != null)
    push(
      <IconCircle
        key="cum"
        kind="info"
        title="Cumulative transfers"
        badge={meta.cumulativeTransfers}
      >
        <Svg path="hash" />
      </IconCircle>
    );

  if ((meta?.segments?.length ?? 0) > 0)
    push(
      <IconCircle
        key="segs"
        kind="info"
        title="Segments"
        badge={meta?.segments?.length ?? 0}
      >
        <Svg path="stack" />
      </IconCircle>
    );

  if (headProof)
    push(
      <IconCircle
        key="headproof"
        kind={headProof.ok ? "ok" : "err"}
        title={headProof.ok ? "Head proof verified" : "Head proof failed"}
      >
        <Svg path="shield" />
      </IconCircle>
    );

  if (meta?.transfersWindowRootV14)
    push(
      <IconCircle key="v14root" kind="info" title="v14 head root present">
        <Svg path="hash" />
      </IconCircle>
    );

  // ZK presence (any verified zkSend/zkReceive)
  const anyZkVerified = (meta?.hardenedTransfers ?? []).some(
    (ht) => !!(ht.zkSend?.verified || ht.zkReceive?.verified)
  );
  if (anyZkVerified)
    push(
      <IconCircle key="zk" kind="ok" title="Zero-knowledge proof verified">
        <Svg path="zk" />
      </IconCircle>
    );

  // Derivative/parent timing + SEND-file constraint
  const isChildCtx = canonicalContext === "derivative";

  if (isChildCtx && childUsed)
    push(
      <IconCircle key="used" kind="warn" title="Transfer link used">
        <Svg path="lock" />
      </IconCircle>
    );

  if (isChildCtx && childExpired)
    push(
      <IconCircle key="expired" kind="warn" title="Transfer link expired">
        <Svg path="timer" />
      </IconCircle>
    );

  if (canonicalContext === "parent" && parentOpenExpired)
    push(
      <IconCircle key="pexp" kind="warn" title="Send expired">
        <Svg path="timer" />
      </IconCircle>
    );

  if (isSendFilename)
    push(
      <IconCircle
        key="nosg"
        kind="warn"
        title="SEND file: segmentation disabled"
      >
        <Svg path="ban" />
      </IconCircle>
    );

  return chips;
}

/* ─────────────────────── UI Component ─────────────────────── */

export type StatusChipsProps = BuildStatusChipsArgs & {
  className?: string;
  /** If true, wraps chips in a horizontally scrollable strip (default: true). */
  scrollable?: boolean;
  /** aria-live politeness (default: 'polite') */
  ariaLive?: "off" | "polite" | "assertive";
};

const StatusChips: React.FC<StatusChipsProps> = ({
  className,
  scrollable = true,
  ariaLive = "polite",
  ...rest
}) => {
  const chips = buildStatusChips(rest);

  return (
    <div
      className={`status-chips ${className ?? ""}`}
      role="group"
      aria-label="Verification status"
      aria-live={ariaLive}
      style={
        scrollable
          ? { overflowX: "auto", whiteSpace: "nowrap" }
          : undefined
      }
      data-count={chips.length}
    >
      {/* Tiny layout marker for CSS animation hooks */}
      <span className="chip-sentinel" aria-hidden="true" />
      {chips.map((c, idx) => (
        <span
          key={idx}
          className="chip-wrap"
          data-i={idx}
          style={{ display: "inline-block" }}
        >
          {c}
        </span>
      ))}
    </div>
  );
};

export default StatusChips;
