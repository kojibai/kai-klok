// src/components/exhale-note/sanitize.ts
// text & SVG sanitization helpers

export const esc = (t?: string): string =>
    String(t ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  
  export const trunc = (s: string | undefined, n: number): string => {
    if (!s) return "—";
    return s.length <= n ? s : s.slice(0, n - 2) + "…";
  };
  
  export function sanitizeSvg(svgText: string): string {
    let s = (svgText || "").toString();
  
    // strip <script>...</script>
    const reScriptBlock = new RegExp("<" + "script[\\s\\S]*?>" + "[\\s\\S]*?" + "<" + "/script>", "gi");
    s = s.replace(reScriptBlock, "");
  
    // strip inline handlers
    s = s.replace(/\son[a-z]+\s*=\s*"(?:[^"]*)"/gi, "");
    s = s.replace(/\son[a-z]+\s*=\s*'(?:[^']*)'/gi, "");
  
    // ensure xmlns + viewBox
    if (!/xmlns=/.test(s)) s = s.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    if (!/viewBox=/.test(s)) {
      const mW = s.match(/\bwidth\s*=\s*"(\d+(\.\d+)?)"/i);
      const mH = s.match(/\bheight\s*=\s*"(\d+(\.\d+)?)"/i);
      const w = mW ? parseFloat(mW[1]) : 1024;
      const h = mH ? parseFloat(mH[1]) : 1024;
      s = s.replace(/<svg([^>]*)>/i, `<svg$1 viewBox="0 0 ${w} ${h}">`);
    }
  
    // drop width/height so we can embed responsively
    s = s.replace(/\bwidth\s*=\s*"(?:[^"]*)"/gi, "");
    s = s.replace(/\bheight\s*=\s*"(?:[^"]*)"/gi, "");
  
    return s;
  }
  
  export function ensureSvgBackground(svgText: string, color: string): string {
    const m = svgText.match(/<svg\b[^>]*>/i);
    if (!m) return svgText;
    const open = m[0];
    if (!/data-injected-bg="true"/.test(svgText)) {
      return svgText.replace(
        open,
        open + `<rect width="100%" height="100%" fill="${color}" data-injected-bg="true"/>`
      );
    }
    return svgText;
  }
  