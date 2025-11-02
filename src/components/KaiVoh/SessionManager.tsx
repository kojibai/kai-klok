"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode, ReactElement } from "react";

export interface ConnectedAccounts {
  x?: string;
  ig?: string;
  tiktok?: string;
  threads?: string;
  [key: string]: string | undefined;
}

export interface PostEntry {
  pulse: number;
  platform: string;
  link: string;
}

export interface SessionData {
  phiKey: string;
  kaiSignature: string;
  pulse: number;
  chakraDay?: string;
  connectedAccounts: ConnectedAccounts;
  postLedger: PostEntry[];
}

interface SessionContextType {
  session: SessionData | null;
  setSession: (data: SessionData) => void;
  clearSession: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps): ReactElement {
  const [session, setSessionData] = useState<SessionData | null>(null);

  const setSession = (data: SessionData) => setSessionData(data);
  const clearSession = () => setSessionData(null);

  return (
    <SessionContext.Provider value={{ session, setSession, clearSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextType {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return ctx;
}

export { SessionContext };
