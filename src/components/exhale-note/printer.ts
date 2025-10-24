// src/components/exhale-note/printer.ts
import { esc } from "./sanitize";

/**
 * Internal: inject (or update) a single print stylesheet that:
 *  - hides everything except the provided print root during printing
 *  - defines page sizing and page breaks
 *  - styles common classes used by our pages
 */
function ensurePrintStyles(printRootEl: HTMLElement): void {
  const STYLE_ID = "kk-print-style";
  let styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null;

  // Mark the element so our CSS can target it without relying on a specific ID
  printRootEl.setAttribute("data-kk-print-scope", "1");

  const css = `
@media screen {
  /* Keep print container out of sight on screen */
  [data-kk-print-scope] { display: none !important; }
}

@media print {
  /* Hide everything except the print root scope */
  body * { visibility: hidden !important; }
  [data-kk-print-scope],
  [data-kk-print-scope] * { visibility: visible !important; }

  [data-kk-print-scope] {
    position: fixed;
    inset: 0;
    margin: 0;
    padding: 0;
    background: #fff !important;
    z-index: 999999; /* above any overlays/modals */
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Let the browser/user pick A4/Letter; keep margins sane */
  @page {
    size: auto;
    margin: 10mm;
  }

  /* Page wrapper (legacy .print-page and newer .kk-print-page) */
  .print-page, .kk-print-page {
    box-sizing: border-box;
    width: 100%;
    min-height: 260mm;          /* enough for A4; Letter also fine */
    padding: 8mm 10mm;
    break-after: page;
    page-break-after: always;   /* legacy engines */
  }
  /* Avoid a trailing blank page */
  .print-page:last-child, .kk-print-page:last-child {
    break-after: auto;
    page-break-after: auto;
  }

  /* Simple header/footer bits used by the cover page */
  .page-stamp-top,
  .page-stamp-bot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.25;
    opacity: 0.85;
    margin-bottom: 6mm;
  }
  .page-stamp-bot { margin-top: 6mm; }

  /* Banknote container — enforce physical width for parity */
  .banknote-frame {
    width: 100%;
    display: flex;
    justify-content: center;
  }
  .banknote-frame svg {
    display: block;
    width: 182mm;   /* exact physical width */
    height: auto;
  }

  /* Generic proof card block */
  .proof-card {
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 6mm;
    margin: 0 0 6mm 0;
    break-inside: avoid-page;
    page-break-inside: avoid; /* legacy */
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 10pt;
  }

  /* Simple 2-col key/value layout used by proof sections */
  .kv {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 6px 12px;
    align-items: start;
    font: 10pt ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
    word-break: break-word;
  }
  .kv > strong {
    font-family: inherit;
    font-weight: 600;
  }

  .hint {
    font-size: 9pt;
    opacity: 0.75;
  }

  .out {
    font: 10pt ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
    background: #f6f8fa;
    border: 1px solid #e6e8eb;
    border-radius: 4px;
    padding: 10px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* Tables used by proof pages (if present) */
  .kk-proof-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10pt;
  }
  .kk-proof-table th, .kk-proof-table td {
    border: 1px solid #ccc;
    padding: 6px 8px;
    vertical-align: top;
    word-break: break-word;
  }
  .kk-proof-section { margin-top: 6mm; }

  /* Links should wrap nicely when long (verify URLs) */
  a { color: #000; text-decoration: underline; }
  a, a:visited { word-break: break-all; }
}
`;

  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = STYLE_ID;
    styleEl.type = "text/css";
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  } else if (styleEl.textContent !== css) {
    styleEl.textContent = css;
  }
}

/**
 * Internal: normalize arguments so we tolerate both call orders:
 *
 *   Recommended (new):
 *      renderIntoPrintRoot(root, banknoteSVG, frozenPulse, proofPagesHTML)
 *
 *   Legacy (earlier code):
 *      renderIntoPrintRoot(root, banknoteSVG, proofPagesHTML, frozenPulse)
 */
function normalizeArgs(
  banknoteSVG: string,
  third: string,  // pulse OR proofPagesHTML
  fourth: string  // remaining arg
): { svg: string; pulse: string; proof: string } {
  const looksHtml = (s: string) => s.includes("<") && /[a-z][\s\S]*>/i.test(s);
  if (looksHtml(third) && !looksHtml(fourth)) {
    // legacy order: (svg, proof, pulse)
    return { svg: banknoteSVG, proof: third, pulse: fourth };
  }
  // recommended order: (svg, pulse, proof)
  return { svg: banknoteSVG, pulse: third, proof: fourth };
}

/**
 * Writes the banknote + proof pages (already built) into the hidden print root,
 * ensuring proper pagination and visibility for the browser print engine.
 */
export function renderIntoPrintRoot(
  printRootEl: HTMLElement,
  banknoteSVG: string,
  frozenPulse: string,
  proofPagesHTML: string
): void {
  ensurePrintStyles(printRootEl);

  const { svg, pulse, proof } = normalizeArgs(banknoteSVG, frozenPulse, proofPagesHTML);

  // Cover page (banknote) + stamps
  const coverPageHTML = `
    <div class="print-page">
      <div class="page-stamp-top">
        <span>KAIROS KURRENSY — Sovereign Harmonik Kingdom</span>
        <span>Valuation Pulse: ${esc(pulse)}</span>
      </div>
      <div class="banknote-frame">${svg}</div>
      <div class="page-stamp-bot">
        <span>Σ→sha256(Σ)→Φ • Offline</span>
        <span>PULSE: ${esc(pulse)}</span>
      </div>
    </div>
  `;

  // If proof already contains explicit page wrappers, use as-is; otherwise wrap once.
  const proofHasPageWrappers = /\b(print-page|kk-print-page)\b/.test(proof);
  const normalizedProof = proofHasPageWrappers ? proof : `<div class="print-page">${proof}</div>`;

  // Paint into the print root
  while (printRootEl.firstChild) printRootEl.removeChild(printRootEl.firstChild);
  const frag = document.createDocumentFragment();
  const tmp = document.createElement("div");
  tmp.innerHTML = coverPageHTML + normalizedProof;
  while (tmp.firstChild) frag.appendChild(tmp.firstChild);
  printRootEl.appendChild(frag);
}

/**
 * Prints the page after temporarily setting the document title, then restores it.
 * We wait one rAF tick (plus a microtask) to ensure layout has committed.
 */
export function printWithTempTitle(tempTitle: string): void {
  const oldTitle = document.title;
  document.title = tempTitle;

  requestAnimationFrame(() => {
    Promise.resolve().then(() => {
      try {
        window.print();
      } finally {
        window.setTimeout(() => {
          document.title = oldTitle;
        }, 250);
      }
    });
  });
}
