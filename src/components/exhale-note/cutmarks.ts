// src/components/exhale-note/cutmarks.ts

/**
 * Build printer-friendly corner cut marks.
 * Uses only explicit, standards-safe SVG attributes to avoid parser errors.
 */
export type CutMarksOptions = {
  stroke?: string;
  strokeWidth?: number;
};

export function buildCutMarks(
  x: number,
  y: number,
  w: number,
  h: number,
  inset: number,
  opts: CutMarksOptions = {}
): string {
  const stroke = opts.stroke ?? "#2ad6c7";
  const strokeWidth = opts.strokeWidth ?? 1;

  const x0 = x;
  const y0 = y;
  const x1 = x + w;
  const y1 = y + h;

  return `
<g id="kk-cutmarks"
   fill="none"
   stroke="${stroke}"
   stroke-width="${strokeWidth}"
   stroke-linecap="butt"
   stroke-linejoin="miter"
   vector-effect="non-scaling-stroke"
   shape-rendering="crispEdges">
  <!-- top-left -->
  <path d="M ${x0} ${y0 + inset} V ${y0} M ${x0} ${y0} H ${x0 + inset}" />
  <!-- top-right -->
  <path d="M ${x1} ${y0 + inset} V ${y0} M ${x1} ${y0} H ${x1 - inset}" />
  <!-- bottom-left -->
  <path d="M ${x0} ${y1 - inset} V ${y1} M ${x0} ${y1} H ${x0 + inset}" />
  <!-- bottom-right -->
  <path d="M ${x1} ${y1 - inset} V ${y1} M ${x1} ${y1} H ${x1 - inset}" />
</g>`.trim();
}
