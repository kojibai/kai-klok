// src/components/verifier/SendPhiAmountField.tsx
import React from "react";

type Props = {
  amountMode: "USD" | "PHI";
  setAmountMode: (m: "USD" | "PHI") => void;

  usdInput: string;
  phiInput: string;
  setUsdInput: (v: string) => void;
  setPhiInput: (v: string) => void;

  convDisplayRight: string;          // computed display (e.g., "$ 12.34" or "≈ Φ 0.1234")
  remainingPhiDisplay4: string;      // e.g., "1.2345"
  canonicalContext: "parent" | "derivative" | null;
  phiFormatter: (s: string) => string;
};

const btnBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 40,
  padding: "0 10px",
  borderRadius: 8,
  border: "1px solid var(--border, #333)",
  background: "var(--card, rgba(255,255,255,0.04))",
  color: "inherit",
  cursor: "pointer",
};

const wrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  flex: "1 1 auto",
  minWidth: 0,
};

const inputStyle: React.CSSProperties = {
  height: 40,
  padding: "0 12px",
  borderRadius: 8,
  border: "1px solid var(--border, #333)",
  background: "var(--card, rgba(255,255,255,0.04))",
  color: "inherit",
  minWidth: 120,
  outline: "none",
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
  const rightLabel =
    amountMode === "PHI" ? convDisplayRight : convDisplayRight; // left is controlled by parent

  return (
    <div style={wrap} aria-live="polite">
      <div role="group" aria-label="Amount mode" style={{ display: "inline-flex", gap: 6 }}>
        <button
          type="button"
          style={{ ...btnBase, opacity: amountMode === "PHI" ? 1 : 0.55 }}
          onClick={() => setAmountMode("PHI")}
          title="Send Φ amount"
        >
          Φ
        </button>
        <button
          type="button"
          style={{ ...btnBase, opacity: amountMode === "USD" ? 1 : 0.55 }}
          onClick={() => setAmountMode("USD")}
          title="Send USD amount (converted)"
        >
          $
        </button>
      </div>

      {amountMode === "PHI" ? (
        <input
          inputMode="decimal"
          pattern="[0-9]*"
          placeholder="Φ amount"
          title="Φ amount to exhale"
          value={phiInput}
          onChange={(e) => setPhiInput(phiFormatter(e.target.value))}
          style={{ ...inputStyle, minWidth: 160 }}
        />
      ) : (
        <input
          inputMode="decimal"
          pattern="[0-9]*"
          placeholder="USD amount"
          title="USD amount to exhale"
          value={usdInput}
          onChange={(e) => setUsdInput(e.target.value.replace(/[^\d.]/g, ""))}
          style={{ ...inputStyle, minWidth: 160 }}
        />
      )}

      <div
        className="conv-right"
        style={{ minWidth: 120, fontVariantNumeric: "tabular-nums" }}
        aria-label="Converted display"
        title="Converted display"
      >
        {rightLabel}
      </div>

      <div
        className="remaining"
        style={{ marginLeft: "auto", minWidth: 160, textAlign: "right" }}
        title={
          canonicalContext === "derivative"
            ? "Resonance Φ remaining on this derivative"
            : "Resonance Φ remaining on this glyph"
        }
      >
        Remaining: Φ {remainingPhiDisplay4}
      </div>
    </div>
  );
};

export default SendPhiAmountField;
