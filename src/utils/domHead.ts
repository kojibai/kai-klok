// src/utils/domHead.ts

/**
 * Safe DOM head helpers.
 * - No innerHTML anywhere.
 * - Attribute-based lookup without relying on CSS.escape (robust across browsers).
 * - Idempotent: reuses existing tags when possible, otherwise creates them.
 */

/** Find a <meta> whose given attribute exactly matches the provided key. */
function findMeta(attr: "name" | "property", key: string): HTMLMetaElement | null {
  const metas = document.head.querySelectorAll<HTMLMetaElement>("meta[name], meta[property]");
  for (const m of metas) {
    if (m.getAttribute(attr) === key) return m;
  }
  return null;
}

/** Ensure a <meta> tag with the given attribute/key exists and return it. */
export function ensureMeta(attr: "name" | "property", key: string): HTMLMetaElement {
  let el = findMeta(attr, key);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  return el;
}

/** Set (or clear) the content attribute of a <meta> tag. */
export function setMeta(attr: "name" | "property", key: string, value: string | undefined): void {
  const el = ensureMeta(attr, key);
  if (value == null) {
    el.removeAttribute("content");
  } else {
    el.setAttribute("content", value);
  }
}

/** Find a <link> by exact rel value. */
function findLink(rel: string): HTMLLinkElement | null {
  const links = document.head.querySelectorAll<HTMLLinkElement>("link[rel]");
  for (const l of links) {
    if ((l.getAttribute("rel") || "").toLowerCase() === rel.toLowerCase()) return l;
  }
  return null;
}

/** Ensure a <link rel="..."> exists and return it. */
export function ensureLink(rel: string): HTMLLinkElement {
  let el = findLink(rel);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  return el;
}

/**
 * Ensure a single <script type="application/ld+json" id="..."> exists
 * and set its textContent to the JSON string of the provided object.
 */
export function setJsonLd(id: string, obj: unknown): void {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  // Never use innerHTML; textContent is safe.
  el.textContent = JSON.stringify(obj);
}
