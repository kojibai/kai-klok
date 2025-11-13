// src/pages/sigilstream/data/toast/Toasts.tsx
// Lightweight, mobile-safe toast system.
// Public API:
//   export function useToasts(): { push(kind, text) }
//   export function ToastsProvider({ children }): React.JSX.Element

import React, {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";

export type ToastKind = "success" | "info" | "warn" | "error";
export type Toast = { id: number; kind: ToastKind; text: string };
export type ToastApi = { push: (kind: ToastKind, text: string) => void };

const MAX_TOASTS = 3;
const TTL_MS = 2600;

const ToastCtx = createContext<ToastApi | null>(null);

/** Hook to publish toasts anywhere under the provider. */
export function useToasts(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    throw new Error("useToasts() must be used within <ToastsProvider/>");
  }
  return ctx;
}

/** Provider + on-page, sticky-bottom toasts (avoid fixed overlays near inputs). */
export function ToastsProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [items, setItems] = useState<Toast[]>([]);
  const timersRef = useRef<Map<number, number>>(new Map());

  const remove = (id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const handle = timersRef.current.get(id);
    if (typeof handle === "number") {
      window.clearTimeout(handle);
      timersRef.current.delete(id);
    }
  };

  const api = useMemo<ToastApi>(
    () => ({
      push: (kind: ToastKind, text: string) => {
        const id = Math.floor(Math.random() * 1_000_000_000);
        setItems((prev) => [{ id, kind, text }, ...prev].slice(0, MAX_TOASTS));
        const handle = window.setTimeout(() => remove(id), TTL_MS);
        timersRef.current.set(id, handle);
      },
    }),
    [],
  );

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      for (const h of timersRef.current.values()) {
        window.clearTimeout(h);
      }
      timersRef.current.clear();
    };
  }, []);

  const bgFor = (kind: ToastKind): string => {
    switch (kind) {
      case "success":
        return "rgba(16,28,22,.88)";
      case "warn":
        return "rgba(28,24,12,.88)";
      case "error":
        return "rgba(36,16,16,.88)";
      case "info":
      default:
        return "rgba(12,18,28,.88)";
    }
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      {/* Sticky footer so it won't fight the iOS keyboard; not position:fixed */}
      <div
        aria-live="polite"
        aria-atomic="false"
        style={{
          position: "sticky",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "8px 12px",
          display: "grid",
          gap: 8,
          zIndex: 2,
          pointerEvents: "none",
        }}
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            style={{
              pointerEvents: "auto",
              marginInline: "auto",
              maxWidth: "min(720px, 100%)",
              width: "100%",
              background: bgFor(t.kind),
              border: "1px solid rgba(255,255,255,.12)",
              borderRadius: 12,
              padding: "10px 12px",
              color: "rgb(236,241,251)",
              boxShadow: "0 8px 28px rgba(0,0,0,.35)",
              backdropFilter: "blur(6px)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
