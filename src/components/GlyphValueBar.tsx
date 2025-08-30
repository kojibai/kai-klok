// src/components/GlyphValueBar.tsx
"use client";

import "./GlyphBalanceBar.css"; // reuse same CSS

export interface GlyphValueBarProps {
  value: number;
}

export default function GlyphValueBar({ value }: GlyphValueBarProps) {
  return (
    <div className="glyph-balance-bar">
      <div className="glyph-balance-content">
        <span className="glyph-balance-label">Glyph Value:</span>
        <span className="glyph-balance-amount">{value.toFixed(3)} Φ</span>
      </div>
      <div className="glyph-balance-fill">
        <div
          className="glyph-balance-bar-inner"
          style={{
            width: `${Math.min(value * 10, 100)}%`, // Cap at 100%
          }}
        />
      </div>
    </div>
  );
}
