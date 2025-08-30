/**
 * v46 — SigilConflictBanner.tsx
 * -----------------------------------------------------------------------------
 * High-level dev notes:
 *
 * Purpose
 * -------
 * A single, accessible banner for surfacing Sigil link state conflicts:
 *  - Legacy route hash vs modern canonical hash (upgrade path).
 *  - Archived (rotated / expired) links.
 *  - Stale ledger in URL that we just reconciled.
 *
 * Props
 * -----
 *  - glyphAuth: "checking" | "authentic" | "forged"
 *  - linkStatus: "checking" | "active" | "archived"
 *  - routeHash?: string
 *  - localHash?: string
 *  - upgradedOnce?: boolean
 *  - oldLinkDetected?: boolean
 *  - transferToken?: string | null
 *  - onUpgradeClick?: () => void
 *  - className?: string
 *
 * Behavior
 * --------
 * - Shows the legacy upgrade CTA when: authentic glyph, archived link, no token in URL,
 *   route & local hashes both exist and differ, and user hasn't already completed the one-time upgrade.
 * - Shows a "ledger refreshed" toast-like banner when oldLinkDetected = true.
 * - Shows an archived warning when linkStatus === "archived" and there's a token present.
 *
 * Styling
 * -------
 * Reuses the SIGIL page classes if present:
 *  - .sp-upgrade (CTA look)
 *  - .pill, .muted, .spacer, .upg-btn
 *  - .sp-card--banner (fallback base)
 * -----------------------------------------------------------------------------
 */

import * as React from "react";

export type SigilConflictBannerProps = {
  glyphAuth: "checking" | "authentic" | "forged";
  linkStatus: "checking" | "active" | "archived";
  routeHash?: string;
  localHash?: string;
  upgradedOnce?: boolean;
  oldLinkDetected?: boolean;
  transferToken?: string | null;
  onUpgradeClick?: () => void;
  className?: string;
};

const Code: React.FC<{ children: React.ReactNode; title?: string }> = ({ children, title }) => (
  <code title={title} style={{ whiteSpace: "nowrap" }}>
    {children}
  </code>
);

export const SigilConflictBanner: React.FC<SigilConflictBannerProps> = ({
  glyphAuth,
  linkStatus,
  routeHash,
  localHash,
  upgradedOnce,
  oldLinkDetected,
  transferToken,
  onUpgradeClick,
  className,
}) => {
  const legacyEligible =
    glyphAuth === "authentic" &&
    linkStatus === "archived" &&
    !transferToken &&
    !!routeHash &&
    !!localHash &&
    routeHash.toLowerCase() !== localHash.toLowerCase();

  const showLegacyCta = legacyEligible && !upgradedOnce;

  const showArchivedWarning = linkStatus === "archived" && !!transferToken;

  const hasAnyBanner = showLegacyCta || !!oldLinkDetected || showArchivedWarning;

  if (!hasAnyBanner) return null;

  return (
    <div className={className} aria-live="polite" aria-atomic="true">
      {showLegacyCta && (
        <div className="sp-upgrade" role="region" aria-label="Legacy upgrade notice">
          <div className="row">
            <span className="pill">Legacy link detected</span>
            <span className="muted">
              Upgrade your Φkey to the modern canonical hash to enable transfers & new features.
            </span>
            <span className="spacer" />
            <button
              className="upg-btn"
              onClick={onUpgradeClick}
              aria-haspopup="dialog"
              aria-controls="upgrade-sigil-modal"
            >
              Upgrade sigil
            </button>
          </div>
          <div className="muted">
            Route hash <Code>{routeHash?.slice(0, 16)}…</Code> → Modern{" "}
            <Code>{(localHash || "").slice(0, 16)}…</Code>
          </div>
        </div>
      )}

      {oldLinkDetected && (
        <div
          className="sp-card sp-card--banner"
          role="status"
          style={{ marginTop: 12, padding: 12 }}
          aria-label="Ledger refreshed from canonical store"
        >
          <span className="pill">Ledger refreshed</span>
          <span className="muted" style={{ marginLeft: 8 }}>
            Your URL didn’t have the latest resonance stream. We’ve updated it.
          </span>
        </div>
      )}

      {showArchivedWarning && (
        <div
          className="sp-card sp-card--banner"
          role="alert"
          style={{ marginTop: 12, padding: 12 }}
          aria-label="Archived transfer link"
        >
          <span className="pill">Archived link</span>
          <span className="muted" style={{ marginLeft: 8 }}>
            This transfer link has been rotated or expired. Start from the latest share to continue.
          </span>
        </div>
      )}
    </div>
  );
};

export default SigilConflictBanner;
