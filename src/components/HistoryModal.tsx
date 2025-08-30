/* ────────────────────────────────────────────────────────────────
   HistoryModal.tsx · Compact Transfer History (URL-friendly)
   - Accepts either a prebuilt compact history (&h= value) OR meta.transfers
   - Decodes/encodes using utils/sigilUrl (SigilTransferLite + h:)
   - Mobile-first dialog, copy/export helpers, lightweight rendering
────────────────────────────────────────────────────────────────── */

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { SigilMetadataLite } from "../utils/valuation";
import {
  encodeSigilHistory,
  decodeSigilHistory,
  type SigilTransferLite,
} from "../utils/sigilUrl";

type MaybeMeta =
  | (SigilMetadataLite & {
      transfers?: Array<{
        senderSignature: string;
        senderKaiPulse: number;
        receiverSignature?: string;
      }>;
    })
  | null
  | undefined;

export type HistoryModalProps = {
  /** Open/close state */
  open: boolean;
  /** Called on close (X or backdrop) */
  onClose: () => void;

  /** Optional metadata to derive history from (head-window only) */
  meta?: MaybeMeta;

  /** Optional compact history param string (value of &h= WITHOUT the 'h:' tag) */
  historyParam?: string;

  /** Optional share URL to preview with &h= appended */
  shareUrl?: string;

  /** Optional dialog id (for a11y/tests) */
  id?: string;

  /** Optional title override */
  title?: string;
};

