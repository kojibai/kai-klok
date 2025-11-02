// src/components/KaiSigil/Defs.tsx
import React from "react";
import { CENTER, hsl } from "./constants";

type Props = {
  uid: string;
  hue: number;
  visualClamped: number;
  doAnim: boolean;
  quality: "low" | "med" | "high" | "ultra";
  dpr: number;
  seed: number;
  payloadHashHex?: string;
  auraPath: string;
};

const Defs: React.FC<Props> = ({
  uid,
  hue,
  visualClamped,
  doAnim,
  quality,
  dpr,
  seed,
  payloadHashHex,
  auraPath,
}) => {
  const haloId = `${uid}-halo`;
  const glowId = `${uid}-glow`;
  const bloomId = `${uid}-bloom`;
  const maskId = `${uid}-mask`;
  const netId = `${uid}-net`;
  const warpId = `${uid}-warp`;
  const auraId = `${uid}-aura`;

  return (
    <defs>
      <path id={auraId} d={auraPath} />

      <radialGradient id={haloId} cx="50%" cy="50%" r="50%">
        <stop
          offset="0%"
          stopColor={hsl(hue, 100, 50 + 15 * Math.sin(visualClamped * 2 * Math.PI))}
          stopOpacity=".55"
        >
          {doAnim && quality !== "low" && (
            <animate
              attributeName="stop-opacity"
              values=".35;.75;.35"
              dur={`var(--dur)`}
              begin={`var(--off)`}
              repeatCount="indefinite"
            />
          )}
        </stop>
        <stop offset="100%" stopColor="#000" stopOpacity="0" />
      </radialGradient>

      {quality !== "low" && dpr > 1 && (
        <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      )}

      {quality === "ultra" && (
        <filter id={bloomId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="u" />
          <feBlend in="SourceGraphic" in2="u" mode="screen" />
        </filter>
      )}

      <mask id={maskId}>
        <rect width="100%" height="100%" fill="white" />
      </mask>

      <pattern
        id={netId}
        patternUnits="userSpaceOnUse"
        width="160"
        height="160"
        patternTransform={`rotate(${(seed * 7) % 60} ${CENTER} ${CENTER})`}
      >
        <path
          d="M0 80 H160 M80 0 V160 M160 0 L0 160 M0 0 L160 160"
          stroke="#00FFD0"
          strokeOpacity=".06"
          strokeWidth="1"
        />
      </pattern>

      <filter id={warpId} x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.006"
          numOctaves="2"
          seed={(seed % 997) + 3}
          result="noise"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="noise"
          scale={
            0.35 +
            ((payloadHashHex ? parseInt(payloadHashHex.slice(-2), 16) : 0) % 12) *
              0.05
          }
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </defs>
  );
};

export default Defs;