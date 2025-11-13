// src/components/FeedCard.tsx
import React, { useCallback, useMemo, useState } from "react";
import KaiSigil from "../components/KaiSigil";
import { decodeSigilUrl } from "../utils/sigilDecode";
import {
  STEPS_BEAT,
  momentFromPulse,
  type ChakraDay,
} from "../utils/kai_pulse";
import type {
  Capsule,
  PostPayload,
  MessagePayload,
  SharePayload,
  ReactionPayload,
} from "../utils/sigilDecode";
import "./FeedCard.css";

type Props = { url: string };

/** Safe string shortener */
const short = (s: string, head = 8, tail = 4): string =>
  s.length <= head + tail ? s : `${s.slice(0, head)}…${s.slice(-tail)}`;

/** Host label helper */
const hostOf = (href?: string): string | undefined => {
  if (!href) return undefined;
  try {
    return new URL(href).host;
  } catch {
    return undefined;
  }
};

const isNonEmpty = (val: unknown): val is string =>
  typeof val === "string" && val.trim().length > 0;

/** Map an unknown value to a valid ChakraDay with a coherent fallback. */
function toChakra(value: unknown, fallback: ChakraDay): ChakraDay {
  if (
    typeof value === "string" &&
    (
      [
        "Root",
        "Sacral",
        "Solar Plexus",
        "Heart",
        "Throat",
        "Third Eye",
        "Crown",
      ] as const
    ).includes(value as never)
  ) {
    return value as ChakraDay;
  }
  return fallback;
}

/** Arc name from *zero-based* beat (0..35) — 6 beats per arc */
function arcFromBeat(beatZ: number):
  | "Ignition Ark"
  | "Integration Ark"
  | "Harmonization Ark"
  | "Reflection Ark"
  | "Purification Ark"
  | "Dream Ark" {
  const idx = Math.max(0, Math.min(5, Math.floor(beatZ / 6)));
  return (
    [
      "Ignition Ark",
      "Integration Ark",
      "Harmonization Ark",
      "Reflection Ark",
      "Purification Ark",
      "Dream Ark",
    ] as const
  )[idx];
}

/** Two-digit pad: 0 → "00", 1 → "01", … 9 → "09", etc. */
const pad2 = (n: number): string => String(Math.max(0, Math.floor(n))).padStart(2, "0");

/** Build a Kai-first meta line with **zero-based**, **two-digit** BB:SS label. NEVER display Chronos. */
function buildKaiMetaLineZero(
  pulse: number,
  beatZ: number,
  stepZ: number,
  chakraDay: ChakraDay
): string {
  const arc = arcFromBeat(beatZ);
  const label = `${pad2(beatZ)}:${pad2(stepZ)}`; // zero-based, two-digit BB:SS
  return `Kai:${pulse} • ${label} • ${chakraDay} • ${arc}`;
}

/** Compute stepPct for KaiSigil from a *zero-based* step index */
function stepPctFromIndex(stepZ: number): number {
  const s = Math.max(0, Math.min(STEPS_BEAT - 1, Math.floor(stepZ)));
  const pct = s / STEPS_BEAT;
  return pct >= 1 ? 1 - 1e-12 : pct;
}

