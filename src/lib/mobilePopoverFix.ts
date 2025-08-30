// mobilePopoverFix.ts
export interface MobileDismissalsAPI {
  openModal: (el: Element | null) => void;
  closeModal: (el: Element | null) => void;
  disable: () => void;
  teardown: () => void; // alias of disable (for compatibility)
  destroy: () => void;  // alias of disable (for compatibility)
}

export function enableMobileDismissals(): MobileDismissalsAPI {
  // SSR/Non-DOM guard — return no-ops if there's no document
  if (typeof window === "undefined" || typeof document === "undefined") {
    const noop: () => void = () => {};
    // typed to accept an Element | null, but implemented without param to avoid unused-var lint
    const noopWithArg: (el: Element | null) => void = () => {};
    return {
      openModal: noopWithArg,
      closeModal: noopWithArg,
      disable: noop,
      teardown: noop,
      destroy: noop,
    };
  }

  const doc = document;

  const EVENTS: Array<keyof DocumentEventMap> = ["click", "pointerup", "touchend"];

  // Add with capture so we can intercept before inner handlers;
  // passive must be false to allow preventDefault on touch events.
  const addOpts: AddEventListenerOptions = { capture: true, passive: false };
  // removeEventListener matches only on the capture flag.
  const removeOpts: EventListenerOptions = { capture: true };

  // Any overlay/backdrop we consider "open"
  const anyOpenSelector =
    ".sp-breathproof__backdrop.is-open, .stargate-overlay.is-open, " +
    ".valuechart-backdrop.is-open, .sp-modal.is-open, .ownership-overlay.is-open";

  const openModal = (el: Element | null): void => {
    if (!el) return;
    el.classList.add("is-open");
    (el as HTMLElement).removeAttribute("hidden");
    document.body.classList.add("modal-open", "bp-open");
  };

  const closeModal = (el: Element | null): void => {
    if (!el) return;
    el.classList.remove("is-open");
    (el as HTMLElement).setAttribute("hidden", "");
    if (!doc.querySelector(anyOpenSelector)) {
      document.body.classList.remove("modal-open", "bp-open");
    }
  };

  const handler = (ev: Event): void => {
    const target = ev.target as HTMLElement | null;
    if (!target) return;

    // 1) Explicit close buttons
    const closeBtn = target.closest(
      '.sp-breathproof__close, .stargate-exit, [data-modal-close], [data-dismiss="modal"]'
    );
    if (closeBtn) {
      const modal = (closeBtn as HTMLElement).closest(
        ".sp-breathproof__backdrop, .stargate-overlay, .valuechart-backdrop, .sp-modal, .ownership-overlay"
      );
      closeModal(modal);
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }

    // 2) Backdrop click to dismiss (only for specific overlays)
    const openBackdrop = target.closest(
      ".sp-breathproof__backdrop.is-open, .valuechart-backdrop.is-open, .ownership-overlay.is-open"
    );
    if (openBackdrop && !target.closest(".sp-breathproof, .valuechart, .ownership-panel")) {
      closeModal(openBackdrop as Element);
      ev.preventDefault();
      ev.stopPropagation();
    }
  };

  // Attach listeners
  EVENTS.forEach((evt) => doc.addEventListener(evt, handler, addOpts));

  // Cleanup
  const disable = (): void => {
    EVENTS.forEach((evt) => doc.removeEventListener(evt, handler, removeOpts));
  };

  // Back-compat aliases
  const teardown = disable;
  const destroy = disable;

  return { openModal, closeModal, disable, teardown, destroy };
}
