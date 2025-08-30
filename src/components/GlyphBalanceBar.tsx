// src/components/GlyphBalanceBar.tsx
"use client";

import "./GlyphBalanceBar.css";
import type { Glyph } from "../glyph/types";

export interface GlyphBalanceBarProps {
  glyphs: Glyph[];
}

export default function GlyphBalanceBar({ glyphs }: GlyphBalanceBarProps) {
  const totalPhi = glyphs.reduce((acc, glyph) => acc + glyph.value, 0);

  return (
    <div className="glyph-balance-bar">
      <div className="glyph-balance-content">
        <span className="glyph-balance-label">Σ Glyph Value:</span>
        <span className="glyph-balance-amount">{totalPhi.toFixed(3)} Φ</span>
      </div>
      <div className="glyph-balance-fill">
        <div
          className="glyph-balance-bar-inner"
          style={{
            width: `${Math.min(totalPhi * 10, 100)}%`, // Cap visual width at 100%
          }}
        />
      </div>
    </div>
  );
}
