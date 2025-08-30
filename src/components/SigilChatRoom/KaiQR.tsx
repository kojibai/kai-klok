"use client";

import { useMemo, useEffect, useRef } from "react";
import QRCode from "qrcode-generator";

export type KaiQRProps = {
  uid: string;               // Unique identity (e.g., sigil hash or chat UID)
  url?: string | null;
  size?: number;             // CSS size in px (logical)
  dpr?: number;              // device pixel ratio
  phaseHue?: number;         // base hue for gradients
  phaseColor?: string;       // primary color (e.g., "#00FFD0")
  animate?: boolean;         // enable harmonic pulsing
  pulseMs?: number;          // pulse period in ms (e.g., 5236)

  // Glyph poster integration / artistic control
  centerX?: number;          // fade center X (in module space)
  centerY?: number;          // fade center Y (in module space)
  space?: number;            // quiet zone in *pixels* around QR (keeps scannability)
  render?: "field" | "corners" | "full"; // visual mode
  cornerFade?: number;       // 0..1 fade weight for "corners" mode
};

/** clamp 0..1 and apply smoothstep easing */
function smooth01(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

const hsl = (h: number, s = 100, l = 50) => `hsl(${h} ${s}% ${l}%)`;

/** Parse hsl/hsla(...) and return hsla(h, s%, 30%, alpha) for high contrast; otherwise rgba black */
function darkenForQR(base: string, alpha = 1): string {
  // hsl(a?) regex with optional alpha
  const re = /^hsla?\(\s*([0-9.]+)\s*[, ]\s*([0-9.]+)%\s*[, ]\s*([0-9.]+)%(?:\s*[,/]\s*([0-9.]+))?\s*\)$/i;
  const match = base.match(re);
  if (match) {
    const h = Number(match[1]);
    const s = Number(match[2]);
    const a = match[4] !== undefined ? Number(match[4]) : 1;
    const aOut = Math.max(0, Math.min(1, a * alpha));
    // lock lightness to 30% for module darkness
    return `hsla(${h}, ${s}%, 30%, ${aOut})`;
  }
  // fallback: near-black with requested alpha
  return `rgba(0,0,0,${Math.min(0.92, Math.max(0.6, alpha))})`;
}

/** Draw one frame of the QR code with optional animation */
function drawQRFrame(opts: {
  ctx: CanvasRenderingContext2D;
  size: number;
  space: number;
  qr: ReturnType<typeof QRCode>;
  phaseHue: number;
  phaseColor: string;
  render: "field" | "corners" | "full";
  cornerFade: number;
  animate: boolean;
  pulseMs: number;
  now: number; // ms timestamp for animation
  centerX: number;
  centerY: number;
}) {
  const {
    ctx, size, space, qr, phaseHue, phaseColor, render, cornerFade,
    animate, pulseMs, now, centerX, centerY,
  } = opts;

  const moduleCount = qr.getModuleCount();
  const inner = size - space * 2; // drawable area (px)
  const modulePx = Math.max(1, Math.floor(inner / moduleCount)); // size per module (px)
  const qrPx = modulePx * moduleCount;
  const originX = Math.floor((size - qrPx) / 2);
  const originY = Math.floor((size - qrPx) / 2);

  // Clear then draw a white background (improves scanner stability)
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  // Harmonic pulse factor 0..1, eased
  const tCycle = animate ? ((now % pulseMs) / pulseMs) : 0;
  const pulse = smooth01(0.5 - 0.5 * Math.cos(2 * Math.PI * tCycle)); // smooth cos pulse

  // Two tones: a dark readable module color and a subtle glow overlay
  const moduleColor = darkenForQR(phaseColor, 0.9);
  const glowHue = (phaseHue + Math.round(60 * pulse)) % 360;
  const glow = hsl(glowHue, 100, 55);

  // Precompute radii for fades
  const maxDistCorner = Math.max(moduleCount / 4, 1);
  const maxDistCenter = Math.hypot(
    Math.max(centerX, moduleCount - centerX),
    Math.max(centerY, moduleCount - centerY)
  );

  // Optional: subtle animated vignette to look incredible but not harm readability
  if (animate) {
    const radial = ctx.createRadialGradient(
      size / 2, size / 2, (size * 0.1) * (1 + 0.25 * pulse),
      size / 2, size / 2, size * (0.7 + 0.1 * pulse)
    );
    radial.addColorStop(0, `rgba(255,255,255,${0.08 + 0.06 * pulse})`);
    radial.addColorStop(1, `rgba(255,255,255,0)`);
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, size, size);
  }

  // Draw modules
  ctx.save();
  ctx.translate(originX, originY);

  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (!qr.isDark(r, c)) continue;

      // Compute alpha modulation depending on render mode
      let alpha = 1;

      if (render === "corners") {
        // Fade stronger near edges to accent the three finder corners visually
        const edgeDist = Math.min(r, c, moduleCount - 1 - r, moduleCount - 1 - c);
        const k = Math.min(1, edgeDist / maxDistCorner);
        alpha = 1 - cornerFade * (1 - k); // more transparent near edges
      } else if (render === "full") {
        // Radial fade around centerX/centerY in module space
        const dx = c - centerX;
        const dy = r - centerY;
        const dist = Math.hypot(dx, dy);
        const k = 1 - smooth01(dist / Math.max(maxDistCenter, 1));
        alpha = 0.85 + 0.15 * k; // keep strong but with gentle center bias
      } // "field" = uniform

      // Animate: add a slight pulsing to alpha to create life
      if (animate) {
        alpha *= 0.9 + 0.1 * pulse;
      }

      // Module rectangle position in px
      const x = c * modulePx;
      const y = r * modulePx;

      // Draw the module body (high contrast)
      ctx.fillStyle = moduleColor;
      ctx.globalAlpha = alpha;
      ctx.fillRect(x, y, modulePx, modulePx);

      // Optional glossy edge: subtle inner highlight based on pulse
      if (animate && modulePx >= 4) {
        ctx.globalAlpha = 0.08 * pulse;
        ctx.fillStyle = glow;
        ctx.fillRect(x + 1, y + 1, modulePx - 2, modulePx - 2);
      }
    }
  }

  ctx.restore();

  // Gentle outer glow frame (aesthetic, not affecting code cells)
  if (animate) {
    const frame = ctx.createLinearGradient(0, 0, size, size);
    frame.addColorStop(0, `rgba(255,255,255,${0.05 * pulse})`);
    frame.addColorStop(1, `rgba(255,255,255,0)`);
    ctx.globalAlpha = 1;
    ctx.fillStyle = frame;
    ctx.fillRect(0, 0, size, size);
  }
}

