// src/components/valuation/hooks.ts
import { useEffect, useState } from "react";

export function useIsMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function useMedia(query: string) {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);

    type LegacyListener = (this: MediaQueryList, ev: MediaQueryListEvent) => void;
    const legacyListener: LegacyListener = function (ev) { onChange(ev); };

    if (typeof mql.addEventListener === "function") mql.addEventListener("change", onChange);
    else (mql as { addListener?: (l: LegacyListener) => void }).addListener?.(legacyListener);

    setMatches(mql.matches);
    return () => {
      if (typeof mql.removeEventListener === "function") mql.removeEventListener("change", onChange);
      else (mql as { removeListener?: (l: LegacyListener) => void }).removeListener?.(legacyListener);
    };
  }, [query]);

  return matches;
}

export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    const isNarrow =
      typeof window !== "undefined"
        ? window.matchMedia("(max-width: 560px)").matches
        : false;
    if (!isLocked || isNarrow) return;

    const { scrollY } = window;
    const original = {
      top: document.body.style.top,
      pos: document.body.style.position,
      w: document.body.style.width,
      o: document.documentElement.style.overflow,
    };
    document.documentElement.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.documentElement.style.overflow = original.o;
      document.body.style.position = original.pos;
      document.body.style.top = original.top;
      document.body.style.width = original.w;
      window.scrollTo(0, scrollY);
    };
  }, [isLocked]);
}

type AnyRef<T extends HTMLElement> =
  | React.RefObject<T | null>
  | React.MutableRefObject<T | null>;

export function useFocusTrap<T extends HTMLElement>(active: boolean, containerRef: AnyRef<T>) {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const FOCUSABLE =
      'a[href], button:not([disabled]), textarea, input, select, summary, [tabindex]:not([tabindex="-1"])';

    const firstFocus = () => {
      const el =
        container.querySelector<HTMLElement>(".close-btn") ||
        container.querySelector<HTMLElement>(".btn.primary") ||
        container.querySelector<HTMLElement>(FOCUSABLE);
      el?.focus();
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null || n === document.activeElement
      );
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault(); last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    };

    const prevActive = document.activeElement as HTMLElement | null;
    firstFocus();
    container.addEventListener("keydown", handleKeydown);
    return () => {
      container.removeEventListener("keydown", handleKeydown);
      prevActive?.focus?.();
    };
  }, [active, containerRef]);
}
