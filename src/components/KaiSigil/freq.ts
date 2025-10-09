import { CHAKRA_BASE_FREQ } from "./constants";
import type { ChakraDayKey } from "./types";
import { PHI } from "./constants";
import { STEPS_SAFE } from "./step";

export const deriveFrequencyHzSafe = (c: ChakraDayKey, si: number) =>
  +(
    CHAKRA_BASE_FREQ[c] *
    Math.pow(PHI, (Number.isFinite(si) ? si : 0) / STEPS_SAFE)
  ).toFixed(3);
