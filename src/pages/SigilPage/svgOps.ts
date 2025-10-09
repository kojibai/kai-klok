// src/pages/SigilPage/svgOps.ts

/** Lightweight shape of the canonical metadata we actually touch. */
export type CanonicalSigilMeta = {
  pulse?: number;
  kaiPulse?: number;
  beat?: number;
  stepIndex?: number;
  stepsPerBeat?: number;
  eternalRecord?: string;
} & Record<string, unknown>;

/** Type guard for a plain object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parse JSON safely with a typed fallback. */
function safeJsonParse<T extends Record<string, unknown>>(text: string | null | undefined): T | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    return isRecord(parsed) ? (parsed as T) : null;
  } catch {
    return null;
  }
}

/** Ensure the canonical <metadata> (the one WITHOUT data-noncanonical="1") is first inside the SVG. */
export function ensureCanonicalMetadataFirst(svgEl: SVGSVGElement): void {
  try {
    const metas = Array.from(svgEl.querySelectorAll("metadata"));
    if (!metas.length) return;
    const canonical =
      metas.find((m) => m.getAttribute("data-noncanonical") !== "1" && m.id !== "sigil-display") ??
      metas[0];
    if (canonical && svgEl.firstChild !== canonical) {
      svgEl.insertBefore(canonical, svgEl.firstChild);
    }
  } catch (err) {
    console.debug("ensureCanonicalMetadataFirst failed:", err);
  }
}

/**
 * Get the canonical <metadata> element (prefers one without data-noncanonical="1" and id!=="sigil-display").
 */
function getCanonicalMetadataEl(svgEl: SVGSVGElement): SVGMetadataElement | null {
  const metas = Array.from(svgEl.querySelectorAll("metadata"));
  if (!metas.length) return null;
  const canonical =
    metas.find((m) => m.getAttribute("data-noncanonical") !== "1" && m.id !== "sigil-display") ??
    metas[0];
  return canonical as SVGMetadataElement;
}

/**
 * Rewrite the *canonical* metadata JSON in-place (no `any`).
 * The canonical block is the one without data-noncanonical="1" (or the first if none tagged).
 */
export function rewriteCanonicalMetadata<T extends Record<string, unknown>>(
  svgEl: SVGSVGElement,
  patch: (current: Readonly<T>) => T
): void {
  try {
    const canonical = getCanonicalMetadataEl(svgEl);
    if (!canonical) return;

    const current = safeJsonParse<T>(canonical.textContent?.trim() ?? "") ?? ({} as T);
    const next = patch(Object.freeze(current));
    canonical.textContent = JSON.stringify(next);

    // Keep the canonical metadata first for consumers
    if (svgEl.firstChild !== canonical) {
      svgEl.insertBefore(canonical, svgEl.firstChild);
    }
  } catch (err) {
    console.debug("rewriteCanonicalMetadata failed:", err);
  }
}

/**
 * Retag the SVG for a specific (pulse, beat, stepIndex), updating:
 *  - root id / desc id / data-step-index
 *  - all IDs that include the old step suffix
 *  - references to those IDs (href, filter, mask, fill, stroke, style, aria-describedby)
 *  - human hint text "Day Seal: <beat>:<step>"
 *  - the canonical <metadata> JSON (pulse/kaiPulse, beat, stepIndex, stepsPerBeat)
 *
 * This guarantees DOM attributes, text, and embedded JSON all reflect the same KKS step.
 */
