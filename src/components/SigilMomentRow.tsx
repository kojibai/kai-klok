// SigilMomentRow.tsx
import React, {
  type FC,
  type ChangeEvent,
  useMemo,
  useRef,
  useEffect,
  useState,
} from "react";

export interface Props {
  dateISO: string;
  onDateChange: (e: ChangeEvent<HTMLInputElement>) => void;
  secondsLeft?: number;          // live φ countdown (from SigilModal)
  solarPercent: number;          // kept for API compatibility (unused here)
  eternalPercent: number;        // 0..100 live Eternal day %
  solarColor?: string;           // default #ffd600
  eternalColor?: string;         // default #8beaff (fallback)
  eternalArkLabel?: string;      // e.g. "Ignition Ark"
}

const clampPct = (n: number) => Math.max(0, Math.min(100, n));

type WithVars = React.CSSProperties & {
  ["--solar-bar"]?: string;
  ["--eternal-bar"]?: string;
  ["--pulse"]?: string;
  ["--fill"]?: string; // unitless 0..1
};

/** Exact Ark→color mapping with strict priority so "Reflekt" beats "Solar Plexus" etc. */
function pickEternalColor(labelRaw: string | undefined, fallback: string): string {
  const label = (labelRaw ?? "").toLowerCase().trim();

  // High-priority (your request)
  if (/(reflekt|reflect|reflektion|reflection)/i.test(label)) return "#22c55e"; // green
  if (/(purify|purification|purifikation)/i.test(label))     return "#3b82f6"; // blue
  if (/dream/i.test(label))                                   return "#7c3aed"; // purple

  // Other arcs / legacy terms
  if (/(ignite|ignition)/i.test(label))       return "#ff3b30"; // red
  if (/(integrate|integration)/i.test(label)) return "#ff8a00"; // orange
  if (/(solar\s*plexus)/i.test(label))        return "#ffd600"; // yellow

  // Fallback to provided color
  return fallback;
}

