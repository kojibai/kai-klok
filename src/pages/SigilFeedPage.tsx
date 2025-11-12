// /src/pages/SigilFeedPage.tsx
"use client";

/**
 * Glyph Stream — payload-aware stream + Reply Composer + Link Inhaler + Attachments
 * v3.3 — Kopy-only sharing; beautiful attachment gallery (URLs, videos, files)
 *
 * - Canonical:   /stream/p/<token>[?add=<parentUrl>]
 * - Short alias: /p#t=<token>  (and /p?t=<token> for iOS robustness)
 * - Share policy: **Kopy only**
 * - Attachments (from payload.attachments):
 *    • kind="url"           → provider embeds (YouTube/Vimeo/Spotify) or smart link card
 *    • kind="file-inline"   → image/video/audio/text previews; download link
 *    • kind="file-ref"      → verified file card (name, size, SHA-256)
 *
 * - No `any`. All casts go through `unknown` + type guards.
 */

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  createContext,
  useContext,
} from "react";
import FeedCard from "../components/FeedCard";
import "./SigilFeedPage.css";

import {
  decodeFeedPayload,
  extractPayloadToken,
  encodeFeedPayload,
  type FeedPostPayload,
} from "../utils/feedPayload";

import {
  momentFromPulse,
  momentFromUTC,
  type KaiMoment,
} from "../utils/kai_pulse";

import { useSigilAuth } from "../components/KaiVoh/SigilAuthContext";
import SigilLogin from "../components/KaiVoh/SigilLogin";

/** ---------- Globals / ambient ---------- */
declare global {
  interface Window {
    __PSHORT__?: string;
    webkitAudioContext?: { new (): AudioContext };
  }
}

/** ---------- Logger ---------- */
const report = (where: string, err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  // eslint-disable-next-line no-console
  console.warn(`[SigilFeed] ${where}:`, msg);
};

/** ---------- Short host (PSHORT) ---------- */
type ImportMetaEnvLike = {
  env?: Record<string, string | undefined>;
};

const PSHORT: string = (() => {
  try {
    const fromGlobal =
      typeof window !== "undefined" ? window.__PSHORT__ : undefined;
    const fromEnv =
      typeof import.meta !== "undefined"
        ? (import.meta as unknown as ImportMetaEnvLike).env?.VITE_PSHORT
        : undefined;
    const pick = (fromGlobal?.trim() || fromEnv?.trim() || "");
    return pick;
  } catch (e) {
    report("Resolve PSHORT failed", e);
    return "";
  }
})();

const shortBase = (): URL => {
  try {
    if (PSHORT) return new URL("/", PSHORT);
  } catch (e) {
    report("Invalid PSHORT", e);
  }
  return new URL(
    "/",
    typeof window !== "undefined" ? window.location.href : "https://example.com",
  );
};

const canonicalBase = (): URL =>
  new URL(
    "/",
    typeof window !== "undefined" ? window.location.href : "https://example.com",
  );

/** ---------- Local types & constants ---------- */
type Source = { url: string };

const LS_KEY = "sf-links";
const SESSION_VERIFIED_PREFIX = "sf.verifiedSession:";

/** ---------- Utilities (pure) ---------- */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function parseStringArray(input: string | null): string[] {
  if (!input) return [];
  try {
    const parsed: unknown = JSON.parse(input || "[]");
    return Array.isArray(parsed) && parsed.every((v) => typeof v === "string")
      ? (parsed as string[])
      : [];
  } catch (e) {
    report("parseStringArray JSON.parse failed", e);
    return [];
  }
}

async function loadLinksJson(): Promise<Source[]> {
  try {
    const r = await fetch("/links.json", { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    const data: unknown = await r.json();
    if (
      Array.isArray(data) &&
      data.every(
        (row) => row && typeof row === "object" && typeof (row as Source).url === "string",
      )
    ) {
      return data as Source[];
    }
    return [];
  } catch (e) {
    report("loadLinksJson failed", e);
    return [];
  }
}

function prependUniqueToStorage(urls: string[]): void {
  try {
    const current = parseStringArray(localStorage.getItem(LS_KEY));
    const seen = new Set(current);
    const fresh = urls.filter((u) => !seen.has(u));
    if (fresh.length === 0) return;
    localStorage.setItem(LS_KEY, JSON.stringify([...fresh, ...current]));
  } catch (e) {
    report("prependUniqueToStorage failed (localStorage)", e);
  }
}

function kaiLabel(k: KaiMoment): string {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `Kai ${k.beat}:${pad2(k.stepIndex)} — ${k.weekday} • ${k.chakraDay}`;
}

function buildStreamUrl(token: string): string {
  const base = canonicalBase();
  base.pathname = `/stream/p/${token}`.replace(/\/{2,}/g, "/");
  base.search = "";
  base.hash = "";
  return base.toString();
}

function currentPayloadUrl(): string | null {
  if (typeof window === "undefined") return null;
  const token = extractPayloadToken(window.location.pathname);
  if (!token) return null;
  return buildStreamUrl(token);
}

function isUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isLikelySigilUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return (url.protocol === "https:" || url.protocol === "http:") && url.search.includes("p=");
  } catch {
    return false;
  }
}

function normalizeUrl(u: string): string | null {
  const s = u.trim();
  if (!s) return null;
  if (/^(kai|sigil):\/\//i.test(s)) return s.replace(/^(kai|sigil):\/\//i, "https://");
  if (isUrl(s)) return s;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(s)) return `https://${s}`;
  return null;
}

