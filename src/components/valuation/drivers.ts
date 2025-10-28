// src/components/valuation/drivers.ts
import type { ValueSeal } from "../../utils/valuation";
import type { ChartBundle } from "./series";
import type { SigilMetadataLite } from "../../utils/valuation";
import { currency, fmt, fmtPct, pct, pctSigned } from "./display";

/** Local helpers mirror Verifier heuristics (lightweight, no external deps) */
type DerivativeHints = {
  // name-ish
  fileName?: string;
  sourceName?: string;
  name?: string;
  filename?: string;
  file?: string;
  path?: string;

  // context & lineage
  canonicalContext?: string;
  context?: string;
  childOfHash?: string;
  sendLock?: unknown;
  childClaim?: { steps?: number; expireAtPulse?: number };

  // exact child value slots (authoritative first)
  childAllocationPhi?: number | string;
  branchBasePhi?: number | string;

  // prior stash points
  valuationSource?: { childValuePhi?: number | string };
  stats?: { childValuePhi?: number | string; remainingPhi?: number | string };

  // relaxed fallbacks (only if derivative confirmed)
  remainingPhi?: number | string;
  valuePhi?: number | string;
  value?: number | string;

  // dataset aliases
  dataset?: Record<string, unknown>;
  metaDataset?: Record<string, unknown>;

  // legacy aliases
  childValuePhi?: number | string;
  childPhi?: number | string;
  value_child_phi?: number | string;
  "child-value-phi"?: number | string;
  child_value_phi?: number | string;
};

const asNum = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
};

const getAliasFrom = (obj: unknown, key: string): number | string | null => {
  if (!obj || typeof obj !== "object") return null;
  const rec = obj as Record<string, unknown>;
  const v = rec[key];
  return typeof v === "number" || typeof v === "string" ? v : null;
};

const isDerivative = (m: SigilMetadataLite): boolean => {
  const mm = m as SigilMetadataLite & Partial<DerivativeHints>;

  const nameish = [
    mm.fileName,
    mm.sourceName,
    mm.name,
    mm.filename,
    mm.file,
    mm.path,
  ]
    .map((s) => (typeof s === "string" ? s.toLowerCase() : ""))
    .filter(Boolean)
    .join("|");

  const ctx = String(mm.canonicalContext ?? mm.context ?? "").toLowerCase();

  if (/\bsigil[_-]?send\b/.test(nameish)) return true;
  if (ctx === "derivative" || ctx === "child") return true;
  if (typeof mm.childOfHash === "string" && mm.childOfHash) return true;
  if (mm.sendLock && typeof mm.sendLock === "object") return true;
  if (mm.childClaim && typeof mm.childClaim === "object") return true;
  if (mm.childAllocationPhi != null || mm.branchBasePhi != null) return true;
  if (mm.stats?.childValuePhi != null) return true;
  if (mm.valuationSource?.childValuePhi != null) return true;

  return false;
};

const getChildExactPhi = (m: SigilMetadataLite): number | null => {
  const mm = m as SigilMetadataLite & Partial<DerivativeHints>;
  const sureChild = isDerivative(m);

  const pick = (...vals: unknown[]): number | null => {
    for (const v of vals) {
      const n = asNum(v);
      if (n != null && n >= 0) return Number(n.toFixed(6)); // snap6 equivalence
    }
    return null;
  };

  return (
    pick(
      // authoritative
      mm.childAllocationPhi,
      mm.branchBasePhi,
      mm.valuationSource?.childValuePhi,
      mm.stats?.childValuePhi,

      // legacy aliases
      mm.childValuePhi,
      mm.childPhi,
      mm.value_child_phi,
      mm["child-value-phi"],
      mm.child_value_phi,

      // dataset/metaDataset
      getAliasFrom(mm.dataset, "childValuePhi"),
      getAliasFrom(mm.metaDataset, "childValuePhi"),
      getAliasFrom(mm.dataset, "child-value-phi"),
      getAliasFrom(mm.metaDataset, "child-value-phi"),
      getAliasFrom(mm.dataset, "child_value_phi"),
      getAliasFrom(mm.metaDataset, "child_value_phi"),

      // relaxed fallbacks if confirmed derivative
      ...(sureChild ? [mm.stats?.remainingPhi, mm.remainingPhi, mm.valuePhi, mm.value] : [])
    ) ?? null
  );
};

