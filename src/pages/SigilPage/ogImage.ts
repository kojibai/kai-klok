import html2canvas from "html2canvas";
import { CHAKRA_THEME } from "../../components/sigil/theme";
import { OG_W, OG_H } from "../../utils/qrExport";
import { momentBadgeColor, requestIdle, cancelIdle } from "./utils";
import type { SigilPayload } from "../../types/sigil";



type MetaSetter = (attrName: "name" | "property", key: string, val: string) => void;

export function runOgImageEffect(params: {
  stageId: string;
  payload: (SigilPayload & { stepPct?: number }) | null;
  localHash: string | null;
  setOgImgUrl: (s: string | null) => void;
  setMeta: MetaSetter;
  seoTitle: string;
  seoDesc: string;
}) {
  const { stageId, payload, localHash, setOgImgUrl, setMeta, seoTitle, seoDesc } = params;

  let cancelled = false;
  let idleId: number | null = null;

  const run = async () => {
    const el = document.getElementById(stageId);
    if (!el || !payload) {
      setOgImgUrl(null);
      setMeta("property", "og:image", "");
      setMeta("property", "og:image:alt", "");
      setMeta("property", "og:image:width", "");
      setMeta("property", "og:image:height", "");
      setMeta("name", "twitter:image", "");
      return;
    }

    try {
      const chakra = (payload.chakraDay ?? "Throat") as keyof typeof CHAKRA_THEME;
      const accent = CHAKRA_THEME[chakra]?.accent || "#00FFD0";
      const pulseStr = payload.pulse || 0;
      const title = "Kairos Sigil-Glyph — Sealed Kairos Moment";

      const stepsNum: number = (payload.stepsPerBeat ?? 44) as number;
      const stepIdx = Math.floor((payload.pulse % (stepsNum * 11)) / 11);
      const stepPctOG = typeof payload.stepPct === "number" ? payload.stepPct : (payload.pulse % 11) / 11;
      const badgeCol = momentBadgeColor(chakra, stepPctOG, localHash || undefined);
      const subtitle = `Pulse ${pulseStr.toLocaleString()} • Beat ${payload.beat}/36 • Step ${stepIdx + 1}/${stepsNum} • ${chakra}`;


      const stageCanvas = await html2canvas(el as HTMLElement);

      const canvas = document.createElement("canvas");
      canvas.width = OG_W;
      canvas.height = OG_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unsupported");

      // background
      const grd = ctx.createLinearGradient(0, 0, OG_W, OG_H);
      grd.addColorStop(0, "rgba(0,0,0,0.92)");
      grd.addColorStop(1, "rgba(0,0,0,0.70)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, OG_W, OG_H);

      // bloom
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const bloom = ctx.createRadialGradient(OG_W * 0.8, OG_H * 0.2, 20, OG_W * 0.8, OG_H * 0.2, 600);
      bloom.addColorStop(0, `${accent}CC`);
      bloom.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.arc(OG_W * 0.8, OG_H * 0.2, 600, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // place stage
      const margin = 36;
      const boxW = Math.floor(OG_W * 0.52);
      const boxH = OG_H - margin * 2;
      const scale = Math.min(boxW / stageCanvas.width, boxH / stageCanvas.height);
      const drawW = Math.floor(stageCanvas.width * scale);
      const drawH = Math.floor(stageCanvas.height * scale);
      const dx = margin + Math.floor((boxW - drawW) / 2);
      const dy = margin + Math.floor((boxH - drawH) / 2);
      ctx.drawImage(stageCanvas, dx, dy, drawW, drawH);

      // text
      const textX = margin + boxW + 32;
      const textW = OG_W - textX - margin;
      ctx.fillStyle = "#EAFBFF";
      ctx.font = "700 38px Inter, ui-sans-serif, -apple-system, Segoe UI, Roboto";
      ctx.fillText(title, textX, margin + 58);
      ctx.fillStyle = "rgba(255,255,255,0.82)";
      ctx.font = "400 24px Inter, ui-sans-serif, -apple-system, Segoe UI, Roboto";
      wrapText(ctx, `“${seoTitle}” — ${seoDesc}`, textX, margin + 100, textW, 30);

      // badge
      const badge = `${pulseStr.toLocaleString()}`;
      ctx.textBaseline = "alphabetic";
      ctx.font = "900 120px Inter, ui-sans-serif, -apple-system, Segoe UI, Roboto";
      ctx.shadowColor = badgeCol;
      ctx.shadowBlur = 20;
      ctx.fillStyle = badgeCol;
      const bw = ctx.measureText(badge).width;
      const bx = textX + Math.floor((textW - bw) / 2);
      const by = OG_H - margin - 40;
      ctx.fillText(badge, bx, by);
      ctx.shadowBlur = 0;

      const dataUrl = canvas.toDataURL("image/png");
      if (cancelled) return;
      setOgImgUrl(dataUrl);
      setMeta("property", "og:image", dataUrl);
      setMeta("property", "og:image:alt", subtitle);
      setMeta("property", "og:image:type", "image/png");
      setMeta("property", "og:image:width", String(OG_W));
      setMeta("property", "og:image:height", String(OG_H));
      setMeta("name", "twitter:image", dataUrl);
    } catch {
      if (cancelled) return;
      setOgImgUrl(null);
    }
  };

  idleId = requestIdle(() => {
    if (!cancelled) run();
  });

  return () => {
    cancelled = true;
    if (idleId != null) cancelIdle(idleId);
  };

  function wrapText(
    cx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ) {
    const words = text.split(" ");
    let line = "";
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = cx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        cx.fillText(line, x, y);
        line = words[n] + " ";
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    cx.fillText(line.trim(), x, y);
  }
}
