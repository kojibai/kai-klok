"use client";

import React, { useState } from "react";
import "./GlyphModal.css";
import { canInhale, inhaleGlyphIntoTarget } from "./useGlyphLogic";
import type { Glyph } from "./types";

type Props = {
  targetGlyph: Glyph;
  onClose: () => void;
  onUpdate: (updatedGlyph: Glyph) => void;
};

export default function GlyphModal({ targetGlyph, onClose, onUpdate }: Props) {
  const [sourceGlyph, setSourceGlyph] = useState<Glyph | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        setSourceGlyph(parsed);
        setError(null);
      } catch {
        setError("Invalid glyph file.");
      }
    };
    reader.readAsText(file);
  }

  function handleInhale() {
    if (!sourceGlyph) return;
    const { allowed, reason } = canInhale(sourceGlyph, targetGlyph, amount);
    if (!allowed) return setError(reason ?? "Not allowed.");

    const updated = inhaleGlyphIntoTarget(sourceGlyph, { ...targetGlyph }, amount);
    onUpdate(updated);
    onClose();
  }

  return (
    <div className="glyph-modal">
      <h2>Inhale Glyph</h2>
      <input type="file" accept=".json" onChange={handleFileUpload} />
      {sourceGlyph && (
        <>
          <p>Source Glyph Value: {sourceGlyph.value.toFixed(3)} Φ</p>
          <input
            type="number"
            placeholder="Amount to inhale"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value))}
            min={0}
            step={0.001}
          />
          {error && <p className="error">{error}</p>}
          <button onClick={handleInhale}>Inhale</button>
        </>
      )}
      <button onClick={onClose}>Cancel</button>
    </div>
  );
}
