// src/components/valuation/globals.d.ts
export {};

declare global {
  interface Window {
    KaiSigil?: {
      renderToSVG?: (opts: {
        width: number;
        height: number;
        seed?: string;
        label?: string;
        donors?: Array<{ hash?: string; amount: number }>;
        palette?: string[];
      }) => string;
    };
    __SIGIL__?: { registerSigilUrl?: (url: string) => void };
  }
}
