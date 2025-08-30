import React, { useCallback, useState } from "react";

type BusyActionButtonProps = {
  onPress: () => void | Promise<void>;
  className?: string;            // e.g., "btn-secondary"
  disabled?: boolean;
  children: React.ReactNode;     // your existing inner markup
  "aria-label"?: string;
};

const BusyActionButton: React.FC<BusyActionButtonProps> = ({
  onPress,
  className,
  disabled = false,
  children,
  "aria-label": ariaLabel,
}) => {
  const [busy, setBusy] = useState(false);

  const handle = useCallback(async () => {
    if (disabled || busy) return;
    try {
      setBusy(true);
      await onPress();
    } finally {
      setBusy(false);
    }
  }, [onPress, disabled, busy]);

  return (
    <button
      type="button"
      className={className}
      onClick={handle}
      onPointerUp={handle}
      onTouchEnd={handle}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      data-busy={busy || undefined}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
};

export default BusyActionButton;
