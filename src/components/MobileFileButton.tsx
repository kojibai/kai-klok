import React, { useCallback, useRef, useState } from "react";

/**
 * MobileFileButtonV2
 * • One-tap reliable file picker on iOS/Android.
 * • Overlay <input type="file"> is FULL-SIZE and visible-to-OS (opacity ≠ 0).
 * • We also trigger showPicker()/click() inside the same user gesture for skins that need it.
 */
export type MobileFileButtonV2Props = {
  id: string;
  onFile: (file: File) => void | Promise<void>;
  label: React.ReactNode;           // visual face (keeps your current look)
  className?: string;               // e.g., "btn-primary btn-primary--xl file-cta"
  accept?: string;                  // e.g., "image/svg+xml,.svg"
  multiple?: boolean;               // default false
  disabled?: boolean;
  "aria-label"?: string;
};

const MobileFileButton: React.FC<MobileFileButtonV2Props> = ({
  id,
  onFile,
  label,
  className,
  accept = "",
  multiple = false,
  disabled = false,
  "aria-label": ariaLabel,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  // safe programmatic open inside the same user gesture
  const openPicker = useCallback(() => {
    const el = inputRef.current;
    if (!el || disabled) return;
    try {
      if (typeof el.showPicker === "function") el.showPicker();
      else el.click();
    } catch {
      try { el.click(); } catch { /* noop */ }
    }
  }, [disabled]);

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.currentTarget.files?.[0];
      if (!f) return;
      try {
        setBusy(true);
        await onFile(f);
      } finally {
        setBusy(false);
        // allow re-selecting the same file
        e.currentTarget.value = "";
      }
    },
    [onFile]
  );

  // We render BOTH the overlay input and a label/face.
  // The overlay guarantees native open; the events below double-open only if the OS ignored the first request.
  return (
    <div className={`file-cta-wrap ${disabled ? "is-disabled" : ""}`}>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={handleChange}
        // keep default pointer behavior; CSS makes it full-size with opacity ~0
      />
      <label
        htmlFor={id}
        className={className}
        role="button"
        aria-disabled={disabled}
        aria-label={ariaLabel}
        aria-busy={busy || undefined}
        data-busy={busy || undefined}
        onPointerUp={() => {
            if (disabled) return;
            openPicker();
          }}
          
        onClick={(e) => {
          if (disabled) { e.preventDefault(); return; }
          // ensure same-gesture programmatic open
          openPicker();
        }}
        onTouchEnd={() => {
          if (disabled) return;
          openPicker();
        }}
      >
        {label}
      </label>
    </div>
  );
};

export default MobileFileButton;
