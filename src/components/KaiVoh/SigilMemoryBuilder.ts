import type { SessionData } from "./SessionManager";

export function buildNextSigilSvg(session: SessionData): string {
  const { pulse, kaiSignature, phiKey, connectedAccounts, postLedger, chakraDay } = {
    ...session,
    phiKey: session.phiKey || "φK-" + session.kaiSignature.slice(0, 8),
  };

  const meta = {
    pulse,
    kaiSignature,
    phiKey,
    chakraDay,
    connectedAccounts,
    postLedger,
    logoutSigil: true,
    createdAt: new Date().toISOString(),
  };

  // Basic Kai-stamped sigil SVG (visual can be replaced with KaiSigil engine)
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
  <rect width="100%" height="100%" fill="black"/>
  <circle cx="500" cy="500" r="300" fill="none" stroke="white" stroke-width="8"/>
  <text x="50%" y="50%" font-size="48" fill="white" text-anchor="middle" dy=".3em">${phiKey}</text>
  <metadata><![CDATA[
${JSON.stringify(meta, null, 2)}
  ]]></metadata>
</svg>`.trim();
}

export function downloadSigil(filename: string, svgContent: string): void {
  const blob = new Blob([svgContent], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}
