// /components/KaiVoh/SocialConnector.tsx
"use client";

import { useSession } from "./SessionManager";
import type { ReactNode } from "react";

type SocialPlatform = "x" | "ig" | "tiktok" | "threads";

interface SocialService {
  key: SocialPlatform;
  name: string;
  icon: ReactNode;
  oauthUrl: string;
}

const SERVICES: SocialService[] = [
  {
    key: "x",
    name: "X / Twitter",
    icon: <span className="text-2xl">🧵</span>,
    oauthUrl: "/oauth/x", // TODO: replace with real endpoint
  },
  {
    key: "ig",
    name: "Instagram",
    icon: <span className="text-2xl">📸</span>,
    oauthUrl: "/oauth/ig",
  },
  {
    key: "tiktok",
    name: "TikTok",
    icon: <span className="text-2xl">🎵</span>,
    oauthUrl: "/oauth/tiktok",
  },
  {
    key: "threads",
    name: "Threads",
    icon: <span className="text-2xl">🧶</span>,
    oauthUrl: "/oauth/threads",
  },
];

export default function SocialConnector() {
  const { session, setSession } = useSession();

  const handleConnect = async (service: SocialService): Promise<void> => {
    // Open provider auth window
    const popup: Window | null = window.open(
      service.oauthUrl,
      "_blank",
      "width=500,height=600"
    );
    if (!popup) return;

    // Poll for demo purposes; in prod use postMessage or backend callback
    let attempts = 0;
    const MAX_ATTEMPTS = 120; // ~2 minutes
    const poll: number = window.setInterval(() => {
      // Stop if closed or timed out
      if (!popup || popup.closed || attempts++ > MAX_ATTEMPTS) {
        window.clearInterval(poll);
        return;
      }

      // Example read — replace with a secure message flow
      // (e.g., window.addEventListener('message', ...) from the OAuth redirect page)
      try {
        const returnedHandle = localStorage.getItem(`oauth-${service.key}-handle`);
        if (returnedHandle && session) {
          window.clearInterval(poll);

          setSession({
            ...session,
            connectedAccounts: {
              ...session.connectedAccounts,
              [service.key]: returnedHandle,
            },
          });

          localStorage.removeItem(`oauth-${service.key}-handle`);
          popup.close();
        }
      } catch {
        // Intentionally ignore (cross-origin read until the flow completes)
      }
    }, 1000);
  };

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <h2 className="text-lg opacity-70">Connect your socials</h2>
      <div className="grid grid-cols-2 gap-6">
        {SERVICES.map((service) => {
          const isConnected = Boolean(session?.connectedAccounts?.[service.key]);
          const label = session?.connectedAccounts?.[service.key] ?? "Not connected";

          return (
            <button
              key={service.key}
              type="button"
              className={`w-28 h-28 rounded-full border flex flex-col items-center justify-center transition ${
                isConnected
                  ? "bg-green-500/20 border-green-500 hover:scale-105"
                  : "bg-white/10 border-white hover:scale-105"
              }`}
              onClick={() => handleConnect(service)}
              aria-label={`Connect ${service.name}`}
            >
              {service.icon}
              <span className="text-xs mt-2 opacity-80">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
