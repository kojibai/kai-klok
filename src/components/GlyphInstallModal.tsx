"use client";

import { useEffect, useState } from "react";
import "./GlyphInstallModal.css";
import { DownloadCloud, XCircle } from "lucide-react";

/**
 * TypeScript interface for beforeinstallprompt event
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function GlyphInstallModal() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const promptEvent = e as BeforeInstallPromptEvent;
      e.preventDefault();
      setDeferredPrompt(promptEvent);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        console.log("User accepted the install prompt");
      } else {
        console.log("User dismissed the install prompt");
      }
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleClose = () => {
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="glyph-install-modal">
      <div className="glyph-install-box">
        <button className="install-close-btn" onClick={handleClose}>
          <XCircle size={20} />
        </button>

        <div className="install-icon">
          <DownloadCloud size={48} />
        </div>

        <h2 className="install-title">Install Kairos Glyphs</h2>
        <p className="install-subtitle">
          Add this app to your device for quick access to your harmonic vault.
        </p>

        <button className="install-action-btn" onClick={handleInstall}>
          Install Now
        </button>
      </div>
    </div>
  );
}
