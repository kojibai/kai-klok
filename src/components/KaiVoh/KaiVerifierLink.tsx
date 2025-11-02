import QRCode from "react-qr-code";

interface KaiVerifierLinkProps {
  pulse: number;
  kaiSignature: string;
  phiKey: string;
}

export default function KaiVerifierLink({ pulse, kaiSignature, phiKey }: KaiVerifierLinkProps) {
  const shortSig = kaiSignature.slice(0, 10);
  const url = `https://kai.to/verify/${pulse}-${shortSig}`;

  return (
    <div className="flex flex-col items-center gap-4 p-6 text-center">
      <h2 className="text-lg font-semibold">🧿 Public Proof</h2>

      <QRCode value={url} size={180} bgColor="#ffffff00" fgColor="#ffffff" />

      <div className="mt-4">
        <p className="text-sm opacity-80">Pulse: <strong>{pulse}</strong></p>
        <p className="text-sm opacity-80">PhiKey: <strong>{phiKey}</strong></p>
        <p className="text-sm opacity-80">Verifier: <a href={url} className="underline" target="_blank" rel="noopener noreferrer">{url}</a></p>
      </div>
    </div>
  );
}
