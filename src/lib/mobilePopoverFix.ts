// mobilePopoverFix.ts
export interface MobileDismissalsAPI {
  openModal: (el: Element | null) => void;
  closeModal: (el: Element | null) => void;
  disable: () => void;
  teardown: () => void; // alias of disable (for compatibility)
  destroy: () => void;  // alias of disable (for compatibility)
}

type AnyEvent = MouseEvent | PointerEvent | TouchEvent | KeyboardEvent;

export function enableMobileDismissals(): MobileDismissalsAPI {
  // SSR/Non-DOM guard — return no-ops if there's no document
  if (typeof window === "undefined" || typeof document === "undefined") {
    const noop: () => void = () => {};
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
  const body = doc.body;

  // Overlays we manage (keep this list in sync with your UI)
  const OVERLAY_SELECTORS = [
    ".sp-breathproof__backdrop",
    ".stargate-overlay",
    ".valuechart-backdrop",
    ".sp-modal",
    ".ownership-overlay",
  ];

  // For backdrop-click detection, these are *content* containers that shouldn't close on click.
  const CONTENT_WITHIN: Record<string, string> = {
    ".sp-breathproof__backdrop": ".sp-breathproof",
    ".valuechart-backdrop": ".valuechart",
    ".ownership-overlay": ".ownership-panel",
    ".stargate-overlay": ".stargate-content, .stargate-frame, .stargate__content",
    ".sp-modal": ".sp-modal__content, .sp-modal__card, .sp-card",
  };

  // "Close" affordances we honor globally
  const CLOSE_BUTTON_SELECTORS =
    '.sp-breathproof__close, .stargate-exit, .sp-modal__close, .sealmoment__close, [data-modal-close], [data-dismiss="modal"], button[aria-label="Close"], button[aria-label="close"]';

  // Add with capture so we intercept before inner handlers;
  // passive must be false where we may call preventDefault on touch/pointer to stop scroll bleed.
  const ADD_OPTS_CAPTURE_ACTIVE: AddEventListenerOptions = { capture: true, passive: false };
  const REMOVE_OPTS_CAPTURE: EventListenerOptions = { capture: true };

  // ===== Scroll lock (robust for iOS/Android) =====
  let lockCount = 0;
  let savedScrollY = 0;
  let savedScrollX = 0;
  let savedBodyTop = "";
  let savedBodyLeft = "";
  let savedBodyWidth = "";
  let savedBodyPosition = "";
  let savedOverflow = "";

  const lockScroll = () => {
    if (lockCount === 0) {
      savedScrollY = window.scrollY || doc.documentElement.scrollTop || 0;
      savedScrollX = window.scrollX || doc.documentElement.scrollLeft || 0;

      savedBodyTop = body.style.top;
      savedBodyLeft = body.style.left;
      savedBodyWidth = body.style.width;
      savedBodyPosition = body.style.position;
      savedOverflow = body.style.overflow;

      // Prevent scroll on body; keep layout stable
      body.style.position = "fixed";
      body.style.top = `-${savedScrollY}px`;
      body.style.left = `-${savedScrollX}px`;
      body.style.width = "100%";
      body.style.overflow = "hidden";

      // helpful flags for your CSS (already used elsewhere in your app)
      body.classList.add("modal-open", "bp-open");
    }
    lockCount++;
  };

  const unlockScroll = () => {
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount > 0) return;

    body.style.position = savedBodyPosition;
    body.style.top = savedBodyTop;
    body.style.left = savedBodyLeft;
    body.style.width = savedBodyWidth;
    body.style.overflow = savedOverflow;

    // Restore scroll position *after* styles revert (next frame)
    requestAnimationFrame(() => {
      window.scrollTo(savedScrollX, savedScrollY);
    });

    body.classList.remove("modal-open");
    // NOTE: don't forcibly remove bp-open if your app toggles it separately.
    body.classList.remove("bp-open");
  };

  // ===== Helpers =====
  const isVisible = (el: Element | null): el is HTMLElement => {
    if (!el) return false;
    const style = window.getComputedStyle(el as HTMLElement);
    if (style.display === "none" || style.visibility === "hidden") return false;
    // Hidden attribute check
    if ((el as HTMLElement).hasAttribute("hidden")) return false;
    return true;
  };

  const anyOverlayOpen = (): HTMLElement[] => {
    const list: HTMLElement[] = [];
    OVERLAY_SELECTORS.forEach((sel) => {
      doc.querySelectorAll<HTMLElement>(sel).forEach((el) => {
        if (isVisible(el)) list.push(el);
      });
    });
    return list;
  };

  const findOverlayFor = (target: Element | null): HTMLElement | null => {
    if (!target) return null;
    let el: Element | null = target;
    while (el && el !== doc.documentElement) {
      for (const sel of OVERLAY_SELECTORS) {
        if ((el as Element).matches(sel)) return el as HTMLElement;
      }
      el = (el as HTMLElement).parentElement;
    }
    return null;
  };

  const isBackdropClick = (overlayEl: HTMLElement, evTarget: Element | null): boolean => {
    if (!overlayEl || !evTarget) return false;
    const overlaySel = OVERLAY_SELECTORS.find((s) => overlayEl.matches(s)) || "";
    const contentSel = overlaySel ? CONTENT_WITHIN[overlaySel] : "";
    if (!contentSel) {
      // No content selector mapped — treat click on overlay (not inside children) as backdrop
      return evTarget === overlayEl;
    }
    const content = overlayEl.querySelector(contentSel);
    return content ? !((evTarget as Element).closest(contentSel)) : evTarget === overlayEl;
  };

  const refreshLock = () => {
    const open = anyOverlayOpen();
    if (open.length > 0) lockScroll();
    else unlockScroll();
  };

  // ===== API (for optional explicit open/close wiring) =====
  const openModal = (el: Element | null): void => {
    if (!el) return;
    (el as HTMLElement).classList.add("is-open");
    (el as HTMLElement).removeAttribute("hidden");
    refreshLock();
  };

  const closeModal = (el: Element | null): void => {
    if (!el) return;
    (el as HTMLElement).classList.remove("is-open");
    (el as HTMLElement).setAttribute("hidden", "");
    refreshLock();
  };

  // ===== Global event handlers (capture) =====
  const onCloseIntent = (ev: AnyEvent) => {
    const target = ev.target as Element | null;
    if (!target) return;

    // 1) Click on explicit close affordance
    const closeBtn = (target as Element).closest(CLOSE_BUTTON_SELECTORS);
    if (closeBtn) {
      const overlay = findOverlayFor(closeBtn);
      if (overlay) {
        closeModal(overlay);
        ev.preventDefault();
        ev.stopPropagation();
      }
      return;
    }

    // 2) Backdrop click/tap on overlays that allow it
    const overlay = findOverlayFor(target);
    if (overlay && isBackdropClick(overlay, target)) {
      // Allow custom opt-out: data-backdrop-dismiss="false"
      const optOut = overlay.getAttribute("data-backdrop-dismiss");
      if (optOut !== "false") {
        closeModal(overlay);
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
    }
  };

  // Prevent scroll-bleed behind overlays on touch devices
  const onTouchMove = (ev: TouchEvent) => {
    if (anyOverlayOpen().length === 0) return;
    const t = ev.target as HTMLElement | null;
    if (!t) return;

    // Permit scrolling inside internal scroll containers; block otherwise
    const scrollable = t.closest<HTMLElement>(
      '[data-scroll], .sp-breathproof, .valuechart, .ownership-panel, .sp-modal__content, .sp-card, .stargate-content'
    );

    if (!scrollable) {
      // Not inside a declared scrollable zone — block page scroll
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }

    // If inside a scrollable, only block if it's at edge and trying to overscroll
    const canScroll = scrollable.scrollHeight > scrollable.clientHeight;
    if (!canScroll) {
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }

    // Allow natural scroll within the element
    // iOS sometimes needs this guard even when scrollable; no-op here.
  };

  const onKeyDown = (ev: KeyboardEvent) => {
    if (ev.key !== "Escape") return;
    const open = anyOverlayOpen();
    if (open.length === 0) return;
    // Close the last/open-most overlay
    const top = open[open.length - 1];
    // Allow custom opt-out: data-escape-dismiss="false"
    const optOut = top.getAttribute("data-escape-dismiss");
    if (optOut === "false") return;

    closeModal(top);
    ev.preventDefault();
    ev.stopPropagation();
  };

  // Attach listeners
  doc.addEventListener("click", onCloseIntent as EventListener, ADD_OPTS_CAPTURE_ACTIVE);
  doc.addEventListener("pointerup", onCloseIntent as EventListener, ADD_OPTS_CAPTURE_ACTIVE);
  doc.addEventListener("touchend", onCloseIntent as EventListener, ADD_OPTS_CAPTURE_ACTIVE);
  doc.addEventListener("touchmove", onTouchMove as EventListener, ADD_OPTS_CAPTURE_ACTIVE);
  doc.addEventListener("keydown", onKeyDown as EventListener, ADD_OPTS_CAPTURE_ACTIVE);

  // Initial sync (if overlays are already mounted)
  refreshLock();

// Cleanup
const disable = (): void => {
  doc.removeEventListener("click", onCloseIntent as EventListener, REMOVE_OPTS_CAPTURE);
  doc.removeEventListener("pointerup", onCloseIntent as EventListener, REMOVE_OPTS_CAPTURE);
  doc.removeEventListener("touchend", onCloseIntent as EventListener, REMOVE_OPTS_CAPTURE);
  doc.removeEventListener("touchmove", onTouchMove as EventListener, REMOVE_OPTS_CAPTURE);
  doc.removeEventListener("keydown", onKeyDown as EventListener, REMOVE_OPTS_CAPTURE);
  // Ensure body is unlocked if nothing else owns the lock
  try {
    lockCount = 1; // force unlock
    unlockScroll();
  } catch (err) {
    // Intentional no-op: cleanup is best-effort during teardown.
    void err;
  }
};


  // Back-compat aliases
  const teardown = disable;
  const destroy = disable;

  return { openModal, closeModal, disable, teardown, destroy };
}