/* Utilities */
const trimSig = (s: string, head = 8, tail = 6) =>
  s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`;

function buildLiteFromMeta(meta: MaybeMeta): SigilTransferLite[] {
  const out: SigilTransferLite[] = [];
  for (const t of meta?.transfers ?? []) {
    if (!t || typeof t.senderSignature !== "string" || typeof t.senderKaiPulse !== "number") continue;
    const lite: SigilTransferLite = { s: t.senderSignature, p: t.senderKaiPulse };
    if (t.receiverSignature && typeof t.receiverSignature === "string") lite.r = t.receiverSignature;
    out.push(lite);
  }
  return out;
}

function ensureHPrefix(h: string) {
  return h.startsWith("h:") ? h : `h:${h}`;
}
function stripHPrefix(h: string) {
  return h.startsWith("h:") ? h.slice(2) : h;
}

/** Apply (or replace) &h= on a URL. Value must be WITHOUT 'h:' prefix. */
function applyHToUrl(url: string, hValueNoPrefix: string): string {
  try {
    const u = new URL(url, typeof window !== "undefined" ? window.location.origin : "https://example.invalid");
    if (hValueNoPrefix) u.searchParams.set("h", hValueNoPrefix);
    return u.toString();
  } catch {
    return url;
  }
}

async function copyText(s: string) {
  try {
    await navigator.clipboard.writeText(s);
    return true;
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = s;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      document.body.removeChild(ta);
      return false;
    }
  }
}

const Chip: React.FC<{ kind?: "ok" | "warn" | "err" | "info"; children: React.ReactNode }> = ({ kind = "info", children }) => (
  <span className={`chip ${kind}`}>{children}</span>
);

const HistoryModal: React.FC<HistoryModalProps> = ({
  open,
  onClose,
  meta,
  historyParam,
  shareUrl,
  id = "history-dialog",
  title = "Transfer History",
}) => {
  const dlgRef = useRef<HTMLDialogElement>(null);

  const [inputH, setInputH] = useState<string>(historyParam ?? "");
  const [copyStatus, setCopyStatus] = useState<"idle" | "ok" | "err">("idle");
  const [exportStatus, setExportStatus] = useState<"idle" | "ok" | "err">("idle");
  const [importErr, setImportErr] = useState<string | null>(null);

  // open/close sync
  useEffect(() => {
    const d = dlgRef.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      d.setAttribute("data-open", "true");
    } else if (!open && d.open) {
      d.close();
      d.setAttribute("data-open", "false");
    }
  }, [open]);

  // Reset statuses when opening
  useEffect(() => {
    if (open) {
      setCopyStatus("idle");
      setExportStatus("idle");
      setImportErr(null);
      setInputH(historyParam ?? "");
    }
  }, [open, historyParam]);

  // Source of truth: compact history list
  const historyList: SigilTransferLite[] = useMemo(() => {
    // Priority 1: provided &h=
    if (inputH && inputH.trim()) {
      try {
        return decodeSigilHistory(ensureHPrefix(inputH.trim()));
      } catch {
        // fall through to meta-derived
      }
    }
    // Priority 2: meta head-window transfers
    return buildLiteFromMeta(meta);
  }, [inputH, meta]);

  // Compact value (no prefix) derived from current list (stable)
  const hValueNoPrefix: string | null = useMemo(() => {
    try {
      if (historyList.length === 0) return null;
      const enc = encodeSigilHistory(historyList);
      return stripHPrefix(enc);
    } catch {
      return null;
    }
  }, [historyList]);

  // Share URL with &h= applied (if provided)
  const urlWithH = useMemo(() => {
    if (!shareUrl || !hValueNoPrefix) return shareUrl ?? "";
    return applyHToUrl(shareUrl, hValueNoPrefix);
  }, [shareUrl, hValueNoPrefix]);

  const onBackdrop = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target?.tagName?.toLowerCase() === "dialog") onClose();
  };

  const onCopyParam = async () => {
    setCopyStatus("idle");
    const ok = await copyText(hValueNoPrefix ? `h=${hValueNoPrefix}` : "");
    setCopyStatus(ok ? "ok" : "err");
  };
  const onCopyValue = async () => {
    setCopyStatus("idle");
    const ok = await copyText(hValueNoPrefix ?? "");
    setCopyStatus(ok ? "ok" : "err");
  };
  const onCopyUrl = async () => {
    if (!urlWithH) return;
    setCopyStatus("idle");
    const ok = await copyText(urlWithH);
    setCopyStatus(ok ? "ok" : "err");
  };

  const onExportJson = async () => {
    try {
      const blob = new Blob([JSON.stringify(historyList, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = `sigil_history_${historyList.length}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setExportStatus("ok");
    } catch {
      setExportStatus("err");
    }
  };

  const onImport = () => {
    if (!inputH.trim()) {
      setImportErr("Paste an &h= value (without the 'h:' tag is fine).");
      return;
    }
    try {
      // validate (ignore return)
      void decodeSigilHistory(ensureHPrefix(inputH.trim()));
      setImportErr(null);
    } catch {
      setImportErr("Could not decode history. Ensure it’s a valid base64url-encoded compact history.");
    }
  };
  

  return (
    <dialog
      ref={dlgRef}
      id={id}
      className="glass-modal fullscreen"
      aria-label="Sigil Transfer History"
      data-open={open ? "true" : "false"}
      onClick={onBackdrop}
      style={{
        width: "100vw",
        maxWidth: "100vw",
        height: "100dvh",
        maxHeight: "100dvh",
        margin: 0,
        padding: 0,
        overflow: "hidden",
      }}
    >
      <div
        className="modal-viewport"
        style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", maxWidth: "100vw", overflow: "hidden" }}
      >
        {/* Top bar */}
        <div className="modal-topbar" style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center" }}>
          <div className="status-strip" aria-live="polite" style={{ overflowX: "auto", whiteSpace: "nowrap" }}>
            <Chip kind="info">{title}</Chip>
            <Chip kind={historyList.length > 0 ? "ok" : "warn"}>Tx {historyList.length}</Chip>
            {copyStatus === "ok" && <Chip kind="ok">Copied</Chip>}
            {copyStatus === "err" && <Chip kind="err">Copy failed</Chip>}
            {exportStatus === "ok" && <Chip kind="ok">Exported</Chip>}
            {exportStatus === "err" && <Chip kind="err">Export failed</Chip>}
          </div>
          <button className="close-btn holo" data-aurora="true" aria-label="Close" title="Close" onClick={onClose} style={{ justifySelf: "end", marginRight: 8 }}>
            ×
          </button>
        </div>

        {/* Body */}
        <section
          className="modal-body"
          role="tabpanel"
          style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "12px 12px 84px" }}
        >
          {/* Input / Import row */}
          <div className="panel" style={{ marginBottom: 12 }}>
            <label className="k" htmlFor="hval" style={{ display: "block", marginBottom: 6 }}>
              Paste &h= value (optional)
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
              <input
                id="hval"
                type="text"
                placeholder="base64url-encoded compact history (without 'h:')"
                value={inputH}
                onChange={(e) => setInputH(e.target.value)}
                style={{ width: "100%", padding: "10px 12px" }}
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
              />
              <button className="secondary" onClick={onImport}>
                Load
              </button>
            </div>
            {importErr && (
              <p className="status error" style={{ marginTop: 6, overflowWrap: "anywhere" }}>
                {importErr}
              </p>
            )}
            {!inputH && meta?.transfers && meta.transfers.length > 0 && (
              <p className="hint" style={{ marginTop: 6 }}>
                No &h= pasted — showing compact history derived from this file’s head-window transfers.
              </p>
            )}
          </div>

          {/* Encoded preview + actions */}
          <div className="panel" style={{ marginBottom: 12 }}>
            <div className="kv wide" style={{ marginBottom: 8 }}>
              <span className="k">Encoded &h=</span>
              <span className="v mono" style={{ overflowWrap: "anywhere" }}>{hValueNoPrefix ?? "—"}</span>
            </div>
            <div className="row" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="secondary" onClick={onCopyParam} disabled={!hValueNoPrefix}>Copy “h=…”</button>
              <button className="secondary" onClick={onCopyValue} disabled={!hValueNoPrefix}>Copy value only</button>
              <button className="secondary" onClick={onExportJson} disabled={historyList.length === 0}>Export JSON</button>
              {shareUrl && (
                <button className="secondary" onClick={onCopyUrl} disabled={!hValueNoPrefix}>
                  Copy URL + &h
                </button>
              )}
            </div>
            {shareUrl && (
              <div className="kv wide" style={{ marginTop: 8 }}>
                <span className="k">URL + &h</span>
                <span className="v mono" style={{ overflowWrap: "anywhere" }}>{urlWithH || "—"}</span>
              </div>
            )}
          </div>

          {/* History list */}
          <div className="panel">
            <h4 style={{ marginTop: 0, marginBottom: 8 }}>Transfers ({historyList.length})</h4>
            {historyList.length === 0 ? (
              <p className="empty">No transfers to show.</p>
            ) : (
              <ol className="transfers" style={{ paddingLeft: 0, listStyle: "none", margin: 0 }}>
                {historyList.map((t, i) => {
                  const sealed = !!t.r;
                  return (
                    <li
                      key={`${i}-${t.s}-${t.p}`}
                      className={`transfer ${sealed ? "closed" : "open"}`}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        marginBottom: 8,
                        background: "var(--card-bg, rgba(255,255,255,0.06))",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <header style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center" }}>
                        <strong>#{i + 1}</strong>
                        <div style={{ opacity: 0.8 }}>
                          <span className="k" style={{ marginRight: 6 }}>Pulse</span>
                          <span className="v">{t.p}</span>
                        </div>
                        <span className={`state ${sealed ? "closed" : "open"}`} aria-label={sealed ? "Sealed" : "Pending receive"}>
                          {sealed ? "Sealed" : "Pending"}
                        </span>
                      </header>

                      <div className="row" style={{ marginTop: 6 }}>
                        <span className="k">Sender Σ</span>{" "}
                        <span className="v mono" style={{ overflowWrap: "anywhere" }}>{trimSig(t.s)}</span>
                      </div>

                      {sealed && (
                        <div className="row">
                          <span className="k">Receiver Σ</span>{" "}
                          <span className="v mono" style={{ overflowWrap: "anywhere" }}>{trimSig(t.r!)}</span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </section>

        {/* Footer */}
        <footer className="modal-footer" style={{ position: "sticky", bottom: 0 }}>
          <div className="footer-left">
            <p style={{ opacity: 0.8 }}>
              {hValueNoPrefix ? "Compact history ready" : "No compact history available"}
            </p>
          </div>
          <div className="footer-actions">
            <button className="primary" onClick={onClose}>Done</button>
          </div>
        </footer>
      </div>
    </dialog>
  );
};

export default HistoryModal;

/* ────────────────────────────────────────────────────────────────
   Light CSS sidenote (optional):
   - This modal follows the same classes (.glass-modal, .modal-viewport, etc.)
   - It will inherit your existing VerifierStamper.css styles.
   - The small .chip/.state/.panel/.kv/.row patterns are consistent.
────────────────────────────────────────────────────────────────── */
