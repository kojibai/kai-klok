// src/utils/qrExport.ts
import QRCode from "qrcode";
import { ensureMetadata, ensureTitleAndDesc, ensureViewBoxOnClone, ensureXmlns, NS } from "./svgMeta";

export const EXPORT_PX = 1024;
export const POSTER_PX = 2048;
export const OG_W = 1200;
export const OG_H = 630;

function injectDefs(svg: SVGSVGElement, accent: string) {
  // Find or create a <defs> element, strongly typed as SVGDefsElement
  let defs = svg.querySelector<SVGDefsElement>("defs");
  if (!defs) {
    defs = svg.ownerDocument!.createElementNS(NS.SVG_NS, "defs") as SVGDefsElement;
    // insert before first child (second arg can be null)
    svg.insertBefore(defs, svg.firstChild);
  }
  // defs is guaranteed non-null and correctly typed now

  const neonId = "ep-neon-glow";
  if (!svg.querySelector(`#${neonId}`)) {
    const f = svg.ownerDocument!.createElementNS(NS.SVG_NS, "filter");
    f.setAttribute("id", neonId);
    f.setAttribute("x", "-50%");
    f.setAttribute("y", "-50%");
    f.setAttribute("width", "200%");
    f.setAttribute("height", "200%");

    const blur1 = svg.ownerDocument!.createElementNS(NS.SVG_NS, "feGaussianBlur");
    blur1.setAttribute("stdDeviation", "3");
    blur1.setAttribute("result", "b1");

    const blur2 = svg.ownerDocument!.createElementNS(NS.SVG_NS, "feGaussianBlur");
    blur2.setAttribute("in", "SourceGraphic");
    blur2.setAttribute("stdDeviation", "1.2");
    blur2.setAttribute("result", "b2");

    const merge = svg.ownerDocument!.createElementNS(NS.SVG_NS, "feMerge");
    const m1 = svg.ownerDocument!.createElementNS(NS.SVG_NS, "feMergeNode");
    m1.setAttribute("in", "b1");
    const m2 = svg.ownerDocument!.createElementNS(NS.SVG_NS, "feMergeNode");
    m2.setAttribute("in", "b2");
    const m3 = svg.ownerDocument!.createElementNS(NS.SVG_NS, "feMergeNode");
    m3.setAttribute("in", "SourceGraphic");
    merge.appendChild(m1);
    merge.appendChild(m2);
    merge.appendChild(m3);

    f.appendChild(blur1);
    f.appendChild(blur2);
    f.appendChild(merge);
    defs.appendChild(f);
  }

  const glossId = "ep-gloss-gradient";
  if (!svg.querySelector(`#${glossId}`)) {
    const lg = svg.ownerDocument!.createElementNS(NS.SVG_NS, "linearGradient");
    lg.setAttribute("id", glossId);
    lg.setAttribute("x1", "0");
    lg.setAttribute("y1", "0");
    lg.setAttribute("x2", "0");
    lg.setAttribute("y2", "1");

    const s1 = svg.ownerDocument!.createElementNS(NS.SVG_NS, "stop");
    s1.setAttribute("offset", "0%");
    s1.setAttribute("stop-color", "rgba(255,255,255,0.15)");

    const s2 = svg.ownerDocument!.createElementNS(NS.SVG_NS, "stop");
    s2.setAttribute("offset", "100%");
    s2.setAttribute("stop-color", "rgba(255,255,255,0.05)");

    lg.appendChild(s1);
    lg.appendChild(s2);
    defs.appendChild(lg);
  }

  const barGlowId = "ep-bar-outer-glow";
  if (!svg.querySelector(`#${barGlowId}`)) {
    const f = svg.ownerDocument!.createElementNS(NS.SVG_NS, "filter");
    f.setAttribute("id", barGlowId);
    f.setAttribute("x", "-50%");
    f.setAttribute("y", "-50%");
    f.setAttribute("width", "200%");
    f.setAttribute("height", "200%");

    const flood = svg.ownerDocument!.createElementNS(NS.SVG_NS, "feFlood");
    flood.setAttribute("flood-color", accent);
    flood.setAttribute("flood-opacity", "0.5");
    flood.setAttribute("result", "c");

    const comp = svg.ownerDocument!.createElementNS(NS.SVG_NS, "feComposite");
    comp.setAttribute("in", "c");
    comp.setAttribute("in2", "SourceAlpha");
    comp.setAttribute("operator", "in");
    comp.setAttribute("result", "glow");

    const blur = svg.ownerDocument!.createElementNS(NS.SVG_NS, "feGaussianBlur");
    blur.setAttribute("in", "glow");
    blur.setAttribute("stdDeviation", "4");
    blur.setAttribute("result", "blurGlow");

    const merge = svg.ownerDocument!.createElementNS(NS.SVG_NS, "feMerge");
    const mg1 = svg.ownerDocument!.createElementNS(NS.SVG_NS, "feMergeNode");
    mg1.setAttribute("in", "blurGlow");
    const mg2 = svg.ownerDocument!.createElementNS(NS.SVG_NS, "feMergeNode");
    mg2.setAttribute("in", "SourceGraphic");
    merge.appendChild(mg1);
    merge.appendChild(mg2);

    f.appendChild(flood);
    f.appendChild(comp);
    f.appendChild(blur);
    f.appendChild(merge);
    defs.appendChild(f);
  }

  return {
    neonId: "ep-neon-glow",
    glossId: "ep-gloss-gradient",
    barGlowId: "ep-bar-outer-glow",
  };
}