export function retagSvgIdsForStep(
  svgEl: SVGSVGElement,
  pulse: number,
  beat: number,
  stepIndex: number
): void {
  try {
    const prefix = `ks-${pulse}-${beat}-`;
    const newPrefix = `${prefix}${stepIndex}`;

    // Root + desc + data-step-index
    const newRootId = newPrefix;
    svgEl.setAttribute("id", newRootId);
    svgEl.setAttribute("aria-describedby", `${newRootId}-desc`);
    const descEl = svgEl.querySelector("desc");
    if (descEl) descEl.setAttribute("id", `${newRootId}-desc`);
    svgEl.setAttribute("data-step-index", String(stepIndex));

    // Map old ids → new ids
    const renames = new Map<string, string>();
    const idRe = new RegExp(`^${prefix}(\\d+)(.*)$`);
    svgEl.querySelectorAll<Element>("[id]").forEach((el) => {
      const id = el.getAttribute("id") || "";
      const m = idRe.exec(id);
      if (!m) return;
      const oldStep = m[1];
      const tail = m[2] || "";
      if (oldStep !== String(stepIndex)) {
        const newId = `${newPrefix}${tail}`;
        renames.set(id, newId);
      }
    });

    // If the (possibly old) root id matched the old pattern, queue its rename
    const rootId = svgEl.getAttribute("id") || "";
    const rm = idRe.exec(rootId);
    if (rm && rm[1] !== String(stepIndex)) {
      renames.set(rootId, newRootId);
    }

    // Apply id renames
    renames.forEach((newId, oldId) => {
      const el = svgEl.querySelector<Element>(`[id="${oldId}"]`);
      if (el) el.setAttribute("id", newId);
    });

    // Rewrite references
    const REF_ATTRS = [
      "href",
      "xlink:href",
      "filter",
      "mask",
      "fill",
      "stroke",
      "style",
      "aria-describedby",
    ] as const;

    const replaceAllLiteral = (s: string, find: string, replacement: string): string =>
      s.indexOf(find) === -1 ? s : s.split(find).join(replacement);

    const allEls = svgEl.querySelectorAll<Element>("*");
    allEls.forEach((el) => {
      for (const attr of REF_ATTRS) {
        const val = el.getAttribute(attr);
        if (!val) continue;
        let next = val;
        renames.forEach((newId, oldId) => {
          next = replaceAllLiteral(next, `url(#${oldId}`, `url(#${newId}`);
          next = replaceAllLiteral(next, `"#${oldId}"`, `"#${newId}"`);
          next = replaceAllLiteral(next, `'#${oldId}'`, `'#${newId}'`);
          next = replaceAllLiteral(next, `#${oldId}`, `#${newId}`);
          next = replaceAllLiteral(next, `&quot;#${oldId}&quot;`, `&quot;#${newId}&quot;`);
        });
        if (next !== val) el.setAttribute(attr, next);
      }
    });

    // Human hint text (if present)
    const hintRe = new RegExp(`(Day\\s+Seal:\\s*${beat}\\s*:)\\s*\\d+`);
    svgEl.querySelectorAll("text").forEach((t) => {
      const s = t.textContent || "";
      const r = s.replace(hintRe, `$1${stepIndex}`);
      if (r !== s) t.textContent = r;
    });

    // ── Canonical metadata: unify to the same KKS values ───────────────────
    // Prefer stepsPerBeat embedded in existing metadata, else from data-*, else default 44.
    const DEFAULT_STEPS_PER_BEAT = 44;
    let stepsPerBeat = DEFAULT_STEPS_PER_BEAT;

    try {
      const canonicalEl = getCanonicalMetadataEl(svgEl);
      const parsed = canonicalEl ? safeJsonParse<CanonicalSigilMeta>(canonicalEl.textContent?.trim()) : null;
      const n = Number(parsed?.stepsPerBeat);
      if (Number.isFinite(n) && n > 0) stepsPerBeat = Math.max(1, Math.floor(n));
    } catch {
      /* ignore */
    }

    const stepsAttr = Number(svgEl.getAttribute("data-steps-per-beat"));
    if (Number.isFinite(stepsAttr) && stepsAttr > 0) {
      stepsPerBeat = Math.max(1, Math.floor(stepsAttr));
    }

    // Patch the canonical metadata JSON to match the exact display step
    rewriteCanonicalMetadata<CanonicalSigilMeta>(svgEl, (m) => {
      const next: CanonicalSigilMeta = { ...m };

      // Authoritative KKS fields
      next.pulse = pulse;
      next.kaiPulse = pulse;
      next.beat = beat;
      next.stepIndex = stepIndex;
      next.stepsPerBeat = stepsPerBeat;

      // Optional: keep eternalRecord coherent if present
      if (typeof next.eternalRecord === "string") {
        const rx = new RegExp(`(Day\\s*Seal:\\s*${beat}\\s*:)\\s*\\d+`);
        next.eternalRecord = next.eternalRecord.replace(rx, `$1${stepIndex}`);
      }

      return next;
    });

    // Ensure canonical metadata is first after the rewrite
    ensureCanonicalMetadataFirst(svgEl);
  } catch (err) {
    console.debug("retagSvgIdsForStep failed:", err);
  }
}

/**
 * Attach a BreathProof metadata block (separate <metadata id="kai-breath-proof">).
 * Caller provides a signing function; this embeds the signature and message.
 */
export async function addBreathProofMetadata(
  svgEl: SVGSVGElement,
  {
    parentHash,
    eventKind,
    kaiPulse,
    kaiBeat,
    stepIndex,
    amount,
    expiresAtPulse,
    lineageCommitment,
    stateRoot,
    ownerPublicKey,
    signWithPrivateKey,
  }: {
    parentHash: string;
    eventKind: "mint" | "transfer";
    kaiPulse: number;
    kaiBeat: number;
    stepIndex: number;
    amount: number;
    expiresAtPulse: number;
    lineageCommitment: string;
    stateRoot: string;
    ownerPublicKey: string;
    signWithPrivateKey: (data: Uint8Array) => Promise<Uint8Array>;
  }
): Promise<void> {
  const message = {
    parentHash,
    eventKind,
    kaiPulse,
    kaiBeat,
    stepIndex,
    amount,
    expiresAtPulse,
    lineageCommitment,
    stateRoot,
  };

  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(message));
  const sigBuf = await signWithPrivateKey(data);
  const signature = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));

  const metadataEl = document.createElement("metadata");
  metadataEl.setAttribute("id", "kai-breath-proof");

  // JSON block as text content (no DOM nodes inside).
  metadataEl.textContent = JSON.stringify(
    {
      type: "BreathProof",
      ownerPublicKey,
      signature,
      message,
    },
    null,
    2
  );

  // Insert metadata at the top so it’s discoverable, but keep canonical first.
  const first = svgEl.firstChild;
  if (first) {
    svgEl.insertBefore(metadataEl, first.nextSibling);
  } else {
    svgEl.appendChild(metadataEl);
  }
}
