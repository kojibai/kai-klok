// Tiny classnames utility with strict typing (no 'any')
type ClassPrimitive = string | null | undefined | false;
type ClassRecord = Record<string, boolean>;
type ClassValue = ClassPrimitive | ClassRecord | ReadonlyArray<ClassPrimitive>;

function isRecord(v: ClassValue): v is ClassRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function cn(...values: ReadonlyArray<ClassValue>): string {
  const out: string[] = [];

  for (const v of values) {
    if (!v) continue;

    if (typeof v === "string") {
      if (v.trim().length > 0) out.push(v);
      continue;
    }

    if (Array.isArray(v)) {
      for (const inner of v) {
        if (typeof inner === "string" && inner.trim().length > 0) out.push(inner);
      }
      continue;
    }

    if (isRecord(v)) {
      for (const key of Object.keys(v)) {
        if (v[key]) out.push(key);
      }
    }
  }

  return out.join(" ");
}

export default cn;
