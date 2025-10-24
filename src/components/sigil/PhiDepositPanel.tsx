import * as React from "react";
import {
  buildValueSeal,
  type ValueSeal,
  type SigilMetadataLite,
} from "../../utils/valuation";

/** Back-compat + new props (both supported) */
export type PhiDepositPanelProps = {
  /** Required in both modes */
  availablePhi: number;

  /** New mode: panel does valuation + deposit payload for you */
  onDepositToSigil?: (opts: {
    recipientPhiKey: string;
    amountPhi: number;
    valuation: ValueSeal;
    svgText: string;
    svgHash: string;
    file: File;
  }) => Promise<void> | void;
  creatorVerified?: boolean;
  creatorRep?: number; // 0..1

  /** Legacy mode: caller controls verification, amount, and deposit */
  ownerVerified?: boolean;
  ownershipMsg?: string;
  sendAmount?: number;
  onSendAmountChange?: (v: number) => void;
  onVerifyUpload?: (file: File) => void;
  onDeposit?: () => void;

  /** Shared */
  busy?: boolean;
  archived?: boolean;
};

const fmt = (n: number) =>
  Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 6 }) : "0";

/* ---- EXACT Kai constants (φ-exact; no drift) ------------------------------ */
/* Semantic lattice (engine expects pulses-per-step here, not steps-per-beat) */
const PULSES_PER_STEP = 11;

/* Genesis epoch (ms since Unix) — Sun-origin model anchor */
const GENESIS_TS_BI = 1715323541888n; // 2024-05-10T06:45:41.888Z

/* Inverse pulse duration scaled exactly (1000/T) with 60 decimal digits.
   This equals microPulses per millisecond. T = 3 + √5 (seconds). */
const INV_Tx1000_NUM_BI =
  190983005625052575897706582817180941139845410097118568932275689n; // ≈ 190.98300562505257...
const INV_Tx1000_DEN_BI = 10n ** 60n;

/** Euclidean floor division with negatives handled the same as Math.floor */
const floorDivE = (a: bigint, d: bigint) => {
  const q = a / d;
  const r = a % d;
  return r === 0n || a >= 0n ? q : q - 1n;
};

/** Bankers rounding for bigint mul/div: round-half-even on the quotient of (x * num / den). */
const mulDivRoundHalfEven = (x: bigint, num: bigint, den: bigint) => {
  if (den <= 0n) throw new Error("Denominator must be positive.");
  const sgn = (x < 0n ? -1n : 1n) * (num < 0n ? -1n : 1n);
  const A = (x < 0n ? -x : x) * (num < 0n ? -num : num);
  const q = A / den;
  const r = A % den;
  const twice = r * 2n;
  let n = q;
  if (twice > den) n = q + 1n;
  else if (twice === den && (q & 1n) === 1n) n = q + 1n; // ties-to-even
  return sgn * n;
};

/** Current Kai pulse index using φ-exact bridge: microPulses = ms * (1000/T), pulses = floor(μp/1e6). */
function kaiPulseNow(date = new Date()): number {
  const deltaMs = BigInt(date.getTime()) - GENESIS_TS_BI;
  const microPulses = mulDivRoundHalfEven(deltaMs, INV_Tx1000_NUM_BI, INV_Tx1000_DEN_BI);
  const pulses = floorDivE(microPulses, 1_000_000n);
  const MAX = BigInt(Number.MAX_SAFE_INTEGER);
  return Number(pulses > MAX ? MAX : pulses);
}

