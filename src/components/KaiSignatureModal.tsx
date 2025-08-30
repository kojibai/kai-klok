import { useState } from "react";
import { blake2bHex } from "blakejs";

export default function KaiSignatureModal({
  onComplete,
}: {
  onComplete: (kaiSignature: string) => void;
}) {
  const [kaiSig, setKaiSig] = useState<string | null>(null);

  const handleThumbprint = async () => {
    const cred = await navigator.credentials.get({
      publicKey: {
        challenge: new Uint8Array(32),
        allowCredentials: [],
        timeout: 60000,
        userVerification: "required",
      },
    });

    const raw = JSON.stringify(cred);
    const hash = blake2bHex(raw);
    setKaiSig(hash);
    onComplete(hash);
  };

  return (
    <div className="kai-modal">
      <h2>🧬 Authenticate With Light</h2>
      <p>Touch your fingerprint or scan your face to align your Kai Signature.</p>
      <button onClick={handleThumbprint}>Begin</button>
      {kaiSig && (
        <div>
          <p>Your Kai Signature:</p>
          <code>{kaiSig.slice(0, 16)}…</code>
        </div>
      )}
    </div>
  );
}