export function buildDriversSections(
  seal: ValueSeal,
  livePrice: number | null,
  chart: ChartBundle | null,
  sessionChangePct: number,
  meta: SigilMetadataLite,
  momentUi: {
    claimPulse: number;
    claimX: number;
    genesisX: number;
    lineageGM: number;
    momentX: number;
    badges: string[];
    seq: { len: number; dir: "up" | "down" | "none" };
    run: number;
    digit: string;
    uniform: boolean;
    fib: boolean;
    sevensCount: number;
  }
) {
  // Detect child/derivative state & exact child Φ (if present)
  const childMode = isDerivative(meta);
  const childExact = getChildExactPhi(meta);

  // Price we’re *displaying* in the UI (already child if upstream provided it)
  const displayPrice = Math.max(0, (livePrice ?? seal.valuePhi) || 0);

  // Parent model baselines
  const parentModelPrice = Math.max(0, seal.valuePhi || 0);
  const pvRaw = Math.max(0, seal.inputs?.pv_phi ?? 0);

  // If child: scale PV to child proportion, mirroring the chart logic
  const scaleRatio =
    childMode && parentModelPrice > 0 ? displayPrice / parentModelPrice : 1;

  const pvDisplay = Math.max(0, pvRaw * scaleRatio);
  const premiumOnly = Math.max(0, displayPrice - pvDisplay);

  const core = [
    { label: childMode ? "Price (child Φ)" : "Live Price (Φ)", value: currency(displayPrice) },
    { label: childMode ? "Intrinsic PV (scaled)" : "Intrinsic PV (Φ)", value: currency(pvDisplay) },
    { label: "Premium (Φ)", value: currency(premiumOnly) },
    { label: "Premium ×", value: (seal.premium ?? 1).toFixed(6) },
    { label: "Moment ×", value: (seal.inputs.momentLift ?? 1).toFixed(6) },
    { label: "Session P/L", value: pct(sessionChangePct) },
  ];

  const trend = chart
    ? [
        { label: "Window steps", value: String(chart.lineData.length) },
        { label: "Slope", value: chart.stats.slope.toFixed(6) },
        { label: "R²", value: chart.stats.r2.toFixed(4) },
        { label: "Change (window)", value: pct(chart.stats.change) },
        { label: "Avg step vol", value: chart.stats.vol.toFixed(6) },
      ]
    : [];

  const series = [
    { label: "Series size", value: String(seal.inputs.size) },
    { label: "Quality", value: String(seal.inputs.quality) },
    { label: "Unique holders", value: String(seal.inputs.uniqueHolders) },
    { label: "Closed fraction", value: fmtPct(seal.inputs.closedFraction) },
    { label: "Age (pulses)", value: String(seal.inputs.agePulses) },
    { label: "Pulses / beat", value: String(seal.inputs.pulsesPerBeat) },
    { label: "Velocity / beat", value: fmt(seal.inputs.velocityPerBeat, 6) },
    { label: "Resonance φ", value: fmt(seal.inputs.resonancePhi) },
    { label: "Median hold (beats)", value: fmt(seal.inputs.medianHoldBeats) },
    { label: "Cadence regularity", value: fmtPct(seal.inputs.cadenceRegularity) },
    { label: "Geometry lift ×", value: fmt(seal.inputs.geometryLift, 6) },
  ];

  const moment = [
    { label: "Claim pulse", value: String(momentUi.claimPulse) },
    { label: "Claim moment ×", value: fmt(momentUi.claimX, 6) },
    { label: "Genesis tilt ×", value: fmt(momentUi.genesisX, 6) },
    { label: "Lineage moments GM ×", value: fmt(momentUi.lineageGM, 6) },
    { label: "Genesis tilt", value: pctSigned(momentUi.genesisX - 1, 2) },
    {
      label: "Digit geometry",
      value:
        momentUi.uniform
          ? `Uniform (${momentUi.digit}×${String(Math.abs(Math.trunc(momentUi.claimPulse))).length})`
          : momentUi.run >= 3
          ? `Run ${momentUi.digit}×${momentUi.run}`
          : "—",
    },
    {
      label: "Sequence",
      value:
        momentUi.seq.len >= 4
          ? `${momentUi.seq.dir === "up" ? "Ascending" : "Descending"} ${momentUi.seq.len}`
          : "—",
    },
    { label: "Fibonacci", value: momentUi.fib ? "yes" : "no" },
    { label: "Lucky 7s", value: momentUi.sevensCount ? `×${momentUi.sevensCount}` : "—" },
    { label: "Badges", value: momentUi.badges.length ? momentUi.badges.join(", ") : "—" },
  ];

  const creator = [
    { label: "Creator verified", value: seal.inputs.creatorVerified ? "yes" : "no" },
    { label: "Creator rep", value: fmt(seal.inputs.creatorRep) },
  ];

  const head = [
    { label: "Computed @ Kai", value: String(seal.computedAtPulse) },
    { label: "Cumulative transfers", value: String(seal.headRef.cumulativeTransfers) },
    { label: "Head window root", value: seal.headRef.transfersWindowRoot ?? "—" },
    ...(seal.headRef.headHash ? [{ label: "Head hash", value: seal.headRef.headHash, mono: true as const }] : []),
  ];

  const bindings = [
    { label: "Valuation stamp", value: seal.stamp, mono: true },
    { label: "Meta pulse", value: String(meta.pulse ?? "—") },
    { label: "Meta beat", value: String(meta.beat ?? "—") },
    { label: "Meta stepIndex", value: String(meta.stepIndex ?? "—") },
  ];

  // Extra inputs passthrough
  const known = new Set([
    "pv_phi",
    "size",
    "quality",
    "creatorVerified",
    "creatorRep",
    "uniqueHolders",
    "closedFraction",
    "cadenceRegularity",
    "medianHoldBeats",
    "velocityPerBeat",
    "resonancePhi",
    "pulsesPerBeat",
    "agePulses",
    "geometryLift",
    "momentLift",
  ]);
  const extraInputs = Object.entries(seal.inputs ?? {})
    .filter(([k]) => !known.has(k))
    .map(([k, v]) => ({
      label: k,
      value:
        typeof v === "number"
          ? String(v)
          : typeof v === "boolean"
          ? (v ? "true" : "false")
          : String(v ?? "—"),
    }));

  // Child-specific rows (only if derivative)
  const childSection =
    childMode
      ? (() => {
          const mm = meta as SigilMetadataLite & Partial<DerivativeHints>;
          const rows: Array<{ label: string; value: string; mono?: boolean }> = [
            { label: "Child Φ (exact)", value: currency(childExact ?? displayPrice) },
            { label: "Scale vs parent", value: fmt(scaleRatio, 6) },
            { label: "Parent Φ (model)", value: currency(parentModelPrice) },
            { label: "Parent PV (Φ)", value: currency(pvRaw) },
          ];

          // Allocation / branch base if present
          const alloc =
            asNum(mm.childAllocationPhi) ??
            asNum(mm.branchBasePhi) ??
            asNum(mm.valuationSource?.childValuePhi) ??
            asNum(mm.stats?.childValuePhi);
          if (alloc != null) rows.push({ label: "Child allocation (Φ)", value: currency(alloc) });

          // Remaining hint if present
          const remaining =
            asNum(mm.stats?.remainingPhi) ??
            asNum(mm.remainingPhi);
          if (remaining != null) rows.push({ label: "Remaining hint (Φ)", value: currency(remaining) });

          // Lineage & locks
          if (typeof mm.childOfHash === "string" && mm.childOfHash) {
            rows.push({ label: "Child of (hash)", value: mm.childOfHash, mono: true });
          }
          rows.push({ label: "Send lock", value: mm.sendLock ? "yes" : "no" });
          if (mm.childClaim?.expireAtPulse != null) {
            rows.push({ label: "Expiry @ Kai", value: String(mm.childClaim.expireAtPulse) });
          }

          return { title: "Child / Derivative", rows };
        })()
      : null;

  const sections: Array<{
    title: string;
    rows: Array<{ label: string; value: string; mono?: boolean }>;
  }> = [
    { title: "Core", rows: core },
    { title: "Trend", rows: trend },
    { title: "Series", rows: series },
    { title: "Moment rarity", rows: moment },
    { title: "Creator", rows: creator },
    { title: "Head / Chain", rows: head },
    { title: "Bindings & Meta", rows: bindings },
  ];

  if (childSection) sections.splice(1, 0, childSection); // show Child right after Core
  if (extraInputs.length) sections.push({ title: "Other inputs", rows: extraInputs });

  return sections;
}