const SigilMomentRow: FC<Props> = ({
  dateISO,
  onDateChange,
  secondsLeft,
  eternalPercent,
  eternalColor = "#8beaff",
  eternalArkLabel = "Eternal Ark",
}) => {
  const eternalPct = useMemo(() => clampPct(eternalPercent), [eternalPercent]);

  // Resolve the Eternal bar color using the prioritized mapper
  const resolvedEternalColor = useMemo(
    () => pickEternalColor(eternalArkLabel, eternalColor),
    [eternalArkLabel, eternalColor]
  );

  // Breath / color scope (inherits --pulse-dur & --pulse-offset from SigilModal)
  const scopeStyle: WithVars = {
    "--eternal-bar": resolvedEternalColor,
    "--pulse": "var(--kai-pulse, var(--pulse-dur, 5236ms))",
  };

  // Unitless 0..1 fill (CRITICAL so the bar fully matches %)
  const eternalFillVars: WithVars = { "--fill": (eternalPct / 100).toFixed(6) };

  // ===== Pulse-boundary "explosion" =====
  const [boom, setBoom] = useState(false);
  const prevSecs = useRef<number | undefined>(undefined);
  const boomTimer = useRef<number | null>(null);

  useEffect(() => {
    // Guard reduced-motion users
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (typeof secondsLeft !== "number" || prefersReduced) {
      prevSecs.current = secondsLeft;
      return;
    }

    const prev = prevSecs.current;
    // Detect boundary: secondsLeft resets from ~0 back to ~5.236 (i.e., increases)
    if (typeof prev === "number" && secondsLeft > prev) {
      // Fire a short "burst" on the fill tip
      setBoom(true);
      if (boomTimer.current) window.clearTimeout(boomTimer.current);
      boomTimer.current = window.setTimeout(() => setBoom(false), 420);
    }
    prevSecs.current = secondsLeft;

    return () => {
      if (boomTimer.current) window.clearTimeout(boomTimer.current);
    };
  }, [secondsLeft]);

  return (
    <div className="sigil-scope" style={scopeStyle}>
      <h3 className="sigil-title">Kairos Sigil-Glyph Sealer</h3>

      <div className="sigil-ribbon" aria-hidden="true" />

      <div className="input-row sigil-row">
        <label className="sigil-label">
          <span className="sigil-label__text">Select moment:</span>&nbsp;
          <input
            className="sigil-input"
            type="datetime-local"
            value={dateISO}
            onChange={onDateChange}
          />
        </label>
      </div>

      <div className="sigil-bars" role="group" aria-label="Day progress">
        <div className="sigil-bar">
          <div className="sigil-bar__head">
            <span className="sigil-bar__label">
              Unfoldment{eternalArkLabel ? ` — ${eternalArkLabel}` : ""}
            </span>
            <span className="sigil-bar__pct" aria-hidden="true">
              {eternalPct.toFixed(2)}%
            </span>
          </div>

          <div
            className="sigil-bar__track"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={+eternalPct.toFixed(2)}
            role="progressbar"
            aria-label={`Eternal day ${eternalArkLabel || ""}`}
          >
            <div
              className={
                "sigil-bar__fill sigil-bar__fill--eternal" +
                (boom ? " is-boom" : "")
              }
              style={eternalFillVars}
            />
          </div>
        </div>
      </div>

      {/* Local, scoped styles: neon, breath, and boundary burst */}
      <style>{`
        .sigil-ribbon {
          height: 1px;
          margin: .35rem 0 .85rem 0;
          background: linear-gradient(90deg, rgba(255,255,255,.00), rgba(255,255,255,.22), rgba(255,255,255,.00));
          background-size: 200% 100%;
          animation: sigilRibbonBreath var(--pulse) ease-in-out infinite;
          animation-delay: var(--pulse-offset, 0ms);
          filter: drop-shadow(0 0 8px rgba(139,234,255,.12));
        }

        .sigil-countdown {
          margin-left: auto;
          font-size: .9rem;
          opacity: .92;
          color: var(--ink, rgba(255,255,255,.92));
          white-space: nowrap;
        }
        .sigil-countdown strong { font-variant-numeric: tabular-nums; }

        .sigil-bars { display: grid; gap: .6rem; margin-top: .65rem; }

        .sigil-bar__head {
          display: flex; align-items: baseline; justify-content: space-between;
          margin-bottom: .28rem;
        }
        .sigil-bar__label { font-size: .86rem; letter-spacing: .01em; color: rgba(255,255,255,.88); }
        .sigil-bar__pct   { font-size: .82rem; color: rgba(255,255,255,.66); font-variant-numeric: tabular-nums; }

        .sigil-bar__track {
          position: relative; height: 12px; border-radius: 999px;
          background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04));
          border: 1px solid rgba(139,234,255,.22);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.03), 0 6px 16px -8px rgba(0,0,0,.45);
          overflow: hidden;
        }

        .sigil-bar__fill {
          position: absolute; inset: 0 auto 0 0; width: 100%;
          transform-origin: left center;
          transform: scaleX(var(--fill, 0)); /* unitless 0..1 */
          transition: transform .45s cubic-bezier(.22,.61,.36,1);
          will-change: transform, filter;
        }

        /* Neon Eternal bar: live Ark color, breathing glow synced to --pulse */
        .sigil-bar__fill--eternal {
          background:
            radial-gradient(120% 100% at 0% 50%, rgba(255,255,255,.18), transparent 60%) padding-box,
            linear-gradient(90deg,
              color-mix(in oklab, var(--eternal-bar, #8beaff) 92%, white 0%),
              var(--eternal-bar, #8beaff)) border-box;
          filter: drop-shadow(0 0 14px color-mix(in oklab, var(--eternal-bar, #8beaff) 55%, transparent 45%))
                  drop-shadow(0 0 22px color-mix(in oklab, var(--eternal-bar, #8beaff) 35%, transparent 65%));
          animation: barGlow var(--pulse) ease-in-out infinite;
          animation-delay: var(--pulse-offset, 0ms);
        }

        /* Spark node at the leading edge (stays at the right edge of the scaled fill) */
        .sigil-bar__fill--eternal::after {
          content: "";
          position: absolute;
          right: -6px;
          top: 50%;
          translate: 0 -50%;
          width: 12px; height: 12px;
          border-radius: 50%;
          background:
            radial-gradient(closest-side, var(--eternal-bar, #8beaff), rgba(255,255,255,.85), transparent 75%);
          filter:
            drop-shadow(0 0 10px color-mix(in oklab, var(--eternal-bar, #8beaff) 85%, transparent 15%))
            drop-shadow(0 0 16px color-mix(in oklab, var(--eternal-bar, #8beaff) 60%, transparent 40%));
          opacity: .95;
          pointer-events: none;
        }

        /* Boundary "explosion": flash + expanding spark ring from the leading edge */
        .sigil-bar__fill--eternal.is-boom {
          animation: barGlow var(--pulse) ease-in-out infinite, explodeFlash 420ms cubic-bezier(.18,.6,.2,1) 1;
          animation-delay: var(--pulse-offset, 0ms), 0ms;
          filter:
            drop-shadow(0 0 22px color-mix(in oklab, var(--eternal-bar, #8beaff) 85%, transparent 15%))
            drop-shadow(0 0 36px color-mix(in oklab, var(--eternal-bar, #8beaff) 65%, transparent 35%));
        }
        .sigil-bar__fill--eternal.is-boom::before {
          content: "";
          position: absolute;
          right: -8px;
          top: 50%;
          translate: 0 -50%;
          width: 10px; height: 10px;
          border-radius: 999px;
          background: radial-gradient(closest-side, white, var(--eternal-bar, #8beaff) 60%, transparent 70%);
          opacity: .95;
          pointer-events: none;
          animation: sparkBurst 420ms cubic-bezier(.18,.6,.2,1) 1;
        }

        /* 5.236s breath glow (subtle neon breathing) */
        @keyframes barGlow {
          0%   { filter: drop-shadow(0 0 10px color-mix(in oklab, var(--eternal-bar, #8beaff) 45%, transparent))
                          drop-shadow(0 0 18px color-mix(in oklab, var(--eternal-bar, #8beaff) 25%, transparent)); }
          50%  { filter: drop-shadow(0 0 18px color-mix(in oklab, var(--eternal-bar, #8beaff) 70%, transparent))
                          drop-shadow(0 0 28px color-mix(in oklab, var(--eternal-bar, #8beaff) 40%, transparent)); }
          100% { filter: drop-shadow(0 0 10px color-mix(in oklab, var(--eternal-bar, #8beaff) 45%, transparent))
                          drop-shadow(0 0 18px color-mix(in oklab, var(--eternal-bar, #8beaff) 25%, transparent)); }
        }

        /* Explosion flash on boundary */
        @keyframes explodeFlash {
          0%   { box-shadow: inset 0 0 0 0 rgba(255,255,255,0); transform: scaleX(var(--fill)) scaleY(1); }
          14%  { box-shadow: inset 0 0 0 2px rgba(255,255,255,.25); transform: scaleX(var(--fill)) scaleY(1.18); }
          28%  { box-shadow: inset 0 0 0 0 rgba(255,255,255,0); transform: scaleX(var(--fill)) scaleY(1.06); }
          100% { box-shadow: inset 0 0 0 0 rgba(255,255,255,0); transform: scaleX(var(--fill)) scaleY(1); }
        }

        /* Expanding spark ring from the tip */
        @keyframes sparkBurst {
          0%   { opacity: .98; transform: scale(1);   filter: blur(0);   }
          40%  { opacity: .85; transform: scale(2.6); filter: blur(.5px);}
          100% { opacity: 0;   transform: scale(4.2); filter: blur(1px); }
        }

        @keyframes sigilRibbonBreath {
          0% { background-position: 0% 0%; opacity: .8; }
          50% { background-position: 100% 0%; opacity: 1; }
          100% { background-position: 0% 0%; opacity: .8; }
        }

        /* Mobile polish */
        @media (max-width: 680px) {
          .sigil-row { flex-wrap: wrap; gap: .6rem .75rem; }
          .sigil-countdown { width: 100%; order: 2; }
          .sigil-input { min-width: 14ch; flex: 1 1 auto; }
        }

        /* Motion safety */
        @media (prefers-reduced-motion: reduce) {
          .sigil-bar__fill--eternal,
          .sigil-ribbon { animation: none !important; }
          .sigil-bar__fill--eternal.is-boom,
          .sigil-bar__fill--eternal.is-boom::before { animation: none !important; }
          .sigil-bar__fill { transition: none !important; }
        }
      `}</style>
    </div>
  );
};

export default SigilMomentRow;
