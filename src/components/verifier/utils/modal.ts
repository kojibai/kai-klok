// src/components/verifier/utils/modal.ts
/* ────────────────────────────────────────────────────────────────
   modal.ts
   Small helpers for <dialog> UX:
   - safeShowDialog(el): open a dialog with data-open flag & scroll lock
   - switchModal(current, next): close current, then open next safely
   Notes:
   • Works with native <dialog>. Falls back to attribute "open" if needed.
   • Avoids exceptions if the dialog is already open.
   • Adds/removes document scroll lock while any dialog is open.
   • No 'any', no empty catches, strict TS-friendly.
────────────────────────────────────────────────────────────────── */

let openCount = 0;

/** Lightweight logger that never throws. */
function logError(ctx: string, err: unknown): void {
  // eslint-disable-next-line no-console
  console.error(`[modal] ${ctx}:`, err);
}

/** Returns true if the dialog is currently open. */
function isOpen(dlg: HTMLDialogElement): boolean {
  // Native .open is boolean; some polyfills toggle the "open" attribute.
  return Boolean(dlg.open || dlg.hasAttribute("open"));
}

/** Increment global open dialog count and lock body scroll if needed. */
function lockScroll(): void {
  openCount += 1;
  if (typeof document !== "undefined" && openCount === 1) {
    document.documentElement.classList.add("kk-dialog-open");
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
  }
}

/** Decrement open dialog count and release body scroll if none left. */
function unlockScroll(): void {
  openCount = Math.max(0, openCount - 1);
  if (typeof document !== "undefined" && openCount === 0) {
    document.documentElement.classList.remove("kk-dialog-open");
    document.body.style.overflow = "";
    document.body.style.touchAction = "";
  }
}

/** Attach one-time listeners for close lifecycle to keep scroll lock accurate. */
function attachCloseLifecycle(dlg: HTMLDialogElement): void {
  const onClose = (): void => {
    dlg.removeEventListener("close", onClose);
    dlg.removeEventListener("cancel", onClose);
    dlg.setAttribute("data-open", "false");
    dlg.removeAttribute("data-rotate");
    unlockScroll();
  };
  dlg.addEventListener("close", onClose, { once: true });
  // ESC closes native dialog via "cancel"
  dlg.addEventListener("cancel", onClose, { once: true });
}

/** Find a sensible first focus target inside a dialog for a11y. */
function findFirstFocusable(root: HTMLElement): HTMLElement | null {
  const selector =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const el = root.querySelector<HTMLElement>(selector);
  return el ?? null;
}

/** Show a dialog safely (no throw if already open, sets data-open, locks scroll). */
export function safeShowDialog(dlg?: HTMLDialogElement | null): void {
  if (typeof window === "undefined" || !dlg) return;

  try {
    if (isOpen(dlg)) {
      dlg.setAttribute("data-open", "true");
      const focusTarget = findFirstFocusable(dlg) ?? dlg;
      if (typeof focusTarget.focus === "function") focusTarget.focus();
      return;
    }

    // Prefer showModal() for proper backdrop & focus trapping
    const hasShowModal = typeof dlg.showModal === "function";
    const hasShow = typeof dlg.show === "function";

    try {
      if (hasShowModal) {
        dlg.showModal();
      } else if (hasShow) {
        dlg.show();
      } else {
        // Attribute fallback (old browsers)
        dlg.setAttribute("open", "");
      }
    } catch (err) {
      // If showModal/show throws (already open race), fallback to attribute
      logError("showModal/show", err);
      dlg.setAttribute("open", "");
    }

    dlg.setAttribute("data-open", "true");
    attachCloseLifecycle(dlg);
    lockScroll();

    const focusTarget = findFirstFocusable(dlg) ?? dlg;
    if (typeof focusTarget.focus === "function") focusTarget.focus();
  } catch (err) {
    // Never throw from a UI helper; log and continue
    logError("safeShowDialog", err);
  }
}

/**
 * Close the current dialog (if open), then after a micro handoff open the "next".
 * The "next" action is a callback that should open another dialog or set state.
 * A two-frame rAF (or setTimeout fallback) avoids backdrop/animation flicker.
 */
export function switchModal(
  current: HTMLDialogElement | null | undefined,
  next: () => void,
  options?: { delayMs?: number }
): void {
  const delayMs = options?.delayMs ?? 0;

  const runNext = (): void => {
    if (delayMs > 0) {
      window.setTimeout(next, delayMs);
      return;
    }
    try {
      const raf = typeof window !== "undefined" ? window.requestAnimationFrame : undefined;
      if (typeof raf === "function") {
        raf(() => raf(next));
      } else {
        window.setTimeout(next, 16);
      }
    } catch (err) {
      logError("switchModal.runNext", err);
      // Last-resort fallback
      window.setTimeout(next, 16);
    }
  };

  if (!current) {
    runNext();
    return;
  }

  try {
    if (isOpen(current)) {
      // Reflect closing state immediately for CSS hooks
      current.setAttribute("data-open", "false");
      current.removeAttribute("data-rotate");

      // If this dialog wasn't opened via safeShowDialog (no lifecycle attached),
      // ensure we still unlock on close once.
      const ensureUnlock = (): void => {
        current.removeEventListener("close", ensureUnlock);
        unlockScroll();
      };
      current.addEventListener("close", ensureUnlock, { once: true });

      try {
        current.close();
      } catch (err) {
        // Fallback for non-native dialogs or polyfills
        logError("current.close", err);
        current.removeAttribute("open");
        try {
          current.dispatchEvent(new Event("close"));
        } catch (err2) {
          logError("dispatch(close)", err2);
        }
      }

      runNext();
      return;
    }
  } catch (err) {
    logError("switchModal", err);
  }

  runNext();
}
