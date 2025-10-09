// src/session/SigilSession.tsx
import React, {
    createContext,
    useContext,
    useMemo,
    useState,
    useCallback,
  } from "react";
  import { unpackCapsuleParam, type CapsuleMeta } from "../utils/sigilCapsule";
  
  export type SigilSessionData = {
    appId: string;
    userGlyphUrl: string;
    userPhiKey: string;
    kaiSignature?: string;
    pulse: number;
    beat: number;
    stepIndex: number;
    expiresAtPulse?: number;
  };
  
  type CtxShape = {
    session: SigilSessionData | null;
    login: (url: string) => boolean;
    logout: () => void;
  };
  
  const Ctx = createContext<CtxShape>({
    session: null,
    login: () => false,
    logout: () => {},
  });
  
  export const useSigilSession = (): CtxShape => useContext(Ctx);
  
  function isFiniteNum(n: unknown): n is number {
    return typeof n === "number" && Number.isFinite(n);
  }
  
  export const SigilSessionProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
  }) => {
    const [session, setSession] = useState<SigilSessionData | null>(null);
  
    const login = useCallback(
      (url: string): boolean => {
        try {
          const u = new URL(
            url,
            typeof window !== "undefined"
              ? window.location.origin
              : "https://example.org"
          );
          const parts = u.pathname.split("/").filter(Boolean);
          if (parts[0] !== "s" || parts.length < 2) return false;
          const appId = parts[1];
  
          const p = u.searchParams.get("p");
          const meta: CapsuleMeta | null = unpackCapsuleParam(p);
          if (!meta) return false;
  
          const {
            userPhiKey,
            kaiSignature,
            pulse,
            beat,
            stepIndex,
            expiresAtPulse,
            canonicalHash,
          } = meta;
  
          if (!userPhiKey || !kaiSignature) return false;
          if (!isFiniteNum(pulse) || !isFiniteNum(beat) || !isFiniteNum(stepIndex))
            return false;
          if (typeof canonicalHash === "string" && canonicalHash !== appId)
            return false;
  
          setSession({
            appId,
            userGlyphUrl: url,
            userPhiKey,
            kaiSignature,
            pulse,
            beat,
            stepIndex,
            expiresAtPulse,
          });
          return true;
        } catch (e) {
          // Fail closed without throwing; keep this non-fatal and typed.
          // eslint-disable-next-line no-console
          console.warn(
            "Sigil login failed:",
            e instanceof Error ? e.message : String(e)
          );
          return false;
        }
      },
      [setSession]
    );
  
    const logout = useCallback((): void => {
      setSession(null);
    }, [setSession]);
  
    const value = useMemo<CtxShape>(
      () => ({ session, login, logout }),
      [session, login, logout]
    );
  
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
  };
  