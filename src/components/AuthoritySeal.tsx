type VerifyUIState = "verified" | "ok" | "mismatch" | "error" | "notfound" | "checking";

export function AuthoritySeal(props: {
  verified: VerifyUIState;
  pressed: boolean;
  onToggle: () => void;
}) {
  const { verified, pressed, onToggle } = props;
  const isVerified = verified === "verified";

  return (
    <>
      <style>{`
      .authority-seal{
        --gold:#ffd76e; --mint:#00ffc6; --aqua:#8ab4ff; --ink:#061012; --glass:rgba(10,14,15,.86);
        --fail:#ff184c; --fail-2:#ff4d6d; --fail-3:#ff0f3a;
        --pulse:5.236s;
        position:relative; display:grid; grid-template-columns:auto 1fr; align-items:center; gap:8px;
        width:fit-content; max-width:min(360px,92vw); min-width:220px; margin:8px auto; padding:7px 10px;
        border-radius:9999px; text-transform:uppercase; letter-spacing:.11em; font-weight:900; color:#eafff7;
        background: linear-gradient(180deg,var(--glass),rgba(6,10,12,.78)) padding-box,
                   conic-gradient(from 180deg at 50% 50%, var(--gold), var(--mint), var(--aqua), var(--gold)) border-box;
        border:1px solid transparent; background-clip:padding-box, border-box;
        box-shadow:0 1px 0 rgba(255,255,255,.06) inset, 0 0 0 1px rgba(0,255,198,.14),
                   0 10px 28px rgba(0,0,0,.40), 0 0 22px rgba(0,255,198,.10);
      }
      .authority-seal:focus-visible{ outline:none; box-shadow:
        0 0 0 2px rgba(255,255,255,.14), 0 0 0 4px rgba(0,255,198,.22), 0 18px 52px rgba(0,0,0,.5); }
      .authority-seal__emblem{
        width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:900;color:var(--ink);
        background: radial-gradient(closest-side, rgba(255,255,255,.95), rgba(255,255,255,.36) 62%, rgba(255,255,255,0) 63%),
                    conic-gradient(var(--mint), var(--gold), var(--aqua), var(--mint));
        box-shadow:0 0 0 1px rgba(255,255,255,.22), 0 3px 10px rgba(0,255,198,.28), inset 0 0 6px rgba(255,255,255,.26);
      }
      .authority-seal__content{ display:grid; grid-auto-rows:min-content; gap:4px; min-width:0; }
      .authority-seal__headline{ display:flex; align-items:center; gap:6px;
        font-size:clamp(10.5px,1.6vw,12px); letter-spacing:.11em; white-space:nowrap; }
      .authority-seal__chip{
        align-self:start; justify-self:start; padding:3px 8px; border-radius:999px;
        font-size:clamp(10px,1.6vw,11.5px); letter-spacing:.11em; color:var(--ink);
        border:1px solid rgba(255,255,255,.15);
        background:linear-gradient(180deg,#00ffc6,#00c2aa);
        box-shadow:inset 0 1px 0 rgba(255,255,255,.14), 0 0 14px rgba(0,255,198,.16);
      }
      .authority-seal.is-verified .authority-seal__state{ color:var(--mint); text-shadow:0 0 12px rgba(0,255,198,.18); }
      .authority-seal.is-failed   .authority-seal__state{ color:#ff184c; text-shadow:0 0 12px rgba(255,24,76,.25); }
      `}</style>

      <button
        type="button"
        className={`authority-seal ${isVerified ? "is-verified" : "is-failed"}`}
        aria-pressed={pressed}
        aria-label="Show breath proof"
        title="Tap to show breath proof"
        onClick={onToggle}
      >
        <span className="authority-seal__emblem" aria-hidden="true">
          {isVerified ? "✓" : "✕"}
        </span>
        <div className="authority-seal__content">
          <div className="authority-seal__headline">
            <span className="authority-seal__state">{isVerified ? "VERIFIED" : "Out•Of•Sync"}</span>
            <span aria-hidden>•</span>
            <span>PROOF•OF•BREATH™</span>
          </div>
          <div className="authority-seal__chip">{isVerified ? "SEAL VALID" : "SEAL FAILED"}</div>
        </div>
      </button>
    </>
  );
}
