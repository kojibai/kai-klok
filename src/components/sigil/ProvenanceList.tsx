// src/components/sigil/ProvenanceList.tsx
import { useEffect, useMemo, useState } from "react";
import type { ProvenanceEntry } from "../../types/sigil";

type Props = {
  entries: ProvenanceEntry[];
  steps: number; // steps per beat (usually 44)
};

/* ── Exact beat/step math (match EternalKlock) ────────────────────────────── */
const HARMONIC_DAY_PULSES_EXACT = 17_491.270421; // exact
const CHAKRA_BEATS_PER_DAY = 36;
const PULSES_PER_STEP = 11;                      // 11 breaths per step
const UPULSES = 1_000_000;                       // μpulses per pulse
const MU_PER_DAY = Math.round(HARMONIC_DAY_PULSES_EXACT * UPULSES);

const DAYS_PER_WEEK = 6;
const WEEKS_PER_MONTH = 7;
const MONTHS_PER_YEAR = 8;
const DAYS_PER_MONTH = DAYS_PER_WEEK * WEEKS_PER_MONTH; // 42
const DAYS_PER_YEAR = DAYS_PER_MONTH * MONTHS_PER_YEAR; // 336

const PHI = (1 + Math.sqrt(5)) / 2;

/* μpulse helpers (exact, floor-snapped to current μpulse) */
function muPerBeat() {
  return Math.round(
    (HARMONIC_DAY_PULSES_EXACT / CHAKRA_BEATS_PER_DAY) * UPULSES
  );
}
function muPosInDayFromPulse(pulse: number) {
  const muAbs = Math.floor(pulse * UPULSES); // snap down to current μpulse
  const mu = ((muAbs % MU_PER_DAY) + MU_PER_DAY) % MU_PER_DAY;
  return mu;
}
function exactBeatIndexFromPulse(pulse: number): number {
  const muBeat = muPerBeat();
  const muDay  = muPosInDayFromPulse(pulse);
  const idx = Math.floor(muDay / muBeat);  // 0..35
  return Math.min(Math.max(idx, 0), CHAKRA_BEATS_PER_DAY - 1);
}
function exactStepIndexFromPulse(pulse: number, stepsPerBeat: number): number {
  const muBeat   = muPerBeat();
  const muStep   = PULSES_PER_STEP * UPULSES;
  const muInBeat = muPosInDayFromPulse(pulse) % muBeat;
  const idx = Math.floor(muInBeat / muStep);  // 0..(steps-1)
  return Math.min(Math.max(idx, 0), Math.max(stepsPerBeat - 1, 0));
}
function exactPercentIntoStepFromPulse(pulse: number): number {
  const muBeat   = muPerBeat();
  const muStep   = PULSES_PER_STEP * UPULSES;
  const muInBeat = muPosInDayFromPulse(pulse) % muBeat;
  const muInto   = muInBeat % muStep;
  return Math.max(0, Math.min(1, muInto / muStep)); // 0..1
}
function pulsesIntoBeatFromPulse(pulse: number): number {
  const muBeat   = muPerBeat();
  const muInBeat = muPosInDayFromPulse(pulse) % muBeat;
  return Math.floor(muInBeat / UPULSES); // whole pulses since beat start
}

/* ── Kairos Calendar indices (NO Chronos) ────────────────────────────────
   Absolute day is 1-based for official display.
*/
function kaiCalendarFromPulse(pulse: number) {
  const pμ = BigInt(Math.floor(pulse * UPULSES));         // μpulses since Genesis (use full precision)
  const N_DAY_μ = BigInt(MU_PER_DAY);                     // μpulses per Kai-Day (exact)
  const absDayIdxBI = pμ / N_DAY_μ;                       // floor division (0..∞)
  const absDayIdxDisp = Number(absDayIdxBI) + 1;          // 1..∞ for display

  const dYear = Number(((absDayIdxBI % BigInt(DAYS_PER_YEAR)) + BigInt(DAYS_PER_YEAR)) % BigInt(DAYS_PER_YEAR)); // 0..335
  const yearIdx  = Math.floor(Number(absDayIdxBI) / DAYS_PER_YEAR); // 0..∞

  const monthIdx = Math.floor(dYear / DAYS_PER_MONTH);        // 0..7 (UI shows +1)
  const dayInMonth = (dYear % DAYS_PER_MONTH) + 1;            // 1..42

  const weekOfYear = Math.floor(dYear / DAYS_PER_WEEK);       // 0..55 (UI shows +1)
  const weekOfMonth = Math.floor((dayInMonth - 1) / DAYS_PER_WEEK); // 0..6 (UI shows +1)

  const dayOfWeek = (dYear % DAYS_PER_WEEK) + 1;              // 1..6

  return {
    absDayIdx: absDayIdxDisp, // 1..∞
    yearIdx,                   // 0..∞
    monthIdx,                  // 0..7
    weekOfYear,                // 0..55
    weekOfMonth,               // 0..6
    dayInMonth,                // 1..42
    dayOfWeek,                 // 1..6
  };
}

