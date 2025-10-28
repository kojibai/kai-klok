// src/components/verifier/ui/JsonTree.tsx
/* ────────────────────────────────────────────────────────────────
   JsonTree
   • Collapsible object/array inspector for the "Memory" tab
   • Pure presentational component
────────────────────────────────────────────────────────────────── */

import React from "react";

export const JsonTree: React.FC<{ data: unknown }> = ({
  data,
}) => {
  if (typeof data !== "object" || data === null) {
    return (
      <span className="json-primitive">
        {String(data)}
      </span>
    );
  }

  const isArr = Array.isArray(data);
  const entries = isArr
    ? (data as unknown[]).map(
        (v, i) => [i, v] as [number, unknown]
      )
    : Object.entries(
        data as Record<string, unknown>
      );

  return (
    <ul className="json-node">
      {entries.map(([k, v]) => (
        <li key={String(k)}>
          <details>
            <summary>
              {isArr ? `[${k}]` : `"${k}"`}
            </summary>
            <JsonTree data={v} />
          </details>
        </li>
      ))}
    </ul>
  );
};

export default JsonTree;
