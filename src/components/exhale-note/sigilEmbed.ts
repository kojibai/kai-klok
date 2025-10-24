// src/components/exhale-note/sigilEmbed.ts
// Embed a (sanitized) raw Sigil SVG into a fixed slot with a glossy overlay and a clickable link.
// Strictly SVG 1.1–safe: NO 8-digit hex colors, only ASCII hyphens in attribute names,
// and explicit stroke + stroke-opacity where needed.

import { esc, sanitizeSvg, ensureSvgBackground } from "./sanitize";

/**
 * Safely embeds a user-provided sigil SVG into a rectangular slot on the note, wrapped in a link.
 * - Sanitizes incoming SVG.
 * - Ensures an opaque background inside the embedded SVG to avoid odd blending in PDF/PNG.
 * - Avoids SVG 1.1 parser pitfalls (e.g., #RRGGBBAA colors or smart dashes in attributes).
 */
export function embedSigilIntoSlotClickable(
  sigilRaw: string,
  slotX: number,
  slotY: number,
  slotW: number,
  slotH: number,
  hrefUrl: string
): string {
  const bgColor = "#0a1114";

  // 1) Sanitize and guarantee an internal background on the <svg>
  const safe = sanitizeSvg(sigilRaw || "");
  const withBg = ensureSvgBackground(safe, bgColor);

  // 2) Strip XML prolog/doctype if present; some exporters include these and they’re invalid nested.
  const stripped = withBg
    .replace(/^\s*<\?xml[\s\S]*?\?>/i, "")
    .replace(/^\s*<!DOCTYPE[\s\S]*?>/i, "");

  // 3) Extract outer <svg ...> and its children so we can re-position into the slot
  const openMatch = stripped.match(/<svg\b([^>]*)>/i);
  const closeMatch = stripped.match(/<\/svg>/i);
  const openTag = openMatch ? openMatch[0] : "<svg>";
  const svgAttrs = openMatch?.[1] ?? "";

  const inner =
    stripped.substring(
      openTag.length,
      closeMatch ? stripped.lastIndexOf(closeMatch[0]) : stripped.length
    ) || "";

  // 4) Reuse provided viewBox if present (support single or double quotes); default to square
  const vbMatch = svgAttrs.match(/viewBox\s*=\s*(['"])(.*?)\1/i);
  const viewBox = vbMatch ? vbMatch[2] : "0 0 1024 1024";

  // 5) Unique id for gloss gradient (avoid collisions if multiple notes render)
  const glossId = `kk-gloss-${Math.random().toString(36).slice(2)}`;

  // IMPORTANT:
  // - No 8-digit hex like #RRGGBBAA anywhere in this string.
  // - Only ASCII hyphens in attributes: stroke-opacity, stroke-width, etc.
  // - Explicit stroke + stroke-opacity instead of hex alpha in colors.

  return `
<defs>
  <linearGradient id="${glossId}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0"   stop-color="#ffffff" stop-opacity=".14"/>
    <stop offset=".35" stop-color="#ffffff" stop-opacity=".04"/>
    <stop offset=".7"  stop-color="#000000" stop-opacity=".02"/>
    <stop offset="1"   stop-color="#000000" stop-opacity="0"/>
  </linearGradient>
</defs>

<a href="${esc(hrefUrl)}" target="_blank" rel="noopener noreferrer" style="cursor:pointer" aria-label="Open verification link">
  <g>
    <!-- Slot background + subtle border (SVG 1.1 safe color/opacity) -->
    <rect
      x="${slotX}" y="${slotY}" width="${slotW}" height="${slotH}" rx="12"
      fill="${bgColor}"
      stroke="#2ad6c7" stroke-opacity=".2" stroke-width="1"
      vector-effect="non-scaling-stroke"
    />

    <!-- Embedded sigil, scaled to the slot -->
    <svg
      x="${slotX}" y="${slotY}"
      width="${slotW}" height="${slotH}"
      viewBox="${viewBox}"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-hidden="false"
    >${inner}</svg>

    <!-- Gloss overlay and inner rim -->
    <rect x="${slotX}" y="${slotY}" width="${slotW}" height="${slotH}" rx="12" fill="url(#${glossId})"/>
    <rect
      x="${slotX + 1}" y="${slotY + 1}" width="${slotW - 2}" height="${slotH - 2}" rx="10"
      fill="none" stroke="#ffffff" stroke-opacity=".08" stroke-width="1"
      vector-effect="non-scaling-stroke"
    />
  </g>
</a>
`.trim();
}
