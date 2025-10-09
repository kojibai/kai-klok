import * as React from "react";

export function useResponsiveSigilSize(frameRef: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = React.useState(320);

  React.useEffect(() => {
    let raf = 0;
    const compute = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const verticalReserve =
          vw < 640 ? Math.max(220, Math.min(360, vh * 0.48)) : Math.max(160, Math.min(320, vh * 0.35));
        const maxByViewport = Math.max(160, Math.min(640, Math.min(vw, vh - verticalReserve)));
        const frameW = frameRef.current?.clientWidth ?? vw;
        const maxByFrame = Math.max(160, Math.min(640, frameW - 24));
        setSize(Math.round(Math.min(maxByViewport, maxByFrame)));
      });
    };
    const node = frameRef.current ?? document.body;
    const ro = new ResizeObserver(() => compute());
    ro.observe(node);
    window.addEventListener("resize", compute, { passive: true });
    compute();
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
      cancelAnimationFrame(raf);
    };
  }, [frameRef]);

  return size;
}
