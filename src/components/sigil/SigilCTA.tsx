// src/components/sigil/SigilCTA.tsx
import React from "react";


type FastPress = {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onPointerUp?: (e: React.PointerEvent<HTMLButtonElement>) => void;
};

export type Props = {
  hasPayload: boolean;
  showError: boolean;
  expired: boolean;
  exporting: boolean;
  isFutureSealed: boolean;
  isArchived: boolean;

  claimPress: FastPress;
  stargatePress: FastPress;
  posterPress: FastPress;

  /* NEW: mobile-safe send wiring */
  sendAmount: number;
  setSendAmount: (n: number) => void;
  onSend: () => void;
  sendBusy: boolean;
  ownerVerified: boolean;
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
            ? "Arkived link — kannot klaim from here"
            : expired
            ? "Breath Sealed"
            : isFutureSealed
            ? "Opens after the moment—klaim unloks then"
            : "Klaim ZIP (SVG+PNG w/ QR, no pulse bar)"
        }
      >
        {isArchived
          ? "Arkived (Burned)"
          : expired
          ? "Sealed"
          : isFutureSealed
          ? "Sealed (Pre-Moment)"
          : exporting
          ? "Sealing…"
          : "Inhale"}
      </button>

      {hasPayload && (
        <>
          <button className="btn-ghost" {...stargatePress}>
            Stargate
          </button>
          <button className="btn-ghost" {...posterPress} title="Save a shareable poster (QR + sleek Pulse Bar)">
            Sigil-Stamp
          </button>
        </>
      )}
    </div>
  );
}
