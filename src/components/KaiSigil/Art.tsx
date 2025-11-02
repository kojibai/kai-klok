import React from "react";
import { CENTER, FONT_STACK, SPACE, TEAL } from "./constants";

type Props = {
  uid: string;
  size: number;
  baseColor: string;
  corePath: string;
  auraId: string;
  sigPathId?: string;
  doAnim: boolean;
  quality: "low" | "med" | "high" | "ultra";
  dpr: number;
  pad: number;
  safeTextWidth: number;
  outlineWidth: number;
  strokeCore: number;
  dotR: number;
  debugOutline: boolean;
  prefersContrast: boolean;
  haloId: string;
  netId: string;
  warpId: string;
  glowId: string;
  maskId: string;
  rotation: number;
  chakraSides: number;
  binaryForRender: string;
  summary: string;
  pulse: number;
};

const Art: React.FC<Props> = ({
  uid,
  size,
  baseColor,
  corePath,
  auraId,
  sigPathId,
  doAnim,
  quality,
  dpr,
  pad,
  safeTextWidth,
  outlineWidth,
  strokeCore,
  dotR,
  debugOutline,
  prefersContrast,
  haloId,
  netId,
  warpId,
  glowId,
  maskId,
  rotation,
  chakraSides,
  binaryForRender,
  summary,
  pulse,
}) => {
  return (
    <g id={`${uid}-art`} filter={`url(#${warpId})`}>
      <rect width={SPACE} height={SPACE} fill={`url(#${haloId})`} aria-hidden="true" pointerEvents="none" />
      <rect x="0" y="0" width={SPACE} height={SPACE} fill={`url(#${netId})`} pointerEvents="none" />

      <path
        d={corePath}
        fill="none"
        stroke={baseColor}
        strokeWidth={strokeCore}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
        mask={`url(#${maskId})`}
        filter={quality !== "low" && dpr > 1 ? `url(#${glowId})` : undefined}
        style={{ strokeDasharray: debugOutline || prefersContrast ? "4 4" : undefined }}
        aria-hidden="true"
        pointerEvents="none"
      />

      {(debugOutline || prefersContrast) && (
        <path
          d={corePath}
          fill="none"
          stroke={TEAL}
          strokeWidth={Math.max(1, strokeCore * 0.45)}
          vectorEffect="non-scaling-stroke"
          opacity={0.6}
          aria-hidden={true}
          pointerEvents="none"
        />
      )}

      {quality !== "low" &&
        Array.from({ length: chakraSides }, (_: unknown, i: number) => {
          const θ = (i / chakraSides) * 2 * Math.PI + rotation;
          const r = SPACE * 0.38;
          const x = CENTER + r * Math.cos(θ);
          const y = CENTER + r * Math.sin(θ);
          return <circle key={i} cx={x} cy={y} r={dotR} fill={baseColor} aria-hidden="true" pointerEvents="none" />;
        })}

      {doAnim && (
        <>
          <use
            href={`#${auraId}`}
            stroke={TEAL}
            strokeWidth={Math.max(2, strokeCore * 1.05)}
            fill="none"
            opacity=".2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            aria-hidden="true"
            pointerEvents="none"
          >
            <animate attributeName="stroke-opacity" values=".2;.6;.2" dur={`var(--dur)`} begin={`var(--off)`} repeatCount="indefinite" />
          </use>
          <use
            href={`#${auraId}`}
            stroke={baseColor}
            strokeWidth={Math.max(1.2, strokeCore * 0.8)}
            fill="none"
            opacity=".4"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            aria-hidden="true"
            pointerEvents="none"
          >
            <animate attributeName="stroke-opacity" values=".4;.9;.4" dur={`var(--dur)`} begin={`var(--off)`} repeatCount="indefinite" />
          </use>
        </>
      )}

      <circle cx={CENTER} cy={CENTER} r={Math.max(3, dotR)} fill={TEAL} aria-hidden="true" pointerEvents="none">
        {doAnim && (
          <animateTransform attributeName="transform" type="scale" values="1;1.5;1" dur={`var(--dur)`} begin={`var(--off)`} repeatCount="indefinite" />
        )}
      </circle>

      {quality !== "low" && sigPathId && binaryForRender && (
        <g id="signature">
          <text
            fontFamily={FONT_STACK}
            fontSize={Math.max(4, size * 0.028)}
            fill={baseColor}
            letterSpacing="1.2"
            textAnchor="middle"
            dominantBaseline="middle"
            opacity=".7"
            pointerEvents="none"
          >
            <textPath href={`#${sigPathId}`} startOffset="50%">
              {binaryForRender}
            </textPath>
          </text>
        </g>
      )}

      <g id="signature-hint" aria-hidden="true" pointerEvents="none">
        <text
          x={pad}
          y={size - 6}
          fontFamily={FONT_STACK}
          fontSize={Math.max(4, size * 0.025)}
          fill={baseColor}
          opacity=".12"
          textAnchor="start"
          lengthAdjust="spacingAndGlyphs"
          textLength={safeTextWidth}
          style={{
            paintOrder: "stroke",
            stroke: "#000",
            strokeWidth: outlineWidth,
            fontVariantNumeric: "tabular-nums",
            fontFeatureSettings: "'tnum' 1",
          }}
        >
          {summary}
        </text>

        <text
          x={size - pad}
          y={size - pad}
          fontFamily={FONT_STACK}
          fontSize={size * 0.25}
          fill={baseColor}
          opacity="0.04"
          textAnchor="end"
          dominantBaseline="ideographic"
          lengthAdjust="spacingAndGlyphs"
          textLength={safeTextWidth}
          vectorEffect="non-scaling-stroke"
          style={{
            paintOrder: "stroke",
            stroke: "#000",
            strokeWidth: outlineWidth,
            fontVariantNumeric: "tabular-nums",
            fontFeatureSettings: "'tnum' 1",
          }}
        >
          {typeof (pulse as number) === "number" ? pulse.toLocaleString?.() ?? String(pulse) : String(pulse)}
        </text>
      </g>
    </g>
  );
};

export default Art;