import React, { useRef, useEffect } from "react";
import { CENTER, PHI, SPACE, lissajousPath } from "./constants";
import { PULSE_MS } from "../../utils/kai_pulse";

type Props = {
  uid: string;
  size: number;
  phaseColor: string;
  outerRingText: string;
  innerRingText: string;
  animate: boolean;
  prefersReduce: boolean;
};

const ZKGlyph: React.FC<Props> = ({
  uid, size, phaseColor, outerRingText, innerRingText,
  animate, prefersReduce,
}) => {
  const rOuter = SPACE * 0.34;
  const rInner = rOuter / PHI;
  const rPetal = rInner * 0.96;
  const petalScale = rPetal / (SPACE / 2);

  const phiRingId = `${uid}-zk-phi-ring`;
  const binRingId = `${uid}-zk-bin-ring`;
  const gradId = `${uid}-zk-grad`;
  const petalUseId = `${uid}-zk-petal-def`;

  const wPetal = Math.max(1.0, (size ?? 240) * 0.008);
  const wRing = Math.max(0.9, (size ?? 240) * 0.007);
  const wGlow = Math.max(1.2, (size ?? 240) * 0.009);
  const doAnim = animate && !prefersReduce;

  const petalDefRef = useRef<SVGPathElement | null>(null);

  useEffect(() => {
    if (!doAnim) return;
    const el = petalDefRef.current;
    if (!el) return;

    let raf = 0;
    const t0 = performance.now();

    const secPerPulse = PULSE_MS / 1000;
    const fA = (1 / secPerPulse) * (PHI * 0.21);
    const fB = (1 / secPerPulse) * ((PHI - 1) * 0.17);
    const fD = (1 / secPerPulse) * (Math.SQRT2 * 0.15);

    const a0 = 5, b0 = 8, aAmp = 1.6, bAmp = 1.2;
    const d0 = Math.PI / 2, dAmp = Math.PI / 3;

    const render = () => {
      const t = (performance.now() - t0) / 1000;
      const aDyn = a0 + aAmp * (0.5 + 0.5 * Math.sin(2 * Math.PI * fA * t));
      const bDyn = b0 + bAmp * (0.5 + 0.5 * Math.sin(2 * Math.PI * fB * t + 1.234));
      const deltaDyn = d0 + dAmp * Math.sin(2 * Math.PI * fD * t + 0.777);
      el.setAttribute("d", lissajousPath(aDyn, bDyn, deltaDyn));
      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [doAnim]);

  return (
    <g id={`${uid}-zk-glyph`} aria-label="Atlantean zero-knowledge verification glyph" pointerEvents="none">
      <defs>
        <radialGradient id={gradId} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor={phaseColor} stopOpacity="0.85">
            {doAnim && (
              <>
                <animate attributeName="stop-opacity" values=".55;.85;.55" dur={`${PULSE_MS}ms`} repeatCount="indefinite" />
                <animate attributeName="stop-color" values={`${phaseColor};#00FFD0;${phaseColor}`} dur={`${PULSE_MS * 3}ms`} repeatCount="indefinite" />
              </>
            )}
          </stop>
          <stop offset="55%" stopColor={phaseColor} stopOpacity="0.55">
            {doAnim && (
              <animate attributeName="stop-color" values={`${phaseColor};#00FFD0;${phaseColor}`} dur={`${PULSE_MS * 3}ms`} repeatCount="indefinite" />
            )}
          </stop>
          <stop offset="100%" stopColor="#00FFD0" stopOpacity="0.25">
            {doAnim && (
              <animate attributeName="stop-opacity" values=".15;.35;.15" dur={`${PULSE_MS}ms`} repeatCount="indefinite" />
            )}
          </stop>
        </radialGradient>

        <path
          id={phiRingId}
          d={`M ${CENTER} ${CENTER - rOuter} a ${rOuter} ${rOuter} 0 1 1 0 ${2 * rOuter} a ${rOuter} ${rOuter} 0 1 1 0 -${2 * rOuter}`}
          fill="none"
        />
        <path
          id={binRingId}
          d={`M ${CENTER} ${CENTER - rInner} a ${rInner} ${rInner} 0 1 1 0 ${2 * rInner} a ${rInner} ${rInner} 0 1 1 0 -${2 * rInner}`}
          fill="none"
        />

        <path id={petalUseId} ref={petalDefRef} d={lissajousPath(5, 8, Math.PI / 2)} />
      </defs>

      <circle cx={CENTER} cy={CENTER} r={rOuter} fill="none" stroke={`url(#${gradId})`} strokeWidth={wGlow} opacity="0.5" vectorEffect="non-scaling-stroke" />

      {Array.from({ length: 12 }, (_, i) => (
        <use
          key={i}
          href={`#${petalUseId}`}
          transform={`translate(${CENTER},${CENTER}) scale(${petalScale}) rotate(${i * 30}) translate(${-CENTER},${-CENTER})`}
          stroke={`url(#${gradId})`}
          strokeWidth={wPetal}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.42"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      ))}

      <g opacity="0.25">
        <circle cx={CENTER - rInner / 2.2} cy={CENTER} r={rInner * 0.86} fill="none" stroke={phaseColor} strokeWidth={wRing} />
        <circle cx={CENTER + rInner / 2.2} cy={CENTER} r={rInner * 0.86} fill="none" stroke="#00FFD0" strokeWidth={wRing} />
      </g>

      <circle cx={CENTER} cy={CENTER} r={rInner} fill="none" stroke={`url(#${gradId})`} strokeWidth={wRing} opacity="0.55" vectorEffect="non-scaling-stroke" />

      <text
        key={`outer-${outerRingText}`}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
        fontSize={Math.max(8, (size ?? 240) * 0.035)}
        fill={phaseColor}
        opacity="0.33"
        textAnchor="middle"
        dominantBaseline="middle"
        letterSpacing={Math.max(0.8, (size ?? 240) * 0.002)}
        pointerEvents="none"
      >
        <textPath href={`#${phiRingId}`} startOffset="50%">{outerRingText}</textPath>
      </text>

      <text
        fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
        fontSize={Math.max(7, (size ?? 240) * 0.03)}
        fill="#00FFD0"
        opacity="0.28"
        textAnchor="middle"
        dominantBaseline="middle"
        pointerEvents="none"
      >
        <textPath href={`#${binRingId}`} startOffset="50%">{innerRingText}</textPath>
      </text>
    </g>
  );
};

export default ZKGlyph;