/* Display helpers */
const pad2 = (n: number) => String(n).padStart(2, "0");

/* Canonical seal builder (exactly mirrors values shown in the panel) */
function buildProvenanceSeal(opts: {
  e: ProvenanceEntry;
  stepsPerBeat: number;
  beat0: number;
  step0: number;
  stepPct: number;     // 0..1
  pulsesIntoBeat: number;
}) {
  const { e, beat0, step0, stepPct, pulsesIntoBeat } = opts;
  const k = kaiCalendarFromPulse(e.pulse);

  // Match the panel: Kai shown 0-based as "beat:SS"
  const kaiSegment = `Kai:${beat0}:${pad2(step0)}`;

  // Match the panel’s 1-based displays for Month, Week-of-Year, Week-of-Month
  const calSegment =
    `Y${k.yearIdx} M${pad2(k.monthIdx + 1)} W(y)${pad2(k.weekOfYear + 1)} ` +
    `W(m)${pad2(k.weekOfMonth + 1)} D(w)${k.dayOfWeek}/${DAYS_PER_WEEK} ` +
    `D(m)${pad2(k.dayInMonth)}/${DAYS_PER_MONTH} D(abs)${k.absDayIdx}`;

  const metrics =
    `Step%:${(stepPct * 100).toFixed(6)} PulsesInBeat:${pulsesIntoBeat}`;

  const phiLevel = Math.floor(Math.log(Math.max(e.pulse, 1)) / Math.log(PHI));

  return [
    `Action:${e.action}`,
    `Owner:${e.ownerPhiKey}`,
    `Pulse:${e.pulse}`,
    kaiSegment,
    calSegment,
    metrics,
    `PhiSpiral:${phiLevel}`,
    e.kaiSignature ? `KaiSig:${e.kaiSignature}` : null,
    e.attachmentName ? `Attachment:${e.attachmentName}` : null,
    e.atPulse != null ? `AtPulse:${e.atPulse}` : null,
  ]
    .filter(Boolean)
    .join(" • ");
}

