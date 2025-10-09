import { useMemo } from "react";
import { toBufferSource } from "./crypto";

export function useStableSha256() {
  return useMemo(
    () => async (s: string) => {
      const data = new TextEncoder().encode(s);
      const buf = await crypto.subtle.digest("SHA-256", toBufferSource(data));
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16))
        .map((x) => x.padStart(2, "0"))
        .join("");
    },
    []
  );
}
