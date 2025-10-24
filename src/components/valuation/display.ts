// src/components/valuation/display.ts

/** Guard */
const isFiniteNumber = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n);

/* ------------------------------------------------------------------
   Safe, lazy USD formatter cache (prevents module-load crashes on
   older mobile WebViews that lack Intl / currency support)
-------------------------------------------------------------------*/
const usdFmtCache = new Map<number, Intl.NumberFormat | null>();

function getUsdFormatter(dp = 2): Intl.NumberFormat | null {
  if (usdFmtCache.has(dp)) return usdFmtCache.get(dp)!;
  try {
    if (typeof Intl !== "undefined" && typeof Intl.NumberFormat === "function") {
      const fmt = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: dp,
        maximumFractionDigits: dp,
      });
      // Some engines error only on first format — probe once.
      void fmt.format(0);
      usdFmtCache.set(dp, fmt);
      return fmt;
    }
  } catch {
    // fall through to manual formatter
  }
  usdFmtCache.set(dp, null);
  return null;
}

function formatUsdManual(n: number, dp: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const s = abs.toFixed(Math.max(0, dp));
  const [i, f] = s.split(".");
  const withCommas = i.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}$${withCommas}${dp > 0 ? "." + f : ""}`;
}

/** USD formatter for the *one* place you want a $ value (mobile-safe) */
export function usd(n: number, dp: number = 2): string {
  if (!isFiniteNumber(n)) return dp === 0 ? "$0" : "$0.00";
  const fmt = getUsdFormatter(dp);
  return fmt ? fmt.format(n) : formatUsdManual(n, dp);
}

/** Φ formatter — unchanged default used everywhere else */
export function currency(n: number, dp: number = 6): string {
  const v = isFiniteNumber(n) ? n : 0;
  return `Φ ${v.toFixed(Math.max(0, dp))}`;
}

/** Alias if you want to call it explicitly */
export const currencyPhi = currency;

/** Percent from fraction (e.g., 0.1234 -> "12.340%"). */
export const fmtPct = (n?: number | null, digits = 3): string =>
  typeof n === "number" && Number.isFinite(n)
    ? `${(n * 100).toFixed(digits)}%`
    : "—";

/** Fixed decimals with guard. */
export const fmt = (n?: number | null, digits = 3): string =>
  typeof n === "number" && Number.isFinite(n) ? n.toFixed(digits) : "—";

/** Signed percent from fraction (adds +/−). */
export const pctSigned = (x: number, d = 2): string =>
  `${isFiniteNumber(x) && x >= 0 ? "+" : ""}${(x * 100).toFixed(d)}%`;

/** For values already expressed in percent (12.34 -> "+12.34%"). */
export const pct = (n: number, digits = 2): string =>
  `${isFiniteNumber(n) && n >= 0 ? "+" : ""}${(isFiniteNumber(n) ? n : 0).toFixed(digits)}%`;
