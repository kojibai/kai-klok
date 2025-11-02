import QRCode from "react-qr-code";

interface VerifierFrameProps {
  pulse: number;
  kaiSignature: string;
  phiKey: string;
  caption?: string;
  chakraDay?: string;
  compact?: boolean;
}

export default function VerifierFrame({
  pulse,
  kaiSignature,
  phiKey,
  caption,
  chakraDay,
  compact = false,
}: VerifierFrameProps) {
  const shortSig = kaiSignature.slice(0, 10);
  const url = `https://kai.to/verify/${pulse}-${shortSig}`;

  return (
    <div
      className={`flex flex-col items-center text-center ${
        compact ? "gap-2 p-2" : "gap-4 p-6"
      }`}
    >
      <QRCode value={url} size={compact ? 100 : 180} bgColor="#ffffff00" fgColor="#ffffff" />

      <div className="text-sm space-y-1 opacity-80 mt-2">
        <div>🌀 Pulse: <strong>{pulse}</strong></div>
        <div>Sig: <strong>{shortSig}</strong></div>
        <div>PhiKey: <strong>{phiKey}</strong></div>
        {chakraDay && <div>🧬 Chakra Day: {chakraDay}</div>}
        {caption && <div className="italic text-xs mt-2">“{caption}”</div>}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline block mt-2 text-blue-300"
        >
          Open Verifier
        </a>
      </div>
    </div>
  );
}
