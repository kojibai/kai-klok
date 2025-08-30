import type { SigilMetadata } from "../types/SigilMetadata";
import { parseSigilMetadata } from "./parseSigilMetadata";

export type SigilPayload = {
  /** Original filename */
  name: string;
  /** File size in bytes */
  size: number;
  /** MIME */
  type: "image/svg+xml" | "image/png";
  /** Raw SVG text (if SVG) */
  svgText?: string;
  /** Raw PNG bytes (if PNG) */
  pngBytes?: Uint8Array;
  /** Extracted metadata (if present/parsable) */
  metadata?: SigilMetadata;
};

/**
 * Reads a user-selected Sigil file (SVG or PNG).
 * - For SVG: returns raw text + extracted <metadata> JSON (if present).
 * - For PNG: returns raw bytes; metadata extraction is not attempted here.
 *
 * Never throws for valid files; only rejects on I/O errors.
 */
export async function readSigilFromFile(file: File): Promise<SigilPayload> {
  const lower = file.name.toLowerCase();
  const isSvg = file.type.includes("svg") || lower.endsWith(".svg");
  const isPng = file.type.includes("png") || lower.endsWith(".png");

  if (isSvg) {
    const text = await file.text();
    let metadata: SigilMetadata | undefined;
    try {
      metadata = parseSigilMetadata(text);
    } catch {
      // Metadata is optional; keep undefined if not present/parsable.
      metadata = undefined;
    }
    return {
      name: file.name,
      size: file.size,
      type: "image/svg+xml",
      svgText: text,
      metadata,
    };
  }

  if (isPng) {
    const buf = await file.arrayBuffer();
    return {
      name: file.name,
      size: file.size,
      type: "image/png",
      pngBytes: new Uint8Array(buf),
    };
  }

  // Fallback: treat unknown types as binary; still return something usable
  const buf = await file.arrayBuffer();
  return {
    name: file.name,
    size: file.size,
    type: "image/png",
    pngBytes: new Uint8Array(buf),
  };
}
