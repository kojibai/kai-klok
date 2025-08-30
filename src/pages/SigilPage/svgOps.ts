// src/pages/SigilPage/svgOps.ts

/** Ensure the canonical <metadata> (the one WITHOUT data-noncanonical="1") is first inside the SVG. */
export function ensureCanonicalMetadataFirst(svgEl: SVGSVGElement) {
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
  
  export function retagSvgIdsForStep(
    svgEl: SVGSVGElement,
    pulse: number,
    beat: number,
    stepIndex: number
  ) {
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
      svgEl.querySelectorAll<HTMLElement>("[id]").forEach((el) => {
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
  
      const rootId = svgEl.getAttribute("id") || "";
      const rm = idRe.exec(rootId);
      if (rm && rm[1] !== String(stepIndex)) {
        renames.set(rootId, newRootId);
      }
  
      // Apply id renames
      renames.forEach((newId, oldId) => {
        const el = svgEl.querySelector<HTMLElement>(`[id="${oldId}"]`);
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
  
      const replaceAllLiteral = (s: string, find: string, replacement: string) =>
        s.indexOf(find) === -1 ? s : s.split(find).join(replacement);
  
      const allEls = svgEl.querySelectorAll<HTMLElement>("*");
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
    } catch (err) {
      console.debug("retagSvgIdsForStep failed:", err);
    }
  }
  export async function addBreathProofMetadata(svgEl: SVGSVGElement, {
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
  }) {
    const M = {
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
    const data = encoder.encode(JSON.stringify(M));
    const sigBuf = await signWithPrivateKey(data);
    const signature = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
  
    const metadataEl = document.createElement("metadata");
    metadataEl.setAttribute("id", "kai-breath-proof");
  
    metadataEl.innerHTML = `
      {
        "type": "BreathProof",
        "ownerPublicKey": "${ownerPublicKey}",
        "signature": "${signature}",
        "message": ${JSON.stringify(M, null, 2)}
      }
    `.trim();
  
    // Insert metadata
    svgEl.insertBefore(metadataEl, svgEl.firstChild);
  }
  