/* ---- hashing helpers ------------------------------------------------------ */
function bytesToHex(u8: Uint8Array): string {
  let s = "";
  for (let i = 0; i < u8.length; i++) s += u8[i].toString(16).padStart(2, "0");
  return s;
}
async function sha256Hex(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

/** If SVG includes data-kai-pulse="1234", use it; else derive a stable <= now value from the file hash. */
function inferClaimPulse(svgText: string, nowPulse: number, svgHexHash: string): number {
  const m = svgText.match(/data-kai-pulse\s*=\s*"(.*?)"/i);
  if (m && Number.isFinite(Number(m[1]))) {
    const n = Math.floor(Number(m[1]));
    if (n > 0 && n <= nowPulse) return n;
  }
  const hi = parseInt(svgHexHash.slice(0, 12), 16);
  const p = hi % Math.max(1, nowPulse);
  return Math.max(1, Math.min(p, nowPulse));
}

/** Deterministic page key for “this glyph as a sigil”. */
function recipientPhiKeyFromHash(svgHexHash: string): string {
  return `phi:${svgHexHash.slice(0, 40)}`;
}

export default function PhiDepositPanel(props: PhiDepositPanelProps) {
  const {
    availablePhi,
    // new-mode hooks (optional)
    onDepositToSigil,
    creatorVerified = false,
    creatorRep = 0,
    // legacy-mode hooks (optional)
    ownerVerified: ownerVerifiedProp,
    ownershipMsg: ownershipMsgProp,
    sendAmount: sendAmountProp,
    onSendAmountChange,
    onVerifyUpload,
    onDeposit,
    // shared
    busy: busyProp,
    archived = false,
  } = props;

  const inputRef = React.useRef<HTMLInputElement | null>(null);

  // Internal state for the new self-valuating flow
  const [busyInternal, setBusyInternal] = React.useState(false);
  const [sendAmountInternal, setSendAmountInternal] = React.useState(0);

  const [ownerVerifiedInternal, setOwnerVerifiedInternal] = React.useState(false);
  const [ownershipMsgInternal, setOwnershipMsgInternal] = React.useState<string>("");

  const [valuation, setValuation] = React.useState<ValueSeal | null>(null);
  const [recipientPhiKey, setRecipientPhiKey] = React.useState<string>("");
  const [svgText, setSvgText] = React.useState<string>("");
  const [svgHash, setSvgHash] = React.useState<string>("");
  const [fileMeta, setFileMeta] = React.useState<{ name: string; size: number } | null>(null);
  const [claimPulse, setClaimPulse] = React.useState<number | null>(null);

  // Controlled vs uncontrolled amount
  const amount = typeof sendAmountProp === "number" ? sendAmountProp : sendAmountInternal;
  const setAmount = onSendAmountChange ?? setSendAmountInternal;

  // Effective flags/messages (prefer internal, then legacy prop)
  const ownerVerified = ownerVerifiedInternal || !!ownerVerifiedProp;
  const ownershipMsg = ownershipMsgInternal || ownershipMsgProp || "";

  const isBusy = !!(busyProp ?? busyInternal);

  const disabledReason =
    archived
      ? "Archived link — cannot deposit"
      : !ownerVerified
      ? "Upload/verify your SVG first"
      : amount <= 0
      ? "Enter an amount > 0"
      : amount > (availablePhi || 0)
      ? "Amount exceeds available"
      : isBusy
      ? "Working…"
      : "";

  async function handleUpload(file: File) {
    // Always notify legacy handler first (if provided)
    try {
      onVerifyUpload?.(file);
    } catch {
      /* swallow legacy handler errors */
    }

    try {
      setBusyInternal(true);
      setOwnerVerifiedInternal(false);
      setOwnershipMsgInternal("Verifying and valuating…");

      const text = await file.text();
      setSvgText(text);
      setFileMeta({ name: file.name, size: file.size });

      const hashHex = await sha256Hex(text);
      setSvgHash(hashHex);

      const nowPulse = kaiPulseNow();
      const cp = inferClaimPulse(text, nowPulse, hashHex);
      setClaimPulse(cp);

      const meta: SigilMetadataLite = {
        kaiPulse: cp,
        // IMPORTANT: engine interprets this as pulses-per-step; send 11 (not 44)
        stepsPerBeat: PULSES_PER_STEP,
        seriesSize: 1,
        quality: "med",
        creatorVerified,
        creatorRep,
        transfers: [],
        valuationPolicyId: "vφ-5/Harmonia",
      };

      // hasher signature is (s: string) => Promise<string>
      const { seal } = await buildValueSeal(meta, nowPulse, (s: string) => sha256Hex(s));

      const key = recipientPhiKeyFromHash(hashHex);
      setRecipientPhiKey(key);
      setValuation(seal);
      setOwnerVerifiedInternal(true);

      setOwnershipMsgInternal(
        `Valued at ${seal.valuePhi.toFixed(6)} Φ • premium ${seal.premium.toFixed(6)} • key ${key}`
      );
    } catch (e) {
      console.error(e);
      setOwnerVerifiedInternal(false);
      setValuation(null);
      setRecipientPhiKey("");
      setOwnershipMsgInternal("Failed to verify/valuate file.");
    } finally {
      setBusyInternal(false);
    }
  }

  const handleDeposit = React.useCallback(async () => {
    if (onDepositToSigil && valuation && recipientPhiKey && svgText && svgHash) {
      setBusyInternal(true);
      try {
        await onDepositToSigil({
          recipientPhiKey,
          amountPhi: amount,
          valuation,
          svgText,
          svgHash,
          file: new File([svgText], fileMeta?.name ?? "sigil.svg", { type: "image/svg+xml" }),
        });
        setOwnershipMsgInternal(
          `Deposited ${amount.toFixed(6)} Φ → ${recipientPhiKey} • last value ${valuation.valuePhi.toFixed(6)} Φ`
        );
        setAmount(0);
      } finally {
        setBusyInternal(false);
      }
    } else if (onDeposit) {
      await onDeposit(); // legacy path
    }
  }, [
    amount,
    fileMeta?.name,
    onDeposit,
    onDepositToSigil,
    recipientPhiKey,
    setAmount,
    svgHash,
    svgText,
    valuation,
  ]);

  return (
    <section
      aria-label="Deposit Phi to this Sigil"
      className="sp-card"
      style={{
        marginTop: 16,
        padding: 16,
        borderRadius: 16,
        background: "linear-gradient(180deg, rgba(10,14,15,.92), rgba(6,10,12,.82))",
        boxShadow: "0 1px 0 rgba(255,255,255,.06) inset, 0 18px 60px rgba(0,0,0,.45)",
      }}
    >
      <header style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
        <h6 style={{ margin: 0 }}>Deposit Φ (COMING SOON!)</h6>
        <span
          title={
            ownerVerified
              ? "Stewardship/valuation verified"
              : ownershipMsg || "Upload any Φkey glyph to verify and valuate"
          }
          style={{
            padding: "3px 8px",
            borderRadius: 999,
            fontSize: 12,
            letterSpacing: ".08em",
            border: "1px solid rgba(255,255,255,.15)",
            background: ownerVerified
              ? "linear-gradient(180deg,#00ffc6,#00c2aa)"
              : "linear-gradient(180deg,#3c4b4b,#2a3638)",
            color: ownerVerified ? "#061012" : "#cfe9e1",
          }}
        >
          {ownerVerified ? "STEWARD VERIFIED" : "VERIFY STEWARDSHIP"}
        </span>
      </header>

      {/* Upload / verify */}
      <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
        <div
          role="group"
          aria-label="Upload your SVG sigil"
          style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".svg,image/svg+xml"
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              if (f) void handleUpload(f);
              if (inputRef.current) inputRef.current.value = ""; // allow re-pick
            }}
            style={{ display: "none" }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="sp-button"
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #ffffff22",
              background: "var(--sp-glass, rgba(12,18,20,.55))",
              cursor: "pointer",
            }}
          >
            Upload Φkey Glyph
          </button>

          <span style={{ opacity: 0.8, fontSize: 12 }}>
            {ownershipMsg || "Any real glyph works — value is computed from Kai-time & policy vφ-5."}
          </span>
        </div>

        {/* Valuation preview (new mode) */}
        {valuation && (
          <div
            aria-live="polite"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
              gap: 8,
              padding: 10,
              borderRadius: 12,
              border: "1px solid #ffffff22",
              background: "rgba(255,255,255,0.04)",
              color: "#cfe9e1",
              fontSize: 13,
            }}
          >
            <div>
              <strong>Value</strong>
              <br />
              {valuation.valuePhi.toFixed(6)} Φ
            </div>
            <div>
              <strong>Premium</strong>
              <br />
              {valuation.premium.toFixed(6)}
            </div>
            <div title={recipientPhiKey}>
              <strong>Sigil Key</strong>
              <br />
              <code style={{ fontSize: 12 }}>{recipientPhiKey}</code>
            </div>
            <div>
              <strong>Claim Pulse</strong>
              <br />
              {claimPulse ?? "—"}
            </div>
            {fileMeta && (
              <div>
                <strong>File</strong>
                <br />
                {fileMeta.name} · {fmt(fileMeta.size)} bytes
              </div>
            )}
          </div>
        )}
      </div>

      {/* Amount + available */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.8 }}>Amount to deposit (Φ)</span>
          <input
            inputMode="decimal"
            type="number"
            step="0.000001"
            min={0}
            max={Math.max(0, availablePhi)}
            value={Number.isFinite(amount) ? amount : 0}
            onChange={(e) => setAmount(Math.max(0, Number(e.currentTarget.value) || 0))}
            placeholder="0.00"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #ffffff22",
              background: "rgba(10,14,15,.55)",
              color: "#eafff7",
              outline: "none",
            }}
          />
        </label>

        <button
          type="button"
          title="Use your full available balance"
          onClick={() => setAmount(Math.max(0, availablePhi))}
          className="sp-button"
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #ffffff22",
            background: "var(--sp-glass, rgba(12,18,20,.55))",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          MAX ({fmt(availablePhi)} Φ)
        </button>
      </div>

      {/* Deposit */}
      <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={handleDeposit}
          disabled={!!disabledReason}
          className="sp-button"
          style={{
            opacity: disabledReason ? 0.6 : 1,
            cursor: disabledReason ? "not-allowed" : "pointer",
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid #00ffc622",
            background: "linear-gradient(180deg,#00ffc6,#00c2aa)",
            color: "#061012",
            fontWeight: 800,
            letterSpacing: ".08em",
          }}
          title={disabledReason || "Deposit Φ"}
        >
          {isBusy ? "Depositing…" : "Deposit Φ"}
        </button>
      </div>

      <footer style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
        Updates are written to this sigil’s ledger (URL <code>?d=</code> + local store) and broadcast in real-time.
      </footer>
    </section>
  );
}
