// src/components/exhale-note/format.ts
/**
 * Tiny, robust formatters for UI display.
 * - All functions are null/NaN safe (return "—" when not a finite number)
 * - Trim trailing zeros while keeping reasonable precision
 */

/** Internal: is the value a finite number? */
const isFiniteNum = (n: unknown): n is number =>
    typeof n === "number" && Number.isFinite(n);
  
  /** Internal: strip trailing zeros and any trailing decimal point */
  const stripZeros = (s: string): string =>
    s.replace(/(?:\.0+|(\.\d*?[1-9]))0+$/u, "$1").replace(/\.$/u, "");
  
  /**
   * Format a number with up to 6 decimals and append the Φ unit.
   * Examples:
   *   1.234000 -> "1.234 Φ"
   *   0        -> "0 Φ"
   *   NaN      -> "— Φ"
   */
  export const fPhi = (x: number): string => {
    if (!isFiniteNum(x)) return "— Φ";
    return `${stripZeros(x.toFixed(6))} Φ`;
  };
  
  /**
   * Format a USD amount.
   * - For |x| >= 1000, use locale groupings with up to 2 decimals (no currency style to keep the plain "$")
   * - Otherwise, fixed 2 decimals.
   * - Negative values display as "-$1,234.56"
   * - NaN/invalid => "—"
   */
  export const fUsd = (x: number): string => {
    if (!isFiniteNum(x)) return "—";
    const neg = x < 0;
    const abs = Math.abs(x);
    const body =
      abs >= 1000
        ? abs.toLocaleString(undefined, { maximumFractionDigits: 2 })
        : abs.toFixed(2);
    return `${neg ? "-" : ""}$${body}`;
  };
  
  /**
   * Tiny numeric formatter with up to 6 decimals, no unit.
   * Examples:
   *   3.140000 -> "3.14"
   *   2.000001 -> "2.000001"
   *   NaN      -> "—"
   */
  export const fTiny = (x: number): string => {
    if (!isFiniteNum(x)) return "—";
    return stripZeros(x.toFixed(6));
  };
  