// src/components/FeedCard.tsx
import React, { useCallback, useMemo, useState } from "react";
import KaiSigil from "../components/KaiSigil";
import { decodeSigilUrl } from "../utils/sigilDecode";
import {
  STEPS_BEAT,
  momentFromPulse,
  toDisplayBeatStep,
  type ChakraDay,
} from "../utils/kai_pulse";
import type {
  Capsule,
  PostPayload,
  MessagePayload,
  SharePayload,
  ReactionPayload,
} from "../utils/sigilDecode";

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

/** Arc name from beat (0..35) — 6 beats per arc */
function arcFromBeat(beat: number):
  | "Ignition Ark"
  | "Integration Ark"
  | "Harmonization Ark"
  | "Reflection Ark"
  | "Purification Ark"
  | "Dream Ark" {
  const idx = Math.max(0, Math.min(5, Math.floor(beat / 6)));
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

/** Build a Kai-first meta line. NEVER display Chronos. */
function buildKaiMetaLine(pulse: number, beat: number, stepIndex: number, chakraDay: ChakraDay): string {
  const { label } = toDisplayBeatStep(beat, stepIndex); // "BB:SS" (1-based label)
  const arc = arcFromBeat(beat);
  return `Kai:${pulse} • ${label} • ${chakraDay} • ${arc}`;
}

/** Compute stepPct for KaiSigil from a zero-based stepIndex */
function stepPctFromIndex(stepIndex: number): number {
  const s = Math.max(0, Math.min(STEPS_BEAT - 1, Math.floor(stepIndex)));
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
  let beat = typeof data.beat === "number" ? data.beat : 0;
  let stepIndex = typeof data.stepIndex === "number" ? data.stepIndex : 0;
  let chakraDay: ChakraDay = toChakra(data.chakraDay, "Crown");

  if (!(typeof data.beat === "number" && typeof data.stepIndex === "number")) {
    const m = momentFromPulse(pulse);
    beat = m.beat;
    stepIndex = m.stepIndex;
    if (!data.chakraDay) chakraDay = m.chakraDay;
  }

  const kind =
    data.kind ??
    (post ? "post" : message ? "message" : share ? "share" : reaction ? "reaction" : "sigil");

  const appBadge = data.appId ? `app ${short(data.appId, 10, 4)}` : undefined;
  const userBadge = data.userId ? `user ${short(String(data.userId), 10, 4)}` : undefined;

  const sigilId = isNonEmpty(capsule.sigilId) ? capsule.sigilId : undefined;
  const phiKey = isNonEmpty(capsule.phiKey) ? capsule.phiKey : undefined;
  const signaturePresent = isNonEmpty(capsule.kaiSignature);
  const verifiedTitle = signaturePresent ? "Signature present (Kai Signature)" : "Unsigned capsule";

  // ✅ FIX: author is not a field on `data`; only read from capsule
  const authorBadge = isNonEmpty(capsule.author) ? capsule.author : undefined;

  // Source may exist on capsule or data depending on your decoder type
  const sourceBadge =
    (isNonEmpty(capsule.source) ? capsule.source : undefined) ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (typeof (data as any).source === "string" ? ((data as any).source as string) : undefined);

  const kaiMeta = buildKaiMetaLine(pulse, beat, stepIndex, chakraDay);
  const stepPct = stepPctFromIndex(stepIndex);

  return (
    <article className="fc" role="article" aria-label={`${kind} glyph`}>
      {/* Left: living sigil */}
      <div className="fc-left" aria-hidden="true">
        <div className="fc-sigil">
          <KaiSigil pulse={pulse} beat={beat} stepPct={stepPct} chakraDay={chakraDay} />
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
            <h3 className="fc-title">Sigil Action</h3>
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
