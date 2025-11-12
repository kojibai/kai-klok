// src/pages/PShort.tsx
import { useEffect } from "react";

export default function PShort() {
  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      const hash = u.hash.startsWith("#") ? u.hash.slice(1) : u.hash;
      const qp = new URLSearchParams(hash);
      const t = qp.get("t"); // token
      const add = qp.get("add"); // optional parent (may be short alias too)

      if (!t) {
        // fallback to home
        window.location.replace("/");
        return;
      }

      // Rebuild canonical URL
      const dest = new URL(u.origin);
      dest.pathname = `/feed/p/${t}`;

      if (add) {
        // Allow both full URLs and short /p#t=... aliases as parent
        const addUrl = (() => {
          try {
            // full absolute?
            const maybe = new URL(add);
            return maybe.toString();
          } catch {
            // short alias like /p#t=... or just #t=...
            if (add.startsWith("/p#t=")) {
              return `${u.origin}${add}`;
            }
            if (add.startsWith("#t=")) {
              return `${u.origin}/p${add}`;
            }
            return add; // as-is
          }
        })();
        dest.searchParams.set("add", addUrl);
      }

      window.location.replace(dest.toString());
    } catch {
      window.location.replace("/");
    }
  }, []);

  return null;
}
