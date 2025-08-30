"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./GlyphImportModal.css";

import { UploadCloud, XCircle, Check, AlertTriangle } from "lucide-react";
import type { Glyph } from "../glyph/types";

import {
  computeIntrinsicUnsigned,
  buildValueSeal,
  attachValuation,
  type SigilMetadataLite,
} from "../utils/valuation";

import {
  validateMeta as verifierValidateMeta,
  type SigilMetadata,
} from "../verifier/validator";

/** ─────────────────────────────────────────────────────────────
 *  Enhancements:
 *   • Record any credited Φ into metadata as a ledger entry: meta.credits[]
 *   • Seal valuation AFTER ledger augmentation so the seal matches metadata
 *   • Preserve full verifier metadata; never drop fields
 *   • Return a complete Glyph (hash/value/pulse/meta) via onImport
 *  ──────────────────────────────────────────────────────────── */

type FallbackSigilMetadata = SigilMetadataLite & Record<string, unknown>;
type AnySigil = SigilMetadata | FallbackSigilMetadata;

type CreditEntry = { atPulse: number; amountPhi: number; source?: string };

/* Safe helpers (no `any`) */
function readCredits(meta: object): CreditEntry[] | undefined {
  const maybe = (meta as { credits?: unknown }).credits;
  if (!Array.isArray(maybe)) return undefined;

  const parsed = maybe
    .map((e): CreditEntry | null => {
      if (e && typeof e === "object") {
        const atPulse = (e as { atPulse?: unknown }).atPulse;
        const amountPhi = (e as { amountPhi?: unknown }).amountPhi;
        const source = (e as { source?: unknown }).source;
        if (typeof atPulse === "number" && typeof amountPhi === "number") {
          return {
            atPulse,
            amountPhi,
            source: typeof source === "string" ? source : undefined,
          };
        }
      }
      return null;
    })
    .filter((v): v is CreditEntry => v !== null);

  return parsed.length ? parsed : undefined;
}

function withAppendedCredit<T extends object>(meta: T, entry: CreditEntry | null): T & { credits?: CreditEntry[] } {
  if (!entry) return meta as T & { credits?: CreditEntry[] };
  const existing = readCredits(meta) ?? [];
  const next = [...existing, entry];
  return { ...(meta as Record<string, unknown>), credits: next } as T & { credits?: CreditEntry[] };
}

const bytesToHex = (u8: Uint8Array) =>
  Array.from(u8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

async function sha256Hex(msg: string | Uint8Array): Promise<string> {
  const data = typeof msg === "string" ? new TextEncoder().encode(msg) : msg;
  const buf = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(buf));
}

export interface GlyphImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (glyph: Glyph) => void;
  onCreditPhi?: (amountPhi: number) => void; // optional side-effect to pre-credit a wallet/balance
}

