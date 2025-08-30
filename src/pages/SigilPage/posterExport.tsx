// src/pages/SigilPage/posterExport.tsx
"use client";

import { renderToStaticMarkup } from "react-dom/server";
import KaiQR from "../../components/sigil/KaiQR";
import { CHAKRA_THEME } from "../../components/sigil/theme";
import { POSTER_PX } from "../../utils/qrExport";
import { momentBadgeColor } from "./utils";
import type { SigilPayload } from "../../types/sigil";
import { ensureClaimTimeInUrl } from "../../utils/urlShort";

export async function exportPosterPNG(params: {
  stageEl: HTMLElement | null;
  payload: (SigilPayload & { stepPct?: number }) | null;
  localHash: string | null;
  routeHash: string | null;
  qr: { uid: string; url: string; hue: number; accent: string };
  onToast: (m: string) => void;
}) {
  const { stageEl, payload, localHash, routeHash, qr, onToast } = params;
  if (!stageEl) return onToast("No stage found");

  try {
    const html2canvas = (await import("html2canvas")).default;

    // Transparent capture of the stage
    const stageCanvas = await html2canvas(
      stageEl,
      ({ backgroundColor: null } as unknown) as Parameters<typeof html2canvas>[1]
    );

    const canvas = document.createElement("canvas");
    canvas.width = POSTER_PX;
    canvas.height = POSTER_PX;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No canvas context");

    // Start fully transparent
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const margin = Math.floor(POSTER_PX * 0.06);
    const availW = POSTER_PX - margin * 2;
    const availH = POSTER_PX - margin * 2;

    const sW = stageCanvas.width;
    const sH = stageCanvas.height;
    const scale = Math.min(availW / sW, availH / sH);
    const drawW = Math.floor(sW * scale);
    const drawH = Math.floor(sH * scale);
    const dx = Math.floor((POSTER_PX - drawW) / 2);
    const dy = Math.floor((POSTER_PX - drawH) / 2);
    ctx.drawImage(stageCanvas, dx, dy, drawW, drawH);

    // ——— Accent & badge ———
    const chakraDayLocal = (payload?.chakraDay ?? "Throat") as keyof typeof CHAKRA_THEME;
    const accent = CHAKRA_THEME[chakraDayLocal]?.accent || "#00FFD0";
    const stepPctPoster =
      typeof payload?.stepPct === "number"
        ? payload!.stepPct
        : payload
        ? (payload.pulse % 11) / 11
        : 0;
    const badgeCol = momentBadgeColor(
      chakraDayLocal,
      stepPctPoster,
      localHash || undefined
    );

    const barW = Math.max(POSTER_PX * 0.33, 720);
    const barH = Math.max(POSTER_PX * 0.08, 160);
    const barR = Math.max(barH * 0.24, 30);
    const barX = POSTER_PX - barW - margin;
    const barY = POSTER_PX - barH - margin;

    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = Math.max(18, Math.floor(POSTER_PX * 0.012));
    const gloss = ctx.createLinearGradient(0, barY, 0, barY + barH);
    gloss.addColorStop(0, "rgba(255,255,255,0.16)");
    gloss.addColorStop(1, "rgba(255,255,255,0.05)");

    roundRect(ctx, barX, barY, barW, barH, barR);
    ctx.fillStyle = gloss; // semi-transparent gloss, preserves PNG alpha
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(2, Math.floor(POSTER_PX * 0.0016));
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.stroke();

    const pulseStr = (payload?.pulse ?? 0).toLocaleString();
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = badgeCol;
    ctx.font = `900 ${Math.floor(
      barH * 0.48
    )}px Inter, ui-sans-serif, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial`;
    ctx.shadowColor = badgeCol;
    ctx.shadowBlur = Math.max(16, Math.floor(POSTER_PX * 0.008));
    const textW = ctx.measureText(pulseStr).width;
    const tx = Math.floor(barX + barW / 2 - textW / 2);
    const ty = Math.floor(barY + barH / 2 + barH * 0.18);
    ctx.fillText(pulseStr, tx, ty);
    ctx.restore();

    // ——— QR block ———
    const qrSide = Math.floor(POSTER_PX * 0.32);
    const qrX = Math.floor((POSTER_PX - qrSide) / 2);
    const qrY = Math.floor((POSTER_PX - qrSide) / 2);

    // Always derive an EFFECTIVE url for the QR:
    // - Prefer the provided qr.url
    // - If we have a payload with canonicalHash/transferNonce, force /s/:canonical + ?t= + claim window in ?p=
    // - Fall back to window.location.href
    const urlForQR = derivePosterUrl({
      provided: qr.url,
      payload,
      localHash,
      routeHash,
    });

    const qrSvgMarkup = renderToStaticMarkup(
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
        <KaiQR
          uid={qr.uid}
          url={urlForQR}
          size={800}
          phaseHue={qr.hue}
          phaseColor={qr.accent}
          animate={false}
          pulseMs={5236}
        />
      </svg>
    );

    const qrBlob = new Blob([qrSvgMarkup], {
      type: "image/svg+xml;charset=utf-8",
    });
    const qrObjUrl = URL.createObjectURL(qrBlob);

    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          ctx.drawImage(img, qrX, qrY, qrSide, qrSide);
        } finally {
          URL.revokeObjectURL(qrObjUrl);
          resolve();
        }
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(qrObjUrl);
        reject(e);
      };
      img.src = qrObjUrl;
    });

    const outUrl = canvas.toDataURL("image/png"); // PNG preserves alpha
    const a = document.createElement("a");
    a.href = outUrl;
    a.download = `sigil_poster_${(localHash || routeHash || "mint").slice(0, 16)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    onToast("Public key PNG saved");
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    onToast("Poster export failed");
  }

  function roundRect(
    cx: CanvasRenderingContext2D,
    rx: number,
    ry: number,
    rw: number,
    rh: number,
    rr: number
  ) {
    cx.beginPath();
    cx.moveTo(rx + rr, ry);
    cx.lineTo(rx + rw - rr, ry);
    cx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + rr);
    cx.lineTo(rx + rw, ry + rh - rr);
    cx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - rr, ry + rh);
    cx.lineTo(rx + rr, ry + rh);
    cx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - rr);
    cx.lineTo(rx, ry + rr);
    cx.quadraticCurveTo(rx, ry, rx + rr, ry);
    cx.closePath();
  }
}

/**
 * Build the *correct* URL for the QR:
 *  - If payload carries canonicalHash and transferNonce, force path=/s/:canonical and attach ?t=nonce.
 *  - Also embed claim window / lineage timing in ?p= via ensureClaimTimeInUrl for robust deep links.
 *  - Otherwise prefer the provided URL, finally window.location.href.
 */
function derivePosterUrl(args: {
  provided?: string | null;
  payload: (SigilPayload & { stepPct?: number }) | null;
  localHash: string | null;
  routeHash: string | null;
}): string {
  const { provided, payload, localHash, routeHash } = args;

  // Start with a safe base
  const base =
    (provided && safeUrl(provided))
      ? provided
      : (typeof window !== "undefined" ? window.location.href : "") || "";

  if (!payload) return base;

  try {
    const canonical = (payload.canonicalHash || localHash || routeHash || "").toLowerCase();
    if (!canonical) return base;

    const u = new URL(base, typeof window !== "undefined" ? window.location.origin : "https://local.test");
    u.pathname = `/s/${canonical}`;

    // Prefer transferNonce from payload; otherwise keep existing ?t
    const token = payload.transferNonce || u.searchParams.get("t");
    if (token) u.searchParams.set("t", token);

    const normalized = `${u.pathname}${u.search}${u.hash}`;

    // Ensure claim window + lineage timing are embedded in ?p=
    const withClaim = ensureClaimTimeInUrl(normalized, payload);
    return withClaim || normalized;
  } catch {
    return base;
  }
}


function safeUrl(u: string): boolean {
  try {
    // Only allow http(s) to avoid odd data: or javascript: schemes
    const p = new URL(u, typeof window !== "undefined" ? window.location.origin : "https://local.test");
    return p.protocol === "http:" || p.protocol === "https:";
  } catch {
    return false;
  }
}