export async function injectQrIntoSvg(
  svg: SVGSVGElement,
  opts: { accent: string; qrUrl: string }
) {
  const { accent, qrUrl } = opts;

  const vb = (
    svg.getAttribute("viewBox") ||
    `0 0 ${svg.getAttribute("width") || EXPORT_PX} ${svg.getAttribute("height") || EXPORT_PX}`
  )
    .trim()
    .split(/\s+/)
    .map(Number) as number[];

  const x0 = vb[0] || 0;
  const y0 = vb[1] || 0;
  const w = vb[2] || EXPORT_PX;
  const h = vb[3] || EXPORT_PX;

  const g = svg.ownerDocument!.createElementNS(NS.SVG_NS, "g");
  g.setAttribute("data-export-qr", "1");

  const minDim = Math.min(w, h);
  const margin = Math.max(minDim * 0.035, 18);
  const qrSize = Math.max(minDim * 0.1, 96);

  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    margin: 0,
    color: { dark: accent, light: "#00000000" },
    scale: 8,
  });

  const qr = svg.ownerDocument!.createElementNS(NS.SVG_NS, "image") as SVGImageElement;
  // Older UAs: xlink:href; SVG 2: href
  qr.setAttributeNS(NS.XLINK_NS, "xlink:href", qrDataUrl);
  (qr as unknown as Element).setAttribute("href", qrDataUrl);

  qr.setAttribute("x", String(x0 + margin));
  qr.setAttribute("y", String(y0 + h - qrSize - margin));
  qr.setAttribute("width", String(qrSize));
  qr.setAttribute("height", String(qrSize));
  qr.setAttribute("preserveAspectRatio", "xMidYMid meet");
  g.appendChild(qr);

  svg.appendChild(g);
}

export async function svgBlobForExport(
  svgEl: SVGSVGElement,
  px = EXPORT_PX,
  options?: {
    metaOverride?: unknown;
    addQR?: { accent: string; qrUrl: string } | false;
    addPulseBar?: { accent: string; pulseNumber: number } | false;
    title?: string;
    desc?: string;
  }
) {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  ensureViewBoxOnClone(clone, px);
  ensureXmlns(clone);
  ensureTitleAndDesc(
    clone,
    options?.title || "Kairos Sigil-Glyph — Sealed Kairos Moment",
    options?.desc || "Deterministic sigil-glyph with sovereign metadata."
  );

  if (options?.metaOverride) {
    const metaEl = ensureMetadata(clone);
    metaEl.textContent = JSON.stringify(options.metaOverride);
  }

  // Remove any previously injected export layers
  clone
    .querySelectorAll('[data-export-qr="1"],[data-export-pulsebar="1"]')
    .forEach((n) => n.parentNode?.removeChild(n));

  if (options?.addQR) {
    await injectQrIntoSvg(clone, options.addQR);
  }

  if (options?.addPulseBar) {
    const { accent, pulseNumber } = options.addPulseBar;
    const { barGlowId, neonId, glossId } = injectDefs(clone, accent);

    const vb = (clone.getAttribute("viewBox") || `0 0 ${px} ${px}`)
      .split(/\s+/)
      .map(Number) as number[];
    const [x0, y0, w, h] = [vb[0] || 0, vb[1] || 0, vb[2] || px, vb[3] || px];

    const g = clone.ownerDocument!.createElementNS(NS.SVG_NS, "g");
    g.setAttribute("data-export-pulsebar", "1");

    const minDim = Math.min(w, h);
    const margin = Math.max(minDim * 0.035, 18);
    const barW = Math.max(minDim * 0.34, 320);
    const barH = Math.max(minDim * 0.085, 96);
    const barR = Math.max(barH * 0.22, 18);
    const barX = x0 + w - barW - margin;
    const barY = y0 + h - barH - margin;

    const rect = clone.ownerDocument!.createElementNS(NS.SVG_NS, "rect");
    rect.setAttribute("x", String(barX));
    rect.setAttribute("y", String(barY));
    rect.setAttribute("rx", String(barR));
    rect.setAttribute("ry", String(barR));
    rect.setAttribute("width", String(barW));
    rect.setAttribute("height", String(barH));
    rect.setAttribute("fill", `url(#${glossId})`);
    rect.setAttribute("stroke", "rgba(255,255,255,0.16)");
    rect.setAttribute("stroke-width", String(Math.max(1.5, minDim * 0.0018)));
    rect.setAttribute("filter", `url(#${barGlowId})`);
    g.appendChild(rect);

    const pulseText = clone.ownerDocument!.createElementNS(NS.SVG_NS, "text");
    pulseText.setAttribute("x", String(barX + barW / 2));
    pulseText.setAttribute("y", String(barY + barH / 2 + Math.max(6, barH * 0.06)));
    pulseText.setAttribute("text-anchor", "middle");
    pulseText.setAttribute("dominant-baseline", "middle");
    pulseText.setAttribute("fill", accent);
    pulseText.setAttribute("filter", `url(#${neonId})`);
    pulseText.setAttribute("font-weight", "900");
    pulseText.setAttribute(
      "font-family",
      "Inter, ui-sans-serif, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial"
    );
    pulseText.setAttribute("font-size", String(Math.floor(barH * 0.46)));
    pulseText.textContent = pulseNumber.toLocaleString();
    g.appendChild(pulseText);

    clone.appendChild(g);
  }

  const xml = new XMLSerializer().serializeToString(clone);
  const finalXml = xml.startsWith("<?xml")
    ? xml
    : `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`;

  return new Blob([finalXml], { type: "image/svg+xml;charset=utf-8" });
}

export async function pngBlobFromSvg(svgBlob: Blob, px = EXPORT_PX) {
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = rej;
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unsupported");

    ctx.drawImage(img, 0, 0, px, px);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("PNG encode failed"))),
        "image/png"
      )
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