export default function KaiQR({
  uid,
  url,
  dpr = typeof window !== "undefined" ? window.devicePixelRatio ?? 1 : 1,
  size = 280,
  phaseHue = 192,
  phaseColor = "#00FFD0",
  animate = false,
  pulseMs = 5236,
  render = "field",
  centerX,
  centerY,
  space = 16, // default to 16px quiet zone for better scanning
  cornerFade = 0.8,
}: KaiQRProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Payload encoded in the QR
  const payload = useMemo(
    () => (url && url.trim().length > 0 ? url : `https://sigil.phi.network/${uid}`),
    [uid, url]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !payload) return;

    // Create QR (version 0 = auto, error correction H)
    const qr = QRCode(0, "H");
    qr.addData(payload);
    qr.make();

    // Prepare canvas pixels with DPR
    const pixelSize = Math.max(1, Math.floor(size * dpr));
    canvas.width = pixelSize;
    canvas.height = pixelSize;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Reset any previous transforms & draw in logical px
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const cx = centerX ?? qr.getModuleCount() / 2;
    const cy = centerY ?? qr.getModuleCount() / 2;

    let raf = 0;
    const renderOnce = (now: number) => {
      drawQRFrame({
        ctx,
        size,
        space,
        qr,
        phaseHue,
        phaseColor,
        render,
        cornerFade,
        animate,
        pulseMs,
        now,
        centerX: cx,
        centerY: cy,
      });
    };

    if (animate) {
      const loop = (t: number) => {
        renderOnce(t);
        raf = window.requestAnimationFrame(loop);
      };
      raf = window.requestAnimationFrame(loop);
    } else {
      renderOnce(0);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [
    uid,
    payload,
    dpr,
    size,
    phaseHue,
    phaseColor,
    animate,
    pulseMs,
    render,
    centerX,
    centerY,
    space,
    cornerFade,
  ]);

  return (
    <div className="kai-qr" style={{ width: size, height: size, lineHeight: 0 }}>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        aria-label="Kairos QR Code"
        role="img"
      />
    </div>
  );
}
