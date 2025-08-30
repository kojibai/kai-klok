// src/components/sigil/SigilCTA.tsx
import React from "react";

type Press = {
  onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
};

type Props = {
  hasPayload: boolean;
  showError: boolean;
  expired: boolean;
  exporting: boolean;
  isFutureSealed: boolean;
  isArchived: boolean;
  claimPress: Press;
  stargatePress: Press;
  posterPress: Press;
};

export default function SigilCTA({
  hasPayload,
  showError,
  expired,
  exporting,
  isFutureSealed,
  isArchived,
  claimPress,
  stargatePress,
  posterPress,
}: Props) {
  return (
    <div className="sp-cta">
      <button
        className="btn-primary"
        {...claimPress}
        disabled={!hasPayload || showError || expired || exporting || isFutureSealed || isArchived}
        title={
          isArchived
            ? "Archived link — cannot claim from here"
            : expired
            ? "Window closed"
            : isFutureSealed
            ? "Opens after the moment—claim unlocks then"
            : "Claim ZIP (SVG+PNG w/ QR, no pulse bar)"
        }
      >
        {isArchived
          ? "Archived (Burned)"
          : expired
          ? "Eternally Sealed"
          : isFutureSealed
          ? "Eternally Sealed (Pre-Moment)"
          : exporting
          ? "Preparing…"
          : "Inhale Claimed Ownership"}
      </button>

      {hasPayload && (
        <>
          <button className="btn-ghost" {...stargatePress}>
            View in Stargate
          </button>
          <button className="btn-ghost" {...posterPress} title="Save a shareable PNG poster (QR + sleek Pulse Bar)">
            Save Sigil-Glyph
          </button>
        </>
      )}
    </div>
  );
}
