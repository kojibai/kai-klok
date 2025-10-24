// src/components/exhale-note/hash.ts
// small deterministic codes (FNV-1a)

/**
 * FNV-1a 32-bit hash of a string, returned as 8-char uppercase hex.
 * Stable across sessions and platforms (within JS string semantics).
 */
export function fnvHex8(s: string): string {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      // h *= 16777619 (with overflow), expanded to avoid bigint
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return (`00000000${h.toString(16)}`).slice(-8).toUpperCase();
  }
  
  /**
   * Deterministic fallback text for specific note fields.
   * Uses FNV-1a over a namespaced label + anchors key, then slices.
   */
  export function fallbackCode(label: string, anchors: string): string {
    const H = fnvHex8(`kk:${label}:${anchors}`);
    switch (label) {
      case "Purpose":
        return H.slice(0, 8);
      case "To":
        return H.slice(0, 10);
      case "From":
        return H.slice(0, 10);
      case "Location":
        return H.slice(0, 8);
      case "Witnesses":
        return H.slice(0, 8);
      case "Reference":
        return H.slice(0, 12);
      default:
        return H;
    }
  }
  