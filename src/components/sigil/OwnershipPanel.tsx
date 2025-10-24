// src/components/sigil/OwnershipPanel.tsx
import { useCallback, useRef, useState } from "react";
import { openOwnershipVerifyModal } from "./openOwnershipVerifyModal";
import "./OwnershipModal.css";

type Props = {
  isArchived: boolean;
  ownerVerified: boolean;
  ownershipMsg: string;
  onVerifyOwnershipFile: (file: File) => void;
};

export default function OwnershipPanel({
  isArchived,
  ownerVerified,
  ownershipMsg,
  onVerifyOwnershipFile,
}: Props) {
  const [busy, setBusy] = useState(false);

  // Prevent double-fire on certain mobile browsers where PointerUp + Click both trigger.
  const pressedViaPointerRef = useRef(false);

  const open = useCallback(async () => {
    if (isArchived || busy) return;
    setBusy(true);
    try {
      const file = await openOwnershipVerifyModal({
        accept: "image/svg+xml,.svg",
        title: "Verify",
        subtitle: "Pick the Φkey for this Sigil-Glyph.",
      });
      if (file) onVerifyOwnershipFile(file);
    } finally {
      setBusy(false);
    }
  }, [isArchived, busy, onVerifyOwnershipFile]);

  const disabled = isArchived || busy;
  const buttonTitle = isArchived ? "Archived link — cannot verify here" : "Choose Φkey";

  return (
    <div className="sp-panel" role="group" aria-labelledby="own-title">
      <h3 id="own-title">Stewardship</h3>

      <div className="sp-field">
        <label className="lbl" htmlFor="btn-own-verify">
          Φkey
        </label>

        <button
          id="btn-own-verify"
          type="button"
          className="btn-primary btn-primary--xl sp-btn-full"
          title={buttonTitle}
          aria-disabled={disabled}
          disabled={disabled}
          aria-busy={busy || undefined}
          data-testid="ownership-verify-button"
          // Pointer path (fast on touch screens)
          onPointerUp={(e) => {
            if (disabled) return;
            if (e.pointerType === "touch" || e.pointerType === "mouse" || e.pointerType === "pen") {
              pressedViaPointerRef.current = true;
              // Keep the flag long enough to swallow the follow-up click on some Android/Safari builds
              setTimeout(() => {
                pressedViaPointerRef.current = false;
              }, 500);
              void open();
            }
          }}
          // Click path (screen readers, keyboards, odd webviews)
          onClick={() => {
            if (disabled) return;
            if (pressedViaPointerRef.current) return; // swallow duplicate after pointerUp
            void open();
          }}
        >
          {busy ? "Opening…" : "Verify"}
        </button>
      </div>

      <div className="sp-meta-row" aria-live="polite" aria-atomic="true" role="status">
        <span className="lbl">Status</span>
        <span
          className={
            ownerVerified && !isArchived ? "badge badge--ok" : "badge badge--checking"
          }
          data-testid="ownership-status-badge"
        >
          {isArchived ? "Archived link — cannot verify here" : ownershipMsg}
        </span>
      </div>

      {isArchived && (
        <div className="sp-meta-row">
          <span className="lbl">Link</span>
          <span className="badge">Archived</span>
        </div>
      )}
    </div>
  );
}
