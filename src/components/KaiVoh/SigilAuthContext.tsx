// src/components/KaiVoh/SigilAuthContext.tsx
"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/** Minimal meta SocialConnector needs (no app secrets, no Chronos). */
export type SigilAuthMeta = {
  pulse: number;
  beat: number;
  stepIndex: number;
  chakraDay: string;
  kaiSignature: string;
  userPhiKey?: string;
  /** Optional if embedded in your primary <metadata> */
  sigilId?: string;
  /** NEW: canonical action URL extracted from the SVG (e.g., https://.../s/...?...p=...) */
  sigilActionUrl?: string;
};

type SigilAuthState = {
  svgText: string | null;
  meta: SigilAuthMeta | null;
};

type SigilAuthCtx = {
  auth: SigilAuthState;
  setAuth: (svgText: string, meta: SigilAuthMeta) => void;
  clearAuth: () => void;
};

const SigilAuthContext = createContext<SigilAuthCtx | null>(null);

const LS_KEY = "kai.sigilAuth.v1";

export function SigilAuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuthState] = useState<SigilAuthState>({ svgText: null, meta: null });

  // Hydrate from localStorage (soft)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SigilAuthState | unknown;
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "meta" in parsed &&
        (parsed as SigilAuthState).meta &&
        typeof (parsed as SigilAuthState).meta === "object"
      ) {
        setAuthState(parsed as SigilAuthState);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setAuth = useCallback((svgText: string, meta: SigilAuthMeta) => {
    const next = { svgText, meta };
    setAuthState(next);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      /* storage may be blocked */
    }
  }, []);

  const clearAuth = useCallback(() => {
    setAuthState({ svgText: null, meta: null });
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ auth, setAuth, clearAuth }), [auth, setAuth, clearAuth]);

  return <SigilAuthContext.Provider value={value}>{children}</SigilAuthContext.Provider>;
}

export function useSigilAuth(): SigilAuthCtx {
  const ctx = useContext(SigilAuthContext);
  if (!ctx) throw new Error("useSigilAuth must be used inside <SigilAuthProvider>");
  return ctx;
}
