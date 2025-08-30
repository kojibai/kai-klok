/**
 * Extract embedded Sigil metadata from an SVG string.
 *
 * Expected <metadata> JSON structure:
 * {
 *   "header": { ...tiny human-readable... },
 *   "payload": "<base64 of gzip(bytes of canonical JSON)>",
 *   "integrity": {
 *     "payloadEncoding": "gzip+base64",
 *     "payloadHash": { "alg": "blake3", "value": "<hex>" },
 *     "payloadSignature": { "alg":"harmonic-sig","public":"<addr>","value":"<hex>" }
 *   }
 * }
 *
 * Works in both browser (DOMParser) and Node/SSR (regex fallback).
 */

export type EmbeddedHeader = Record<string, unknown>;
export type PayloadEncoding = "gzip+base64";

export interface EmbeddedIntegrity {
  payloadEncoding: PayloadEncoding;
  payloadHash: { alg: "blake3"; value: string };
  payloadSignature: { alg: "harmonic-sig"; public: string; value: string };
}

export interface EmbeddedMetadata {
  header: EmbeddedHeader;
  payload: string; // base64 of gzip(canonical JSON bytes)
  integrity: EmbeddedIntegrity;
}

export class MetadataError extends Error {
  code:
    | "METADATA_MISSING"
    | "METADATA_NOT_JSON"
    | "METADATA_INVALID_SHAPE"
    | "SVG_PARSE_FAILED";

  constructor(
    code:
      | "METADATA_MISSING"
      | "METADATA_NOT_JSON"
      | "METADATA_INVALID_SHAPE"
      | "SVG_PARSE_FAILED",
    message?: string
  ) {
    super(message ?? code);
    this.code = code;
    this.name = "MetadataError";
  }
}

function parseWithDOM(svgText: string): string | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const md = doc.querySelector("metadata");
    return md?.textContent ?? null;
  } catch {
    return null;
  }
}

function parseWithRegex(svgText: string): string | null {
  const m = svgText.match(/<metadata[^>]*>([\s\S]*?)<\/metadata>/i);
  return m ? m[1] : null;
}

/** Extract and JSON-parse the <metadata> content. */
export function extractMetadata(svgText: string): EmbeddedMetadata {
  let raw = parseWithDOM(svgText);
  if (raw == null) raw = parseWithRegex(svgText);
  if (!raw || !raw.trim()) {
    throw new MetadataError("METADATA_MISSING");
  }

  // Trim down to outermost JSON object if extra whitespace/text present
  const jsonStart = raw.indexOf("{");
  const jsonEnd = raw.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd < 0 || jsonEnd <= jsonStart) {
    throw new MetadataError("METADATA_NOT_JSON");
  }

  const jsonChunk = raw.slice(jsonStart, jsonEnd + 1).trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonChunk);
  } catch (e) {
    throw new MetadataError("METADATA_NOT_JSON", (e as Error).message);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new MetadataError("METADATA_INVALID_SHAPE");
  }

  const obj = parsed as {
    header?: EmbeddedHeader;
    payload?: unknown;
    integrity?: unknown;
  };

  if (typeof obj.payload !== "string") {
    throw new MetadataError("METADATA_INVALID_SHAPE");
  }

  if (!obj.integrity || typeof obj.integrity !== "object") {
    throw new MetadataError("METADATA_INVALID_SHAPE");
  }

  const integrityCandidate = obj.integrity as Partial<EmbeddedIntegrity>;

  if (
    integrityCandidate.payloadEncoding !== "gzip+base64" ||
    !integrityCandidate.payloadHash ||
    integrityCandidate.payloadHash.alg !== "blake3" ||
    typeof integrityCandidate.payloadHash.value !== "string" ||
    !integrityCandidate.payloadSignature ||
    integrityCandidate.payloadSignature.alg !== "harmonic-sig" ||
    typeof integrityCandidate.payloadSignature.public !== "string" ||
    typeof integrityCandidate.payloadSignature.value !== "string"
  ) {
    throw new MetadataError("METADATA_INVALID_SHAPE");
  }

  return {
    header: obj.header ?? {},
    payload: obj.payload,
    integrity: {
      payloadEncoding: "gzip+base64",
      payloadHash: {
        alg: "blake3",
        value: integrityCandidate.payloadHash.value,
      },
      payloadSignature: {
        alg: "harmonic-sig",
        public: integrityCandidate.payloadSignature.public,
        value: integrityCandidate.payloadSignature.value,
      },
    },
  };
}
