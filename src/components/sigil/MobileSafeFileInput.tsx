import React, { useCallback, useRef } from "react";

type Props = {
  id: string;
  accept?: string;
  label: React.ReactNode;         // what the user sees (text or JSX)
  className?: string;             // style wrapper as your button
  softDisabled?: boolean;         // style only; do NOT disable the input
  onFile: (file: File) => void;   // gets exactly one file
};

export default function MobileSafeFileInput({
  id,
  accept = "image/svg+xml,.svg",
  label,
  className,
  softDisabled = false,
  onFile,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.currentTarget.files?.[0];
    if (f) onFile(f);
    // allow re-selecting the same file back-to-back
    if (inputRef.current) inputRef.current.value = "";
  }, [onFile]);

  return (
    <div className={`msfi ${className ?? ""}`} data-disabled={softDisabled ? "true" : "false"}>
      {/* Visible “button” content */}
      <div className="msfi-btn" aria-hidden="true">{label}</div>

      {/* The real native input sits on top and owns the tap */}
      <input
        ref={inputRef}
        id={id}
        className="msfi-input"
        type="file"
        accept={accept}
        aria-disabled={softDisabled ? "true" : "false"}
        tabIndex={softDisabled ? -1 : 0}
        onChange={onChange}
        
      />
    </div>
  );
}
