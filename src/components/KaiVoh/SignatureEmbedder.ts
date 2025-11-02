// /components/KaiVoh/SignatureEmbedder.ts
import type { SealedPost } from "./BreathSealer";

export interface EmbeddedMediaResult {
  type: "image" | "video";
  content: Blob;
  filename: string;
  metadata: Record<string, unknown>;
}

const SVG_NS = "http://www.w3.org/2000/svg";

export async function embedKaiSignature(sealed: SealedPost): Promise<EmbeddedMediaResult> {
  const { post, pulse, kaiSignature, chakraDay } = sealed;

  const metadata: Record<string, unknown> = {
    pulse,
    kaiSignature,
    chakraDay,
    phiKey: `φK-${kaiSignature.slice(0, 8)}`,
    caption: post.caption ?? null,
    timestamp: new Date().toISOString(),
  };

  if (post.mediaType === "image" && post.file.type.includes("svg")) {
    const rawText = await post.file.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawText, "image/svg+xml");

    if (doc.querySelector("parsererror")) {
      throw new Error("Invalid SVG content (parsererror present).");
    }

    const root = doc.documentElement;
    if (!root || root.namespaceURI !== SVG_NS || root.tagName.toLowerCase() !== "svg") {
      throw new Error("Not an SVG root document.");
    }

    const metas = doc.getElementsByTagName("metadata");
    let metaEl: SVGMetadataElement;

    if (metas.length > 0) {
      metaEl = metas.item(0)!;
    } else {
      const created = doc.createElementNS(SVG_NS, "metadata");
      metaEl = created as SVGMetadataElement;
      root.appendChild(metaEl);
    }

    metaEl.textContent = JSON.stringify(metadata, null, 2);

    const serializer = new XMLSerializer();
    const updatedSvg = serializer.serializeToString(doc);

    return {
      type: "image",
      content: new Blob([updatedSvg], { type: "image/svg+xml" }),
      filename: `sigil-${pulse}.svg`,
      metadata,
    };
  }

  if (post.mediaType === "image") {
    return {
      type: "image",
      content: post.file,
      filename: post.file.name,
      metadata,
    };
  }

  return {
    type: "video",
    content: post.file,
    filename: post.file.name,
    metadata,
  };
}
