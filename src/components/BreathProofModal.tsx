import { createPortal } from "react-dom";
import type { BreathProof } from "../hooks/useAuthorityProof";

export function BreathProofModal(props: {
  open: boolean;
  proof: BreathProof | null;
  onClose: () => void;
}) {
  const { open, proof, onClose } = props;
  if (!open || !proof) return null;

  return createPortal(
    <div
      className="sp-breathproof__backdrop"
      role="presentation"
      onClick={onClose}
      onMouseDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      style={{
        position: "fixed", inset: 0, zIndex: 2147483647, display: "flex",
        alignItems: "center", justifyContent: "center", padding: 16,
        background: "rgba(0,0,0,.55)", overflow: "auto", overscrollBehavior: "contain",
        WebkitOverflowScrolling: "touch", pointerEvents: "auto",
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="bp-title"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        style={{
          maxHeight: "calc(100dvh - 32px)", overflowY: "auto", overflowX: "hidden",
          WebkitOverflowScrolling: "touch", outline: "none", boxSizing: "border-box",
          width: "100%", maxWidth: "min(960px, calc(100vw - 32px))", margin: "0 auto",
          padding: 16, borderRadius: 16,
          background: "linear-gradient(180deg, rgba(10,14,15,.92), rgba(6,10,12,.82))",
          boxShadow: "0 1px 0 rgba(255,255,255,.06) inset, 0 24px 80px rgba(0,0,0,.55)",
          pointerEvents: "auto",
        }}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{
            position: "sticky", top: -8, marginLeft: "auto", display: "inline-flex",
            alignItems: "center", justifyContent: "center", width: 36, height: 36,
            borderRadius: 999, border: "1px solid #ffffff22",
            background: "rgba(12,18,20,.55)", backdropFilter: "blur(6px)", cursor: "pointer",
          }}
        >
          ×
        </button>

        <h3 id="bp-title" style={{ marginTop: -40, marginBottom: 10, wordBreak: "break-word" }}>
          Proof•of•Breath™
        </h3>
        <p>One breath. One pulse. One truth. Sealed by breath. Stamped in Kairos.</p>

        {/* Two pills: Sigma and Phi match */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
          <MatchPill label="KAI MATCH" icon="Σ" ok={proof.matches.sigma} />
          <MatchPill label="PHI MATCH" icon="Φ" ok={proof.matches.phi} />
        </div>

        <div style={{ marginTop: 12, wordBreak: "break-word", opacity: .9 }}>
          pulse={proof.pulse} • beat={proof.beat} • step={proof.stepIndex + 1}/{proof.stepsPerBeat} • spiral={proof.chakraDay}
        </div>
      </aside>
    </div>,
    document.body
  );
}

function MatchPill({ label, icon, ok }: { label: string; icon: string; ok: boolean }) {
  return (
    <div
      style={{
        display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8,
        padding: "10px 12px", borderRadius: 999,
        background: "linear-gradient(180deg, rgba(7,30,26,.85), rgba(6,18,20,.75))",
        border: "1px solid rgba(255,255,255,.16)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.06), 0 8px 22px rgba(0,0,0,.35)",
        minWidth: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center",
          background:
            "radial-gradient(closest-side, rgba(255,255,255,.9), rgba(255,255,255,.35) 60%, rgba(255,255,255,0) 61%), conic-gradient(#00FFC6, #FFD76E, #8AB4FF, #00FFC6)",
          boxShadow: "0 0 0 2px rgba(255,255,255,.25), 0 4px 18px rgba(0,255,198,.35), inset 0 0 10px rgba(255,255,255,.35)",
          color: "#061012", fontSize: 16, fontWeight: 900,
        }}
      >
        {icon}
      </span>
      <span style={{ opacity: 0.9, whiteSpace: "nowrap" }}>{label}:</span>
      <strong
        style={{
          justifySelf: "end", padding: "2px 10px", borderRadius: 999,
          fontSize: "clamp(10px, 3vw, 12px)", letterSpacing: "0.08em",
          background: ok ? "linear-gradient(180deg, #00FFC6, #00C2AA)" : "linear-gradient(180deg, #FF5F7A, #C2143F)",
          color: "#061012",
          boxShadow: ok
            ? "0 0 0 1px rgba(0,255,198,.45) inset, 0 0 22px rgba(0,255,198,.35)"
            : "0 0 0 1px rgba(255,95,122,.45) inset, 0 0 22px rgba(255,95,122,.35)",
          border: "1px solid rgba(255,255,255,.15)", whiteSpace: "nowrap",
        }}
      >
        {ok ? "YES" : "NO"}
      </strong>
    </div>
  );
}
