// src/pages/sigilstream/attachments/files.ts
"use client";

import type {
  AttachmentItem,
  AttachmentManifest,
  AttachmentFileInline,
  AttachmentFileRef,
} from "./types";
import { report } from "../core/utils";

/* Bytes ↔ encodings */
export function bytesToHex(bytes: Uint8Array): string {
  const lut = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += lut[bytes[i]];
  return out;
}

export function bytesToBase64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64urlToBase64(b64u: string): string {
  const s = b64u.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  return s + "=".repeat(pad);
}

export const dataUrlFrom = (b64url: string, mime = "application/octet-stream"): string =>
  `data:${mime};base64,${base64urlToBase64(b64url)}`;

/* Hashing */
export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const subtle =
    (typeof crypto !== "undefined" && crypto.subtle) ||
    // @ts-expect-error Safari legacy
    (typeof window !== "undefined" && window.crypto && window.crypto.webkitSubtle);
  if (!subtle) throw new Error("WebCrypto.subtle is not available in this context.");
  const digest = await subtle.digest("SHA-256", buf);
  return bytesToHex(new Uint8Array(digest));
}

/* Manifest builder */
export const DEFAULT_INLINE_LIMIT = 512 * 1024;

export async function filesToManifest(
  fileList: FileList,
  inlineLimit: number = DEFAULT_INLINE_LIMIT,
): Promise<AttachmentManifest> {
  const items: AttachmentItem[] = [];
  let totalBytes = 0;
  let inlinedBytes = 0;

  for (const file of Array.from(fileList)) {
    totalBytes += file.size;
    try {
      const buf = await file.arrayBuffer();
      const sha = await sha256Hex(buf);
      const mime = file.type || "application/octet-stream";

      if (file.size <= inlineLimit) {
        const data_b64url = bytesToBase64url(new Uint8Array(buf));
        const inlineItem: AttachmentFileInline = {
          kind: "file-inline",
          name: file.name,
          type: mime,
          size: file.size,
          sha256: sha,
          data_b64url,
        };
        inlinedBytes += file.size;
        items.push(inlineItem);
      } else {
        const refItem: AttachmentFileRef = {
          kind: "file-ref",
          name: file.name,
          type: mime,
          size: file.size,
          sha256: sha,
        };
        items.push(refItem);
      }
    } catch (e) {
      report("filesToManifest: read/hash failed", e);
    }
  }

  return { version: 1, totalBytes, inlinedBytes, items };
}
