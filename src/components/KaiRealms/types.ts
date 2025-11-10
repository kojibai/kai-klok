// /src/components/KaiRealms/types.ts

// src/components/KaiRealms/types.ts
import type { GlyphData } from './GlyphUtils';

/**
 * Basic in-game orb
 */
export type KaiOrb = {
  id: string;
  x: number;
  y: number;
};

/**
 * Minimal player state shared on the network.
 * Local player will send the full payload; peers may omit glyph (optional)
 * but RemotePlayerState requires a glyph for rendering.
 */
export type PlayerState = {
  id: string;
  x: number;
  pulseIndex: number;
  chakraDay: string;
  // glyph optional on the wire for lighter messages; can be present
  glyph?: GlyphData;
};

/**
 * Remote players we render in the scene — must include glyph for unique sigil.
 */
export type RemotePlayerState = PlayerState & {
  glyph: GlyphData;
};
