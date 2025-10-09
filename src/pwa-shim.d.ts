// src/pwa-shim.d.ts
export type BIPEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  };
  
  declare global {
    interface Window {
      __bipEvent?: BIPEvent | null;
      __bipWaiters?: Array<(e: BIPEvent) => void>;
    }
  }
  
  export {};
  