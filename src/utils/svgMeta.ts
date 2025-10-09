import { STEPS_BEAT as STEPS_PER_BEAT } from "./kai_pulse";
import type { SigilMetaLoose, SigilPayload } from "../types/sigil";
import { stepIndexFromPulse } from "./kaiMath";

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

export function sanitizeSvgString(svg: string): string {
  if (typeof svg !== "string" || svg.trim() === "") return svg;
  let out = svg.replace(/<script[\s\S]*?<\/script>/gi, "");
  out = out.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "");
  out = out.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "");
  out = out.replace(/\son[a-z]+\s*=\s*[^\s>'"]+/gi, "");
  out = out.replace(/\s(?:xlink:)?href\s*=\s*"(?:https?:)?\/\/[^"]*"/gi, "");
  out = out.replace(/\s(?:xlink:)?href\s*=\s*'(?:https?:)?\/\/[^']*'/gi, "");
  out = out.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "");
  return out;
}

export function parseSvgAndMetadata(svgText: string): {
  svg: SVGSVGElement;
  meta: SigilMetaLoose;
} {
  const safe = sanitizeSvgString(svgText);
  const dom = new DOMParser().parseFromString(safe, "image/svg+xml");
  const svg = dom.documentElement as unknown as SVGSVGElement;
  if (!svg || svg.nodeName.toLowerCase() !== "svg") throw new Error("Invalid SVG");
  const metaEl = svg.querySelector("metadata");
  let meta: SigilMetaLoose = {};
  if (metaEl && metaEl.textContent) {
    try {
      meta = JSON.parse(metaEl.textContent) as SigilMetaLoose;
    } catch {
      meta = {};
    }
  }
  return { svg, meta };
}

export function ensureXmlns(svg: SVGSVGElement) {
  if (!svg.getAttribute("xmlns")) svg.setAttribute("xmlns", SVG_NS);
  if (!svg.getAttribute("xmlns:xlink")) svg.setAttribute("xmlns:xlink", XLINK_NS);
}

export function ensureMetadata(svg: SVGSVGElement): SVGMetadataElement {
  const doc = svg.ownerDocument ?? document;
  const existing = svg.querySelector<SVGMetadataElement>("metadata");
  if (existing) return existing;
  const created = doc.createElementNS(SVG_NS, "metadata") as SVGMetadataElement;
  svg.insertBefore(created, svg.firstChild);
  return created;
}

export function ensureTitleAndDesc(svg: SVGSVGElement, title: string, desc: string) {
  const doc = svg.ownerDocument ?? document;
  let t = svg.querySelector<SVGTitleElement>("title");
  if (!t) {
    t = doc.createElementNS(SVG_NS, "title") as SVGTitleElement;
    svg.insertBefore(t, svg.firstChild);
  }
  t.textContent = title;

  let d = svg.querySelector<SVGDescElement>("desc");
  if (!d) {
    d = doc.createElementNS(SVG_NS, "desc") as SVGDescElement;
    svg.insertBefore(d, t.nextSibling);
  }
  d.textContent = desc;
}

export function ensureViewBoxOnClone(clone: SVGSVGElement, px: number) {
  if (!clone.getAttribute("viewBox")) {
    try {
      const vb = clone.viewBox.baseVal;
      if (vb?.width && vb?.height) {
        clone.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.width} ${vb.height}`);
      } else if (typeof clone.getBBox === "function") {
        const bbox = clone.getBBox();
        if (bbox?.width && bbox?.height) {
          clone.setAttribute("viewBox", `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
        } else {
          clone.setAttribute("viewBox", `0 0 ${px} ${px}`);
        }
      } else {
        clone.setAttribute("viewBox", `0 0 ${px} ${px}`);
      }
    } catch {
      clone.setAttribute("viewBox", `0 0 ${px} ${px}`);
    }
  }

  clone.setAttribute("width", String(px));
  clone.setAttribute("height", String(px));
  clone.setAttribute("preserveAspectRatio", "xMidYMid meet");
}


export function putMetadata(svg: SVGSVGElement, meta: unknown): string {
  const metaEl = ensureMetadata(svg);
  metaEl.textContent = JSON.stringify(meta);
  ensureXmlns(svg);
  const xml = new XMLSerializer().serializeToString(svg);
  return xml.startsWith("<?xml") ? xml : `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`;
}

