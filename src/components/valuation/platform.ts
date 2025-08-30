// src/components/valuation/platform.ts
export const isBadWebView = (() => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    return /\bFBAN|FBAV|Instagram|Line|Twitter|TikTok|; wv\)|\bWebView\b/i.test(ua);
  })();
  
  export const supportsDialog =
    typeof window !== "undefined" &&
    typeof (window as Window & typeof globalThis).HTMLDialogElement !== "undefined" &&
    typeof (
      (window as Window & typeof globalThis).HTMLDialogElement.prototype.showModal
    ) === "function" &&
    !isBadWebView;
  