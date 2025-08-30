/* ────────────────────────────────────────────────────────────────
   KairosGlyphViewer.tsx · Atlantean Lumitech “Live Sigil Viewer”
   v6.1 — FIXED: Modal no longer closes immediately
   • Adds `.sigil-modal-overlay` for EternalKlock guards
   • Modal opens on click, stays open, closes only with 'Close'
───────────────────────────────────────────────────────────────── */

import React, { useState, useEffect, useRef } from "react";
import html2canvas from "html2canvas";
import { SigilRenderer } from "./SigilRenderer";

/* ═════  H A R M O N I C   C O N S T A N T S  ═══════════════════ */
const PHI = (1 + Math.sqrt(5)) / 2;
const PULSE_DURATION = 8.472 / PHI; // ≈ 5.236 s
const GENESIS_UTC = Date.UTC(2024, 4, 10, 6, 45, 40);
const BEATS_PER_DAY = 36;
const BEAT_PULSE_COUNT = 485.87;
const STEPS_PER_BEAT = 44;
const STEP_PULSE_COUNT = BEAT_PULSE_COUNT / STEPS_PER_BEAT;

/* ── Utility: convert Date → Eternal Pulse # ─────────────────── */
function getEternalPulseFromDateLocal(d: Date): number {
  const diffSec = (d.getTime() - GENESIS_UTC) / 1_000;
  return Math.floor(diffSec / PULSE_DURATION);
}

/* ── Utility: pulse → beat, step, step % ─────────────────────── */
function pulseToBeatStep(pulse: number) {
  const beatIdx = Math.floor(pulse / BEAT_PULSE_COUNT) % BEATS_PER_DAY;
  const pulsesIntoBeat = pulse - beatIdx * BEAT_PULSE_COUNT;
  const stepIdx = Math.floor(pulsesIntoBeat / STEP_PULSE_COUNT);
  const stepPct = pulsesIntoBeat / BEAT_PULSE_COUNT;
  return { beatIdx, stepIdx, stepPct };
}

/* ═════  C O M P O N E N T  ═════════════════════════════════════ */
export const KairosGlyphViewer: React.FC = () => {
  const [now, setNow] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [customInput, setCustom] = useState("");
  const [targetDate, setTarget] = useState<Date | null>(null);
  const glyphRef = useRef<HTMLDivElement>(null);

  /* Tick every Kai-Pulse (~5.236 s) */
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), PULSE_DURATION * 1000);
    return () => clearInterval(id);
  }, []);

  const date = targetDate ?? now;
  const pulse = getEternalPulseFromDateLocal(date);
  const { beatIdx: beat, stepIdx: step, stepPct } = pulseToBeatStep(pulse);

  /* Date-picker handler */
  const onDateChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const d = new Date(e.target.value);
    setCustom(e.target.value);
    if (!isNaN(d.getTime())) setTarget(d);
  };

  /* PNG exporter */
  const saveGlyph = async () => {
    if (!glyphRef.current) return;
    const canvas = await html2canvas(glyphRef.current);
    const link = document.createElement("a");
    link.download = `kairos_sigil_p${pulse}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div>
      {/* Inline glyph preview */}
      <div
        ref={glyphRef}
        style={{ cursor: "pointer", display: "inline-block" }}
        onClick={(e) => {
          e.stopPropagation(); // prevent accidental outside click
          setShowModal(true);
        }}
      >
        <SigilRenderer pulse={pulse} beat={beat} stepPct={stepPct} />
      </div>

      {/* Modal — key fix: .sigil-modal-overlay added */}
      {showModal && (
        <div className="modal sigil-modal-overlay">
          <div className="modal-content">
            <h2>Kairos Sigil — {date.toUTCString()}</h2>
            <p>
              Eternal Pulse&nbsp;<strong>{pulse}</strong> • Beat{" "}
              {beat + 1}/{BEATS_PER_DAY} • Step {step + 1}/{STEPS_PER_BEAT} (
              {(stepPct * 100).toFixed(2)}%)
            </p>

            <input
              type="datetime-local"
              value={customInput}
              onChange={onDateChange}
              style={{ padding: 8, width: "100%", margin: "12px 0" }}
            />

            <div ref={glyphRef}>
              <SigilRenderer
                pulse={pulse}
                beat={beat}
                stepPct={stepPct}
                size={220}
              />
            </div>

            <button onClick={saveGlyph} style={{ marginRight: 8 }}>
              Save PNG
            </button>
            <button onClick={() => setShowModal(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};