/* SHA-256 helper with safe fallback (ties-to-even FNV-1a32) */
const getSubtle = (): SubtleCrypto | undefined => {
  const g = globalThis as unknown as { crypto?: Crypto };
  return g.crypto?.subtle;
};
async function sha256Hex(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const subtle = getSubtle();
  if (subtle) {
    try {
      const buf = await subtle.digest("SHA-256", encoded);
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
    } catch { /* fall through */ }
  }
  let h = 0x811c9dc5;
  for (let i = 0; i < encoded.length; i++) {
    h ^= encoded[i];
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/* Hook: compute SHA-256 for a string */
function useSha256(text: string) {
  const [hex, setHex] = useState<string>("");
  useEffect(() => {
    let alive = true;
    sha256Hex(text).then((h) => alive && setHex(h));
    return () => { alive = false; };
  }, [text]);
  return hex;
}

/* ── Sleek crystalline copy styles (frosted, subtle, gloss) ─────────────── */
const CrystallineCopyStyles = () => (
  <style>{`
    .copy-claim {
      --accent: var(--crystal-accent, #7FFFE1);
      --ink: #EAFBFF;
      --glassA: rgba(255,255,255,.14);
      --glassB: rgba(255,255,255,.04);
      --edge: rgba(255,255,255,.22);
      --shadow: 0 10px 28px rgba(0,0,0,.28);
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border: 1px solid var(--edge);
      border-radius: 16px;
      cursor: pointer;
      color: var(--ink);
      background:
        linear-gradient(180deg, var(--glassA), var(--glassB));
      backdrop-filter: blur(12px) saturate(160%);
      -webkit-backdrop-filter: blur(12px) saturate(160%);
      box-shadow: var(--shadow), inset 0 0 0 0.5px rgba(255,255,255,.18);
      transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, opacity .18s ease;
      will-change: transform, box-shadow;
    }
    .copy-claim:hover { transform: translateY(-1px); box-shadow: 0 12px 34px rgba(0,0,0,.3); border-color: rgba(255,255,255,.3); }
    .copy-claim:active { transform: translateY(0); }

    /* Subtle moving sheen */
    .copy-claim::before {
      content:"";
      position:absolute; inset:0;
      border-radius: inherit;
      background: linear-gradient(120deg, transparent 40%, rgba(255,255,255,.22), transparent 60%);
      transform: translateX(-140%);
      mix-blend-mode: screen;
      transition: transform .9s ease;
      pointer-events: none;
    }
    .copy-claim:hover::before { transform: translateX(140%); }

    /* Minimal success toast */
    .copy-toast {
      position: absolute;
      left: 50%; top: -10px;
      transform: translate(-50%, -100%) scale(.96);
      opacity: 0;
      pointer-events: none;
      color: var(--accent);
      background: rgba(255,255,255,.08);
      border: 1px solid rgba(255,255,255,.22);
      padding: 6px 10px;
      border-radius: 10px;
      box-shadow: 0 6px 18px rgba(0,0,0,.22), inset 0 0 12px rgba(127,255,225,.08);
      font-size: 12px;
      letter-spacing: .3px;
      backdrop-filter: blur(10px) saturate(150%);
      -webkit-backdrop-filter: blur(10px) saturate(150%);
      transition: opacity .18s ease, transform .18s ease;
      white-space: nowrap;
    }
    .copy-claim[data-copied="true"] .copy-toast {
      opacity: 1;
      transform: translate(-50%, -110%) scale(1);
    }

    /* Subtle ambient glow on success (no gaudy rings) */
    .copy-claim[data-copied="true"] {
      box-shadow:
        0 12px 34px rgba(0,0,0,.3),
        0 0 0 1px rgba(255,255,255,.25),
        0 0 40px color-mix(in srgb, var(--accent) 22%, transparent);
    }

    /* Icon + label */
    .crys__icon{ width: 16px; height: 16px; opacity:.95; }
    .crys__label{ font-weight:600; letter-spacing:.2px; }

    .copy-claim[disabled],
    .copy-claim[data-disabled="true"] { opacity: .55; cursor: not-allowed; }
    @media (prefers-reduced-motion: reduce) {
      .copy-claim, .copy-toast { transition: none; }
    }
  `}</style>
);

/* ── Copy control: builds final claim line and copies it (seal + hash) ───── */
function CopyClaim({ seal }: { seal: string }) {
  const hash = useSha256(seal);
  const claim = useMemo(() => (hash ? `${seal} • ProvenanseHash:${hash}` : ""), [seal, hash]);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!claim) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(claim);
      } else {
        const ta = document.createElement("textarea");
        ta.value = claim;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };

  const disabled = !hash;

  return (
    <button
      type="button"
      className="copy-claim"
      onClick={copy}
      data-copied={copied ? "true" : "false"}
      data-disabled={disabled ? "true" : "false"}
      aria-live="polite"
      aria-busy={disabled ? "true" : "false"}
      aria-label={disabled ? "Preparing claim…" : "Copy Provenanse Seal"}
      title={disabled ? "Preparing claim…" : "Copy Provenanse Seal"}
      disabled={disabled}
    >
      {/* Icon + label */}
      <svg className="crys__icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" strokeWidth="1.25" />
        <path d="M9 12.5l2 2 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span className="crys__label">{disabled ? "Preparing…" : "Copy Provenanse Seal"}</span>

      {/* Toast */}
      <span className="copy-toast" role="status" aria-live="polite">✓Copied</span>
    </button>
  );
}

