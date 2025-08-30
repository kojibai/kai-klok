import type { SigilMetadata } from "../types/SigilMetadata";

/**
 * Extracts <metadata> JSON from a sigil SVG string.
 * Throws if malformed or missing required fields.
 */
export function parseSigilMetadata(svgContent: string): SigilMetadata {
  const metadataStart = svgContent.indexOf("<metadata>");
  const metadataEnd = svgContent.indexOf("</metadata>");

  if (metadataStart === -1 || metadataEnd === -1) {
    throw new Error("Missing <metadata> block in sigil SVG.");
  }

  const metadataBlock = svgContent
    .slice(metadataStart + "<metadata>".length, metadataEnd)
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(metadataBlock);
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Sigil metadata is not valid JSON: ${reason}`);
  }

  if (!isValidSigilMetadata(parsed)) {
    throw new Error("Sigil metadata does not conform to required schema.");
  }

  return parsed;
}

/**
 * Runtime type guard for SigilMetadata structure.
 */
function isValidSigilMetadata(obj: unknown): obj is SigilMetadata {
  if (typeof obj !== "object" || obj === null) return false;
  const m = obj as Partial<SigilMetadata>;

  const requiredStrings = [
    m.userPhiKey,
    m.kaiSignature,
    m.type,
  ];
  const requiredNumbers = [
    m.pulse,
    m.beat,
    m.stepIndex,
    m.schemaVersion,
  ];

  return requiredStrings.every((val) => typeof val === "string" && val.length > 0)
    && requiredNumbers.every((val) => typeof val === "number" && Number.isFinite(val));
}
