// src/components/KaiVoh/SocialConnector.tsx
"use client";

/**
 * KaiVoh — SocialConnector
 * v3.2 — Story Recorder (icon-only trigger) + Attach-any-URL + Upload-any-Document-or-Folder
 *
 * - New: Icon-only button to open the Story Recorder (no visible text).
 * - Captured video added as `file-ref` (SHA-256) + inline PNG thumbnail.
 * - Keeps: extra URLs; file/folder upload; inline tiny files; token length guard; verified sigil binding.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import "./styles/SocialConnector.css";

import {
  ATTACHMENTS_VERSION,
  type Attachments,
  type AttachmentItem,
  type FeedPostPayload,
  makeAttachments,
  makeFileRefAttachment,
  makeInlineAttachment,
  makeUrlAttachment,
  preparePayloadForLink,
  encodeFeedPayload,
} from "../../utils/feedPayload";

import { momentFromUTC } from "../../utils/kai_pulse";
import { useSigilAuth } from "./SigilAuthContext";
import StoryRecorder, { type CapturedStory } from "./StoryRecorder";

/* ───────────────────────── Inline Icons (no visible text) ───────────────────────── */

function IconCamRecord() {
  // Rounded camera with lens + small REC dot (top-right)
  return (
    <svg viewBox="0 0 24 24" className="ico" aria-hidden="true" focusable="false">
      <rect x="3" y="6" width="14" height="12" rx="3" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="10" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M17 9l4-2v10l-4-2z" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="18.5" cy="5.5" r="2.5" fill="currentColor" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" className="ico" aria-hidden="true" focusable="false">
      <path d="M3 6h18M9 6V4h6v2M7 6l1 14h8l1-14" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M10 10v6M14 10v6" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/* ───────────────────────── Constants ───────────────────────── */

const MAX_INLINE_BYTES = 6_000 as const; // per-file inline cap
const MAX_SUGGESTED_TOKEN_LEN = 7_000 as const; // warning threshold

const KB = 1024;
const MB = 1024 * KB;

/* ───────────────────────── Small utils (no any) ───────────────────────── */

const prettyBytes = (n: number): string => {
  if (n >= MB) return `${(n / MB).toFixed(2)} MB`;
  if (n >= KB) return `${(n / KB).toFixed(2)} KB`;
  return `${n} B`;
};

const short = (s: string, head = 8, tail = 6): string =>
  s.length <= head + tail ? s : `${s.slice(0, head)}…${s.slice(-tail)}`;

const isHttpUrl = (s: unknown): s is string => {
  if (typeof s !== "string" || !s) return false;
  try {
    const u = new URL(s, globalThis.location?.origin ?? "https://example.org");
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
};

/** Any supported stream link form? (#t=, ?p=, /stream|feed/p/) — no /p~ */
function isLikelySigilUrl(u: string): boolean {
  try {
    const url = new URL(u, globalThis.location?.origin ?? "https://example.org");
    const hasHash = new URLSearchParams(url.hash.replace(/^#/, "")).has("t");
    const hasQuery = new URLSearchParams(url.search).has("p");
    const p = url.pathname;
    const hasPath = /^\/(?:stream|feed)\/p\/[^/]+$/.test(p);
    return hasHash || hasQuery || hasPath;
  } catch {
    return false;
  }
}

/** base64url from ArrayBuffer */
function base64urlFromBytes(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 =
    typeof globalThis.btoa === "function" ? globalThis.btoa(bin) : Buffer.from(bin, "binary").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Read string/number from object or nested meta, safely */
function readStringProp(obj: unknown, key: string): string | undefined {
  if (typeof obj !== "object" || obj === null) return undefined;
  const r = obj as Record<string, unknown>;
  const v = r[key];
  if (typeof v === "string") return v;
  const meta = r["meta"];
  if (typeof meta === "object" && meta !== null) {
    const mv = (meta as Record<string, unknown>)[key];
    if (typeof mv === "string") return mv;
  }
  return undefined;
}
function readNumberProp(obj: unknown, key: string): number | undefined {
  if (typeof obj !== "object" || obj === null) return undefined;
  const r = obj as Record<string, unknown>;
  const v = r[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const meta = r["meta"];
  if (typeof meta === "object" && meta !== null) {
    const mv = (meta as Record<string, unknown>)[key];
    if (typeof mv === "number" && Number.isFinite(mv)) return mv;
  }
  return undefined;
}

/** Extract action URL from SVG text (metadata JSON, CDATA, or <a> href) */
function extractSigilActionUrlFromSvgText(
  svgText?: string | null,
  metaCandidate?: Record<string, unknown>,
): string | undefined {
  if (!svgText) return undefined;

  const keys = [
    "sigilActionUrl",
    "sigilUrl",
    "actionUrl",
    "url",
    "claimedUrl",
    "loginUrl",
    "sourceUrl",
    "originUrl",
    "link",
    "href",
  ];

  if (metaCandidate) {
    for (const k of keys) {
      const v = (metaCandidate as Record<string, unknown>)[k];
      if (isHttpUrl(v)) return v;
    }
  }

  try {
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");

    for (const el of Array.from(doc.getElementsByTagName("metadata"))) {
      const raw = (el.textContent ?? "").trim();
      if (!raw) continue;
      const peeled = raw.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
      try {
        const obj = JSON.parse(peeled) as unknown;
        if (typeof obj === "object" && obj !== null) {
          for (const k of keys) {
            const v = (obj as Record<string, unknown>)[k];
            if (isHttpUrl(v)) return v;
          }
        }
      } catch {
        const m = peeled.match(/https?:\/\/[^\s"'<>)#]+/i);
        if (m && isHttpUrl(m[0])) return m[0];
      }
    }

    for (const a of Array.from(doc.getElementsByTagName("a"))) {
      const href = a.getAttribute("href") || a.getAttribute("xlink:href");
      if (isHttpUrl(href)) return href!;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

/** Cache helper: store blob under /att/<sha> and return the URL */
async function cachePutAndUrl(
  sha256: string,
  blob: Blob,
  opts: { cacheName?: string; pathPrefix?: string } = {},
): Promise<string | undefined> {
  const cacheName = opts.cacheName ?? "sigil-attachments-v1";
  const pathPrefix = (opts.pathPrefix ?? "/att/").replace(/\/+$/, "") + "/";
  try {
    if (!("caches" in globalThis) || typeof caches.open !== "function") return undefined;
    const cache = await caches.open(cacheName);
    const url = `${pathPrefix}${sha256}`;
    await cache.put(new Request(url, { method: "GET" }), new Response(blob, {
      headers: { "Content-Type": blob.type || "application/octet-stream" },
    }));
    return url;
  } catch {
    return undefined;
  }
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

/* ───────────────────────── Component ───────────────────────── */

export default function SocialConnector() {
  const { auth } = useSigilAuth();
  const sigilMeta = auth.meta;

  // Composer text
  const [caption, setCaption] = useState<string>("");
  const [author, setAuthor] = useState<string>("");

  // Identity (locked when verified)
  const [phiKey, setPhiKey] = useState<string>("");
  const [kaiSignature, setKaiSignature] = useState<string>("");

  // Extras: URLs (as AttachmentItem "url")
  const [extraUrlField, setExtraUrlField] = useState<string>("");
  const [extraUrls, setExtraUrls] = useState<AttachmentItem[]>([]);

  // Files/folders
  const [files, setFiles] = useState<File[]>([]);
  const [attachments, setAttachments] = useState<Attachments>({
    version: ATTACHMENTS_VERSION,
    totalBytes: 0,
    inlinedBytes: 0,
    items: [],
  });

  // Story recorder modal + preview
  const [storyOpen, setStoryOpen] = useState<boolean>(false);
  const [storyPreview, setStoryPreview] = useState<{ url: string; durationMs: number } | null>(null);

  // UX state
  const [busy, setBusy] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [generatedUrl, setGeneratedUrl] = useState<string>("");
  const [tokenLength, setTokenLength] = useState<number>(0);

  const dropRef = useRef<HTMLDivElement | null>(null);
  const hasVerifiedSigil = Boolean(sigilMeta);

  /** Preferred sigil action URL from meta/SVG; fall back to origin */
  const sigilActionUrl = useMemo(() => {
    const metaFirst =
      readStringProp(sigilMeta, "sigilActionUrl") ||
      readStringProp(sigilMeta, "sigilUrl") ||
      readStringProp(sigilMeta, "actionUrl") ||
      readStringProp(sigilMeta, "url") ||
      readStringProp(sigilMeta, "claimedUrl") ||
      readStringProp(sigilMeta, "loginUrl") ||
      readStringProp(sigilMeta, "sourceUrl") ||
      readStringProp(sigilMeta, "originUrl") ||
      readStringProp(sigilMeta, "link") ||
      readStringProp(sigilMeta, "href");

    if (metaFirst) return metaFirst;

    const extracted = extractSigilActionUrlFromSvgText(auth.svgText, sigilMeta as unknown as Record<string, unknown>);
    return extracted || (globalThis.location?.origin ?? "https://kaiklok.com");
  }, [sigilMeta, auth.svgText]);

  /** Lock identity from verified sigil */
  useEffect(() => {
    if (!sigilMeta) return;
    setPhiKey(readStringProp(sigilMeta, "userPhiKey") ?? "");
    setKaiSignature(readStringProp(sigilMeta, "kaiSignature") ?? "");
  }, [sigilMeta]);

  /* ───────────── Extra URL management ───────────── */

  const addExtraUrl = () => {
    const raw = extraUrlField.trim();
    if (!isHttpUrl(raw)) {
      setWarn("Invalid URL. Enter a full http(s) link.");
      return;
    }
    setExtraUrls((prev) => [...prev, makeUrlAttachment({ url: raw })]);
    setExtraUrlField("");
    setWarn(null);
  };

  const removeExtraUrl = (i: number) => {
    setExtraUrls((prev) => prev.filter((_, idx) => idx !== i));
  };

  /* ───────────── File/Folder ingest ───────────── */

  const readFilesToAttachments = async (fileList: File[]): Promise<Attachments> => {
    const items = attachments.items.slice();

    for (const f of fileList) {
      if (f.size <= MAX_INLINE_BYTES) {
        // Inline tiny file
        const buf = await f.arrayBuffer();
        items.push(
          makeInlineAttachment({
            name: f.name,
            type: f.type || "application/octet-stream",
            size: f.size,
            data_b64url: base64urlFromBytes(buf),
          }),
        );
      } else {
        // Large: cache → file-ref with url
        const sha = await sha256FileHex(f);
        const url = await cachePutAndUrl(sha, f, { cacheName: "sigil-attachments-v1", pathPrefix: "/att/" });
        items.push(
          makeFileRefAttachment({
            sha256: sha,
            name: f.name,
            type: f.type || "application/octet-stream",
            size: f.size,
            url,
          }),
        );
      }
    }

    return makeAttachments(items);
  };

  async function sha256FileHex(f: File): Promise<string> {
    const buf = await f.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    const v = new Uint8Array(digest);
    let out = "";
    for (let i = 0; i < v.length; i++) out += v[i].toString(16).padStart(2, "0");
    return out;
  }

  const onPickFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const list = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...list]);
    setAttachments(await readFilesToAttachments(list));
  };

  const onDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.dataTransfer?.files?.length) return;
    const list = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...list]);
    setAttachments(await readFilesToAttachments(list));
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const clearFiles = () => {
    setFiles([]);
    setAttachments({ version: ATTACHMENTS_VERSION, totalBytes: 0, inlinedBytes: 0, items: [] });
  };

  /* ───────────── Story capture wiring ───────────── */

  function estimateBase64DataSize(dataUrl: string): number {
    const [, data] = dataUrl.split(",", 2);
    if (!data) return 0;
    // base64 length → bytes ≈ (len * 3)/4
    return Math.ceil((data.length * 3) / 4);
  }

  async function handleStoryCaptured(s: CapturedStory) {
    // Cache main video and attach as file-ref with url
    const videoUrl = await cachePutAndUrl(s.sha256, s.file, {
      cacheName: "sigil-attachments-v1",
      pathPrefix: "/att/",
    });

    const videoRef = makeFileRefAttachment({
      sha256: s.sha256,
      name: s.file.name,
      type: s.mimeType || s.file.type || "video/webm",
      size: s.file.size,
      url: videoUrl,
    });

    // Inline tiny PNG thumb
    const b64 = (s.thumbnailDataUrl.split(",", 2)[1] ?? "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    const thumbInline = makeInlineAttachment({
      name: s.file.name.replace(/\.(webm|mp4)$/i, "") + "_thumb.png",
      type: "image/png",
      size: estimateBase64DataSize(s.thumbnailDataUrl),
      data_b64url: b64,
    });

    const next = makeAttachments([...attachments.items, videoRef, thumbInline]);
    setAttachments(next);

    setStoryPreview({ url: URL.createObjectURL(s.file), durationMs: s.durationMs });
    setStoryOpen(false);
  }

  /* ───────────── Generate payload/link ───────────── */

  const onGenerate = async (): Promise<void> => {
    setErr(null);
    setWarn(null);
    setCopied(false);
    setGeneratedUrl("");
    setTokenLength(0);

    const rawUrl = (sigilActionUrl || "").trim();
    if (!isLikelySigilUrl(rawUrl)) {
      setWarn("Sigil verifikation URL not detected; using fallback. Link generation will still work.");
    }

    // Pulse seal
    let pulse: number;
    try {
      pulse = momentFromUTC(new Date()).pulse;
    } catch {
      setErr("Failed to compute Kai pulse.");
      return;
    }

    try {
      setBusy(true);

      // Merge attachments (files + extra URLs)
      const mergedItems: AttachmentItem[] = [...attachments.items, ...extraUrls];
      const mergedAttachments = mergedItems.length > 0 ? makeAttachments(mergedItems) : undefined;

      const basePayload: FeedPostPayload = {
        v: 1,
        url: rawUrl,
        pulse,
        caption: caption.trim() ? caption.trim() : undefined,
        author: author.trim() ? author.trim() : undefined,
        source: "manual",
        phiKey: hasVerifiedSigil && phiKey ? phiKey : undefined,
        kaiSignature: hasVerifiedSigil && kaiSignature ? kaiSignature : undefined,
        ts: Date.now(),
        attachments: mergedAttachments,
      };

      // Prepare (materialize inlines → file-refs in CacheStorage, prune thumbnails)
      const prepared = await preparePayloadForLink(basePayload, {
        cacheName: "sigil-attachments-v1",
        pathPrefix: "/att/",
      });

      // Encode once → use for both diagnostics and final URL
      const token = encodeFeedPayload(prepared);
      setTokenLength(token.length);
      if (token.length > MAX_SUGGESTED_TOKEN_LEN) {
        setWarn(
          `Large token (${token.length.toLocaleString()} chars). Consider trimming inlined files or relying on external URLs.`,
        );
      }

      // Canonical share URL: /stream/p/<token>
      const origin = globalThis.location?.origin ?? "https://kaiklok.com";
      const shareUrl = `${origin}/stream/p/${encodeURIComponent(token)}`;

      // Copy
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
      } catch {
        setCopied(false);
      }

      setGeneratedUrl(shareUrl);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "Failed to generate link.";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  const onReset = () => {
    setCaption("");
    setAuthor("");
    setExtraUrlField("");
    setExtraUrls([]);
    clearFiles();
    setErr(null);
    setWarn(null);
    setCopied(false);
    setGeneratedUrl("");
    setTokenLength(0);
    if (storyPreview) {
      URL.revokeObjectURL(storyPreview.url);
      setStoryPreview(null);
    }
  };

  const bind =
    (setter: (v: string) => void) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setter(e.target.value);

  /** Identity banner */
  const identityBanner = useMemo(() => {
    if (!hasVerifiedSigil) return null;
    const lastPulse = readNumberProp(sigilMeta, "pulse");
    return (
      <div className="id-banner" role="status" aria-live="polite">
        <span className="id-dot" />
        <span className="id-text">
          Verified by Sigil — ΦKey <strong>{short(phiKey)}</strong>
          {" • "}
          Last verified pulse <strong>{lastPulse ?? "—"}</strong>
        </span>
        <span className="id-sub mono">ΣSig {short(kaiSignature)}</span>
      </div>
    );
  }, [hasVerifiedSigil, phiKey, kaiSignature, sigilMeta]);

  /** Read-only preview of canonical action URL */
  const urlPreview = useMemo(() => {
    if (!sigilActionUrl) return null;
    return (
      <div className="composer">
        <label className="composer-label">Sigil Verifikation URL</label>
        <div className="composer-input-row">
          <input className="composer-input locked" type="url" value={sigilActionUrl} readOnly />
          <button
            type="button"
            className="composer-aux"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(sigilActionUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              } catch {
                /* ignore */
              }
            }}
            title="Kopy sigil verifikation  URL"
          >
            {copied ? "Kopied ✓" : "Kopy"}
          </button>
        </div>
        {!isLikelySigilUrl(sigilActionUrl) && (
          <div className="composer-hint warn">
            No canonical stream token detected in the URL. Fallback will still produce a valid post.
          </div>
        )}
      </div>
    );
  }, [sigilActionUrl, copied]);

  /* ───────────── UI sections ───────────── */

  const attachmentsPanel = (
    <div className="attachments">
      <h3 className="attachments-title">Attachments</h3>

      {/* Story Recorder trigger (ICON-ONLY) */}
      <div className="composer">
        <label className="composer-label">Record a memory</label>
        <div className="story-actions">
          <button
            type="button"
            className="pill prim icon-only"
            aria-label="Open Memory Recorder"
            title="Record story"
            onClick={() => setStoryOpen(true)}
          >
            <IconCamRecord />
          </button>

          {storyPreview && (
            <div className="story-preview">
              <video src={storyPreview.url} playsInline controls className="story-preview-video" />
              <div className="story-preview-meta mono">{formatMs(storyPreview.durationMs)}</div>
              <button
                type="button"
                className="pill danger icon-only"
                onClick={() => {
                  URL.revokeObjectURL(storyPreview.url);
                  setStoryPreview(null);
                }}
                aria-label="Remove recorded preview"
                title="Remove preview"
              >
                <IconTrash />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Extra URL adder */}
      <div className="composer">
        <label className="composer-label">Add any URL</label>
        <div className="composer-input-row">
          <input
            className="composer-input"
            type="url"
            placeholder="https://example.com/docs/your-file.pdf"
            value={extraUrlField}
            onChange={bind(setExtraUrlField)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <button type="button" className="composer-aux" onClick={addExtraUrl} title="Add URL">
            Add
          </button>
        </div>

        {extraUrls.length > 0 && (
          <ul className="url-list">
            {extraUrls.map((it, i) => {
              const url = (it as Extract<AttachmentItem, { kind: "url" }>).url;
              return (
                <li key={`${url}-${i}`} className="url-item">
                  <span className="mono">{short(url, 28, 16)}</span>
                  <button type="button" className="pill danger" onClick={() => removeExtraUrl(i)} title="Remove URL">
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* File / Folder input */}
      <div
        ref={dropRef}
        className="dropzone"
        onDragOver={onDragOver}
        onDrop={onDrop}
        aria-label="Drop files or folders here"
      >
        <div className="dropzone-inner">
          <div className="dz-title">Seal documents or folders</div>
          <div className="dz-sub">Tiny files get inlined; large files become cache-backed refs.</div>
          <div className="dz-actions">
            <label className="pill">
              <input type="file" multiple onChange={onPickFiles} className="visually-hidden" />
              Inhale files…
            </label>

            {/* Directory picker (webkitdirectory) */}
            <label className="pill">
              <input
                type="file"
                multiple
                // @ts-expect-error webkitdirectory is a non-standard extension
                webkitdirectory=""
                onChange={onPickFiles}
                className="visually-hidden"
              />
              Inhale folder…
            </label>

            {files.length > 0 && (
              <button type="button" className="pill subtle" onClick={clearFiles}>
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* File list / summary */}
      {attachments.items.length > 0 && (
        <div className="file-summary">
          <div className="composer-hint">
            Items: <strong>{attachments.items.length}</strong> • Files total:{" "}
            <strong>{prettyBytes(attachments.totalBytes ?? 0)}</strong> • Inlined:{" "}
            <strong>{prettyBytes(attachments.inlinedBytes ?? 0)}</strong> (≤ {prettyBytes(MAX_INLINE_BYTES)} each)
          </div>
          <ul className="file-list">
            {attachments.items.map((it, idx) => {
              if (it.kind === "url") {
                return (
                  <li key={`url-${idx}`} className="file-item">
                    <div className="file-row">
                      <span className="badge">url</span>
                      <span className="mono">{short(it.url, 34, 18)}</span>
                    </div>
                  </li>
                );
              }
              const base = it.name ?? `file-${idx}`;
              const isInline = it.kind === "file-inline";
              const mime = (it as { type?: string }).type || "application/octet-stream";
              const size = (it as { size?: number }).size ?? 0;
              return (
                <li key={`${base}-${idx}`} className="file-item">
                  <div className="file-row">
                    <span className="badge">{isInline ? "inline" : "file"}</span>
                    <span className="mono">{base}</span>
                    <span className="dim">
                      {mime} • {prettyBytes(size)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          {attachments.items.some((i) => i.kind === "file-ref") && (
            <div className="composer-hint warn">
              Large files are cached and referenced by SHA-256. You can also host publicly (Drive/S3/IPFS) and attach the
              public URL above. The manifest preserves names/paths.
            </div>
          )}
        </div>
      )}
    </div>
  );

  /* ───────────── Render ───────────── */

  return (
    <div className="social-connector-container">
      <h2 className="social-connector-title">KaiVoh</h2>
      <p className="social-connector-sub">
        Exhale A Sealed <strong>Memory</strong>.
      </p>

      {/* Identity */}
      {identityBanner}

      {/* URL preview */}
      {urlPreview}

      {/* Optional text */}
      <div className="composer two">
        <div className="field">
          <label htmlFor="caption" className="composer-label">
            Memory <span className="muted">(Message)</span>
          </label>
        <textarea
            id="caption"
            className="composer-textarea"
            rows={3}
            placeholder="What Resonants About This Moment…"
            value={caption}
            onChange={bind(setCaption)}
          />
        </div>
        <div className="field">
          <label htmlFor="author" className="composer-label">
            Author Handle <span className="muted">(optional, e.g., @KaiRexKlok)</span>
          </label>
          <input
            id="author"
            className="composer-input"
            type="text"
            placeholder="@handle"
            value={author}
            onChange={bind(setAuthor)}
            autoCorrect="off"
            autoCapitalize="none"
          />
        </div>
      </div>

      {/* Attachments panel */}
      {attachmentsPanel}

      {err && <div className="composer-error">{err}</div>}
      {warn && !err && <div className="composer-warn">{warn}</div>}

      {/* Actions */}
      <div className="composer-actions">
        <button type="button" onClick={onGenerate} className="composer-submit" disabled={busy} title="Exhale Stream URL">
          {busy ? "Exhaling…" : "Exhale Stream URL"}
        </button>
        <button type="button" className="composer-reset" onClick={onReset}>
          Reset
        </button>
      </div>

      {/* Result */}
      {generatedUrl && (
        <div className="composer-result">
          <label htmlFor="gen-url" className="composer-label">
            Your shareable link
          </label>
          <input
            id="gen-url"
            className="composer-input"
            type="text"
            readOnly
            value={generatedUrl}
            onFocus={(e) => e.currentTarget.select()}
          />
          <div className="composer-actions">
            <button
              type="button"
              className="composer-copy"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(generatedUrl);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "Kopied ✓" : "Kopy"}
            </button>
            <a className="composer-open" href={generatedUrl} target="_blank" rel="noopener noreferrer">
              Open in new tab →
            </a>
          </div>
          <p className="composer-hint">
            Token length: <strong>{tokenLength.toLocaleString()}</strong> chars
            {tokenLength > MAX_SUGGESTED_TOKEN_LEN ? " — consider trimming inlined files or using external URLs." : ""}
          </p>
        </div>
      )}

      {/* Modal */}
      <StoryRecorder
        isOpen={storyOpen}
        onClose={() => setStoryOpen(false)}
        onCaptured={handleStoryCaptured}
        maxDurationMs={15_000}
        preferredFacingMode="user"
      />
    </div>
  );
}
