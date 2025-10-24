// src/components/sigil/openOwnershipVerifyModal.tsx
/* eslint-disable react-refresh/only-export-components */
import { createRoot, type Root } from "react-dom/client";
import OwnershipVerifyModal from "./OwnershipVerifyModal";

export type OpenOwnershipVerifyModalOptions = {
  accept?: string;
  title?: string;
  subtitle?: string;
};

/**
 * Opens the OwnershipVerifyModal in a hardened, single-instance portal.
 * - Cleans up any orphaned host from previous renders
 * - Guards against double-resolve
 * - Adds minimal a11y attributes to the host
 */
export async function openOwnershipVerifyModal(
  opts?: OpenOwnershipVerifyModalOptions
): Promise<File | null> {
  // SSR/Non-DOM guard
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  // Ensure only one host exists (clean up any orphan)
  const stale = document.getElementById("ovm-portal-root");
  if (stale && stale.parentNode) {
    try {
      stale.parentNode.removeChild(stale);
    } catch {
      // noop
    }
  }

  const host = document.createElement("div");
  host.id = "ovm-portal-root";
  host.setAttribute("data-ovm-root", "1");
  host.setAttribute("role", "presentation");
  host.setAttribute("tabindex", "-1");
  document.body.appendChild(host);

  const root: Root = createRoot(host);

  return new Promise<File | null>((outerResolve) => {
    let done = false;
    const safeResolve = (file: File | null) => {
      if (done) return;
      done = true;
      try {
        root.unmount();
      } catch {
        /* noop */
      }
      try {
        host.remove();
      } catch {
        /* noop */
      }
      outerResolve(file);
    };

    root.render(
      <OwnershipVerifyModal
        title={opts?.title ?? "Verify Stewardship"}
        subtitle={opts?.subtitle ?? "Pick the Φkey for this Sigil-Glyph."}
        accept={opts?.accept ?? "image/svg+xml,.svg"}
        onResolve={safeResolve}
      />
    );
  });
}