function readStringProp(obj: unknown, key: string): string | undefined {
  if (!isRecord(obj)) return undefined;
  const direct = obj[key];
  if (typeof direct === "string") return direct;
  const meta = obj["meta"];
  if (isRecord(meta)) {
    const mv = meta[key];
    if (typeof mv === "string") return mv;
  }
  return undefined;
}

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
  ] as const;

  const isHttp = (s: unknown): s is string => {
    if (typeof s !== "string" || !s) return false;
    try {
      const u = new URL(s);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch (e) {
      report("extractSigilActionUrlFromSvgText isHttp URL parse failed", e);
      return false;
    }
  };

  if (metaCandidate) {
    for (const k of keys) {
      const v = metaCandidate[k];
      if (isHttp(v)) return v;
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
        if (isRecord(obj)) {
          for (const k of keys) {
            const v = obj[k];
            if (isHttp(v)) return v;
          }
        }
      } catch (e) {
        report("extractSigilActionUrlFromSvgText metadata JSON.parse failed", e);
        const m = peeled.match(/https?:\/\/[^\s"'<>)#]+/i);
        if (m && isHttp(m[0])) return m[0];
      }
    }

    for (const a of Array.from(doc.getElementsByTagName("a"))) {
      const href = a.getAttribute("href") || a.getAttribute("xlink:href");
      if (isHttp(href)) return href;
    }
  } catch (e) {
    report("extractSigilActionUrlFromSvgText DOM parse failed", e);
  }

  return undefined;
}

/** ---------- Attachments (types + guards) ---------- */
type AttachmentUrl = { kind: "url"; url: string; title?: string };
type AttachmentFileInline = {
  kind: "file-inline";
  name: string;
  type: string;
  size: number;
  sha256: string;
  data_b64url: string;
  relPath?: string;
};
type AttachmentFileRef = {
  kind: "file-ref";
  name: string;
  type: string;
  size: number;
  sha256: string;
  relPath?: string;
};
type AttachmentItem = AttachmentUrl | AttachmentFileInline | AttachmentFileRef;

type AttachmentManifest = {
  version: 1;
  totalBytes: number;
  inlinedBytes: number;
  items: AttachmentItem[];
};

function isAttachmentUrl(v: unknown): v is AttachmentUrl {
  if (!isRecord(v)) return false;
  if (v["kind"] !== "url") return false;
  if (typeof v["url"] !== "string") return false;

  // title is optional but must be a string if present
  if ("title" in v && typeof (v as Record<string, unknown>)["title"] !== "string") return false;

  return true;
}

function isAttachmentFileInline(v: unknown): v is AttachmentFileInline {
  return (
    isRecord(v) &&
    v["kind"] === "file-inline" &&
    typeof v["name"] === "string" &&
    typeof v["type"] === "string" &&
    typeof v["size"] === "number" &&
    typeof v["sha256"] === "string" &&
    typeof v["data_b64url"] === "string"
  );
}
function isAttachmentFileRef(v: unknown): v is AttachmentFileRef {
  return (
    isRecord(v) &&
    v["kind"] === "file-ref" &&
    typeof v["name"] === "string" &&
    typeof v["type"] === "string" &&
    typeof v["size"] === "number" &&
    typeof v["sha256"] === "string"
  );
}
function isAttachmentItem(v: unknown): v is AttachmentItem {
  return isAttachmentUrl(v) || isAttachmentFileInline(v) || isAttachmentFileRef(v);
}
function isAttachmentManifest(v: unknown): v is AttachmentManifest {
  return (
    isRecord(v) &&
    v["version"] === 1 &&
    typeof v["totalBytes"] === "number" &&
    typeof v["inlinedBytes"] === "number" &&
    Array.isArray(v["items"]) &&
    v["items"].every(isAttachmentItem)
  );
}

/** Pull `attachments` off an arbitrary decoded payload (cast-through-unknown). */
function getAttachmentsFromPayload(payload: FeedPostPayload | null): AttachmentManifest | null {
  if (!payload) return null;
  const candidate = (payload as unknown as { attachments?: unknown }).attachments;
  return isAttachmentManifest(candidate) ? candidate : null;
}

/** ---------- Harmonic Toasts ---------- */
type ToastKind = "success" | "info" | "warn" | "error";
type Toast = {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
  urlPreview?: string;
  created: number;
};

type ToastApi = {
  push: (t: Omit<Toast, "id" | "created"> & { ttl?: number }) => void;
};

const ToastCtx = createContext<ToastApi | null>(null);

function useHarmonicToasts(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("Harmonic Toasts used outside provider");
  return ctx;
}

/** ---------- Haptics + chime helpers ---------- */
type VibrateLike = (pattern: number | number[] | Iterable<number>) => boolean;

function hasVibrate(nav: Navigator): nav is Navigator & { vibrate: VibrateLike } {
  return "vibrate" in nav && typeof (nav as unknown as { vibrate: unknown }).vibrate === "function";
}

function tryHaptic(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && hasVibrate(navigator)) {
      navigator.vibrate(pattern);
    }
  } catch {
    /* ignore */
  }
}

let _audioCtx: AudioContext | null = null;
function getAudio(): AudioContext | null {
  try {
    if (typeof window === "undefined") return null;
    if (!_audioCtx) {
      type AudioCtor = new (...args: never[]) => AudioContext;
      const ctor =
        ((window.AudioContext as unknown) as AudioCtor | undefined) ??
        (window.webkitAudioContext as AudioCtor | undefined);
      _audioCtx = ctor ? new ctor() : null;
    }
    return _audioCtx;
  } catch {
    return null;
  }
}
async function phiChime(): Promise<void> {
  const ctx = getAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  const base = 523.6; // φ-ish triad motion
  osc.frequency.setValueAtTime(base, now);
  osc.frequency.exponentialRampToValueAtTime(329.6, now + 0.09);
  osc.frequency.exponentialRampToValueAtTime(261.8, now + 0.18);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.27);
}

