import type { SigilMetadata } from "../types/SigilMetadata";

/**
 * Replaces or injects a new <metadata> block into a base SVG string.
 * Seals it with updated pulse + KaiSignature for chatroom entry.
 */
export function generateSigilChatGlyph(
  baseSvg: string,
  {
    userPhiKey,
    kaiSignature,
    pulse,
    beat,
    stepIndex,
    topic,
    parentSigilHash,
    lineageTag,
    participants,
  }: {
    userPhiKey: string;
    kaiSignature: string;
    pulse: number;
    beat: number;
    stepIndex: number;
    topic?: string;
    parentSigilHash?: string;
    lineageTag?: string;
    participants?: string[];
  }
): string {
  const metadata: SigilMetadata = {
    userPhiKey,
    kaiSignature,
    pulse,
    beat,
    stepIndex,
    chakraGate: undefined,
    chakraDay: undefined,
    type: "chatroom",
    parentSigilHash,
    lineageTag,
    topic,
    participants,
    schemaVersion: 1,
  };

  const metadataString = JSON.stringify(metadata, null, 2);

  const hasMetadata =
    baseSvg.includes("<metadata>") && baseSvg.includes("</metadata>");

  let updatedSvg: string;

  if (hasMetadata) {
    const before = baseSvg.slice(0, baseSvg.indexOf("<metadata>"));
    const after = baseSvg.slice(baseSvg.indexOf("</metadata>") + "</metadata>".length);
    updatedSvg = `${before}<metadata>\n${metadataString}\n</metadata>${after}`;
  } else {
    const insertIndex = baseSvg.indexOf("<svg") + baseSvg.match(/<svg[^>]*>/)![0].length;
    updatedSvg =
      baseSvg.slice(0, insertIndex) +
      `\n  <metadata>\n${metadataString}\n  </metadata>` +
      baseSvg.slice(insertIndex);
  }

  return updatedSvg;
}
