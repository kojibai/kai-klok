// src/components/valuation/DonorsEditor.tsx
/* ────────────────────────────────────────────────────────────────
   DonorsEditor.tsx — “Streams → Temple-Glyph” pre-mint step (ultra-simple)
   v1.0 · Front-facing UI says “Stream(s)” everywhere (not “Donor”)
   • Minimal, buttery UX focused on getting to the Temple-Glyph Exhale step
   • Clean validation (URL → 64-hex canonical hash, Φ > 0, no dupes)
   • Pool allocation kept, with quick 61.8% and Max shortcuts
   • Big, clear totals + single primary CTA: Continue to Exhale Temple-Glyph
   • Keeps the existing props/contract & CSS classnames for drop-in use
   ──────────────────────────────────────────────────────────────── */

   import React, { useMemo, useCallback } from "react";
   import { Plus, Wind, AlertTriangle, Check, Link2 } from "lucide-react";
   import { currency } from "./display";
   
   /**
    * Internal contract remains DonorRow, but all user-facing copy uses “stream”.
    * Parents can still ignore the optional hints (canonicalHash/valid/error).
    */
   export type DonorRow = {
     url: string;
     amount: number;
     canonicalHash?: string | null;
     valid?: boolean;
     error?: string | null;
   };
   
   type Props = {
     donors: DonorRow[];
     balancePhi: number;
     balanceForMintPhi: number;
     setBalanceForMintPhi: (n: number) => void;
     addDonor: () => void;
     removeDonor: (idx: number) => void;
     updateDonor: (idx: number, patch: Partial<DonorRow>) => void;
     onMintComposite: (e: React.MouseEvent<HTMLButtonElement>) => void;
     minting: boolean;
     totalDonorAmount: number;
   };
   
   /* ——— helpers ——— */
   
   /** Extract canonical 64-hex hash from a Kai-sigil share URL or raw text. */
   function extractCanonicalHashFromUrl(input: string): string | null {
     const txt = (input || "").trim();
     if (!txt) return null;
     try {
       const u = new URL(
         txt,
         typeof window !== "undefined" ? window.location.origin : "http://localhost"
       );
       // Prefer /s/<hash>
       const m = u.pathname.match(/[/]s[/]([a-f0-9]{64})/i);
       if (m) return m[1].toLowerCase();
       // Fallback: any 64-hex anywhere (h= param, plain text, etc.)
       const any = txt.match(/[a-f0-9]{64}/i);
       return any ? any[0].toLowerCase() : null;
     } catch {
       const any = txt.match(/[a-f0-9]{64}/i);
       return any ? any[0].toLowerCase() : null;
     }
   }
   
   function round6(n: number) {
     return Number((Number.isFinite(n) ? n : 0).toFixed(6));
   }
   
   /** Validate a row; infer canonicalHash and common errors. */
   function validateRow(row: DonorRow): DonorRow {
     const url = (row.url || "").trim();
     const amount = Math.max(0, Number.isFinite(row.amount) ? row.amount : 0);
   
     if (!url && amount <= 0) {
       return { ...row, canonicalHash: null, valid: false, error: "Enter URL and amount" };
     }
     if (!url) {
       return { ...row, canonicalHash: null, valid: false, error: "Missing URL" };
     }
     const canonicalHash = extractCanonicalHashFromUrl(url);
     if (!canonicalHash) {
       return { ...row, canonicalHash: null, valid: false, error: "No canonical hash found" };
     }
     if (amount <= 0) {
       return { ...row, canonicalHash, valid: false, error: "Amount must be > 0" };
     }
     return { ...row, canonicalHash, valid: true, error: null };
   }
   
   /* ——— component ——— */
   
   export default function DonorsEditor({
     donors,
     balancePhi,
     balanceForMintPhi,
     setBalanceForMintPhi,
     addDonor,
     removeDonor,
     updateDonor,
     onMintComposite,
     minting,
     totalDonorAmount,
   }: Props) {
     // Live-validate so users see exactly what will be embedded.
     const validated = useMemo(() => donors.map(validateRow), [donors]);
   
     // De-duplication preview: if same canonicalHash appears, flag it.
     const dupHashes = useMemo(() => {
       const map = new Map<string, number>();
       for (const d of validated) {
         if (d.canonicalHash) map.set(d.canonicalHash, (map.get(d.canonicalHash) || 0) + 1);
       }
       return map;
     }, [validated]);
   
     const anyInvalid =
       validated.some((d) => d.valid === false && (d.url || d.amount > 0)) ||
       validated.some((d) => d.canonicalHash && (dupHashes.get(d.canonicalHash) || 0) > 1);
   
     const totalWithPool = useMemo(
       () => round6(totalDonorAmount + Math.max(0, Number(balanceForMintPhi || 0))),
       [totalDonorAmount, balanceForMintPhi]
     );
   
     const handleUrlChange = useCallback(
       (i: number, raw: string) => {
         const next = validateRow({ ...donors[i], url: raw });
         updateDonor(i, { url: raw, canonicalHash: next.canonicalHash, valid: next.valid, error: next.error });
       },
       [donors, updateDonor]
     );
   
     const handleAmtChange = useCallback(
       (i: number, raw: string) => {
         const amt = Math.max(0, Number(raw || 0));
         const next = validateRow({ ...donors[i], amount: amt });
         updateDonor(i, { amount: amt, canonicalHash: next.canonicalHash, valid: next.valid, error: next.error });
       },
       [donors, updateDonor]
     );
   
     return (
       <section className="card donors-card streams-card" aria-label="Create Temple-Glyph streams">
         {/* ── Header: ultra-simple orientation + totals ───────────── */}
         <header className="card-hd">
           <div className="hd-left">
             <Wind size={16} /> <strong>Temple-Glyph — Streams</strong>
           </div>
           <div
             className="badge dim small"
             title="Validated streams · total Φ from streams only"
           >
             {validated.filter((d) => d.url).length} streams • Φ {round6(totalDonorAmount).toFixed(6)}
           </div>
         </header>
   
         <div className="card-bd donors-bd">
           {/* ── Pool allocation (kept, simplified) ─────────────────── */}
           <div className="donor-row local">
             <div className="local-balance" title="Current pooled balance (available in-app)">
               <span className="mono">Pool</span>
               <strong>{currency(balancePhi)}</strong>
             </div>
   
             <input
               className="donor-amt"
               type="number"
               step="0.000001"
               min={0}
               max={balancePhi}
               placeholder="Φ from pool"
               aria-label="Amount from pooled balance"
               value={Number.isFinite(balanceForMintPhi) ? balanceForMintPhi : 0}
               onChange={(ev) =>
                 setBalanceForMintPhi(
                   Math.min(Math.max(0, Number(ev.currentTarget.value || 0)), balancePhi)
                 )
               }
               onBlur={(ev) => setBalanceForMintPhi(round6(Number(ev.currentTarget.value || 0)))}
             />
   
             {/* Tiny shortcuts only for the golden pick + Max (kept minimal) */}
             <div className="quick-pcts" aria-label="Quick allocations">
               <button
                 className="btn ghost tiny"
                 onClick={() => setBalanceForMintPhi(round6(balancePhi * 0.618))}
                 title="1/φ (~61.8%)"
               >
                 61.8%
               </button>
               <button
                 className="btn ghost tiny"
                 onClick={() => setBalanceForMintPhi(round6(balancePhi))}
                 title="Use all"
               >
                 Max
               </button>
             </div>
           </div>
   
           {/* ── Stream rows (URL + Φ) — crisp, compact ─────────────── */}
           <div className="donors-grid" role="list" aria-label="Stream entries">
             {validated.map((d, i) => {
               const dup = d.canonicalHash && (dupHashes.get(d.canonicalHash) || 0) > 1;
               const showErr = d.error || dup;
               return (
                 <div
                   key={`stream-${i}`}
                   className={`donor-row ${d.valid && !dup ? "ok" : showErr ? "err" : ""}`}
                   role="listitem"
                 >
                   <div className="url-wrap">
                     <input
                       className="donor-url"
                       type="url"
                       placeholder="Stream sigil URL (or paste a 64-hex canonical hash)"
                       aria-label={`Stream ${i + 1} URL`}
                       value={d.url}
                       onChange={(ev) => handleUrlChange(i, ev.currentTarget.value)}
                       spellCheck={false}
                       inputMode="url"
                     />
                     {d.canonicalHash ? (
                       <span className="chip mono" title="Parsed canonical hash">
                         <Link2 size={12} /> {d.canonicalHash.slice(0, 8)}…
                       </span>
                     ) : (
                       d.url && (
                         <span className="chip warn" title="No canonical hash parsed">
                           <AlertTriangle size={12} /> hash?
                         </span>
                       )
                     )}
                   </div>
   
                   <div className="amt-wrap">
                     <input
                       className="donor-amt"
                       type="number"
                       step="0.000001"
                       min={0}
                       placeholder="Φ amount"
                       aria-label={`Stream ${i + 1} amount (Phi)`}
                       value={Number.isFinite(d.amount) ? d.amount : 0}
                       onChange={(ev) => handleAmtChange(i, ev.currentTarget.value)}
                       onBlur={(ev) =>
                         handleAmtChange(i, round6(Number(ev.currentTarget.value || 0)).toString())
                       }
                     />
                   </div>
   
                   <button
                     className="btn ghost small"
                     title="Remove stream"
                     aria-label={`Remove stream ${i + 1}`}
                     onClick={() => removeDonor(i)}
                   >
                     ×
                   </button>
   
                   {/* Minimal, friendly feedback */}
                   {showErr && (
                     <div className="donor-hint" role="status" aria-live="polite">
                       <AlertTriangle size={14} />
                       <span>{dup ? "Duplicate stream (same hash)" : d.error}</span>
                     </div>
                   )}
                   {d.valid && !dup && (
                     <div className="donor-hint ok" aria-hidden="true">
                       <Check size={14} />
                       <span>Ready</span>
                     </div>
                   )}
                 </div>
               );
             })}
           </div>
   
           {/* ── Actions ─────────────────────────────────────────────── */}
           <div className="donors-actions">
             <button className="btn ghost" onClick={addDonor}>
               <Plus size={16} /> Add stream
             </button>
             <button
               className="btn primary"
               disabled={
                 minting ||
                 anyInvalid ||
                 (!validated.some((d) => d.valid && !((dupHashes.get(d.canonicalHash || "") || 0) > 1)) &&
                   round6(balanceForMintPhi) <= 0)
               }
               title={
                 anyInvalid
                   ? "Fix invalid streams (URL/amount/duplicates)"
                   : "Continue to seal your composite Temple-Glyph"
               }
               onClick={onMintComposite}
             >
               <Wind size={16} /> {minting ? "Exhaling..." : "➵ to Exhale Temple-Glyph"}
             </button>
           </div>
   
           {/* ── Ultra-clean summary block ───────────────────────────── */}
           <div className="donors-summary">
             <div className="kv">
               <span className="k">Streams (valid)</span>
               <span className="v">
                 {validated.filter((d) => d.valid && !((d.canonicalHash && (dupHashes.get(d.canonicalHash) || 0) > 1))).length}
                 /{validated.filter((d) => d.url).length}
               </span>
             </div>
             <div className="kv">
               <span className="k">Σ streams</span>
               <span className="v">Φ {round6(totalDonorAmount).toFixed(6)}</span>
             </div>
             <div className="kv">
               <span className="k">Pool allocation</span>
               <span className="v">Φ {round6(balanceForMintPhi).toFixed(6)}</span>
             </div>
             <div className="kv total">
               <span className="k">Total (Temple-Glyph)</span>
               <span className="v strong">Φ {totalWithPool.toFixed(6)}</span>
             </div>
           </div>
   
           {/* ── Soft guidance copy (no clutter, all signal) ─────────── */}
           <p className="small subtle">
             You’re one breath away. This step gathers your streams (each with a canonical hash) and
             any pool allocation into a single memory. In the next step, your composite{" "}
             <strong>Temple Glyph</strong> will embed a verifier-compatible <code>Temple-Glyph</code> key
             listing each stream’s hash and Φ amount, plus your pool contribution. The export includes
             <code> Φkey*.svg</code> (with <code>&lt;metadata&gt;</code>), a PNG preview, and a{" "}
             <code>manifest.json</code> mirroring the values for auditing.
           </p>
         </div>
       </section>
     );
   }
   