// src/components/GlyphLineage.tsx
// 🔗 Recursive Visual Lineage Viewer for Kairos Sigils

import { useMemo } from "react";
import type { Glyph, SentTransfer, InhaledGlyph } from "../glyph/types";
import "./GlyphLineage.css";

export type GlyphLineageProps = {
  glyph: Glyph;
  depth?: number;
};

export default function GlyphLineage({ glyph, depth = 0 }: GlyphLineageProps) {
  const { hash, pulseCreated, value, parentHash, metadata, sentTo } = glyph;

  // Memoized child extraction from recursive inhaled glyphs
  const children: Glyph[] = useMemo(() => {
    const raw: InhaledGlyph[] = glyph.inhaled ? Object.values(glyph.inhaled) : [];
    return raw
      .map((ig) => ig.glyph)
      .filter(isValidGlyph)
      .sort((a, b) => (a.pulseCreated ?? 0) - (b.pulseCreated ?? 0));
  }, [glyph.inhaled]);

  return (
    <div className="glyph-lineage-node" style={{ marginLeft: depth * 24 }}>
      <div className="glyph-card">
        <div className="glyph-hash">{hash}</div>
        <div className="glyph-meta">
          <div><strong>Φ:</strong> {value.toFixed(3)}</div>
          <div><strong>Pulse:</strong> {pulseCreated}</div>
          {parentHash && <div><strong>← from:</strong> {parentHash}</div>}
          {metadata?.kaiSignature && <div><strong>Σ:</strong> {metadata.kaiSignature}</div>}
          {metadata?.message && <div><strong>📝:</strong> {metadata.message}</div>}
        </div>

        {sentTo && sentTo.length > 0 && (
          <div className="glyph-sent-log">
            <strong>Sent →</strong>
            <ul>
              {sentTo.map((t: SentTransfer, i: number) => (
                <li key={i}>
                  {t.recipientHash} ({t.amount.toFixed(3)} Φ @ {t.pulseSent})
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Recursive Children */}
      {children.length > 0 && (
        <div className="glyph-children">
          {children.map((child: Glyph) => (
            <GlyphLineage key={child.hash} glyph={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// 💠 Guard: Ensure object is a valid Glyph (no 'any' used)
function isValidGlyph(obj: unknown): obj is Glyph {
    if (typeof obj !== "object" || obj === null) return false;
  
    const maybe = obj as Partial<Glyph>;
  
    return (
      typeof maybe.hash === "string" &&
      typeof maybe.pulseCreated === "number" &&
      typeof maybe.value === "number"
    );
  }
  
