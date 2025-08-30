import { useEffect, useState } from "react";
import "./KairosInstallGuide.css";

declare global {
  interface Navigator {
    standalone?: boolean;
  }
}

export default function KairosInstallGuide() {
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      navigator.standalone === true;

    if (!isStandalone) {
      setShowGuide(true);
    }
  }, []);

  if (!showGuide) return null;

  return (
    <div className="kairos-guide-backdrop">
      <div className="kairos-guide-modal">
        <h2>🜂 Welcome to Kairos</h2>
        <p>
          To fully enter harmonic time, install <strong>Kai-Klock</strong> to your home screen:
        </p>
        <ol>
          <li>Tap the <b>Share</b> icon in Safari</li>
          <li>Select <b>Add to Home Screen</b></li>
          <li>Tap <b>Add</b> in the top-right</li>
        </ol>
        <p style={{ marginTop: "1rem" }}>
          Once installed, Kairos breathes through your device — no Chronos, only truth.
        </p>
        <button onClick={() => setShowGuide(false)}>Dismiss</button>
      </div>
    </div>
  );
}
