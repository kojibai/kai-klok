// src/components/VerifierStamper/SendPhiAmountField.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import "./SendPhiAmountField.css";

export type Props = {
  amountMode: "USD" | "PHI";
  setAmountMode: Dispatch<SetStateAction<"USD" | "PHI">>;

  usdInput: string;
  phiInput: string;
  setUsdInput: Dispatch<SetStateAction<string>>;
  setPhiInput: Dispatch<SetStateAction<string>>;

  convDisplayRight: string;
  remainingPhiDisplay4: string;
  canonicalContext: "parent" | "derivative" | null;

  /** Optional compact formatter (kept for compat; not used while typing). */
  phiFormatter?: (s: string) => string;
};

/* Input guards (leading dot allowed, graceful while typing) */
const DEC4 = /^\d*(?:\.\d{0,4})?$/;
const USD2 = /^\d*(?:\.\d{0,2})?$/;

/** Tasteful, official, ephemeral toast that never shifts the footer */
const ErrorToast: React.FC<{ msg: string | null }> = ({ msg }) => {
  if (!msg) return null;
  return (
    <div className="phi-error-toast" role="status" aria-live="polite">
      <div className="phi-error-card">
        <span className="badge">OFFICIAL</span>
        <p className="phi-error-text">{msg}</p>
      </div>
    </div>
  );
};

const SendPhiAmountField: React.FC<Props> = ({
  amountMode,
  setAmountMode,
  usdInput,
  phiInput,
  setUsdInput,
  setPhiInput,
  convDisplayRight,
  remainingPhiDisplay4,
  canonicalContext,
}) => {
  const isChild = canonicalContext === "derivative"; // send-sigil (uploaded) view

  // Hooks MUST be unconditionally called in the same order:
  const [toast, setToast] = useState<string | null>(null);
  const [focused, setFocused] = useState<boolean>(false);

  useEffect(() => {
    if (!toast || isChild) return;
    const id = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [toast, isChild]);

  const showError = (m: string) => {
    setToast(m);
    try {
      window.dispatchEvent(
        new CustomEvent("kk:error", {
          detail: { where: "SendPhiAmountField", error: m },
        })
      );
    } catch {
      /* noop */
    }
  };

  const unitPattern = useMemo(
    () => (amountMode === "USD" ? "\\d*(?:\\.\\d{0,2})?" : "\\d*(?:\\.\\d{0,4})?"),
    [amountMode]
  );
  const unitGlyph = amountMode === "USD" ? "$" : "Φ";
  const ariaLabel =
    amountMode === "USD" ? "Dollar amount to exhale" : "Phi amount to exhale";

  const handleChange = (raw: string) => {
    const v = raw.replace(/\s+/g, "");
    if (amountMode === "USD") {
      if (USD2.test(v)) setUsdInput(v);
    } else {
      if (DEC4.test(v)) setPhiInput(v); // allow ".1" while typing; no forced "0."
    }
  };

  /** Gentle preflight on Enter (Φ is source of truth) */
  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key !== "Enter") return;
    if (amountMode !== "PHI") {
      showError("Enter a Φ amount or switch to Φ to exhale.");
      return;
    }
    const raw = (phiInput || "").trim();
    if (raw === "" || raw === ".") {
      showError("No Φ entered — specify an amount to exhale.");
      return;
    }
    const want = Number((raw.startsWith(".") ? "0" : "") + raw);
    if (!Number.isFinite(want) || want <= 0) {
      showError("Invalid Φ amount — enter a number greater than 0.");
      return;
    }
    const rem = Number(String(remainingPhiDisplay4).replace(/[^\d.]/g, ""));
    if (Number.isFinite(rem) && want > rem + 1e-9) {
      showError(`Exceeds remaining — Rem: Φ ${remainingPhiDisplay4}`);
    }
  };

  // If this is a send sigil (child), the amount field is hidden (only Inhale in footer).
  if (isChild) {
    return (
      <>
        <ErrorToast msg={toast} />
      </>
    );
  }

  return (
    <>
      <div className="phi-send-field" data-state={focused ? "focus" : "idle"}>
        {/* Label stack */}
        <div className="phi-send-label">
          <span className="label-main">Exhale Amount</span>
          <span className="label-sub">
            {amountMode === "USD" ? "Enter in $" : "Enter in Φ"} · 🛕: Φ{" "}
            {remainingPhiDisplay4}
          </span>
        </div>

        {/* Glass capsule input */}
        <div className="phi-send-inputShell" aria-live="polite">
          <span className="phi-prefix" aria-hidden="true">
            {unitGlyph}
          </span>

          <input
            className="phi-send-input"
            type="text"
            inputMode="decimal"
            pattern={unitPattern}
            aria-label={ariaLabel}
            placeholder={unitGlyph}
            value={amountMode === "USD" ? usdInput : phiInput}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-invalid={toast ? true : undefined}
          />

          {/* Unit switch */}
          <div
            role="tablist"
            aria-label="Amount unit"
            className="seg"
            style={{
              display: "inline-grid",
              gridTemplateColumns: "1fr 1fr",
              borderRadius: 999,
              border: "1px solid var(--border, rgba(255,255,255,.18))",
              overflow: "hidden",
              flex: "0 0 auto",
            }}
          >
            <button
              role="tab"
              aria-selected={amountMode === "USD"}
              className={amountMode === "USD" ? "active" : ""}
              onClick={() => setAmountMode("USD")}
              style={{ padding: "6px 10px", fontSize: 12 }}
              title="Enter in dollars"
            >
              $
            </button>
            <button
              role="tab"
              aria-selected={amountMode === "PHI"}
              className={amountMode === "PHI" ? "active" : ""}
              onClick={() => setAmountMode("PHI")}
              style={{ padding: "6px 10px", fontSize: 12 }}
              title="Enter in Φ"
            >
              Φ
            </button>
          </div>

          {/* Breathing glow underbar */}
          <i aria-hidden="true" className="phi-input-glow" />
        </div>

        {/* Live conversion + remaining (responsive, ellipsized) */}
        <div
          className="convert-readout"
          aria-live="polite"
          style={{
            fontSize: 12,
            opacity: 0.9,
            minWidth: 0,
            maxWidth: "100%",
            textAlign: "left",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {convDisplayRight}
        </div>
      </div>

      {/* Official, sleek, non-blocking error toast */}
      <ErrorToast msg={toast} />
    </>
  );
};

export default SendPhiAmountField;
