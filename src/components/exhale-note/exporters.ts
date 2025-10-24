// src/components/exhale-note/exporters.ts
// PNG export + safe download helpers — production-ready, browser-only

export type SvgToPngOptions = {
    outWidth?: number;
    outHeight?: number;
    pixelRatio?: number;
    background?: string | null;
  };
  
  export async function svgStringToPngBlob(
    svgText: string,
    widthOrOptions: number | SvgToPngOptions = 2400
  ): Promise<Blob> {
    const isOptions = typeof widthOrOptions === "object" && widthOrOptions !== null;
    const opts: SvgToPngOptions = isOptions
      ? (widthOrOptions as SvgToPngOptions)
      : { outWidth: widthOrOptions as number };
  
    const outWidth = Math.max(1, Math.floor(opts.outWidth ?? 2400));
    const background = opts.background ?? null;
  
    const svgNormalized =
      svgText.startsWith("<?xml") ? svgText : `<?xml version="1.0" encoding="UTF-8"?>\n${svgText}`;
  
    const svgBlob = new Blob([svgNormalized], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
  
    // Helper: best-effort ratio if browser can't give us intrinsic size
    const ratioFromText = (): number => {
      try {
        const m = svgText.match(/viewBox\s*=\s*"(\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+))"/i);
        if (m && m[2] && m[3]) {
          const w = parseFloat(m[2]);
          const h = parseFloat(m[3]);
          if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return h / w;
        }
        const mW = svgText.match(/\bwidth\s*=\s*"([\d.]+)"/i);
        const mH = svgText.match(/\bheight\s*=\s*"([\d.]+)"/i);
        if (mW && mH) {
          const w = parseFloat(mW[1]);
          const h = parseFloat(mH[1]);
          if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return h / w;
        }
      } catch (e) {
        // Intentionally ignore parse errors; we'll fall back to a known-safe aspect.
        void e;
      }
      // Safe fallback to banknote aspect if unknown
      return 618 / 1000;
    };
  
    try {
      // Wait for fonts (where supported) to reduce text reflow variance in rasterization.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyDoc: any = document;
      if (anyDoc?.fonts?.ready && typeof anyDoc.fonts.ready.then === "function") {
        try {
          await anyDoc.fonts.ready;
        } catch (e) {
          // If fonts don't resolve, just proceed with system fallback fonts.
          void e;
        }
      }
  
      const bitmapSupported = "createImageBitmap" in window;
  
      if (bitmapSupported) {
        // ImageBitmap path
        const res = await fetch(url);
        const blob = await res.blob();
        const bmp = await createImageBitmap(blob);
  
        const ratio =
          opts.outHeight != null
            ? opts.outHeight / Math.max(1, outWidth)
            : bmp.width > 0 && bmp.height > 0
            ? bmp.height / bmp.width
            : ratioFromText();
  
        const effectiveDpr = Math.max(
          1,
          Math.floor(
            Number.isFinite(opts.pixelRatio as number)
              ? (opts.pixelRatio as number)
              : (typeof window !== "undefined" && window.devicePixelRatio) || 1
          )
        );
  
        const w = Math.round(outWidth * effectiveDpr);
        const h = Math.round((opts.outHeight != null ? opts.outHeight : outWidth * ratio) * effectiveDpr);
  
        const useOffscreen = typeof OffscreenCanvas !== "undefined";
        const canvas: HTMLCanvasElement | OffscreenCanvas = useOffscreen
          ? new OffscreenCanvas(w, h)
          : (document.createElement("canvas") as HTMLCanvasElement);
  
        const ctx =
          (canvas.getContext("2d") as
            | CanvasRenderingContext2D
            | OffscreenCanvasRenderingContext2D
            | null);
        if (!ctx) throw new Error("Canvas 2D context unavailable.");
  
        if (background) {
          (ctx as CanvasRenderingContext2D).fillStyle = background;
          (ctx as CanvasRenderingContext2D).fillRect(0, 0, w, h);
        }
  
        (ctx as CanvasRenderingContext2D).imageSmoothingEnabled = true;
        (ctx as CanvasRenderingContext2D).imageSmoothingQuality = "high";
        (ctx as CanvasRenderingContext2D).drawImage(bmp as unknown as CanvasImageSource, 0, 0, w, h);
  
        // OffscreenCanvas: prefer convertToBlob; HTMLCanvas: toBlob
        if ("convertToBlob" in canvas) {
          return await (canvas as OffscreenCanvas).convertToBlob({ type: "image/png" });
        }
        const pngBlob = await new Promise<Blob>((resolve, reject) =>
          (canvas as HTMLCanvasElement).toBlob(
            (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
            "image/png"
          )
        );
        return pngBlob;
      } else {
        // <img> fallback
        const img = new Image();
        img.decoding = "async";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Image load failed"));
          img.src = url;
        });
  
        const naturalW = img.naturalWidth || img.width || 1000;
        const naturalH = img.naturalHeight || img.height || Math.round(1000 * ratioFromText());
  
        const ratio =
          opts.outHeight != null
            ? opts.outHeight / Math.max(1, outWidth)
            : naturalW > 0 && naturalH > 0
            ? naturalH / Math.max(1, naturalW)
            : ratioFromText();
  
        const effectiveDpr = Math.max(
          1,
          Math.floor(
            Number.isFinite(opts.pixelRatio as number)
              ? (opts.pixelRatio as number)
              : (typeof window !== "undefined" && window.devicePixelRatio) || 1
          )
        );
  
        const w = Math.round(outWidth * effectiveDpr);
        const h = Math.round((opts.outHeight != null ? opts.outHeight : outWidth * ratio) * effectiveDpr);
  
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
  
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context unavailable.");
  
        if (background) {
          ctx.fillStyle = background;
          ctx.fillRect(0, 0, w, h);
        }
  
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);
  
        const pngBlob =
          (await new Promise<Blob | null>((resolve) =>
            canvas.toBlob((b) => resolve(b), "image/png")
          )) || dataUrlToBlob(canvas.toDataURL("image/png"));
  
        return pngBlob;
      }
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  
  export function triggerDownload(
    filename: string,
    data: Blob | ArrayBuffer | ArrayBufferView | string,
    mime = "application/octet-stream"
  ): void {
    const blob =
      data instanceof Blob ? data : new Blob([data as BlobPart], { type: mime });
  
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename || "download";
    a.rel = "noopener";
    a.type = mime;
  
    document.body.appendChild(a);
    a.click();
    a.remove();
  
    setTimeout(() => URL.revokeObjectURL(href), 2000);
  }
  
  export function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
  
  /* ------------------------- internal utilities ------------------------- */
  
  function dataUrlToBlob(dataUrl: string): Blob {
    const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/i);
    if (!m) {
      return new Blob([dataUrl], { type: "application/octet-stream" });
    }
    const mime = m[1];
    const b64 = m[2];
    const bin = atob(b64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime || "application/octet-stream" });
  }
  