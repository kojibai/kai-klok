import { bytesToHex, sha256 } from "./crypto";

export function makeExporters(
  svgRef: React.RefObject<SVGSVGElement>,
  size: number | undefined
) {
  const utf8ToBase64 = (s: string): string => {
    if (typeof window === "undefined" || typeof window.btoa !== "function") {
      throw new Error("Base64 encoding unavailable in this environment");
    }
    const utf8 = encodeURIComponent(s).replace(
      /%([0-9A-F]{2})/g,
      (_: string, h: string) => String.fromCharCode(parseInt(h, 16))
    );
    return window.btoa(utf8);
  };

  return {
    toDataURL: () => {
      const el = svgRef.current;
      if (!el) throw new Error("SVG not mounted");
      return `data:image/svg+xml;base64,${utf8ToBase64(
        new XMLSerializer().serializeToString(el)
      )}`;
    },
    async exportBlob(
      type: "image/svg+xml" | "image/png" = "image/svg+xml",
      scale = 2
    ) {
      const el = svgRef.current;
      if (!el) throw new Error("SVG not mounted");
      const xml = new XMLSerializer().serializeToString(el);
      if (type === "image/svg+xml") return new Blob([xml], { type });
      const svgUrl = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }));
      try {
        const img = new Image();
        const sizePx = Math.round((size ?? 240) * scale);
        img.decoding = "async";
        img.src = svgUrl;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = sizePx;
        canvas.height = sizePx;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context not available");
        ctx.drawImage(img, 0, 0, sizePx, sizePx);
        const blob: Blob = await new Promise<Blob>((res, rej) => {
          canvas.toBlob((b) => (b ? res(b) : rej(new Error("Canvas toBlob failed"))), "image/png");
        });
        return blob;
      } finally {
        URL.revokeObjectURL(svgUrl);
      }
    },
    async verifySvgHash(expected: string) {
      const el = svgRef.current;
      if (!el) throw new Error("SVG not mounted");
      const clone = el.cloneNode(true) as SVGSVGElement;
      clone.removeAttribute("data-svg-hash");
      clone.removeAttribute("data-svg-valid");
      const xml = new XMLSerializer().serializeToString(clone);
      const calc = bytesToHex(await sha256(xml));
      if (calc !== expected.toLowerCase())
        throw new Error(`SVG HASH MISMATCH (${calc} != ${expected})`);
      return calc;
    },
  };
}