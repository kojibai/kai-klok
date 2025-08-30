// src/hooks/useFastPress.ts
import { useCallback, useRef } from "react";

export function useFastPress<T extends HTMLElement>(
  handler: (e: React.PointerEvent<T> | React.MouseEvent<T>) => void
) {
  const touchedRef = useRef(false);

  const onPointerUp = useCallback(
    (e: React.PointerEvent<T>) => {
      if ((e as React.PointerEvent<T>).pointerType && e.pointerType !== "mouse") {
        touchedRef.current = true;
        handler(e);
        setTimeout(() => {
          touchedRef.current = false;
        }, 0);
      }
    },
    [handler]
  );

  const onClick = useCallback(
    (e: React.MouseEvent<T>) => {
      if (touchedRef.current) {
        touchedRef.current = false;
        return;
      }
      handler(e);
    },
    [handler]
  );

  return { onPointerUp, onClick };
}
