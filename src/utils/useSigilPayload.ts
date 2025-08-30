// src/utils/useSigilPayload.ts

/**
 * v46 — useSigilPayload.ts
 * -----------------------------------------------------------------------------
 * Purpose
 * -------
 * Small hook that lifts the "load payload from ?p=" concern out of the page.
 * It does not attempt to validate history, debits, or ownership — those concerns
 * live elsewhere. This hook gives you:
 *   - payload: SigilPayload | null
 *   - loading: boolean
 *   - verified: "checking" | "ok" | "notfound" | "error"
 *   - error: string | null
 *   - setPayload: React.Dispatch<React.SetStateAction<SigilPayload | null>>
 *   - setLoading: React.Dispatch<React.SetStateAction<boolean>>
 *
 * Behavior
 * --------
 * - On mount or whenever `search` changes, tries to decode ?p=.
 * - If present and valid => { payload, verified: "ok" }.
 * - If missing => verified: routeHash ? "notfound" : "checking".
 * - If invalid => verified: "error" with message.
 *
 * Integration
 * -----------
 *   const { payload, loading, verified, error, setPayload, setLoading } =
 *     useSigilPayload(location.search, routeHash);
 * -----------------------------------------------------------------------------
 */

import { useEffect, useState } from "react";
import type { SigilPayload } from "../types/sigil";
import { decodePayloadFromQuery } from "./payload";

type VerifyState = "checking" | "ok" | "notfound" | "error";

type UseSigilPayload = {
  payload: SigilPayload | null;
  loading: boolean;
  verified: VerifyState;
  error: string | null;
  setPayload: React.Dispatch<React.SetStateAction<SigilPayload | null>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
};

export function useSigilPayload(
  search: string,
  routeHash: string | null = null
): UseSigilPayload {
  const [payload, setPayload] = useState<SigilPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [verified, setVerified] = useState<VerifyState>("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setVerified("checking");
    setError(null);

    try {
      const decoded = decodePayloadFromQuery(search);
      if (decoded) {
        if (!cancelled) {
          setPayload(decoded as unknown as SigilPayload);
          setVerified("ok");
          setLoading(false);
        }
        return;
      }
      if (!cancelled) {
        setPayload(null);
        setVerified(routeHash ? "notfound" : "checking");
        setLoading(false);
      }
    } catch (e) {
      if (!cancelled) {
        setPayload(null);
        setVerified("error");
        setError(e instanceof Error ? e.message : "Failed to decode payload");
        setLoading(false);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [search, routeHash]);

  return { payload, loading, verified, error, setPayload, setLoading };
}
