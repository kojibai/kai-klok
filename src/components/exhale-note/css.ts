// css.ts — scoped stylesheet generator
export const useScopedCss = (scopeAttr: string): string => {
    const css = `
  ${scopeAttr} {
    --bg:#070b0e; --bg2:#0a0f12; --ink:#e7fbf7; --dim:#a2bbb6;
    --line:#ffffff22; --line-strong:#ffffff33;
    --ok:#28c76f; --bad:#ff4d4f; --accent:#37e6d4; --accent-2:#81fff1;
    --card:linear-gradient(180deg,#ffffff10,#ffffff06);
    --focus:0 0 0 3px #37e6d455; --radius:14px;
    /* Banknote palette */
    --bill-ink:#dff9f2; --bill-ink-2:#b2efe1; --bill-bg:#0a1114;
    --bill-line:#2ad6c755; --bill-edge:#2ad6c7;
    --sigil-slot-bg:#0a1114;
    color:var(--ink);
    font:14px/1.5 ui-sans-serif,system-ui,-apple-system,Segoe UI,Inter,Roboto,Helvetica,Arial;
  }
  
  ${scopeAttr} *{ box-sizing:border-box; }
  ${scopeAttr} .wrap{ max-width:1000px; margin:0 auto; padding:10px 12px 84px; }
  ${scopeAttr} .row{ display:grid; grid-template-columns:180px 1fr auto; gap:8px; align-items:center; margin:8px 0; min-width:0; }
  ${scopeAttr} label{ color:var(--dim); }
  ${scopeAttr} input, ${scopeAttr} button, ${scopeAttr} textarea{ font:inherit; color:inherit; }
  ${scopeAttr} input, ${scopeAttr} textarea{
    width:100%; padding:10px 12px; border-radius:12px; border:1px solid var(--line);
    background:#0c1719; outline:none; min-width:0;
  }
  ${scopeAttr} input:focus, ${scopeAttr} textarea:focus{ box-shadow:var(--focus); border-color:#37e6d499; }
  ${scopeAttr} textarea{ min-height:92px; resize:vertical; white-space:pre-wrap; overflow-wrap:anywhere; }
  ${scopeAttr} button{ padding:10px 12px; border-radius:12px; border:1px solid var(--line); background:#0e1a1c; cursor:pointer; transition:transform .05s; }
  ${scopeAttr} button:active{ transform:translateY(1px); }
  ${scopeAttr} .primary{ background:linear-gradient(180deg,#37e6d466,#37e6d420); border-color:#37e6d455; }
  ${scopeAttr} .ghost{ background:transparent; border-color:#ffffff22; }
  ${scopeAttr} .pill{ display:inline-flex; gap:8px; align-items:center; padding:4px 10px; border-radius:999px; border:1px solid var(--line); background:#0c1719; white-space:nowrap; }
  ${scopeAttr} .spacer{ flex:1; }
  ${scopeAttr} .hint{ color:var(--dim); font-size:12px; }
  ${scopeAttr} .grid{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  ${scopeAttr} .stack{ display:grid; gap:8px; }
  ${scopeAttr} .flex{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
  ${scopeAttr} .out{ background:#081113; border:1px dashed var(--line); padding:10px; border-radius:12px; overflow:auto; white-space:pre-wrap; overflow-wrap:anywhere; }
  ${scopeAttr} .ok{ color:var(--ok) } ${scopeAttr} .bad{ color:var(--bad) }
  
  /* Live valuation header */
  ${scopeAttr} .ticker{
    display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin:6px 0 8px;
  }
  ${scopeAttr} .chip{
    font-size:12px; color:var(--ink); background:#ffffff10; border:1px solid var(--line);
    border-radius:999px; padding:6px 10px;
  }
  ${scopeAttr} .pulse{ font-variant-numeric: tabular-nums; }
  
  /* Preview shell */
  ${scopeAttr} .note-preview-host{ margin-top:8px; overflow:auto; max-height:440px; }
  ${scopeAttr} .banknote-frame{
    width:100%; aspect-ratio:1000/618; background:var(--bill-bg); border:1px solid var(--bill-line);
    border-radius:16px; box-shadow:0 40px 120px #00000050, 0 2px 0 #ffffff10 inset; display:grid; place-items:center; overflow:hidden;
    position:relative;
  }
  ${scopeAttr} .banknote-frame > svg{
    width:100%; height:auto; display:block; position:relative; z-index:2;
    shape-rendering:geometricPrecision; text-rendering:geometricPrecision;
  }
  /* Φ watermark overlay over SVG (parity) */
  ${scopeAttr} .banknote-frame::after{
    content:"Φ"; position:absolute; left:24px; top:86px; z-index:3;
    font-family: ui-serif, "Iowan Old Style", Georgia, "Times New Roman", serif; font-weight:700; line-height:.9;
    font-size:clamp(120px, 18vw, 260px); color:#81fff0; opacity:.06; filter:blur(.4px); mix-blend-mode:screen;
    pointer-events:none; user-select:none;
  }
  
  /* Print pages */
  ${scopeAttr} #print-root{ display:none; }
  ${scopeAttr} .print-page{ page-break-after:always; position:relative; padding:24px; }
  ${scopeAttr} .print-page:last-child{ page-break-after:auto; }
  ${scopeAttr} .page-stamp-top, ${scopeAttr} .page-stamp-bot{
    position:absolute; left:24px; right:24px; font:12px/1.4 ui-monospace,monospace; color:#1b2b2b; opacity:.95; letter-spacing:.02em;
  }
  ${scopeAttr} .page-stamp-top{ top:10px; display:flex; justify-content:space-between; }
  ${scopeAttr} .page-stamp-bot{ bottom:10px; display:flex; justify-content:space-between; }
  ${scopeAttr} .proof-card{ border:1px solid var(--line-strong); border-radius:10px; padding:12px;
    background:linear-gradient(180deg,#ffffff0a,#ffffff05); margin:10px 0; }
  ${scopeAttr} .kv{ display:grid; grid-template-columns:220px 1fr; gap:6px 10px; }
  ${scopeAttr} .kv code{ word-break:break-all; }
  
  /* Print parity */
  @media print {
    ${scopeAttr} { color:#111 !important; }
    ${scopeAttr} .no-print{ display:none !important; }
    ${scopeAttr} #print-root{ display:block; }
    ${scopeAttr} #print-root, ${scopeAttr} #print-root *{
      color:#111 !important;
      font-family: ui-serif, "Iowan Old Style", "Georgia", "Times New Roman", Times, serif;
    }
    ${scopeAttr} .hint{ color:#555 !important; }
    ${scopeAttr} code, ${scopeAttr} pre{
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace !important; color:#111 !important;
    }
    ${scopeAttr} .out{ background:#f6f8f9 !important; border-color:#cbd5e1 !important; }
    ${scopeAttr} .print-page{ border:none; -webkit-print-color-adjust:exact; print-color-adjust:exact; color-adjust:exact; }
    @page{ size:auto; margin:14mm; }
    /* Banknote physical size fixed (182mm) */
    ${scopeAttr} .banknote-frame{ border:none; box-shadow:none; width:182mm; height:auto; aspect-ratio:1000/618; margin:0 auto; }
    ${scopeAttr} .banknote-frame > svg{ width:182mm; height:auto; }
    /* Φ overlay faint on printers */
    ${scopeAttr} .banknote-frame::after{ opacity:.03; mix-blend-mode:normal; -webkit-print-color-adjust:exact; print-color-adjust:exact; color:#8cdfe0; }
  }
  
  /* Mobile tweaks */
  @media (max-width: 900px){
    ${scopeAttr} .grid{ grid-template-columns: 1fr; }
    ${scopeAttr} .row{ grid-template-columns: 1fr; }
  }
  `;
    return css;
  };
  