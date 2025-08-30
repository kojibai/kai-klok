// src/components/valuation/drivers.ts
import type { ValueSeal } from "../../utils/valuation";
import type { ChartBundle } from "./series";
import type { SigilMetadataLite } from "../../utils/valuation";
import { currency, fmt, fmtPct, pct, pctSigned } from "./display";

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
  const pv = Math.max(0, seal.inputs?.pv_phi ?? 0);
  const price = Math.max(0, (livePrice ?? seal.valuePhi) || 0);
  const premiumOnly = Math.max(0, price - pv);

  const core = [
    { label: "Live Price (Φ)", value: currency(price) },
    { label: "Intrinsic PV (Φ)", value: currency(pv) },
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
    ...(seal.headRef.headHash ? [{ label: "Head hash", value: seal.headRef.headHash }] : []),
  ];

  const bindings = [
    { label: "Valuation stamp", value: seal.stamp, mono: true },
    { label: "Meta pulse", value: String(meta.pulse ?? "—") },
    { label: "Meta beat", value: String(meta.beat ?? "—") },
    { label: "Meta stepIndex", value: String(meta.stepIndex ?? "—") },
  ];

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

  if (extraInputs.length) sections.push({ title: "Other inputs", rows: extraInputs });
  return sections;
}
