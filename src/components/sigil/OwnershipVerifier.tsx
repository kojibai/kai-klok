// src/components/sigil/OwnershipVerifierModal.tsx
import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

type Props = {
  isArchived: boolean;
  ownerVerified: boolean;
  ownershipMsg: string;
  onVerifyOwnershipFile: (file: File) => void | Promise<void>;
};

export default function OwnershipVerifierModal({
  isArchived,
  ownerVerified,
  ownershipMsg,
  onVerifyOwnershipFile,
}: Props) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Minimal modal CSS injected once
  useEffect(() => {
    const id = "ownership-verifier-modal-css";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      .ovm-backdrop{
        position: fixed; inset: 0; background: rgba(0,0,0,0.55);
        display:flex; align-items:center; justify-content:center;
        z-index: 2147483600;
      }
      .ovm-dialog{
        background: #0b0b0c; color:#fff; border-radius:16px; width:min(560px, 92vw);
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        border:1px solid rgba(255,255,255,0.06);
        padding: 20px;
        max-height: 85vh; overflow:auto;
      }
      .ovm-header{ display:flex; align-items:center; justify-content:space-between; gap:12px; }
      .ovm-title{ font-size:18px; font-weight:800; margin:0; }
      .ovm-close{ background:transparent; border:0; color:#fff; font-size:18px; padding:6px 10px; }
      .ovm-body{ display:grid; gap:12px; margin-top:12px; }
      .ovm-actions{ display:flex; gap:8px; margin-top:12px; }
      .sr-only-file{
        position:absolute !important; width:1px !important; height:1px !important;
        padding:0 !important; margin:-1px !important; opacity:0.001 !important; overflow:hidden !important;
        clip:rect(0 0 0 0) !important; white-space:nowrap !important; border:0 !important;
      }
      .btn-primary{ cursor:pointer; }
      .badge{ display:inline-flex; align-items:center; gap:8px; padding:2px 10px; border-radius:999px; border:1px solid rgba(255,255,255,0.15); }
      .badge--ok{ border-color: rgba(0,255,208,0.45); color:#0fd; }
      .badge--checking{ border-color: rgba(255,255,255,0.25); color:#fff; opacity:0.85; }
    `;
    document.head.appendChild(style);
  }, []);

  // Prevent body scroll when modal open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Close on escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const onChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.currentTarget.files?.[0];
    if (!f) return;
    await onVerifyOwnershipFile(f);
    // allow picking same file again
    if (inputRef.current) inputRef.current.value = "";
    setOpen(false);
  }, [onVerifyOwnershipFile]);

  return (
    <div className="sp-panel" role="group" aria-labelledby="own-title">
      <h3 id="own-title">Stewardship</h3>

      <div className="sp-field">
        <label className="lbl">Upload Φkey of the Sigil-Glyph</label>
        <button
          type="button"
          className={`btn-primary btn-primary--xl ${isArchived ? "is-disabled" : ""}`}
          aria-disabled={isArchived}
          title={isArchived ? "Archived link — cannot verify here" : "Verify"}
          onClick={() => !isArchived && setOpen(true)}
        >
          {isArchived ? "Archived" : "Verify"}
        </button>
      </div>

      <div className="sp-meta-row" aria-live="polite" aria-atomic="true">
        <span className="lbl">Status</span>
        <span className={ownerVerified && !isArchived ? "badge badge--ok" : "badge badge--checking"}>
          {isArchived ? "Archived link — cannot verify here" : ownershipMsg}
        </span>
      </div>

      {open && createPortal(
        <div className="ovm-backdrop" role="dialog" aria-modal="true" aria-labelledby="ovm-title">
          <div className="ovm-dialog">
            <div className="ovm-header">
              <h4 id="ovm-title" className="ovm-title">Verify Stewardship</h4>
              <button className="ovm-close" aria-label="Close" onClick={() => setOpen(false)}>✕</button>
            </div>

            <div className="ovm-body">
              <p className="sp-fine">Select the Φkey for the current Sigil-Glyph.</p>

              {/* IMPORTANT: keep the real input plainly in the modal (no transforms). */}
              <input
                ref={inputRef}
                id="ovm-own-file"
                className="sr-only-file"
                type="file"
                accept="image/svg+xml,.svg"
                onChange={onChange}
                aria-label="Choose Φkey"
              />

              {/* This label looks like your primary button and triggers the native picker. */}
              <label htmlFor="ovm-own-file" className="btn-primary btn-primary--xl" style={{ display: "inline-flex", justifyContent: "center" }}>
                Choose Φkey
              </label>

              <div className="sp-meta-row" aria-live="polite" aria-atomic="true">
                <span className="lbl">Status</span>
                <span className={ownerVerified ? "badge badge--ok" : "badge badge--checking"}>
                  {ownershipMsg}
                </span>
              </div>
            </div>

            <div className="ovm-actions">
              <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
