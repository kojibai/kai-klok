// src/pages/sigilstream/attachments/types.ts
/**
 * Attachment type declarations + guards.
 * Kept framework-agnostic so it can be shared by server/client if needed.
 */

import { isRecord } from "../core/utils";

/* ---------- Core types ---------- */

export type AttachmentUrl = {
  kind: "url";
  url: string;
  title?: string;
};

export type AttachmentFileInline = {
  kind: "file-inline";
  name: string;
  type: string; // mime
  size: number; // bytes
  sha256: string; // hex
  data_b64url: string; // RFC4648 §5 (no padding)
  relPath?: string; // optional relative path when uploaded from folders
};

export type AttachmentFileRef = {
  kind: "file-ref";
  name: string;
  type: string; // mime
  size: number; // bytes
  sha256: string; // hex
  relPath?: string;
};

export type AttachmentItem =
  | AttachmentUrl
  | AttachmentFileInline
  | AttachmentFileRef;

export type AttachmentManifest = {
  version: 1;
  totalBytes: number;
  inlinedBytes: number;
  items: AttachmentItem[];
};

/* ---------- Type guards ---------- */

export function isAttachmentUrl(v: unknown): v is AttachmentUrl {
  return (
    isRecord(v) &&
    v["kind"] === "url" &&
    typeof v["url"] === "string" &&
    (v["title"] === undefined || typeof v["title"] === "string")
  );
}

export function isAttachmentFileInline(v: unknown): v is AttachmentFileInline {
  return (
    isRecord(v) &&
    v["kind"] === "file-inline" &&
    typeof v["name"] === "string" &&
    typeof v["type"] === "string" &&
    typeof v["size"] === "number" &&
    typeof v["sha256"] === "string" &&
    typeof v["data_b64url"] === "string" &&
    (v["relPath"] === undefined || typeof v["relPath"] === "string")
  );
}

export function isAttachmentFileRef(v: unknown): v is AttachmentFileRef {
  return (
    isRecord(v) &&
    v["kind"] === "file-ref" &&
    typeof v["name"] === "string" &&
    typeof v["type"] === "string" &&
    typeof v["size"] === "number" &&
    typeof v["sha256"] === "string" &&
    (v["relPath"] === undefined || typeof v["relPath"] === "string")
  );
}

export function isAttachmentItem(v: unknown): v is AttachmentItem {
  return (
    isAttachmentUrl(v) || isAttachmentFileInline(v) || isAttachmentFileRef(v)
  );
}

export function isAttachmentManifest(v: unknown): v is AttachmentManifest {
  return (
    isRecord(v) &&
    v["version"] === 1 &&
    typeof v["totalBytes"] === "number" &&
    typeof v["inlinedBytes"] === "number" &&
    Array.isArray(v["items"]) &&
    v["items"].every(isAttachmentItem)
  );
}