export default function GlyphImportModal({
  open,
  onClose,
  onImport,
  onCreditPhi,
}: GlyphImportModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [glyph, setGlyph] = useState<Glyph | null>(null);
  const [status, setStatus] = useState<"checking" | "ok" | "warn" | "err" | null>(null);
  const [unsigned, setUnsigned] = useState(false);
  const [preview, setPreview] = useState<{ hash: string; value: number; pulse: number } | null>(null);
  const [depositPhi, setDepositPhi] = useState<number>(0);
  const [fileName, setFileName] = useState<string | null>(null);

  const triggerUpload = useCallback(() => inputRef.current?.click(), []);

  // Prevent background scroll while open (mobile!)
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setGlyph(null);
      setError(null);
      setStatus(null);
      setUnsigned(false);
      setPreview(null);
      setDepositPhi(0);
      setFileName(null);
    }
  }, [open]);

  // Close on ESC and support keyboard-select for upload box
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (
        (e.key === " " || e.key === "Enter") &&
        (document.activeElement as HTMLElement | null)?.dataset?.upload === "true"
      ) {
        e.preventDefault();
        triggerUpload();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, triggerUpload]);

  // DnD support
  const onDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!e.dataTransfer.files?.length) return;
    const file = e.dataTransfer.files[0];
    await importSvgFile(file);
  }, []);
  const onDragOver = useCallback((e: React.DragEvent) => e.preventDefault(), []);

  // Centralized file import (delegates to shared verifier)
  const importSvgFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".svg")) {
      setError("Please select a Kairos Sigil .svg file.");
      setStatus("err");
      return;
    }

    setError(null);
    setStatus("checking");
    setGlyph(null);
    setPreview(null);
    setUnsigned(false);
    setDepositPhi(0);
    setFileName(file.name);

    try {
      const text = await file.text();

      const doc = new DOMParser().parseFromString(text, "image/svg+xml");
      if (!doc.querySelector("svg")) throw new Error("Unrecognized SVG content.");

      const res = await verifierValidateMeta(text);
      if (!res?.ok) {
        setStatus("err");
        setError(res?.reason || "Failed verification.");
        return;
      }

      const meta = (res.meta || {}) as AnySigil;
      const hash = res.canonical;

      const nowPulse: number =
        (meta.exportedAtPulse as number | undefined) ??
        (meta.kaiPulse as number | undefined) ??
        (meta.pulse as number | undefined) ??
        0;

      // Unsigned intrinsic preview (no seal yet)
      const { unsigned: unsignedVal } = computeIntrinsicUnsigned(meta, nowPulse);
      const valPhi = unsignedVal.valuePhi;
      const pulseCreated = (meta.pulse as number | undefined) ?? 0;

      const importedGlyph: Glyph = {
        hash,
        value: valPhi,
        pulseCreated,
        meta,
      } as Glyph;

      setGlyph(importedGlyph);
      setUnsigned(Boolean(res.unsigned));
      setPreview({ hash, value: valPhi, pulse: pulseCreated });
      setStatus(res.unsigned ? "warn" : "ok");
    } catch (err: unknown) {
      // eslint-disable-next-line no-console
      console.error("Glyph import error:", err);
      setStatus("err");
      const msg = (err as Error | { message?: unknown })?.message;
      const text = typeof msg === "string" ? msg : "";
      setError(
        /signature mismatch|Σ/i.test(text)
          ? "Content signature mismatch (Σ)."
          : "Invalid glyph file. Ensure it's an authentic Kairos Sigil SVG with <metadata>."
      );
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }, []);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await importSvgFile(file);
    },
    [importSvgFile]
  );

  /** Finalize import:
   *  - Append a credit ledger entry (if any) to metadata
   *  - Seal valuation over the enriched metadata (so verifier passes)
   *  - Return the complete Glyph object
   */
  const handleImport = useCallback(async () => {
    if (!glyph) return;

    const max = Math.max(0, glyph.value || 0);
    const amt = Math.max(0, Math.min(Number.isFinite(depositPhi) ? depositPhi : 0, max));

    try {
      const baseMeta = (glyph.meta || {}) as AnySigil;
      const nowPulse: number =
        (baseMeta.exportedAtPulse as number | undefined) ??
        (baseMeta.kaiPulse as number | undefined) ??
        (baseMeta.pulse as number | undefined) ??
        0;

      // 1) Record credit (does not subtract from sealed value; it's an auditable log)
      const creditEntry: CreditEntry | null =
        amt > 0 ? { atPulse: nowPulse, amountPhi: Number(amt.toFixed(6)), source: "import" } : null;

      const metaWithLedger: AnySigil = withAppendedCredit(baseMeta, creditEntry);

      // 2) Build valuation seal over the (possibly) augmented metadata
      const { seal } = await buildValueSeal(metaWithLedger, nowPulse, sha256Hex);
      const metaWithVal = attachValuation(metaWithLedger, seal);

      // 3) Final glyph mirrors the seal value; keep original canonical hash
      const finalizedGlyph: Glyph = {
        ...glyph,
        value: seal.valuePhi,
        meta: metaWithVal,
      };

      // Optional side-effect: top-level credit to user's balance
      if (onCreditPhi && amt > 0) onCreditPhi(Number(amt.toFixed(6)));

      onImport(finalizedGlyph);
      onClose();
    } catch (err: unknown) {
      // eslint-disable-next-line no-console
      console.error("Finalize import error:", err);
      setStatus("err");
      setError("Failed to finalize valuation for this glyph.");
    }
  }, [glyph, depositPhi, onCreditPhi, onImport, onClose]);

  const statusLabel = useMemo<
    "" | "Validating…" | "Verified" | "Unsigned (permissible)" | "Invalid"
  >(() => {
    if (status === "checking") return "Validating…";
    if (status === "ok") return "Verified";
    if (status === "warn") return "Unsigned (permissible)";
    if (status === "err") return "Invalid";
    return "";
  }, [status]);

  if (!open) return null;

  const maxCredit = preview?.value ?? 0;
  const creditError =
    depositPhi < 0
      ? "Cannot credit a negative amount."
      : depositPhi > maxCredit
      ? "Exceeds available value."
      : null;

  return (
    <div
      className="glyph-import-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-hidden={!open}
    >
      <div
        className="glyph-import-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Import Kairos Sigil"
        aria-busy={status === "checking"}
        data-status={status ?? ""}
      >
        <button className="close-button" onClick={onClose} aria-label="Close">
          <XCircle size={22} />
        </button>

        <header className="modal-header">
          <h2 className="modal-title">Import Kairos Sigil</h2>
          <p className="modal-sub">breathe in the moment — measure in Φ</p>
        </header>

        <div
          className="upload-section"
          onClick={triggerUpload}
          role="button"
          tabIndex={0}
          data-upload="true"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              triggerUpload();
            }
          }}
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          <div className="halo" aria-hidden="true" />
          <UploadCloud size={48} />
          <p className="upload-title">Drop your Kairos Sigil .svg here</p>
          <p className="upload-sub">or tap to select</p>
          {fileName && <div className="file-name">{fileName}</div>}
          <input type="file" accept="image/svg+xml,.svg" ref={inputRef} onChange={handleFileSelect} hidden />
        </div>

        {status && (
          <div className={`import-status ${status}`}>
            {status !== "err" ? (
              <>
                {status === "ok" && <Check size={18} className="success-icon" />}
                {status === "warn" && <AlertTriangle size={18} />}
                <span className="label">{statusLabel}</span>
              </>
            ) : (
              <>
                <AlertTriangle size={18} />
                <span className="label">{statusLabel}</span>
              </>
            )}
          </div>
        )}

        {preview && (
          <div className="import-preview">
            <div className="kv">
              <span className="k">Canonical Hash</span>
              <span className="v mono">{preview.hash}</span>
            </div>
            <div className="kv">
              <span className="k">Intrinsic Value</span>
              <span className="v">{preview.value.toFixed(6)} Φ</span>
            </div>
            <div className="kv">
              <span className="k">Pulse</span>
              <span className="v">
                {preview.pulse}
                {unsigned && <span className="chip warn">unsigned</span>}
              </span>
            </div>

            <div className="phi-credit">
              <label htmlFor="phi-credit-input">
                Credit Φ to balance before import <em>(max {maxCredit.toFixed(6)} Φ)</em>
              </label>
              <div className="credit-row">
                <input
                  id="phi-credit-input"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.000001}
                  value={Number.isFinite(depositPhi) ? depositPhi : 0}
                  onChange={(e) => setDepositPhi(Number(e.target.value))}
                />
                <button
                  className="chip quick"
                  onClick={() => setDepositPhi(Number((maxCredit * 0.236).toFixed(6)))}
                  title="φ^-3 (~23.6%)"
                >
                  23.6%
                </button>
                <button
                  className="chip quick"
                  onClick={() => setDepositPhi(Number((maxCredit * 0.382).toFixed(6)))}
                  title="φ^-2 (~38.2%)"
                >
                  38.2%
                </button>
                <button
                  className="chip quick"
                  onClick={() => setDepositPhi(Number((maxCredit * 0.618).toFixed(6)))}
                  title="1/φ (~61.8%)"
                >
                  61.8%
                </button>
                <button
                  className="chip quick"
                  onClick={() => setDepositPhi(Number(maxCredit.toFixed(6)))}
                  title="All"
                >
                  Max
                </button>
              </div>
              {creditError && <div className="helper error">{creditError}</div>}
              {!creditError && depositPhi > 0 && (
                <div className="helper">
                  Remaining intrinsic value after credit: {(maxCredit - depositPhi).toFixed(6)} Φ
                </div>
              )}
            </div>

            <button
              className="import-confirm"
              onClick={handleImport}
              disabled={!glyph || !!creditError}
              title={creditError ?? "Import glyph"}
            >
              Import Glyph
            </button>
          </div>
        )}

        {error && (
          <div className="import-error" role="status" aria-live="polite">
            <AlertTriangle size={20} />
            <p>{error}</p>
          </div>
        )}

        <footer className="modal-footer">
          <span className="seal">Σ</span>
          <span className="foot">Authentic SVG only • deterministic valuation • one breath = 1 Φ</span>
        </footer>
      </div>
    </div>
  );
}