/** Spark burst near click (used by Kopy buttons) */
function sparkBurstAt(clientX: number, clientY: number) {
  try {
    const root = document.body;
    const frag = document.createDocumentFragment();
    const N = 14;
    for (let i = 0; i < N; i++) {
      const el = document.createElement("span");
      el.textContent = "✧";
      const style: Partial<CSSStyleDeclaration> = {
        position: "fixed",
        left: `${clientX}px`,
        top: `${clientY}px`,
        transform: "translate(-50%, -50%) scale(0.8)",
        pointerEvents: "none",
        fontSize: "14px",
        color: "rgb(255, 215, 128)",
        opacity: "0.9",
        transition:
          "transform 600ms cubic-bezier(.2,.9,.2,1), opacity 650ms ease-out",
        zIndex: "999999",
      };
      Object.assign(el.style, style);
      const dx = (Math.random() - 0.5) * 180;
      const dy = (Math.random() - 0.5) * 180 - 40;
      requestAnimationFrame(() => {
        el.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${0.6 + Math.random() * 0.6}) rotate(${(Math.random() - 0.5) * 90}deg)`;
        el.style.opacity = "0";
      });
      window.setTimeout(() => el.remove(), 700);
      frag.appendChild(el);
    }
    root.appendChild(frag);
  } catch {
    /* ignore */
  }
}

function ToastsProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push: ToastApi["push"] = ({ kind, title, detail, urlPreview, ttl = 4200 }) => {
    const id = Math.floor(Math.random() * 1_000_000_000);
    const t: Toast = { id, kind, title, detail, urlPreview, created: Date.now() };
    setToasts((prev) => [t, ...prev].slice(0, 5));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, ttl);
  };

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "fixed",
          right: "max(12px, env(safe-area-inset-right))",
          bottom: "max(12px, env(safe-area-inset-bottom))",
          display: "grid",
          gap: "10px",
          zIndex: 999998,
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            style={{
              pointerEvents: "auto",
              minWidth: "260px",
              maxWidth: "92vw",
              color: "rgb(236,241,251)",
              background:
                t.kind === "success"
                  ? "linear-gradient(135deg, rgba(12,18,28,.86), rgba(16,28,22,.86))"
                  : t.kind === "warn"
                  ? "linear-gradient(135deg, rgba(20,16,10,.86), rgba(28,20,12,.86))"
                  : t.kind === "error"
                  ? "linear-gradient(135deg, rgba(28,12,12,.86), rgba(40,18,18,.86))"
                  : "linear-gradient(135deg, rgba(10,14,22,.86), rgba(12,18,28,.86))",
              border: "1px solid rgba(255,255,255,.12)",
              boxShadow:
                "0 10px 30px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.06)",
              backdropFilter: "blur(6px)",
              borderRadius: "16px",
              padding: "12px 14px",
              transform: "translateY(0)",
              animation: "sf-toast-in 220ms cubic-bezier(.2,.9,.2,1)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>
                {t.kind === "success" ? (
                  <svg
                    width="1em" height="1em" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                  >
                    <defs>
                      <filter id="kaiGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="0.9" result="blur1" />
                        <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="blur2" />
                        <feMerge><feMergeNode in="blur2" /><feMergeNode in="blur1" /><feMergeNode in="SourceGraphic" /></feMerge>
                      </filter>
                      <linearGradient id="kaiSheen" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="currentColor" stopOpacity=".95"/>
                        <stop offset="100%" stopColor="currentColor" stopOpacity=".35"/>
                      </linearGradient>
                    </defs>
                    <g transform="translate(12 12)" filter="url(#kaiGlow)">
                      <g stroke="url(#kaiSheen)">
                        <g>
                          <line x1="0" y1="-8.5" x2="0" y2="8.5"/>
                          <line x1="-8.5" y1="0" x2="8.5" y2="0"/>
                          <line x1="-6" y1="-6" x2="6" y2="6"/>
                          <line x1="-6" y1="6" x2="6" y2="-6"/>
                          <line x1="-3.2" y1="-8" x2="3.2" y2="8"/>
                          <line x1="-8" y1="-3.2" x2="8" y2="3.2"/>
                          <line x1="-3.2" y1="8" x2="3.2" y2="-8"/>
                          <line x1="-8" y1="3.2" x2="8" y2="-3.2"/>
                        </g>
                        <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="5.236s" repeatCount="indefinite"/>
                      </g>
                      <path d="M0 -5.5 L1.6 -1.6 L5.5 0 L1.6 1.6 L0 5.5 L-1.6 1.6 L-5.5 0 L-1.6 -1.6 Z" vectorEffect="non-scaling-stroke" opacity=".95"/>
                      <circle r="6.6" strokeDasharray="1.2 2.4" strokeOpacity=".55">
                        <animate attributeName="r" values="6.2;7.0;6.2" dur="5.236s" repeatCount="indefinite"/>
                      </circle>
                      <g>
                        <circle r="0.9" fill="currentColor" stroke="none" opacity=".95" />
                        <animateMotion dur="5.236s" repeatCount="indefinite" rotate="auto" path="M 0 -9 A 9 9 0 1 1 0.01 -9"/>
                      </g>
                    </g>
                  </svg>
                ) : t.kind === "error" ? (
                  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3L2 20h20L12 3z" /><path d="M12 9v5" /><circle cx="12" cy="17" r="1" />
                  </svg>
                ) : t.kind === "warn" ? (
                  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3c-3 2-6 2.5-9 3v5c0 5.2 3.6 9.6 9 11 5.4-1.4 9-5.8 9-11V6c-3-.5-6-1-9-3z" />
                    <path d="M12 8v6" /><circle cx="12" cy="17" r="1" />
                  </svg>
                ) : (
                  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12h10a3 3 0 1 0 0-6" />
                    <path d="M5 16h9a2 2 0 1 1 0 4" />
                    <path d="M3 8h7" />
                  </svg>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{t.title}</div>
                {t.detail && <div style={{ opacity: 0.9, marginTop: 2 }}>{t.detail}</div>}
                {t.urlPreview && t.kind !== "success" && (
                  <div
                    style={{
                      marginTop: 8, display: "flex", alignItems: "center", gap: 6,
                      background: "rgba(255,255,255,.06)",
                      border: "1px dashed rgba(255,255,255,.15)",
                      borderRadius: 10, padding: "6px 8px",
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      wordBreak: "break-all",
                    }}
                  >
                    <span style={{ opacity: 0.8 }}>URL</span>
                    <span style={{ opacity: 0.9 }}>{t.urlPreview}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes sf-toast-in { from { transform: translateY(8px); opacity: .0; } to { transform: translateY(0px); opacity: 1; } }
      `}</style>
    </ToastCtx.Provider>
  );
}

/** ---------- Auth coercion (no-any) ---------- */
type AuthLike = { meta: Record<string, unknown> | null; svgText: string | null };
function coerceAuth(input: unknown): AuthLike {
  let candidate: unknown = input;
  if (isRecord(candidate) && "auth" in candidate) {
    const maybeAuth = (candidate as { auth?: unknown }).auth;
    candidate = maybeAuth;
  }
  if (isRecord(candidate)) {
    const meta = candidate["meta"];
    const svgText = candidate["svgText"];
    return {
      meta: isRecord(meta) ? (meta as Record<string, unknown>) : null,
      svgText: typeof svgText === "string" ? svgText : null,
    };
  }
  return { meta: null, svgText: null };
}

/** ---------- Embed helpers ---------- */
function base64urlToBase64(b64u: string): string {
  const s = b64u.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  return s + "=".repeat(pad);
}

function dataUrlFrom(b64u: string, mime: string): string {
  return `data:${mime};base64,${base64urlToBase64(b64u)}`;
}

function extFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").pop() || "";
    const dot = last.lastIndexOf(".");
    return dot >= 0 ? last.slice(dot + 1).toLowerCase() : "";
  } catch {
    return "";
  }
}

function ytIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1) || null;
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const parts = u.pathname.split("/");
      const idx = parts.indexOf("embed");
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    }
    return null;
  } catch {
    return null;
  }
}

function vimeoIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("vimeo.com")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    const idPart = parts.find((p) => /^\d+$/.test(p));
    return idPart || null;
  } catch {
    return null;
  }
}

function spotifyEmbedFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("spotify.com")) return null;
    // Convert open.spotify.com/track/ID → embed
    if (u.pathname.startsWith("/track/") || u.pathname.startsWith("/album/") || u.pathname.startsWith("/playlist/")) {
      return `https://open.spotify.com/embed${u.pathname}${u.search}`;
    }
    return null;
  } catch {
    return null;
  }
}

function isImageExt(ext: string): boolean {
  return ["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp"].includes(ext);
}
function isVideoExt(ext: string): boolean {
  return ["mp4", "webm", "ogg", "ogv", "mov", "m4v"].includes(ext);
}
function isPdfExt(ext: string): boolean {
  return ext === "pdf";
}

/** ---------- Attachment cards ---------- */
function PrettyBytes({ n }: { n: number }) {
  const KB = 1024;
  const MB = KB * 1024;
  const GB = MB * 1024;
  const text =
    n >= GB ? `${(n / GB).toFixed(2)} GB` :
    n >= MB ? `${(n / MB).toFixed(2)} MB` :
    n >= KB ? `${(n / KB).toFixed(2)} KB` : `${n} B`;
  return <>{text}</>;
}

function Favicon({ host }: { host: string }) {
  const src = `https://${host}/favicon.ico`;
  return (
    <img
      src={src}
      alt=""
      width={16}
      height={16}
      loading="lazy"
      decoding="async"
      style={{ borderRadius: 3, filter: "drop-shadow(0 0 0 rgba(0,0,0,0))" }}
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
    />
  );
}

function LinkCard({ url, title }: { url: string; title?: string }) {
  let host = "";
  try { host = new URL(url).host; } catch { /* ignore */ }
  return (
    <a className="sf-att-link" href={url} target="_blank" rel="noopener noreferrer">
      <div className="sf-att-link__row">
        {host && <Favicon host={host} />}
        <div className="sf-att-link__text">
          <div className="sf-att-link__title">{title || host || "Open link"}</div>
          <div className="sf-att-link__url">{url}</div>
        </div>
      </div>
    </a>
  );
}

