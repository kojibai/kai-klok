// src/components/SigilChatRoom/utils/format.ts

/**
 * Truncate a string in the middle, preserving both start and end.
 * Safe for Unicode code points (won't cut surrogate pairs).
 *
 * @param input      The string to truncate.
 * @param maxChars   Maximum visible characters including ellipsis.
 * @param options    Optional fine-tuning: left/right segment sizes and ellipsis.
 * @returns          The truncated string (or original if shorter than maxChars).
 *
 * @example
 * truncateMiddle("0x1234abcd5678ef90", 8) // "0x12…f90"
 */
export function truncateMiddle(
    input: string,
    maxChars: number,
    options?: {
      /** Characters kept on the left side (overrides auto-split) */
      left?: number;
      /** Characters kept on the right side (overrides auto-split) */
      right?: number;
      /** Ellipsis string to use (default "…") */
      ellipsis?: string;
    }
  ): string {
    const ellipsis = options?.ellipsis ?? "…";
  
    // Normalize inputs
    const safeMax = Number.isFinite(maxChars) && maxChars > 0 ? Math.floor(maxChars) : 0;
    if (!input || safeMax === 0) return "";
  
    // Convert to code points to avoid splitting surrogate pairs
    const codepoints = Array.from(input);
    if (codepoints.length <= safeMax) return input;
  
    // If max is too small to fit both sides + ellipsis, show hard cut
    if (safeMax <= ellipsis.length + 1) {
      return codepoints.slice(0, safeMax).join("");
    }
  
    // Compute left/right sizes
    let left = options?.left;
    let right = options?.right;
  
    if (
      typeof left !== "number" ||
      !Number.isFinite(left) ||
      left < 1 ||
      typeof right !== "number" ||
      !Number.isFinite(right) ||
      right < 1 ||
      left + right + ellipsis.length > safeMax
    ) {
      // Auto split
      const remaining = safeMax - ellipsis.length;
      left = Math.max(1, Math.floor(remaining / 2));
      right = Math.max(1, remaining - left);
    }
  
    // Edge safety: if still overflowing for any reason, trim right
    if (left + right + ellipsis.length > safeMax) {
      right = Math.max(1, safeMax - ellipsis.length - left);
    }
  
    const start = codepoints.slice(0, left).join("");
    const end = codepoints.slice(codepoints.length - right).join("");
    return `${start}${ellipsis}${end}`;
  }
  