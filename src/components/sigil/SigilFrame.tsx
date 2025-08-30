// src/components/sigil/SigilFrame.tsx
import React from "react";

type Props = React.PropsWithChildren<{
  frameRef: React.RefObject<HTMLDivElement>;
}>;

export default function SigilFrame({ frameRef, children }: Props) {
  return (
    <div ref={frameRef} className="sp-frame" id="sigil-stage">
      {children}
      {/* Clean viewer: UI runes (do not export) */}
      <div className="sp-rune sp-rune--tl" aria-hidden="true" />
      <div className="sp-rune sp-rune--tr" aria-hidden="true" />
      <div className="sp-rune sp-rune--bl" aria-hidden="true" />
      <div className="sp-rune sp-rune--br" aria-hidden="true" />
    </div>
  );
}
