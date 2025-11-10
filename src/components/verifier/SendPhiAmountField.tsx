// src/components/verifier/SendPhiAmountField.tsx
import React from "react";
import "./SendPhiAmountField.css";

type Props = {
  amountMode: "USD" | "PHI";
  setAmountMode: (m: "USD" | "PHI") => void;

  usdInput: string;
  phiInput: string;
  setUsdInput: (v: string) => void;
  setPhiInput: (v: string) => void;

  convDisplayRight: string;          // e.g., "$ 12.34" or "≈ Φ 0.1234"
  remainingPhiDisplay4: string;      // e.g., "1.2345"
  canonicalContext: "parent" | "derivative" | null;
  phiFormatter: (s: string) => string;
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
  phiFormatter,
}) => {
  return (
    <div className="phi-send-field" aria-live="polite">
      {/* Row layout that adapts and goes full-width */}
      <div className="phi-send-row">
        {/* Mode toggle */}
        <div className="phi-mode-toggle" role="group" aria-label="Amount mode">
          <button
            type="button"
            className={`phi-mode-btn ${amountMode === "PHI" ? "is-active" : ""}`}
            onClick={() => setAmountMode("PHI")}
            title="Send Φ amount"
          >
            Φ
          </button>
          <button
            type="button"
            className={`phi-mode-btn ${amountMode === "USD" ? "is-active" : ""}`}
            onClick={() => setAmountMode("USD")}
            title="Send USD amount (converted)"
          >
            $
          </button>
        </div>

        {/* Input capsule */}
        <div className="phi-send-inputShell">
          <span className="phi-prefix" aria-hidden="true">
            {amountMode === "PHI" ? "Φ" : "$"}
          </span>

          {amountMode === "PHI" ? (
            <input
              className="phi-send-input"
              inputMode="decimal"
              pattern="[0-9.]*"
              placeholder="Φ amount"
              title="Φ amount to exhale"
              value={phiInput}
              onChange={(e) => setPhiInput(phiFormatter(e.target.value))}
            />
          ) : (
            <input
              className="phi-send-input"
              inputMode="decimal"
              pattern="[0-9.]*"
              placeholder="USD amount"
              title="USD amount to exhale"
              value={usdInput}
              onChange={(e) => setUsdInput(e.target.value.replace(/[^\d.]/g, ""))}
            />
          )}

          <div className="phi-input-glow" aria-hidden="true" />
        </div>

        {/* Conversion readout */}
        <div
          className="phi-conv-right"
          aria-label="Converted display"
          title="Converted display"
        >
          {convDisplayRight}
        </div>

        {/* Remaining */}
        <div
          className="phi-remaining"
          title={
            canonicalContext === "derivative"
              ? "Resonance Φ remaining on this derivative"
              : "Resonance Φ remaining on this glyph"
          }
        >
          Remaining: Φ {remainingPhiDisplay4}
        </div>
      </div>
    </div>
  );
};

export default SendPhiAmountField;
