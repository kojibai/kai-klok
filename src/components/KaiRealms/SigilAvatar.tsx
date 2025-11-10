// /src/components/KaiRealms/SigilAvatar.tsx

import type { GlyphData } from './GlyphUtils';

// Chakra-based aura color map
const chakraColorMap: Record<string, string> = {
  Root: '#FF0033',
  Sacral: '#FF8000',
  Solar: '#FFD700',
  Heart: '#00FF99',
  Throat: '#33CCFF',
  ThirdEye: '#9933FF',
  Crown: '#AA00FF',
};

export function drawSigilGlyph(
  ctx: CanvasRenderingContext2D,
  glyph: GlyphData,
  x: number,
  y: number,
  radius: number
): void {
  ctx.save();
  ctx.translate(x, y);

  // Pull from nested meta (new GlyphData shape)
  const { chakraDay, pulse } = glyph.meta;

  // Get chakra aura color (fallback if unknown)
  const aura = chakraColorMap[chakraDay] ?? '#00FFFF';

  // Outer aura glow
  ctx.beginPath();
  ctx.arc(0, 0, radius + 4, 0, Math.PI * 2);
  ctx.fillStyle = aura;
  ctx.shadowColor = aura;
  ctx.shadowBlur = 15;
  ctx.fill();

  // Inner sigil core
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#000012';
  ctx.fill();

  // Pulse ring (optional visual for breathing)
  const pulsePhase = pulse % 11;
  const pulseRadius = radius + pulsePhase * 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
  ctx.strokeStyle = `${aura}AA`;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();
}