export const FeedCard: React.FC<Props> = ({ url }) => {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1100);
    } catch (e: unknown) {
      // eslint-disable-next-line no-console
      console.warn("Clipboard copy failed:", e);
    }
  }, [url]);

  const decoded = useMemo(() => decodeSigilUrl(url), [url]);

  // Hard error state (invalid capsule)
  if (!decoded.ok) {
    return (
      <article className="fc err" role="group" aria-label="Invalid Sigil URL">
        <div className="fc-url mono" title={url}>
          {url}
        </div>
        <div className="fc-err" role="alert">
          {decoded.error}
        </div>
        <div className="fc-actions">
          <button className="btn" type="button" onClick={onCopy} aria-pressed={copied}>
            {copied ? "Kopied" : "Kopy URL"}
          </button>
        </div>
      </article>
    );
  }

  // Safe destructure
  const { data } = decoded;
  const capsule: Capsule = data.capsule;

  const post: PostPayload | undefined = capsule.post;
  const message: MessagePayload | undefined = capsule.message;
  const share: SharePayload | undefined = capsule.share;
  const reaction: ReactionPayload | undefined = capsule.reaction;

  // Derive Kai meta robustly
  const pulse = typeof data.pulse === "number" ? data.pulse : 0;

  // Start from provided numbers or compute from pulse, then normalize to zero-based ints
  let beatRaw = typeof data.beat === "number" ? data.beat : NaN;
  let stepRaw = typeof data.stepIndex === "number" ? data.stepIndex : NaN;
  let chakraDay: ChakraDay = toChakra(data.chakraDay, "Crown");

  if (!Number.isFinite(beatRaw) || !Number.isFinite(stepRaw) || !data.chakraDay) {
    const m = momentFromPulse(pulse);
    // Assume momentFromPulse already returns zero-based; if not, floor & clamp will still neutralize.
    if (!Number.isFinite(beatRaw)) beatRaw = m.beat;
    if (!Number.isFinite(stepRaw)) stepRaw = m.stepIndex;
    if (!data.chakraDay) chakraDay = m.chakraDay;
  }

  // Normalize to **zero-based** integers for all downstream usage
  const beatZ = Math.max(0, Math.floor(beatRaw));
  const stepZ = Math.max(0, Math.floor(stepRaw));

  const kind =
    data.kind ??
    (post ? "post" : message ? "message" : share ? "share" : reaction ? "reaction" : "sigil");

  const appBadge = data.appId ? `app ${short(data.appId, 10, 4)}` : undefined;
  const userBadge = data.userId ? `user ${short(String(data.userId), 10, 4)}` : undefined;

  const sigilId = isNonEmpty(capsule.sigilId) ? capsule.sigilId : undefined;
  const phiKey = isNonEmpty(capsule.phiKey) ? capsule.phiKey : undefined;
  const signaturePresent = isNonEmpty(capsule.kaiSignature);
  const verifiedTitle = signaturePresent ? "Signature present (Kai Signature)" : "Unsigned capsule";

  // ✅ author only exists on capsule
  const authorBadge = isNonEmpty(capsule.author) ? capsule.author : undefined;

  // Source may exist on capsule or (legacy) data
  const sourceBadge =
    (isNonEmpty(capsule.source) ? capsule.source : undefined) ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (typeof (data as any).source === "string" ? ((data as any).source as string) : undefined);

  // Build Kai meta with ZERO-BASED, TWO-DIGIT label
  const kaiMeta = buildKaiMetaLineZero(pulse, beatZ, stepZ, chakraDay);
  const stepPct = stepPctFromIndex(stepZ);

  return (
    <article className="fc" role="article" aria-label={`${kind} glyph`}>
      {/* Left: living sigil */}
      <div className="fc-left" aria-hidden="true">
        <div className="fc-sigil">
          <KaiSigil pulse={pulse} beat={beatZ} stepPct={stepPct} chakraDay={chakraDay} />
        </div>
      </div>

      {/* Right: content */}
      <div className="fc-right">
        {/* Meta row — ALL Kai, no Chronos */}
        <div className="fc-meta" aria-label="Glyph metadata">
          <span className="pill kind" title={`Kind: ${kind}`}>
            {kind.toUpperCase()}
          </span>

          {appBadge && <span className="pill">{appBadge}</span>}
          {userBadge && <span className="pill">{userBadge}</span>}

          {sigilId && (
            <span className="pill sigil" title={`Sigil: ${sigilId}`}>
              SIGIL {short(sigilId, 6, 4)}
            </span>
          )}

          {phiKey && (
            <span className="pill phikey" title={`ΦKey: ${phiKey}`}>
              ΦKEY {short(phiKey, 6, 4)}
            </span>
          )}

          {authorBadge && (
            <span className="pill author" title="Author handle / origin">
              {authorBadge}
            </span>
          )}

          {sourceBadge && (
            <span className="pill source" title="Source">
              {String(sourceBadge).toUpperCase()}
            </span>
          )}

          <span className="pill chakra" title="Chakra day">
            {chakraDay}
          </span>

          <span className="muted kai" title="Kai meta">
            • {kaiMeta}
          </span>

          <span
            className={`sig ${signaturePresent ? "ok" : "warn"}`}
            title={verifiedTitle}
            aria-label={verifiedTitle}
          >
            {signaturePresent ? "SIGNED" : "UNSIGNED"}
          </span>
        </div>

        {/* Body by kind */}
        {post && (
          <section className="fc-bodywrap">
            {isNonEmpty(post.title) && <h3 className="fc-title">{post.title}</h3>}
            {isNonEmpty(post.text) && <p className="fc-body">{post.text}</p>}

            {Array.isArray(post.tags) && post.tags.length > 0 && (
              <div className="fc-tags" aria-label="Tags">
                {post.tags.map((t) => (
                  <span key={t} className="tag">
                    #{t}
                  </span>
                ))}
              </div>
            )}

            {Array.isArray(post.media) && post.media.length > 0 && (
              <div className="fc-media" aria-label="Attached media">
                {post.media.map((m) => {
                  const key = `${m.kind}:${m.url}`;
                  const label = hostOf(m.url) ?? m.kind;
                  return (
                    <a
                      key={key}
                      className="btn ghost"
                      href={m.url}
                      target="_blank"
                      rel="noreferrer"
                      title={m.url}
                    >
                      {label}
                    </a>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {message && (
          <section className="fc-bodywrap">
            <h3 className="fc-title">
              Message → {short(String(message.toUserId ?? "recipient"), 10, 4)}
            </h3>
            {isNonEmpty(message.text) && <p className="fc-body">{message.text}</p>}
          </section>
        )}

        {share && (
          <section className="fc-bodywrap">
            <h3 className="fc-title">Share</h3>
            <a
              className="fc-link"
              href={share.refUrl}
              target="_blank"
              rel="noreferrer"
              title={share.refUrl}
            >
              {hostOf(share.refUrl) ?? share.refUrl}
            </a>
            {isNonEmpty(share.note) && <p className="fc-body">{share.note}</p>}
          </section>
        )}

        {reaction && (
          <section className="fc-bodywrap">
            <h3 className="fc-title">Reaction</h3>
            <div className="fc-body">
              {isNonEmpty(reaction.emoji) ? reaction.emoji : "❤️"}
              {typeof reaction.value === "number" ? ` × ${reaction.value}` : null}
            </div>
            <a
              className="fc-link"
              href={reaction.refUrl}
              target="_blank"
              rel="noreferrer"
              title={reaction.refUrl}
            >
              {hostOf(reaction.refUrl) ?? reaction.refUrl}
            </a>
          </section>
        )}

        {/* Fallback body if no typed content is present */}
        {!post && !message && !share && !reaction && (
          <section className="fc-bodywrap">
            <h3 className="fc-title">Sigil Verifikation</h3>
            <a className="fc-link" href={url} target="_blank" rel="noreferrer" title={url}>
              {hostOf(url) ?? url}
            </a>
          </section>
        )}

        {/* Actions */}
        <div className="fc-actions" role="group" aria-label="Actions">
          <a className="btn" href={url} target="_blank" rel="noreferrer" title="Open original sigil URL">
            Open Sigil
          </a>
          <button className="btn" type="button" onClick={onCopy} aria-pressed={copied}>
            {copied ? "Kopied" : "Kopy URL"}
          </button>
        </div>
      </div>
    </article>
  );
};

export default FeedCard;
