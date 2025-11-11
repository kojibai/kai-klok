// src/components/verifier/utils/sigilMemoryVault.ts
// Pulse-only memory vault — NO CHRONOS. Persist and recall by Kai pulse.
// Stores minimal, sovereign facts for each sigil ID, keyed per pulse.

export type SigilMemoryEntry = {
  pulse: number;          // Kai pulse at upload (authoritative "when")
  beat?: number;
  stepIndex?: number;
  chakraDay?: string;

  uiState?: string;       // e.g., "verified", "readySend", etc.
  canonical?: string;     // effective canonical hash at upload
  phiKey?: string;        // user Φ-Key (if present)
  actions?: string[];     // optional breadcrumbs per upload
  fileName?: string;      // original file name (if helpful)

  // Accounting snapshot at upload (scaled BigInt as string, e.g., "123450000" for 6dp)
  spentScaled?: string;
};

export type SigilMemoryVault = Record<string, SigilMemoryEntry[]>;

const STORAGE_KEY = "sigilMemoryVault";


// ---------- internal helpers ----------

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function save(vault: SigilMemoryVault): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vault));
  } catch {
    // ignore storage failures silently
  }
}

/** In-place migration: strip any legacy `timestamp` fields (Chronos) if present. */
function stripChronos(vault: SigilMemoryVault): void {
  for (const id of Object.keys(vault)) {
    const arr = vault[id];
    if (!Array.isArray(arr)) {
      vault[id] = [];
      continue;
    }

  }
}

/** Keep entries ordered by pulse asc and dedupe by pulse (latest write wins). */
function normalizeList(list: SigilMemoryEntry[]): SigilMemoryEntry[] {
  const byPulse = new Map<number, SigilMemoryEntry>();
  for (const e of list) {
    if (!e || typeof e.pulse !== "number" || !Number.isFinite(e.pulse)) continue;
    byPulse.set(e.pulse, { ...e, pulse: Math.trunc(e.pulse) });
  }
  return Array.from(byPulse.values()).sort((a, b) => a.pulse - b.pulse);
}

// ---------- public API ----------

/** Read full vault (auto-migrated to strip any legacy Chronos fields). */
export function getSigilMemoryVault(): SigilMemoryVault {
  const vault = safeParse<SigilMemoryVault>(localStorage.getItem(STORAGE_KEY), {});
  stripChronos(vault);
  // Normalize each list once upon load
  for (const id of Object.keys(vault)) {
    vault[id] = normalizeList(vault[id] || []);
  }
  return vault;
}

/** Replace full vault (ensures normalization & Chronos-free). */
export function saveSigilMemoryVault(vault: SigilMemoryVault): void {
  stripChronos(vault);
  for (const id of Object.keys(vault)) {
    vault[id] = normalizeList(vault[id] || []);
  }
  save(vault);
}

/**
 * Add a pulse-scoped memory entry for a sigil.
 * If an entry already exists at the same pulse, this overwrites it (latest write wins).
 */
export function addSigilMemoryEntry(
  sigilID: string,
  pulse: number,
  entry: Omit<SigilMemoryEntry, "pulse"> = {}
): void {
  try {
    const vault = getSigilMemoryVault();
    vault[sigilID] ??= [];
    const merged: SigilMemoryEntry = { pulse: Math.trunc(pulse), ...entry };
    // Replace any existing item for this pulse
    const list = vault[sigilID].filter((e) => e.pulse !== merged.pulse);
    list.push(merged);
    vault[sigilID] = normalizeList(list);
    save(vault);
  } catch {
    // ignore storage failures
  }
}

/**
 * Upsert selected fields for a specific (sigilID, pulse) record.
 * Creates the record if it doesn't exist yet.
 */
export function upsertSigilMemoryFields(
  sigilID: string,
  pulse: number,
  fields: Partial<SigilMemoryEntry>
): void {
  try {
    const vault = getSigilMemoryVault();
    vault[sigilID] ??= [];
    const p = Math.trunc(pulse);
    const idx = vault[sigilID].findIndex((e) => e.pulse === p);
    if (idx >= 0) {
      vault[sigilID][idx] = normalizeList([{ ...vault[sigilID][idx], ...fields }])[0];
    } else {
      vault[sigilID] = normalizeList([...vault[sigilID], { pulse: p, ...fields } as SigilMemoryEntry]);
    }
    save(vault);
  } catch {
    // ignore
  }
}

/** Get Kai-ordered history for a sigil (ascending by pulse). */
export function getSigilMemoryHistory(sigilID: string): SigilMemoryEntry[] {
  try {
    const vault = getSigilMemoryVault();
    return normalizeList(vault[sigilID] ?? []);
  } catch {
    return [];
  }
}

/** Optional utility: clear all records for a sigil ID. */
export function clearSigilMemory(sigilID: string): void {
  try {
    const vault = getSigilMemoryVault();
    if (sigilID in vault) {
      delete vault[sigilID];
      save(vault);
    }
  } catch {
    // ignore
  }
}
