// src/components/VerifierStamper/svg.ts
import { SIGIL_CTX, SIGIL_TYPE } from "./constants";
import type { SigilMetadata } from "./types";
import { sha256Hex } from "./crypto";

/* SVG attribute helpers */
export function getAttr(svg: string, key: string): string | undefined {
  const m = svg.match(new RegExp(`${key}="([^"]+)"`, "i"));
  return m ? m[1] : undefined;
}
export function getIntAttr(svg: string, key: string): number | undefined {
  const v = getAttr(svg, key);
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function extractMetadataJSON(svg: string): string | null {
  try {
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const meta = doc.querySelector("metadata");
    return meta ? meta.textContent ?? null : null;
  } catch {
    return null;
  }
}

/* Parse an uploaded SVG file and extract SigilMetadata */
export async function parseSvgFile(file: File) {
  const text = await file.text();

  // 1) <metadata> JSON
  let meta: SigilMetadata = {};
  const raw = extractMetadataJSON(text);
  if (raw) {
    try {
      meta = JSON.parse(raw) as SigilMetadata;
    } catch {
      // ignore, continue with attrs
    }
  }

  // 2) attribute fallbacks / mirrors
  meta.pulse ??= getIntAttr(text, "data-pulse");
  meta.beat ??= getIntAttr(text, "data-beat");
  meta.stepIndex ??= getIntAttr(text, "data-step-index");
  meta.frequencyHz ??= (() => {
    const v = getAttr(text, "data-frequency-hz");
    return v ? Number(v) : undefined;
  })();
  meta.chakraGate ??= getAttr(text, "data-chakra-gate");

  if (!meta.chakraDay) {
    const dayAttr =
      getAttr(text, "data-harmonic-day") || getAttr(text, "data-chakra-day");
    if (dayAttr) meta.chakraDay = dayAttr;
  }

  meta.kaiSignature ??= getAttr(text, "data-kai-signature");
  meta.userPhiKey ??= getAttr(text, "data-phi-key");

  const contextOk = !meta["@context"] || meta["@context"] === SIGIL_CTX;
  const typeOk = !meta.type || meta.type === SIGIL_TYPE;

  return { text, meta, contextOk, typeOk };
}

/* centre-pixel live signature (legacy cosmetic) */
export async function centrePixelSignature(url: string, pulseForSeal: number) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();

  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext("2d");
  if (!g) throw new Error("Canvas 2D context unavailable");
  g.drawImage(img, 0, 0);
  const { data } = g.getImageData(
    Math.floor(img.width / 2),
    Math.floor(img.height / 2),
    1,
    1
  );
  const rgb: [number, number, number] = [data[0], data[1], data[2]];
  const sig = (await sha256Hex(`${pulseForSeal}-2:3-${rgb.join(",")}`)).slice(
    0,
    32
  );
  return { sig, rgb };
}

/* embed updated <metadata> JSON into SVG and return data: URL */
export async function embedMetadata(svgURL: string, meta: SigilMetadata) {
  const raw = await fetch(svgURL).then((r) => r.text());
  const json = JSON.stringify(meta, null, 2);
  const updated = raw.match(/<metadata[^>]*>/i)
    ? raw.replace(
        /<metadata[^>]*>[\s\S]*?<\/metadata>/i,
        `<metadata>${json}</metadata>`
      )
    : raw.replace(/<svg([^>]*)>/i, `<svg$1><metadata>${json}</metadata>`);
  return `data:image/svg+xml;base64,${btoa(
    unescape(encodeURIComponent(updated))
  )}`;
}

/** minimal PNG rendering for the ZIP export */
export async function pngBlobFromSvgDataUrl(
  svgDataUrl: string,
  px = 1024
): Promise<Blob> {
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = rej;
    img.src = svgDataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  // cover / center
  ctx.clearRect(0, 0, px, px);
  ctx.drawImage(img, 0, 0, px, px);
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("PNG encode failed"))),
      "image/png"
    )
  );
  return blob;
}
