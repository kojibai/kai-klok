"use client";

/// <reference types="react" />

import { useCallback, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, KeyboardEvent } from "react";

import { parseSvgFile } from "../VerifierStamper/svg";
import { computeKaiSignature, derivePhiKeyFromSig } from "../VerifierStamper/sigilUtils";
import type { SigilMeta } from "../VerifierStamper/types";

import "./styles/sigil-login.css";

/** Minimal, verified shape we require after runtime checks */
type SigilMetaCore = SigilMeta & {
  pulse: number;
  beat: number;
  stepIndex: number;
  chakraDay: string;
  kaiSignature: string;
  userPhiKey?: string;
};

export interface SigilLoginProps {
  onVerified: (svgText: string, embeddedJson: SigilMetaCore) => void;
}

/* --------------------------- safe helpers --------------------------- */
function lower(s: string | undefined | null): string {
  return typeof s === "string" ? s.toLowerCase() : "";
}
function hasOwn<T extends object, K extends PropertyKey>(
  obj: T,
  key: K
): obj is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(obj, key);
}
function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}
function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Assert the parsed meta has the exact core fields we need */
function assertIsSigilMetaCore(m: unknown): asserts m is SigilMetaCore {
  if (typeof m !== "object" || m === null) throw new Error("Malformed sigil metadata.");
  const o = m as Record<string, unknown>;

  for (const k of ["pulse", "beat", "stepIndex", "chakraDay"] as const) {
    if (!hasOwn(o, k)) throw new Error(`Missing Kai field: ${k}`);
  }
  if (!hasOwn(o, "kaiSignature")) throw new Error("Invalid Kai Signature — tampered or unsigned sigil.");

  if (!isFiniteNumber(o.pulse)) throw new Error("Invalid field: pulse");
  if (!isFiniteNumber(o.beat)) throw new Error("Invalid field: beat");
  if (!isFiniteNumber(o.stepIndex)) throw new Error("Invalid field: stepIndex");
  if (!isNonEmptyString(o.chakraDay)) throw new Error("Invalid field: chakraDay");
  if (!isNonEmptyString(o.kaiSignature)) throw new Error("Invalid field: kaiSignature");
}

/** Extract ONLY the primary root <metadata> JSON (skip valuation/ledger/dht/source) */
function extractPrimaryMetaFromSvgText(svgText: string): SigilMeta | null {
  try {
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    const nodes = Array.from(doc.getElementsByTagName("metadata"));
    const skipIds = ["valuation", "ledger", "dht", "source"];
    for (const el of nodes) {
      const idAttr = el.getAttribute("id") ?? "";
      if (skipIds.some((k) => idAttr.includes(k))) continue;

      const raw = (el.textContent ?? "").trim();
      if (!raw) continue;

      const peeled = raw.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
      try {
        const obj = JSON.parse(peeled) as unknown;
        if (
          typeof obj === "object" &&
          obj !== null &&
          hasOwn(obj, "pulse") &&
          hasOwn(obj, "beat") &&
          hasOwn(obj, "stepIndex") &&
          hasOwn(obj, "chakraDay") &&
          hasOwn(obj, "kaiSignature")
        ) {
          return obj as SigilMeta;
        }
      } catch {
        /* ignore non-JSON */
      }
    }
    return null;
  } catch {
    return null;
  }
}

/* ------------------------------ Kai Orb SVG ----------------------------- */
/** Static, glassy Kai orb (no pulse animation). Scales via --sigil-orb-size. */
function KaiOrbSVG() {
  return (
    <svg className="kai-orb-svg" viewBox="0 0 88 88" role="img" aria-label="Kai Orb">
      <defs>
        <radialGradient id="orbGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="55%" stopColor="#00ffd0" stopOpacity="1" />
          <stop offset="100%" stopColor="#00ffd0" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Outer ring */}
      <circle cx="44" cy="44" r="41" fill="none" stroke="#00ffd0" strokeOpacity="0.38" strokeWidth="1.6" />
      {/* Inner violet ring */}
      <circle cx="44" cy="44" r="32" fill="none" stroke="#8a2be2" strokeOpacity="0.45" strokeWidth="1.4" />

      {/* Subtle grid */}
      <g opacity="0.45">
        <circle cx="44" cy="44" r="20" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth=".8" />
        <circle cx="44" cy="44" r="10" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth=".7" />
        <line x1="44" y1="4" x2="44" y2="84" stroke="rgba(255,255,255,.2)" strokeWidth=".8" />
        <line x1="4" y1="44" x2="84" y2="44" stroke="rgba(255,255,255,.2)" strokeWidth=".8" />
      </g>

      {/* Golden core */}
      <circle cx="44" cy="44" r="10" fill="url(#orbGlow)" />

      {/* Phi triangle */}
      <path d="M44 14 L72 68 H16 Z" fill="none" stroke="#00b4ff" strokeOpacity="0.35" strokeWidth="1.2" />
    </svg>
  );
}

