import type React from "react";

export function makeOnSealModalClose(
  setOpen: React.Dispatch<React.SetStateAction<boolean>>,
  setUrl: React.Dispatch<React.SetStateAction<string>>,
  setHash: React.Dispatch<React.SetStateAction<string>>
): (ev?: unknown, reason?: string) => void {
  const isObj = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null;

  return (ev?: unknown, reason?: string) => {
    const getReasonFrom = (e: unknown): string => {
      if (typeof reason === "string") return reason;
      if (!isObj(e)) return "";
      const direct =
        typeof (e as { reason?: unknown }).reason === "string"
          ? (e as { reason: string }).reason
          : "";
      const detail = isObj((e as { detail?: unknown }).detail)
        ? (e as { detail: Record<string, unknown> }).detail
        : null;
      const detailReason =
        detail && typeof detail.reason === "string" ? (detail.reason as string) : "";
      return direct || detailReason || "";
    };

    const getTargetEl = (e: unknown): HTMLElement | null => {
      if (!isObj(e)) return null;
      const t = (e as { target?: unknown }).target as unknown;
      return t instanceof HTMLElement ? t : null;
    };

    const r = getReasonFrom(ev);
    const target = getTargetEl(ev);

    const explicitByReason =
      r === "closeClick" || r === "close-button" || r === "explicit" || r === "close";

    const explicitByTarget = !!target?.closest?.(
      '[data-modal-close],[data-close],.sealmoment__close,.sp-modal__close,button[aria-label="Close"],button[aria-label="close"],button[title="Close"]'
    );

    const noArgsExplicit = ev == null && reason == null;

    const isBackdrop =
      r === "backdropClick" || r === "overlay" || r === "pointerDownOutside" || r === "clickOutside";
    const isEsc = r === "escapeKeyDown" || r === "esc" || r === "dismiss";

    if (explicitByReason || explicitByTarget || noArgsExplicit) {
      setOpen(false);
      setUrl("");
      setHash("");
      return;
    }

    if (isBackdrop || isEsc || r) return;
  };
}
