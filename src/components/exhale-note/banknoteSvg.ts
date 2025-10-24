// src/components/exhale-note/banknoteSvg.ts
import { esc, trunc } from "./sanitize";
import { fallbackCode } from "./hash";
import { embedSigilIntoSlotClickable } from "./sigilEmbed";
import { buildCutMarks } from "./cutmarks";
import { makeQrSvgTagSafe } from "./qr";
import { NOTE_TITLE } from "./titles";
import type { ProvenanceRow } from "./types";

export interface BuildBanknoteSvgOpts {
  // visible, printed on the note
  purpose?: string;
  to?: string;
  from?: string;
  location?: string;
  witnesses?: string;
  reference?: string;
  remark?: string;

  // identity / valuation (appears in note + proof pages)
  valuePhi?: string;
  premiumPhi?: string;
  computedPulse?: string; // frozen pulse
  nowPulse?: string;      // fallback pulse
  kaiSignature?: string;
  userPhiKey?: string;
  valuationAlg?: string;
  valuationStamp?: string;

  // sigil + verify
  sigilSvg?: string;      // raw SVG for slot
  verifyUrl?: string;     // used for QR & clickable slot

  // provenance (optional)
  provenance?: ProvenanceRow[];
}

/** Builds the full SVG string for the Exhale banknote (1000×618 viewBox). */
export function buildBanknoteSVG(opts: BuildBanknoteSvgOpts): string {
  const {
    purpose = "",
    to = "",
    from = "",
    location = "",
    witnesses = "",
    reference = "",
    remark = "In Yahuah We Trust — Secured by Φ, not man-made law",

    valuePhi = "0",
    premiumPhi = "0",
    computedPulse = "",
    nowPulse = "",
    kaiSignature = "",
    userPhiKey = "",
    valuationAlg = "",
    valuationStamp = "",

    sigilSvg = "",
    verifyUrl = "/",

    provenance = [],
  } = opts;

  const pulseRendered = computedPulse || nowPulse || "0";
  const anchorsKey = `${kaiSignature}|${userPhiKey}|${pulseRendered}|${verifyUrl}`;

  const Purpose   = trunc(purpose?.trim()   || fallbackCode("Purpose", anchorsKey), 28);
  const To        = trunc(to?.trim()        || fallbackCode("To", anchorsKey), 22);
  const From      = trunc(from?.trim()      || fallbackCode("From", anchorsKey), 22);
  const Location  = trunc(location?.trim()  || fallbackCode("Location", anchorsKey), 28);
  const Witnesses = trunc(witnesses?.trim() || fallbackCode("Witnesses", anchorsKey), 22);
  const Reference = trunc(reference?.trim() || fallbackCode("Reference", anchorsKey), 22);
  const Remark    = trunc(remark ?? "", 86);

  const serialCore = (kaiSignature ? kaiSignature.slice(0, 12).toUpperCase() : "Φ".repeat(12))
    .replace(/[^0-9A-F]/g, "Φ");
  const serial = `K℞K-${serialCore}-${pulseRendered}`;

  // Guilloché rosette
  const rosette = (() => {
    const cx = 500, cy = 350, R = 210, turns = 96;
    let d = `M ${cx} ${cy - R}`;
    for (let i = 1; i <= turns; i++) {
      const t = (i / turns) * 2 * Math.PI;
      const r = R * (0.82 + 0.18 * Math.sin(5 * t));
      const x = cx + r * Math.sin(3 * t);
      const y = cy + r * Math.cos(4 * t);
      d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    return d + " Z";
  })();

  // Center sigil slot & embed
  const slot = { x: 280, y: 150, w: 440, h: 300 };
  const fallbackSigil =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#0b1417"/><circle cx="512" cy="512" r="420" fill="#37e6d4" fill-opacity=".20"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#0ff" font-family="ui-monospace,monospace" font-size="28">SIGIL</text></svg>`;
  const sigilInner = sigilSvg && /<svg[\s\S]*<\/svg>/i.test(sigilSvg) ? sigilSvg : fallbackSigil;
  const sigilEmbed = embedSigilIntoSlotClickable(sigilInner, slot.x, slot.y, slot.w, slot.h, verifyUrl);

  // QR block (avoid 8-digit hex colors; use stroke-opacity instead)
  const qrSvg = makeQrSvgTagSafe(verifyUrl, 110, 2);
  const qrBlock = `
    <g transform="translate(828,346)">
      <rect x="-8" y="-8" width="126" height="142" rx="10" fill="#0a1013" stroke="#2ad6c7" stroke-opacity=".20"/>
      <g>${qrSvg}</g>
      <text x="55" y="132" text-anchor="middle" font-family="ui-sans-serif" font-size="10" fill="#81fff1" letter-spacing=".08em">SCAN • VERIFY</text>
    </g>`;

  // Optional provenance (last 3 lines)
  let provLines = "";
  try {
    const last = (provenance || []).slice(-3);
    if (last.length) {
      const items = last
        .map(
          (p, i) =>
            `#${last.length - i} • ${esc(p.action || "")} @ pulse ${esc(String(p.pulse || ""))}${
              p.ownerPhiKey ? ` • owner ${esc(String(p.ownerPhiKey)).slice(0, 10)}…` : ""
            }`
        )
        .join("  ");
      provLines = `<text x="64" y="494" fill="#aef" font-size="11" font-family="ui-sans-serif">Lineage: ${items}</text>`;
    }
  } catch {
    /* ignore provenance errors */
  }

  // Animated badge (SVG2-friendly; no xlink)
  const badgeBlock = `
    <g transform="translate(860,200)">
      <defs>
        <linearGradient id="atl-sweep" x1="0" y1="0" x2="1" y2="1">
          <stop id="as1" offset="0%"  stop-color="#37e6d4">
            <animate attributeName="offset" values="0;0.2;0" dur="8s" repeatCount="indefinite"/>
          </stop>
          <stop id="as2" offset="100%" stop-color="#81fff1">
            <animate attributeName="offset" values="1;0.8;1" dur="8s" repeatCount="indefinite"/>
          </stop>
        </linearGradient>
        <filter id="atl-frost" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="b1"/>
          <feColorMatrix in="b1" type="matrix" values="0 0 0 0 0.22 0 0 0 0 0.90 0 0 0 0 0.85 0 0 0 0.35 0" result="g1"/>
          <feGaussianBlur in="SourceGraphic" stdDeviation="5.5" result="b2"/>
          <feColorMatrix in="b2" type="matrix" values="0 0 0 0 0.10 0 0 0 0 0.70 0 0 0 0 0.75 0 0 0 0.25 0" result="g2"/>
          <feMerge><feMergeNode in="g2"/><feMergeNode in="g1"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <linearGradient id="atl-gloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffffff" stop-opacity=".22"/>
          <stop offset=".35" stop-color="#ffffff" stop-opacity=".06"/>
          <stop offset="1" stop-color="#000000" stop-opacity="0"/>
        </linearGradient>
        <radialGradient id="atl-rim" cx="50%" cy="50%" r="52%">
          <stop offset="80%" stop-color="#ffffff" stop-opacity=".10"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity=".00"/>
        </radialGradient>
      </defs>
      <circle cx="0" cy="0" r="56" fill="url(#atl-sweep)" fill-opacity=".12" stroke="#2ad6c7" stroke-opacity=".45" filter="url(#atl-frost)"/>
      <circle cx="0" cy="0" r="54" fill="url(#atl-rim)"/>
      <ellipse cx="0" cy="-12" rx="46" ry="18" fill="url(#atl-gloss)" opacity=".85">
        <animate attributeName="opacity" values=".85;.55;.85" dur="6s" repeatCount="indefinite"/>
      </ellipse>
      <circle cx="0" cy="0" r="44" fill="none" stroke="#81fff1" stroke-opacity=".25" stroke-width="2" stroke-dasharray="6 10">
        <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="24s" repeatCount="indefinite"/>
      </circle>
      <text x="0" y="-10" text-anchor="middle" font-size="12" fill="#81fff1" fill-opacity=".95" style="letter-spacing:.08em">PROOF</text>
      <text x="0" y="8"   text-anchor="middle" font-size="14" fill="#e7fbf7" fill-opacity=".98" style="letter-spacing:.1em">OF</text>
      <text x="0" y="26"  text-anchor="middle" font-size="12" fill="#37e6d4" fill-opacity=".95" style="letter-spacing:.08em">BREATH™</text>
    </g>`;

  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="1000" height="618"
  viewBox="0 0 1000 618"
  preserveAspectRatio="xMidYMid meet"
  xml:space="preserve"
  role="img"
  aria-label="Kairos Kurrency Note"
  data-note="kairos-kurrency"
  data-valuation-pulse="${esc(pulseRendered)}"
  data-kai-signature="${esc(kaiSignature)}"
  data-user-phikey="${esc(userPhiKey)}"
  style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality"
>
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#37e6d4"/><stop offset="1" stop-color="#81fff1"/>
    </linearGradient>
    <pattern id="micro" width="120" height="10" patternUnits="userSpaceOnUse">
      <text x="0" y="8" font-size="9" font-family="ui-monospace,monospace" fill="#6fe" letter-spacing=".08em">
        KAIROS KURRENSY • LAWFUL UNDER YAHUAH • Φ • HARMONIK TENDER • ${esc(serial)}
      </text>
    </pattern>
    <filter id="soft"><feGaussianBlur stdDeviation="1.2"/></filter>
    <filter id="frostGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur"/>
      <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.8  0 0 0 0 1  0 0 0 0 0.95  0 0 0 0.25 0" result="glow"/>
      <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <!-- Moved here from inside the <g> for compatibility -->
    <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".12"/>
      <stop offset=".35" stop-color="#ffffff" stop-opacity=".05"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
  </defs>

  ${buildCutMarks(10,10,980,598,16)}

  <!-- Border + background -->
  <g filter="url(#frostGlow)">
    <rect x="10" y="10" width="980" height="598" rx="14" fill="#0b1417" stroke="#2ad6c7" stroke-opacity=".45"/>
    <rect x="24" y="24" width="952" height="570" rx="12" fill="#0a1013" stroke="#2ad6c7" stroke-opacity=".35"/>
    <rect x="36" y="36" width="928" height="546" rx="10" fill="url(#micro)" opacity=".15"/>
    <rect x="24" y="24" width="952" height="160" rx="12" fill="url(#glass)"/>
  </g>

  <!-- Headings -->
  <text x="50%" y="78" fill="url(#g)" font-size="20" font-family="ui-sans-serif" text-anchor="middle" letter-spacing=".20em">${esc(NOTE_TITLE)}</text>
  <text x="50%" y="102" fill="#cfe" font-size="13" font-family="ui-sans-serif" text-anchor="middle" letter-spacing=".10em">
    ISSUED UNDER YAHUAH’S LAW OF ETERNAL LIGHT — Φ • KAI-TURAH
  </text>

  <!-- Guilloché -->
  <path d="${rosette}" fill="none" stroke="#5ef5e6" stroke-opacity=".25" stroke-width="1" vector-effect="non-scaling-stroke"/>
  <path d="${rosette}" fill="none" stroke="#5ef5e6" stroke-opacity=".12" stroke-width="8" filter="url(#soft)" vector-effect="non-scaling-stroke"/>

  <!-- Left column values -->
  <g transform="translate(64,160)">
    <g opacity=".18">
      <radialGradient id="rbwLens" cx="50%" cy="50%" r="70%">
        <stop offset="0"   stop-color="#ffffff" stop-opacity=".35"/>
        <stop offset=".08" stop-color="#ff0033" stop-opacity=".90"/>
        <stop offset=".22" stop-color="#ff7a00" stop-opacity=".90"/>
        <stop offset=".36" stop-color="#ffef00" stop-opacity=".90"/>
        <stop offset=".50" stop-color="#00d05a" stop-opacity=".90"/>
        <stop offset=".64" stop-color="#00b6ff" stop-opacity=".90"/>
        <stop offset=".78" stop-color="#6a00ff" stop-opacity=".90"/>
        <stop offset=".92" stop-color="#c800ff" stop-opacity=".90"/>
        <stop offset="1"   stop-color="#000000" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="lensGloss" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity=".22"/>
        <stop offset=".35" stop-color="#ffffff" stop-opacity=".06"/>
        <stop offset="1" stop-color="#000000" stop-opacity="0"/>
      </linearGradient>
      <radialGradient id="lensRim" cx="50%" cy="50%" r="60%">
        <stop offset=".85" stop-color="#ffffff" stop-opacity=".12"/>
        <stop offset="1"   stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
      <filter id="softBloom" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="1.4" result="b1"/>
        <feGaussianBlur in="SourceGraphic" stdDeviation="3.2" result="b2"/>
        <feMerge><feMergeNode in="b2"/><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <text x="0" y="58" font-size="72" font-family="ui-sans-serif" fill="url(#rbwLens)" filter="url(#softBloom)">Φ</text>
      <text x="0" y="58" font-size="72" font-family="ui-sans-serif" fill="url(#lensRim)"></text>
      <text x="0" y="58" font-size="72" font-family="ui-sans-serif" fill="url(#lensGloss)" opacity=".22"></text>
    </g>
    <g transform="translate(76,0)">
      <text x="0" y="22" fill="#bff" font-size="22" font-family="ui-sans-serif">VALUE</text>
      <text x="0" y="52" fill="#cfe" font-size="20" font-family="ui-monospace,monospace">Φ${esc(valuePhi)}</text>
      <text x="0" y="82" fill="#bfe" font-size="12" font-family="ui-monospace,monospace">PREMIUM Φ${esc(premiumPhi)}</text>
    </g>
  </g>

  <!-- Badge -->
  ${badgeBlock}

  <!-- Right-side Φ watermark -->
  <text x="860" y="580" text-anchor="middle" font-size="44" fill="#81fff1" fill-opacity=".16" font-family="ui-sans-serif">Φ</text>

  <!-- QR -->
  ${qrBlock}

  <!-- Center sigil (clickable) -->
  ${sigilEmbed}

  <!-- Microtext belts -->
  <rect x="64" y="500" width="872" height="16" fill="url(#micro)" opacity=".45"/>
  <rect x="64" y="520" width="872" height="10" fill="url(#micro)" opacity=".35"/>

  <!-- Provenance line (if any) -->
  ${provLines || ""}

  <!-- Legal -->
  <text x="64" y="575" fill="#aee" font-size="11" font-family="ui-sans-serif">
    This note is lawful tender in Kairos under Yahuah’s Law. It is not issued by man’s law nor redeemable in Chronos. Truth is its collateral; breath is its seal.
  </text>

  <!-- Parties / context -->
  <g font-family="ui-monospace,monospace" font-size="12" fill="#dff">
    <text x="64"  y="544">Purpose: ${esc(Purpose || "—")}</text>
    <text x="364" y="544">To: ${esc(To || "—")}</text>
    <text x="664" y="544">From: ${esc(From || "—")}</text>
    <text x="64"  y="562">Location: ${esc(Location || "—")}</text>
    <text x="364" y="562">Witnesses: ${esc(Witnesses || "—")}</text>
    <text x="664" y="562">Reference: ${esc(Reference || "—")}</text>
  </g>

  <!-- Serials / identity -->
  <g font-family="ui-monospace,monospace" font-size="11" fill="#bff">
    <text x="64"  y="130">SERIAL: ${esc(serial)}</text>
    <text x="64"  y="266">PULSE (VALUATION): ${esc(pulseRendered)}</text>
    <text x="320" y="130" text-anchor="start">KaiSignature: ${esc(kaiSignature || "—")}</text>
    <text x="520" y="146" text-anchor="start">ΦKey: ${esc(userPhiKey || "—")}</text>
    <text x="64" y="460" fill="#aee" font-size="10" opacity=".95">Algorithm (Valuation): ${esc(valuationAlg || "—")}</text>
    <text x="64" y="478" fill="#aee" font-size="10" opacity=".95">Hash (Valuation): ${esc(valuationStamp || "—")}</text>
  </g>

  <!-- Remark -->
  <text x="500" y="590" fill="#ffbfbf" font-size="12" text-anchor="middle" font-family="ui-sans-serif">${esc(Remark)}</text>
</svg>`.trim();
}