const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const asNumber = (v: unknown, def = 0): number => {
  if (isFiniteNumber(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  }
  return def;
};
export function validateSigilMeta(meta: SigilMetaLoose): {
  ok: boolean;
  errors: string[];
  normalized?: SigilPayload;
} {
  const errors: string[] = [];

  if (meta.pulse == null) errors.push("Missing metadata field: pulse");
  if (meta.beat == null) errors.push("Missing metadata field: beat");
  if (meta.chakraDay == null) errors.push("Missing metadata field: chakraDay");
  if (errors.length > 0) return { ok: false, errors };

  const steps = Number.isFinite(meta.stepsPerBeat)
    ? Math.max(1, Number(meta.stepsPerBeat))
    : STEPS_PER_BEAT;

  const pulseNum = Number(meta.pulse);

  // ✅ KKS rule: honor the embedded step if present & in-range. Only derive as a fallback.
  const providedStep = Number(meta.stepIndex);
  const stepIndex =
    Number.isFinite(providedStep) && providedStep >= 0 && providedStep < steps
      ? Math.trunc(providedStep)
      : stepIndexFromPulse(pulseNum, steps);

  const stepPct = typeof meta.stepPct === "number"
    ? Math.max(0, Math.min(1, meta.stepPct))
    : (stepIndex + 1e-9) / steps;

  const exp = asNumber(meta.expiresAtPulse, NaN);
  const expd = asNumber(meta.exportedAtPulse, NaN);

  const rxUnit = typeof meta.claimExtendUnit === "string"
    ? String(meta.claimExtendUnit).toLowerCase()
    : "";
  const claimExtendUnit: SigilPayload["claimExtendUnit"] =
    rxUnit === "steps" ? "steps" : rxUnit === "breaths" ? "breaths" : undefined;

  const claimExtendAmount =
    meta.claimExtendAmount != null && Number.isFinite(Number(meta.claimExtendAmount))
      ? Math.max(0, Math.floor(Number(meta.claimExtendAmount)))
      : undefined;

  const normalized: SigilPayload = {
    pulse: pulseNum,
    beat: Number(meta.beat),
    stepIndex,                    // ← authoritative KKS step
    stepPct,
    chakraDay: meta.chakraDay as SigilPayload["chakraDay"],
    kaiSignature: typeof meta.kaiSignature === "string" ? meta.kaiSignature : undefined,
    userPhiKey: typeof meta.userPhiKey === "string" ? meta.userPhiKey : undefined,
    stepsPerBeat: steps,
    provenance: Array.isArray(meta.provenance) ? meta.provenance : undefined,
    attachment: typeof meta.attachment === "object" ? meta.attachment : undefined,
    expiresAtPulse: Number.isFinite(exp) ? exp : undefined,
    canonicalHash: typeof meta.canonicalHash === "string" ? meta.canonicalHash : undefined,
    transferNonce: typeof meta.transferNonce === "string" ? meta.transferNonce : undefined,
    exportedAtPulse: Number.isFinite(expd) ? expd : undefined,
    claimExtendUnit,
    claimExtendAmount,
    zkPoseidonHash: "",
    zkProof: { pi_a: ["", "", ""], pi_b: [["", ""], ["", ""], ["", ""]], pi_c: ["", "", ""] },
    ownerPubKey: {},
    ownerSig: "",
    originalAmount: 0,
    debits: [],
    totalDebited: 0,
    lineageRoot: null,
    eternalRecord: "",
    creatorResolved: "",
    origin: "",
    proofHints: { scheme: "", api: "", explorer: "" },
  };

  return { ok: true, errors: [], normalized };
}


export function validateSvgForVerifier(svgText: string, expectedHash?: string) {
  try {
    const { svg, meta } = parseSvgAndMetadata(svgText);
    const hasXmlns = !!svg.getAttribute("xmlns") && !!svg.getAttribute("xmlns:xlink");
    const hasViewBox = !!svg.getAttribute("viewBox");
    const hasWH = !!svg.getAttribute("width") && !!svg.getAttribute("height");
    const { ok, errors, normalized } = validateSigilMeta(meta);

    if (!hasXmlns) errors.push("Missing xmlns / xmlns:xlink on <svg>.");
    if (!hasViewBox) errors.push("Missing viewBox on <svg>.");
    if (!hasWH) errors.push("Missing width/height on <svg>.");
    if (expectedHash && normalized?.canonicalHash && normalized.canonicalHash !== expectedHash) {
      errors.push("canonicalHash in Φkey metadata does not match the live glyph hash.");
    }

    return { ok: errors.length === 0 && ok, errors, payload: normalized ?? null, meta };
  } catch (e) {
    const msg = (e instanceof Error && e.message) ? e.message : "Invalid SVG";
    return { ok: false, errors: [msg], payload: null, meta: null };
  }
}

export const NS = { SVG_NS, XLINK_NS };

/**
 * Export an SVG with embedded metadata as a downloadable .svg file.
 * @param svgId - DOM ID of the SVG element to export
 * @param metadata - metadata object to embed inside <metadata> tag
 */
export async function exportSigilAsSvg(svgId: string, metadata: Record<string, unknown>): Promise<void> {
  const svg = document.getElementById(svgId) as SVGSVGElement | null;
  if (!svg) throw new Error(`SVG element with ID "${svgId}" not found`);

  const clone = svg.cloneNode(true) as SVGSVGElement;

  // Insert or update metadata
  const metaTag = clone.querySelector("metadata") ?? document.createElementNS(SVG_NS, "metadata");
  metaTag.textContent = JSON.stringify(metadata, null, 2);
  if (!metaTag.parentNode) {
    clone.insertBefore(metaTag, clone.firstChild);
  }

  // Ensure required xmlns
  ensureXmlns(clone);

  // Serialize
  const serializer = new XMLSerializer();
  const serialized = serializer.serializeToString(clone);
  const fullSvg = serialized.startsWith("<?xml")
    ? serialized
    : `<?xml version="1.0" encoding="UTF-8"?>\n${serialized}`;

  // Download
  const blob = new Blob([fullSvg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${metadata["investmentId"] || "sigil"}.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
