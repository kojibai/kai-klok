import { useEffect, useMemo, useRef, useState } from "react";
import { PULSE_MS, buildKaiKlockResponse } from "../../utils/kai_pulse";

export function useMediaPrefs() {
  const [prefersReduce, setPrefersReduce] = useState(false);
  const [prefersContrast, setPrefersContrast] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mContrast = window.matchMedia("(prefers-contrast: more)");
    const apply = () => {
      setPrefersReduce(Boolean(mReduce.matches));
      setPrefersContrast(Boolean(mContrast.matches));
    };
    apply();
    mReduce.addEventListener?.("change", apply);
    mContrast.addEventListener?.("change", apply);
    return () => {
      mReduce.removeEventListener?.("change", apply);
      mContrast.removeEventListener?.("change", apply);
    };
  }, []);
  return { prefersReduce, prefersContrast };
}

type KaiData = { [k: string]: unknown };
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

export function useKaiData(hashMode: "moment" | "deterministic") {
  const [kaiData, setKaiData] = useState<KaiData | null>(null);
  const kaiDataRef = useRef<KaiData | null>(null);
  useEffect(() => { kaiDataRef.current = kaiData; }, [kaiData]);

  useEffect(() => {
    if (hashMode !== "moment") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const j = await buildKaiKlockResponse();
        if (!cancelled && isRecord(j)) setKaiData(j);
      } catch {
        /* non-fatal */
      }
    };
    void tick();
    const id = window.setInterval(tick, PULSE_MS);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [hashMode]);

  return { kaiData, kaiDataRef };
}

export function useSeed(key: string) {
  const hashToUint32 = (s: string) => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  const seed = useMemo(() => hashToUint32(key), [key]);
  return seed;
}
