// src/components/valuation/asset.ts
import JSZip from "jszip";
import { COLORS } from "./constants";

export async function sha256HexStable(s: string): Promise<string> {
  try {
    if (typeof window !== "undefined" && window.crypto?.subtle?.digest) {
      const buf = await window.crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(s)
      );
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch {
    /* ignore */
  }
  let h = 0 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i);
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function renderInlineGlyphSVG(opts: {
  width: number;
  height: number;
  label: string;
  donors: Array<{ hash?: string; amount: number }>;
  palette?: readonly string[];
}): string {
  const { width, height, label, donors, palette } = opts;
  const w = Math.max(64, Math.floor(width));
  const h = Math.max(64, Math.floor(height));
  const sum = donors.reduce((a, d) => a + Math.max(0, d.amount), 0) || 1;
  const colors: readonly string[] = palette && palette.length ? palette : COLORS;

  let angle = -Math.PI / 2;
  const cx = w / 2;
  const cy = h / 2;
  const rOuter = Math.min(w, h) * 0.46;
  const rInner = rOuter * 0.62;

  const arcs: string[] = [];

  donors.forEach((d, i) => {
    const frac = Math.max(0, d.amount) / sum;
    const theta = frac * Math.PI * 2;
    const start = angle;
    const end = angle + theta;
    angle = end;

    const x0 = cx + rOuter * Math.cos(start);
    const y0 = cy + rOuter * Math.sin(start);
    const x1 = cx + rOuter * Math.cos(end);
    const y1 = cy + rOuter * Math.sin(end);

    const xi0 = cx + rInner * Math.cos(end);
    const yi0 = cy + rInner * Math.sin(end);
    const xi1 = cx + rInner * Math.cos(start);
    const yi1 = cy + rInner * Math.sin(start);

    const largeArc = theta > Math.PI ? 1 : 0;
    const color = colors[i % colors.length];

    arcs.push(
      `<path d="M ${x0.toFixed(2)} ${y0.toFixed(
        2
      )} A ${rOuter.toFixed(2)} ${rOuter.toFixed(
        2
      )} 0 ${largeArc} 1 ${x1.toFixed(2)} ${y1.toFixed(
        2
      )} L ${xi0.toFixed(2)} ${yi0.toFixed(2)} A ${rInner.toFixed(2)} ${rInner.toFixed(
        2
      )} 0 ${largeArc} 0 ${xi1.toFixed(2)} ${yi1.toFixed(
        2
      )} Z" fill="${color}" stroke="rgba(0,0,0,.35)" stroke-width="0.75"/>`
    );
  });

  const ring = `<circle cx="${cx}" cy="${cy}" r="${(rInner - 3).toFixed(
    2
  )}" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.18)" stroke-width="1"/>`;
  const title = `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="${Math.max(
    10,
    Math.min(18, Math.round(Math.min(w, h) / 18))
  )}" font-weight="700" fill="rgba(255,255,255,.9)">${label}</text>`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Composite Kairos Glyph">`,
    `<rect width="100%" height="100%" fill="rgba(0,0,0,.35)" />`,
    `<g filter="url(#softGlow)">${arcs.join("")}${ring}${title}</g>`,
    `<defs><filter id="softGlow"><feGaussianBlur stdDeviation="0.75"/></filter></defs>`,
    `</svg>`,
  ].join("");
}

/** Render via KaiSigil if present, else inline fallback. */
export function renderGlyphSVG(
  label: string,
  donorsForRender: Array<{ hash?: string; amount: number }>
): string {
  const useKai =
    typeof window !== "undefined" && !!window.KaiSigil?.renderToSVG;
  if (useKai) {
    try {
      // NOTE: KaiSigil typings expect a mutable string[] for `palette`
      const svg = window.KaiSigil!.renderToSVG!({
        width: 1024,
        height: 1024,
        seed: label,
        label,
        donors: donorsForRender,
        palette: Array.from(COLORS), // <-- convert readonly tuple to mutable string[]
      });
      if (typeof svg === "string" && svg.includes("<svg")) return svg;
    } catch {
      /* fallback */
    }
  }
  return renderInlineGlyphSVG({
    width: 1024,
    height: 1024,
    label,
    donors: donorsForRender,
    palette: COLORS, // readonly is fine for our inline renderer
  });
}

export async function svgToPng(
  svg: string,
  width = 1024,
  height = 1024
): Promise<Blob> {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to load SVG into image"));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D not available");
    ctx.drawImage(img, 0, 0, width, height);
    const png = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), "image/png", 0.95)
    );
    if (!png) throw new Error("PNG encode failed");
    return png;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportGlyphZip(params: {
  svg: string;
  png: Blob;
  manifest: unknown;
  hash: string;
}): Promise<{ fileName: string; blob: Blob }> {
  const { svg, png, manifest, hash } = params;
  const zip = new JSZip();
  zip.file("glyph.svg", svg);
  zip.file("glyph.png", png);
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  const blob = await zip.generateAsync({ type: "blob" });
  const fileName = `glyph_${hash}.zip`;
  return { fileName, blob };
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
