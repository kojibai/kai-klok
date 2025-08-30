// solarSync.ts — broadcast + listen for sunrise offset changes (seconds, UTC-based)

export const SUNRISE_OFFSET_KEY = "sovereign.sunriseOffsetSec";

type SolarOffsetEvent = { offsetSec: number };

// Fallback for environments where localStorage isn't available (e.g., Safari private mode)
let memorySunriseOffset: number | null = null;

export function publishSunriseOffset(offsetSec: number) {
  try {
    localStorage.setItem(SUNRISE_OFFSET_KEY, String(offsetSec));
  } catch {
    // Storage unavailable — keep a memory fallback so reads still work
    memorySunriseOffset = offsetSec;
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<SolarOffsetEvent>("solar:offset-changed", { detail: { offsetSec } })
    );
  }
}

export function subscribeSunriseOffset(cb: (offsetSec: number) => void) {
  const onCustom = (e: Event) => {
    const ce = e as CustomEvent<SolarOffsetEvent>;
    const v = ce.detail?.offsetSec;
    if (typeof v === "number" && Number.isFinite(v)) cb(v);
  };

  const onStorage = (e: StorageEvent) => {
    if (e.key === SUNRISE_OFFSET_KEY && e.newValue != null) {
      const n = Number(e.newValue);
      if (Number.isFinite(n)) cb(n);
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("solar:offset-changed", onCustom as EventListener);
    window.addEventListener("storage", onStorage);
  }

  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener("solar:offset-changed", onCustom as EventListener);
      window.removeEventListener("storage", onStorage);
    }
  };
}

export function getStoredSunriseOffset(): number | null {
  try {
    const v = localStorage.getItem(SUNRISE_OFFSET_KEY);
    if (v == null) return memorySunriseOffset;
    const n = Number(v);
    return Number.isFinite(n) ? n : memorySunriseOffset;
  } catch {
    // localStorage may throw (disabled/private mode)
    return memorySunriseOffset;
  }
}