/* --------------------------------- UI ---------------------------------- */

export default function SigilLogin({ onVerified }: SigilLoginProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [verified, setVerified] = useState<SigilMetaCore | null>(null);

  const verifyFile = useCallback(
    async (file: File) => {
      setLoading(true);
      setError(null);
      setVerified(null);

      try {
        if (file.type !== "image/svg+xml" && !file.name.endsWith(".svg")) {
          throw new Error("Please upload an SVG sigil file.");
        }

        const svgText = await file.text();
        const { meta, contextOk, typeOk } = await parseSvgFile(file);

        const primaryMeta =
          meta && hasOwn(meta as Record<string, unknown>, "kaiSignature") && hasOwn(meta as Record<string, unknown>, "pulse")
            ? meta
            : extractPrimaryMetaFromSvgText(svgText);

        if (!primaryMeta || !contextOk || !typeOk) {
          throw new Error("Malformed or unrecognized sigil structure.");
        }

        assertIsSigilMetaCore(primaryMeta);
        const core: SigilMetaCore = primaryMeta;

        const expectedSig = await computeKaiSignature(core);
        if (!expectedSig || lower(expectedSig) !== lower(core.kaiSignature)) {
          throw new Error("Invalid Kai Signature — tampered or unsigned sigil.");
        }

        const expectedPhiKey = await derivePhiKeyFromSig(core.kaiSignature);
        if (typeof core.userPhiKey === "string") {
          if (lower(expectedPhiKey) !== lower(core.userPhiKey)) {
            throw new Error("Φ-Key mismatch — identity invalid.");
          }
        } else {
          (core as SigilMetaCore).userPhiKey = expectedPhiKey;
        }

        setVerified(core);
        onVerified(svgText, core);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Invalid sigil file. Ensure it’s a Kai-sealed SVG with embedded JSON <metadata>.";
        setError(message);
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [onVerified]
  );

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await verifyFile(file);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await verifyFile(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const dzClass = [
    "sigil-dropzone",
    dragOver ? "sigil-dropzone--over" : "",
    loading ? "sigil-dropzone--loading" : "",
    verified ? "sigil-dropzone--ok" : "",
    error ? "sigil-dropzone--err" : "",
  ].join(" ");

  return (
    <div className="sigil-login-only w-full max-w-xl mx-auto">
      {/* DROP / TAP AREA ONLY */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onKeyDown={onKey}
        className={dzClass}
        role="button"
        tabIndex={0}
        title="Drag & drop your Kai-sealed SVG here, or tap to browse"
        aria-label="Upload or drop your Kai-sealed SVG sigil"
        aria-describedby="sigil-instructions sigil-trustline"
        onClick={() => fileInputRef.current?.click()}
      >
        {/* Static halo + grid */}
        <div className="sigil-grid" aria-hidden />
        <div className="sigil-ring sigil-ring--outer" aria-hidden />
        <div className="sigil-ring sigil-ring--inner" aria-hidden />

        {/* Center orb + copy */}
        <div className="sigil-center">
          <div className="sigil-orb" aria-hidden>
            <KaiOrbSVG />
          </div>

          {/* NEW: explicit drag/drop instructions (kept above trust line) */}
          <p id="sigil-instructions" className="sigil-instructions">
            Drag & drop your Kai-sealed SVG here, or <span className="sigil-accent">tap to browse</span>.
          </p>

          {/* Inline status feedback (inside the zone) */}
          <div className="sigil-status" aria-live="polite">
            {loading && (
              <div className="sigil-status__row">
                <span className="sigil-spinner" />
                <span>Verifying signature & deriving Φ-Key…</span>
              </div>
            )}
            {!loading && verified && (
              <div className="sigil-status__ok">
                <span className="ok-dot" />
                <span>Verified — Φ-Key bound</span>
              </div>
            )}
            {!loading && error && (
              <div className="sigil-status__err">{error}</div>
            )}
          </div>
        </div>

        {/* Hidden input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".svg,image/svg+xml"
          onChange={handleUpload}
          className="hidden"
        />
      </div>
    </div>
  );
}