function IframeEmbed({ src, title }: { src: string; title: string }) {
  return (
    <div className="sf-embed">
      <iframe
        src={src}
        title={title}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
}

function UrlEmbed({ url, title }: { url: string; title?: string }) {
  const yt = ytIdFromUrl(url);
  if (yt) return <IframeEmbed src={`https://www.youtube.com/embed/${yt}`} title={title || "YouTube"} />;
  const vimeo = vimeoIdFromUrl(url);
  if (vimeo) return <IframeEmbed src={`https://player.vimeo.com/video/${vimeo}`} title={title || "Vimeo"} />;
  const spot = spotifyEmbedFromUrl(url);
  if (spot) return <IframeEmbed src={spot} title={title || "Spotify"} />;

  const ext = extFromUrl(url);
  if (isImageExt(ext)) {
    return (
      <div className="sf-media sf-media--image">
        <img src={url} alt={title || "image"} loading="lazy" decoding="async" />
      </div>
    );
  }
  if (isVideoExt(ext)) {
    return (
      <div className="sf-media sf-media--video">
        <video src={url} controls playsInline preload="metadata" />
      </div>
    );
  }
  if (isPdfExt(ext)) {
    return (
      <div className="sf-embed sf-embed--doc">
        <iframe src={url} title={title || "Document"} loading="lazy" />
      </div>
    );
  }

  // Fallback to a pretty link card
  return <LinkCard url={url} title={title} />;
}

function InlineFileCard({ it }: { it: AttachmentFileInline }) {
  const mime = it.type || "application/octet-stream";
  const dataUrl = dataUrlFrom(it.data_b64url, mime);

  if (mime.startsWith("image/")) {
    return (
      <div className="sf-media sf-media--image">
        <img src={dataUrl} alt={it.name} loading="lazy" decoding="async" />
        <div className="sf-file-meta"><span>{it.name}</span><span><PrettyBytes n={it.size} /></span></div>
        <a className="sf-file-dl" href={dataUrl} download={it.name}>Download</a>
      </div>
    );
  }

  if (mime.startsWith("video/")) {
    return (
      <div className="sf-media sf-media--video">
        <video src={dataUrl} controls playsInline preload="metadata" />
        <div className="sf-file-meta"><span>{it.name}</span><span><PrettyBytes n={it.size} /></span></div>
        <a className="sf-file-dl" href={dataUrl} download={it.name}>Download</a>
      </div>
    );
  }

  if (mime.startsWith("audio/")) {
    return (
      <div className="sf-media sf-media--audio">
        <audio src={dataUrl} controls preload="metadata" />
        <div className="sf-file-meta"><span>{it.name}</span><span><PrettyBytes n={it.size} /></span></div>
        <a className="sf-file-dl" href={dataUrl} download={it.name}>Download</a>
      </div>
    );
  }

  // Text-y preview
  const isTextLike =
    mime.startsWith("text/") ||
    ["application/json", "application/xml", "application/svg+xml"].includes(mime);

  const previewText = (() => {
    if (!isTextLike) return null;
    try {
      const raw = atob(base64urlToBase64(it.data_b64url));
      const sliced = raw.slice(0, 1200);
      return sliced;
    } catch {
      return null;
    }
  })();

  return (
    <div className="sf-file">
      <div className="sf-file-head">
        <div className="sf-file-name">{it.relPath || it.name}</div>
        <div className="sf-file-size"><PrettyBytes n={it.size} /></div>
      </div>
      {previewText && (
        <pre className="sf-file-pre" aria-label={`${it.name} preview`}>
{previewText}
{previewText.length >= 1200 ? "\n… (truncated preview)" : ""}
        </pre>
      )}
      <div className="sf-file-foot">
        <code className="sf-hash mono">sha256:{it.sha256}</code>
        <a className="sf-file-dl" href={dataUrl} download={it.name}>Download</a>
      </div>
    </div>
  );
}

function FileRefCard({ it }: { it: AttachmentFileRef }) {
  return (
    <div className="sf-fileref">
      <div className="sf-file-head">
        <div className="sf-file-name">{it.relPath || it.name}</div>
        <div className="sf-file-size"><PrettyBytes n={it.size} /></div>
      </div>
      <div className="sf-file-foot">
        <div className="sf-file-type">{it.type || "application/octet-stream"}</div>
        <code className="sf-hash mono">sha256:{it.sha256}</code>
      </div>
      <div className="sf-note">Large file not inlined. Host by hash anywhere and add the public URL as an attachment link.</div>
    </div>
  );
}

function AttachmentCard({ item }: { item: AttachmentItem }) {
  if (item.kind === "url") return <UrlEmbed url={item.url} title={item.title} />;
  if (item.kind === "file-inline") return <InlineFileCard it={item} />;
  return <FileRefCard it={item} />;
}

function AttachmentGallery({ manifest }: { manifest: AttachmentManifest }) {
  if (!manifest.items.length) return null;
  return (
    <section className="sf-attachments" aria-labelledby="sf-att-title">
      <h3 id="sf-att-title" className="sf-att-title">Attachments</h3>
      <div className="sf-att-grid">
        {manifest.items.map((it, i) => (
          <div className="sf-att-item" key={i}>
            <AttachmentCard item={it} />
          </div>
        ))}
      </div>
      <div className="sf-att-foot">
        <span>Total: <strong><PrettyBytes n={manifest.totalBytes} /></strong></span>
        {manifest.inlinedBytes > 0 && (
          <span> • Inlined: <strong><PrettyBytes n={manifest.inlinedBytes} /></strong></span>
        )}
      </div>
    </section>
  );
}

/** ---------- Page (Provider wrapper) ---------- */
export default function SigilFeedPage() {
  return (
    <ToastsProvider>
      <SigilFeedPageInner />
    </ToastsProvider>
  );
}

/** ---------- Component (inner, can use toasts) ---------- */
function SigilFeedPageInner() {
  const toasts = useHarmonicToasts();

  /** ---------- Data ---------- */
  const [sources, setSources] = useState<Source[]>([]);

  // Payload context if we arrived via /stream/p/<token>
  const [payload, setPayload] = useState<FeedPostPayload | null>(null);
  const [payloadKai, setPayloadKai] = useState<KaiMoment | null>(null);
  const [payloadError, setPayloadError] = useState<string | null>(null);
  const payloadAttachments = useMemo(() => getAttachmentsFromPayload(payload), [payload]);

  /** ---------- Auth (session-gated identity) ---------- */
  const rawSigilAuth = useSigilAuth() as unknown;
  const authLike = useMemo(() => coerceAuth(rawSigilAuth), [rawSigilAuth]);

  const sessionKey = useMemo(() => {
    if (typeof window === "undefined") return `${SESSION_VERIFIED_PREFIX}root`;
    const token = extractPayloadToken(window.location.pathname) || "root";
    return `${SESSION_VERIFIED_PREFIX}${token}`;
  }, []);

  const [verifiedThisSession, setVerifiedThisSession] = useState<boolean>(() => {
    try {
      return typeof window !== "undefined" && sessionStorage.getItem(sessionKey) === "1";
    } catch (e) {
      report("sessionStorage.getItem failed", e);
      return false;
    }
  });

  const composerMeta = useMemo(
    () => (verifiedThisSession ? authLike.meta : null),
    [verifiedThisSession, authLike.meta],
  );
  const composerSvgText = useMemo(
    () => (verifiedThisSession ? authLike.svgText : null),
    [verifiedThisSession, authLike.svgText],
  );

  const composerPhiKey = useMemo(
    () => (composerMeta ? readStringProp(composerMeta, "userPhiKey") : undefined),
    [composerMeta],
  );
  const composerKaiSig = useMemo(
    () => (composerMeta ? readStringProp(composerMeta, "kaiSignature") : undefined),
    [composerMeta],
  );

  /** ---------- Reply composer state ---------- */
  const [replyText, setReplyText] = useState("");
  const [replyAuthor, setReplyAuthor] = useState("");
  const [replyUrl, setReplyUrl] = useState<string>("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyErr, setReplyErr] = useState<string | null>(null);
  const [replyWarn, setReplyWarn] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  /** ---------- Link Inhaler state ---------- */
  const [inhaleValue, setInhaleValue] = useState("");
  const [inhaleErr, setInhaleErr] = useState<string | null>(null);
  const inhaleInputRef = useRef<HTMLInputElement | null>(null);

  /** ---------- Effects: seed & query handling ---------- */
  useEffect(() => {
    (async () => {
      const seed = await loadLinksJson();
      const stored = parseStringArray(localStorage.getItem(LS_KEY));
      const merged: Source[] = [...stored.map((u) => ({ url: u })), ...seed];

      const seen = new Set<string>();
      const unique = merged.filter(({ url }) =>
        seen.has(url) ? false : (seen.add(url), true),
      );
      setSources(unique);
    })().catch((e) => report("initial links load failed", e));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const search = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(
        window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : window.location.hash,
      );

      const adds = [...search.getAll("add"), ...hash.getAll("add")]
        .map(normalizeAddParam)
        .filter(Boolean);

      if (adds.length === 0) return;

      setSources((prev) => {
        const seen = new Set(prev.map((s) => s.url));
        const fresh = adds.filter((u) => !seen.has(u));
        if (fresh.length === 0) return prev;

        prependUniqueToStorage(fresh);
        return [...fresh.map((u) => ({ url: u })), ...prev];
      });
    } catch (e) {
      report("query parsing (?add / #add) failed", e);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const token = extractPayloadToken(window.location.pathname);
    if (!token) return;

    const decoded = decodeFeedPayload(token);
    if (!decoded) {
      setPayloadError("Invalid or corrupted stream payload.");
      return;
    }

    setPayload(decoded);
    try {
      const k = momentFromPulse(decoded.pulse);
      setPayloadKai(k);
    } catch (e) {
      report("momentFromPulse failed", e);
      setPayloadKai(null);
    }

    setSources((prev) => {
      const exists = prev.some((s) => s.url === decoded.url);
      if (exists) return prev;
      prependUniqueToStorage([decoded.url]);
      return [{ url: decoded.url }, ...prev];
    });
  }, []);

  /** ---------- Derived ---------- */
  const urls = useMemo(() => {
    const rest = payload ? sources.filter((s) => s.url !== payload.url) : sources;
    return payload ? [payload.url, ...rest.map((s) => s.url)] : rest.map((s) => s.url);
  }, [sources, payload]);

  const sigilActionUrl = useMemo(() => {
    if (!composerMeta) return "";
    const metaFirst =
      readStringProp(composerMeta, "sigilActionUrl") ||
      readStringProp(composerMeta, "sigilUrl") ||
      readStringProp(composerMeta, "actionUrl") ||
      readStringProp(composerMeta, "url") ||
      readStringProp(composerMeta, "claimedUrl") ||
      readStringProp(composerMeta, "loginUrl") ||
      readStringProp(composerMeta, "sourceUrl") ||
      readStringProp(composerMeta, "originUrl") ||
      readStringProp(composerMeta, "link") ||
      readStringProp(composerMeta, "href");

    if (metaFirst) return metaFirst;

    const extracted = extractSigilActionUrlFromSvgText(
      composerSvgText,
      composerMeta,
    );
    if (extracted) return extracted;

    return "";
  }, [composerMeta, composerSvgText]);

  /** ---------- Actions ---------- */
  const onVerifiedNow = () => {
    setVerifiedThisSession(true);
    try {
      sessionStorage.setItem(sessionKey, "1");
    } catch (e) {
      report("sessionStorage.setItem failed", e);
    }
  };

  const onGenerateReply = async () => {
    setReplyErr(null);
    setReplyWarn(null);
    setReplyUrl("");
    setReplyBusy(true);

    try {
      if (!verifiedThisSession || !composerMeta) {
        setReplyErr("Verify your sigil in this session to reply.");
        return;
      }

      const actionUrl = (sigilActionUrl || "").trim();
      if (!actionUrl || !isLikelySigilUrl(actionUrl)) {
        setReplyWarn("No canonical sigil auth URL detected; proceeding with provided/fallback link.");
      }

      const pulse = momentFromUTC(new Date()).pulse;

      const payloadObj: FeedPostPayload = {
        v: 1,
        url: actionUrl || canonicalBase().origin,
        pulse,
        caption: replyText.trim() ? replyText.trim() : undefined,
        author: replyAuthor.trim() ? replyAuthor.trim() : undefined,
        source: "manual",
        phiKey: composerPhiKey ?? undefined,
        kaiSignature: composerKaiSig ?? undefined,
        ts: Date.now(),
      };

      const token = encodeFeedPayload(payloadObj);
      let share = buildStreamUrl(token);

      // Canonical keeps ?add= for web
      const parent = currentPayloadUrl();
      if (parent) {
        const u = new URL(share);
        u.searchParams.append("add", parent);
        share = u.toString();
      }

      try {
        await navigator.clipboard.writeText(share); // Kopy canonical immediately
      } catch (e) {
        report("clipboard.writeText(share) failed", e);
      }

      setReplyUrl(share);

      requestAnimationFrame(() => {
        try {
          resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch (e) {
          report("scrollIntoView failed", e);
        }
      });

      tryHaptic([12, 40, 12]);
      void phiChime();
      toasts.push({
        kind: "success",
        title: "Link kopied.",
        detail: "Kai-sealed.",
        ttl: 5200,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to exhale reply link.";
      setReplyErr(msg);
      toasts.push({ kind: "error", title: "Could not seal reply.", detail: String(msg) });
    } finally {
      setReplyBusy(false);
    }
  };

  const onInhaleLink = (raw: string) => {
    setInhaleErr(null);
    const normalized = normalizeUrl(raw);
    if (!normalized) {
      setInhaleErr("Enter a valid URL (https://… or domain.tld).");
      return;
    }
    setSources((prev) => {
      const seen = new Set(prev.map((s) => s.url));
      if (!seen.has(normalized)) {
        prependUniqueToStorage([normalized]);
        return [{ url: normalized }, ...prev];
      }
      return prev;
    });
    setInhaleValue("");
    toasts.push({ kind: "success", title: "Link inhaled.", detail: "Added to your local stream." });
  };

  const onGrabClipboard = async () => {
    setInhaleErr(null);
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        setInhaleErr("Clipboard is empty.");
        return;
      }
      const normalized = normalizeUrl(text);
      if (!normalized) {
        setInhaleErr("Clipboard does not contain a valid link.");
        return;
      }
      setInhaleValue(normalized);
      onInhaleLink(normalized);
    } catch (e) {
      report("clipboard.readText() failed", e);
      setInhaleErr("Clipboard read is not permitted.");
    }
  };

  /** ---------- Kopy-only button ---------- */
  const KopyButton = ({ url, label = "Kopy" }: { url: string; label?: string }) => {
    const onKopy = async (ev: React.MouseEvent) => {
      const clientX = ev.clientX;
      const clientY = ev.clientY;
      // Expand any short alias to canonical first
      const canonicalUrl = expandShortAliasToCanonical(url || "");
      try {
        await navigator.clipboard.writeText(canonicalUrl);
        tryHaptic([16]);
        void phiChime();
        sparkBurstAt(clientX, clientY);
        toasts.push({ kind: "success", title: "Link kopied.", detail: "Kai-sealed." });
      } catch (e) {
        report("clipboard.writeText(canonicalUrl) failed (Kopy button)", e);
        toasts.push({
          kind: "error",
          title: "Kopy failed.",
          detail: "Try selecting the field and Kopying manually.",
        });
      }
    };

    return (
      <button className="sf-btn" onClick={onKopy}>
        {label}
      </button>
    );
  };

  /** ---------- Render ---------- */
  return (
    <main
      className="sf"
      style={{
        maxWidth: "100vw",
        overflowX: "clip",
        paddingInline: "max(var(--space-2, 13px), env(safe-area-inset-left, 0px))",
      }}
    >
      <header className="sf-head" role="region" aria-labelledby="glyph-stream-title">
        <h1 id="glyph-stream-title" style={{ wordBreak: "break-word" }}>
          Memory Stream
        </h1>

        {/* Payload banner + ATTACHMENTS */}
        {payload ? (
          <div className="sf-payload">
            <div
              className="sf-payload-line"
              style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
            >
              <span className="sf-pill sf-pill--source">
                {payload.source === "x" ? "From X" : "Manual"}
              </span>
              {payload.author && <span className="sf-pill sf-pill--author">{payload.author}</span>}
              {payload.sigilId && <span className="sf-pill sf-pill--sigil">Sigil {payload.sigilId}</span>}
              {payload.phiKey && <span className="sf-pill sf-pill--phikey">ΦKey {payload.phiKey}</span>}
            </div>

            <div
              className="sf-payload-core"
              style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
            >
              <strong>Pulse</strong>&nbsp;{payload.pulse}
              {payloadKai && <span className="sf-kai-label"> • {kaiLabel(payloadKai)}</span>}
              {payload.caption && <span className="sf-caption"> — “{payload.caption}”</span>}
            </div>

            {/* Kopy current payload page */}
            <div style={{ marginTop: ".5rem", display: "flex", gap: ".5rem" }}>
              <KopyButton
                url={typeof window !== "undefined" ? window.location.href : ""}
                label="Kopy"
              />
            </div>

            {/* NEW: Attachment gallery */}
            {payloadAttachments && <AttachmentGallery manifest={payloadAttachments} />}
          </div>
        ) : payloadError ? (
          <div className="sf-error" role="alert">{payloadError}</div>
        ) : (
          <>
            <p className="sf-sub" style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
              Open a payload link at <code>/stream/p/&lt;token&gt;</code>. Replies are Kai-sealed and
              automatically add themselves to the stream; threads include sources via <code>?add=</code>.
            </p>

            {/* -------- Link Inhaler -------- */}
            <section className="sf-inhaler" aria-labelledby="inhaler-title" style={{ marginTop: "1rem" }}>
              <h2 id="inhaler-title" className="sf-reply-title">Inhale a memory</h2>
              <div className="sf-reply-row" style={{ display: "grid", gap: ".5rem" }}>
                <input
                  ref={inhaleInputRef}
                  className="sf-input"
                  type="url"
                  placeholder="Paste any message (https://…)"
                  value={inhaleValue}
                  onChange={(e) => setInhaleValue(e.target.value)}
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  inputMode="url"
                />
                <div className="sf-reply-actions" style={{ gap: ".5rem", display: "flex", flexWrap: "wrap" }}>
                  <button className="sf-btn" onClick={() => onInhaleLink(inhaleValue)}>Inhale</button>
                  <button className="sf-btn sf-btn--ghost" onClick={onGrabClipboard}>Grab from Klipboard</button>
                </div>
                {inhaleErr && <div className="sf-error" role="alert">{inhaleErr}</div>}
              </div>
            </section>
          </>
        )}

        {/* Reply Composer (session-gated) */}
        {payload && (
          <section className="sf-reply" aria-labelledby="reply-title">
            <h2 id="reply-title" className="sf-reply-title">Reply</h2>

            {!verifiedThisSession ? (
              <div className="sf-reply-login">
                <p className="sf-sub">Inhale ΦKey to resonant a reply.</p>
                <SigilLogin onVerified={onVerifiedNow} />
              </div>
            ) : !composerMeta ? (
              <div className="sf-error" role="alert">
                Verified, but no sigil metadata found. Re-inhale your glyph.
              </div>
            ) : (
              <>
                {/* Identity preview */}
                <div className="sf-reply-id" style={{ rowGap: ".4rem", columnGap: ".4rem", display: "flex", flexWrap: "wrap" }}>
                  {composerPhiKey && <span className="sf-pill sf-pill--phikey" title="Your ΦKey (session)">ΦKey {composerPhiKey}</span>}
                  {composerKaiSig && <span className="sf-pill sf-pill--ksig" title="Kai Signature (session)">ΣSig {composerKaiSig}</span>}
                </div>

                {/* Optional author handle */}
                <div className="sf-reply-row">
                  <label className="sf-label">Author <span className="sf-muted">(optional)</span></label>
                  <input
                    className="sf-input"
                    type="text"
                    placeholder="@handle"
                    value={replyAuthor}
                    onChange={(e) => setReplyAuthor(e.target.value)}
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    inputMode="text"
                  />
                </div>

                {/* Reply text */}
                <div className="sf-reply-row">
                  <label className="sf-label">Message</label>
                  <textarea
                    className="sf-textarea"
                    rows={3}
                    placeholder="Type your reply…"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                  />
                </div>

                {/* Sigil action URL preview (locked) */}
                {sigilActionUrl ? (
                  <div className="sf-reply-row">
                    <label className="sf-label">Sigil Verifikation <span className="sf-muted">(URL)</span></label>
                    <input className="sf-input sf-input--locked" type="url" value={sigilActionUrl} readOnly />
                    {!isLikelySigilUrl(sigilActionUrl) && (
                      <div className="sf-warn" role="status">No kanonical sigil link found; a fallback will be used.</div>
                    )}
                  </div>
                ) : (
                  <div className="sf-warn" role="status">No sigil verifikation URL detected; a fallback will be used.</div>
                )}

                {/* Errors / warnings */}
                {replyErr && <div className="sf-error" role="alert">{replyErr}</div>}
                {replyWarn && !replyErr && <div className="sf-warn">{replyWarn}</div>}

                {/* Actions */}
                <div className="sf-reply-actions">
                  <button className="sf-btn" onClick={() => void onGenerateReply()} disabled={replyBusy} aria-busy={replyBusy}>
                    {replyBusy ? "Sealing…" : "Exhale Reply Link"}
                  </button>
                  <button
                    className="sf-btn sf-btn--ghost"
                    onClick={() => {
                      setVerifiedThisSession(false);
                      try { sessionStorage.removeItem(sessionKey); } catch (e) { report("sessionStorage.removeItem failed", e); }
                    }}
                  >
                    Use a different glyph
                  </button>
                </div>

                {/* Result + Kopy */}
                {replyUrl && (
                  <div className="sf-reply-result" ref={resultRef}>
                    <label className="sf-label">Share this link</label>
                    <input className="sf-input" type="text" readOnly value={replyUrl} onFocus={(e) => e.currentTarget.select()} />
                    <div className="sf-reply-actions">
                      <a className="sf-link" href={replyUrl} target="_blank" rel="noopener noreferrer">Open reply →</a>
                      <KopyButton url={replyUrl} label="Kopy" />
                    </div>
                    <p className="sf-sub"></p>
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </header>

      {/* Stream list */}
      <section className="sf-list">
        {urls.length === 0 ? (
          <div className="sf-empty">
            No items yet. Paste a link above or open a <code>/stream/p/&lt;payload&gt;</code> link and
            reply to start a thread.
          </div>
        ) : (
          urls.map((u) => <FeedCard key={u} url={u} />)
        )}
      </section>

      {/* Critical styles for the new attachment components */}
      <style>{`
        .sf-attachments { margin-top: 1rem; }
        .sf-att-title { font-size: 1.0rem; font-weight: 700; margin: 0 0 .6rem; letter-spacing: .01em; }
        .sf-att-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr));
          gap: 12px;
        }
        .sf-att-item {
          background: linear-gradient(180deg, rgba(12,16,24,.7), rgba(10,14,22,.6));
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 8px 26px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.04);
          backdrop-filter: blur(6px);
        }
        .sf-att-foot { margin-top: .35rem; opacity: .85; font-size: .9rem; }

        .sf-embed { position: relative; width: 100%; aspect-ratio: 16 / 9; background: rgba(255,255,255,.03); }
        .sf-embed iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; border-radius: 12px; }

        .sf-embed--doc { aspect-ratio: 4 / 3; }

        .sf-media { position: relative; width: 100%; background: rgba(255,255,255,.02); }
        .sf-media--image { display: grid; place-items: center; }
        .sf-media--image img { width: 100%; height: auto; display: block; }
        .sf-media--video video { width: 100%; height: auto; display: block; border-radius: 12px; background: #000; }
        .sf-media--audio { padding: 10px; }
        .sf-media--audio audio { width: 100%; }

        .sf-file, .sf-fileref {
          padding: 10px 12px;
        }
        .sf-file-head, .sf-file-foot {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
        }
        .sf-file-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sf-file-size { opacity: .85; font-feature-settings: "tnum"; }
        .sf-file-pre {
          margin: 8px 0; max-height: 240px; overflow: auto; background: rgba(255,255,255,.04);
          border: 1px dashed rgba(255,255,255,.12); border-radius: 10px; padding: 10px; line-height: 1.25;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: .88rem;
          white-space: pre-wrap; word-break: break-word;
        }
        .sf-file-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 8px; opacity: .9; }
        .sf-file-dl {
          display: inline-flex; align-items: center; gap: 6px;
          margin: 6px 0 0; padding: 6px 10px; border-radius: 10px;
          background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12);
          text-decoration: none; color: inherit;
        }
        .sf-file-type { opacity: .85; }
        .sf-hash { user-select: all; font-size: .85rem; }
        .sf-note { margin-top: 6px; opacity: .8; font-size: .9rem; }

        .sf-att-link {
          display: block; padding: 10px 12px; text-decoration: none; color: inherit;
          background: rgba(255,255,255,.02);
          transition: background .18s ease, transform .18s ease;
        }
        .sf-att-link:hover { background: rgba(255,255,255,.05); transform: translateY(-1px); }
        .sf-att-link__row { display: grid; grid-template-columns: 16px 1fr; gap: 10px; align-items: center; }
        .sf-att-link__text { min-width: 0; }
        .sf-att-link__title { font-weight: 600; font-size: .96rem; }
        .sf-att-link__url { opacity: .9; font-size: .86rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
      `}</style>
    </main>
  );
}

/** ---------- Helpers (hash/query → canonical) ---------- */
function expandShortAliasToCanonical(hrefLike: string): string {
  try {
    const u = new URL(hrefLike, shortBase());
    if (u.pathname !== "/p") return hrefLike;

    const hash = u.hash.startsWith("#") ? u.hash.slice(1) : u.hash;
    const qpHash = new URLSearchParams(hash);
    const tHash = qpHash.get("t");
    const addHash = qpHash.get("add");

    const tQuery = u.searchParams.get("t");
    const addQuery = u.searchParams.get("add");

    const token = tHash || tQuery;
    if (!token) return hrefLike;

    const dest = canonicalBase();
    dest.pathname = `/stream/p/${token}`;

    const add = addHash || addQuery;
    if (add) {
      try {
        const isShort = add.startsWith("/p#t=") || add.startsWith("#t=") || add.includes("/p?t=");
        const expandedAdd = isShort
          ? expandShortAliasToCanonical(add.startsWith("#t=") ? `${shortBase().origin}/p${add}` : add)
          : add;
        dest.searchParams.set("add", expandedAdd);
      } catch (e) {
        report("expandShortAliasToCanonical parent expand failed", e);
        dest.searchParams.set("add", add);
      }
    }
    return dest.toString();
  } catch (e) {
    report("expandShortAliasToCanonical URL parse failed", e);
    return hrefLike;
  }
}

function normalizeAddParam(s: string): string {
  const v = s.trim();
  if (!v) return v;
  try {
    if (v.startsWith("/p#t=") || v.startsWith("#t=") || v.includes("/p?t=")) {
      const full =
        v.startsWith("#t=")
          ? `${shortBase().origin}/p${v}`
          : v.startsWith("/p")
          ? `${shortBase().origin}${v}`
          : v;
      return expandShortAliasToCanonical(full);
    }
    if (v.startsWith("http")) {
      const u = new URL(v);
      if (u.pathname === "/p") return expandShortAliasToCanonical(v);
      return v;
    }
    return v;
  } catch (e) {
    report("normalizeAddParam failed", e);
    return v;
  }
}
