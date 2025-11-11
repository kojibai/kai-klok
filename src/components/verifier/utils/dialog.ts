// src/components/verifier/utils/dialog.ts
export type MaybeDialog = HTMLDialogElement | null | undefined;

/** Open a <dialog> safely (modal when possible), set data-open, and focus it. */
export function safeShowDialog(dlg: MaybeDialog): void {
  if (!dlg) return;
  try {
    if (!dlg.open) dlg.showModal();
  } catch {
    // Fallback for environments without showModal()
    if (!dlg.open) dlg.setAttribute("open", "true");
  }
  dlg.setAttribute("data-open", "true");
  try { dlg.focus(); } catch { /* noop */ }
}

/** Close the current dialog, then open the next one after an optional delay. */
export function switchModal(
  current: MaybeDialog,
  openNext: () => void,
  opts?: { delayMs?: number }
): void {
  const delay = opts?.delayMs ?? 180; // match your close animation duration
  if (current && current.open) {
    current.setAttribute("data-open", "false");
    try { current.close(); } catch { current.removeAttribute("open"); }
    window.setTimeout(openNext, delay);
  } else {
    openNext();
  }
}