export default function ProvenanceList({ entries, steps }: Props) {
  // Guards for safety when parent passes undefined/null
  const safeEntries = Array.isArray(entries) ? entries : [];
  const safeSteps = Number.isFinite(steps) && steps > 0 ? steps : 44;

  // Precompute everything once per (entries, steps)
  const derived = useMemo(() => {
    return safeEntries.map((e) => {
      const beat0        = exactBeatIndexFromPulse(e.pulse);
      const step0        = exactStepIndexFromPulse(e.pulse, safeSteps);
      const stepPct      = exactPercentIntoStepFromPulse(e.pulse);
      const pulsesInBeat = pulsesIntoBeatFromPulse(e.pulse);
      const k            = kaiCalendarFromPulse(e.pulse);
      const phiLevel     = Math.floor(Math.log(Math.max(e.pulse, 1)) / Math.log(PHI));
      const seal         = buildProvenanceSeal({
        e,
        stepsPerBeat: safeSteps,
        beat0,
        step0,
        stepPct,
        pulsesIntoBeat: pulsesInBeat,
      });

      return { e, beat0, step0, stepPct, pulsesInBeat, k, phiLevel, seal };
    });
  }, [safeEntries, safeSteps]);

  return (
    <div className="sp-provenance" role="region" aria-label="Provenance">
      <CrystallineCopyStyles />
      <h3 className="sp-prov-title">Provenanse</h3>
      <ol className="sp-prov-list">
        {derived.length === 0 && (
          <li className="sp-prov-empty" aria-live="polite">No provenance yet.</li>
        )}
        {derived.map((d, i) => {
          const { e, beat0, step0, stepPct, pulsesInBeat, k, phiLevel, seal } = d;

          return (
            <li key={i}>
              {/* ── Human summary (top) */}
              <div className="sp-prov-row">
                <span className="lbl">Action</span>
                <span>{e.action}</span>
              </div>
              <div className="sp-prov-row">
                <span className="lbl">Owner</span>
                <span className="mono mono-wrap">{e.ownerPhiKey}</span>
              </div>

              {/* ── Canonical identifiers */}
              <div className="sp-prov-row">
                <span className="lbl">Kai☤:</span>
                <span>{e.pulse.toLocaleString()}</span>
              </div>
              {e.kaiSignature && (
                <div className="sp-prov-row">
                  <span className="lbl">KaiSig</span>
                  <span className="mono mono-wrap">{e.kaiSignature}</span>
                </div>
              )}

              {/* ── Kai position (panel convention) */}
              <div className="sp-prov-row">
                <span className="lbl">Kairos</span>
                <span>{beat0}:{pad2(step0)}</span>
              </div>
              <div className="sp-prov-row">
                <span className="lbl">% into Step</span>
                <span>{(stepPct * 100).toFixed(6)}%</span>
              </div>
              <div className="sp-prov-row">
                <span className="lbl">Pulses in Beat</span>
                <span>{pulsesInBeat.toLocaleString()}</span>
              </div>

              {/* ── Kairos Calendar (abs day is 1-based; Month/Weeks show +1) */}
              <div className="sp-prov-row">
                <span className="lbl">Kai Year</span>
                <span>Y{String(k.yearIdx)}</span>
              </div>
              <div className="sp-prov-row">
                <span className="lbl">Kai Month</span>
                <span>{pad2(k.monthIdx + 1)} / {pad2(MONTHS_PER_YEAR)}</span>
              </div>
              <div className="sp-prov-row">
                <span className="lbl">Kai Week (Year)</span>
                <span>{pad2(k.weekOfYear + 1)} / {pad2(DAYS_PER_YEAR / DAYS_PER_WEEK)}</span>
              </div>
              <div className="sp-prov-row">
                <span className="lbl">Kai Week (Month)</span>
                <span>{pad2(k.weekOfMonth + 1)} / {pad2(WEEKS_PER_MONTH)}</span>
              </div>
              <div className="sp-prov-row">
                <span className="lbl">Kai Day (Week)</span>
                <span>{pad2(k.dayOfWeek)} / {pad2(DAYS_PER_WEEK)}</span>
              </div>
              <div className="sp-prov-row">
                <span className="lbl">Kai Day (Month)</span>
                <span>{pad2(k.dayInMonth)} / {pad2(DAYS_PER_MONTH)}</span>
              </div>
              <div className="sp-prov-row">
                <span className="lbl">Kai Day (Abs)</span>
                <span>{k.absDayIdx.toLocaleString()}</span>
              </div>

              {/* ── Phi spiral (deterministic, doc-only) */}
              <div className="sp-prov-row">
                <span className="lbl">Φ-Spiral Level</span>
                <span>{phiLevel}</span>
              </div>

              {/* ── Attachments / When (passthroughs) */}
              {e.attachmentName && (
                <div className="sp-prov-row">
                  <span className="lbl">Attachment</span>
                  <span className="mono mono-wrap">{e.attachmentName}</span>
                </div>
              )}
              {e.atPulse != null && (
                <div className="sp-prov-row">
                  <span className="lbl">When</span>
                  <span className="mono mono-wrap">
                    {typeof e.atPulse === "number"
                      ? e.atPulse.toLocaleString()
                      : String(e.atPulse)}
                  </span>
                </div>
              )}

              {/* ── Canonical Provenance Seal (display) */}
              <div className="sp-prov-row">
                <span className="lbl">Seal</span>
                <span className="mono mono-wrap">{seal}</span>
              </div>

              {/* ── One-click: copy ENTIRE claim (seal + hash) */}
              <div className="sp-prov-row">
                <span className="lbl">Stamp</span>
                <CopyClaim seal={seal} />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
