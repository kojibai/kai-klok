// src/components/GlyphVault.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import "./GlyphVault.css";

import type { Glyph } from "../glyph/types";
import { loadStoredGlyphs, formatPhi } from "../glyph/glyphUtils";
import { Eye, UploadCloud, Send } from "lucide-react";
import GlyphValueBar from "./GlyphValueBar";
export default function GlyphVault() {
  const [glyphs, setGlyphs] = useState<Glyph[]>([]);

  const loadVault = useCallback(() => {
    const loaded = loadStoredGlyphs();
    const sorted = loaded.sort((a, b) => b.pulseCreated - a.pulseCreated);
    setGlyphs(sorted);
  }, []);

  useEffect(() => {
    loadVault();
  }, [loadVault]);

  return (
    <div className="glyph-vault-container">
      <h2 className="vault-title">🧿 Glyph Vault</h2>
      <p className="vault-subtitle">Your local recursive memory bank</p>

      {glyphs.length === 0 ? (
        <div className="vault-empty">No glyphs stored yet.</div>
      ) : (
        <div className="glyph-grid">
          {glyphs.map((glyph) => (
            <div className="glyph-card" key={glyph.hash}>
              <div className="glyph-card-header">
                <div className="glyph-hash">
                  <strong>ID:</strong>{" "}
                  <span>
                    {glyph.hash.slice(0, 8)}…{glyph.hash.slice(-6)}
                  </span>
                </div>
                <div className="glyph-pulse">
                  <strong>Pulse:</strong> {glyph.pulseCreated}
                </div>
              </div>

              <GlyphValueBar value={glyph.value} />

              <div className="glyph-value-label">
                {formatPhi(glyph.value)}
              </div>

              <div className="glyph-card-footer">
                <button className="glyph-btn">
                  <Eye size={16} />
                  View
                </button>
                <button className="glyph-btn">
                  <Send size={16} />
                  Send
                </button>
                <button className="glyph-btn">
                  <UploadCloud size={16} />
                  Export
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
