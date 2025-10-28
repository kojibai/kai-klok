// src/components/valuation/ValuationModal.tsx
/* eslint-disable no-restricted-globals */
"use client";

/* ────────────────────────────────────────────────────────────────
   ValuationModal.tsx · Market Ticker + ΦGlyph Mint
   v24.7 — SHARED PRECISION + Verifier parity (child Φ exact)
   Updates:
   - Display Φ priority = child(meta) → last uploaded glyph → initialGlyph → model.
   - All displayed values (chart line, PV line, donut, main KPI) use CHILD Φ if derivative.
   - PV is *scaled* to child proportion: pv_scaled = pv_parent * (childΦ / parentModelΦ).
   - All values snapped to 6dp via shared helpers (snap6).
   - Prevents drift between:
       • Exhale (Temple-Glyph mint) value
       • Send (child/derivative glyph) value
       • Displayed pool balances
   - Child/Derivative detection includes filename “sigil_send”, sendLock,
     childOfHash, and explicit child fields (childAllocationPhi/branchBasePhi).
   ─────────────────────────────────────────────────────────────── */

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import "./ValuationModal.css";

import {
  buildValueSeal,
  type SigilMetadataLite,
  type ValueSeal,
} from "../utils/valuation";
import { DEFAULT_ISSUANCE_POLICY, quotePhiForUsd } from "../utils/phi-issuance";

import { TrendingUp, Gem, ShieldCheck, UploadCloud } from "lucide-react";

/* ───────── modals + types ───────── */
import GlyphImportModal from "./GlyphImportModal";
import SendSigilModal from "./SendSigilModal";
import MintCompositeModal from "./valuation/MintCompositeModal";
import type { Glyph } from "../glyph/types";

/* ───────── internal modularized pieces ───────── */
import { COLORS, BREATH_MS } from "./valuation/constants";
/* ⬇︎ keep Φ everywhere via `currency`; use $ only via `usd` */
import { currency, usd, pct } from "./valuation/display";
import { supportsDialog } from "./valuation/platform";
import {
  useIsMounted,
  useMedia,
  useBodyScrollLock,
  useFocusTrap,
} from "./valuation/hooks";
import { mulberry32, seedFrom, linreg } from "./valuation/math";
import LiveChart from "./valuation/chart/LiveChart";
import ValueDonut from "./valuation/chart/ValueDonut";
import type { ChartBundle } from "./valuation/series";
import { bootstrapSeries } from "./valuation/series";
import {
  absDigits,
  allSameDigit,
  longestRunSameDigit,
  longestConsecutiveSequence,
  isFibonacciExact,
  momentRarityLiftFromPulse,
  genesisProximityLift,
} from "./valuation/rarity";
import { sha256HexStable } from "./valuation/asset";
import DonorsEditor, { type DonorRow } from "./valuation/DonorsEditor";
import { buildDriversSections } from "./valuation/drivers";

/* ───────── shared micro-Φ helpers (Verifier/UI single source of truth) ───────── */
import {
  addPhi as addΦ,
  subPhi as subΦ,
  sumPhi as sumΦ,
  snap6,
} from "../utils/phi-precision";

/* ─────────────────────────────────────────────────────────────── */
/* Dev-safe logger                                                 */
/* ─────────────────────────────────────────────────────────────── */

const devWarn = (...args: ReadonlyArray<unknown>): void => {
  if (process.env.NODE_ENV !== "production") {
    try {
      // eslint-disable-next-line no-console
      console.debug(...args);
    } catch {
      /* no-op */
    }
  }
};

/* ─────────────────────────────────────────────────────────────── */
/* Types & globals                                                 */
/* ─────────────────────────────────────────────────────────────── */

type Props = {
  open: boolean;
  onClose: () => void;
  meta: SigilMetadataLite;
  nowPulse: number;
  onAttach?: (seal: ValueSeal) => void | Promise<void>;
  initialGlyph?: Glyph;
};

declare global {
  interface Window {
    __SIGIL__?: {
      registerSigilUrl?: (url: string) => void;
    };
  }
}

/* ─────────────────────────────────────────────────────────────── */
/* UI helpers                                                      */
/* ─────────────────────────────────────────────────────────────── */

const onRipple = (e: React.MouseEvent<HTMLElement>) => {
  const t = e.currentTarget;
  const rect = t.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  const y = ((e.clientY - rect.top) / rect.height) * 100;
  t.style.setProperty("--x", `${x}%`);
  t.style.setProperty("--y", `${y}%`);
};

/** Split a Φ value into integer and fractional parts for crisp typography */
const formatPhiParts = (val: number): { int: string; frac: string } => {
  const n = Number.isFinite(val) ? val : 0;
  const s = n.toFixed(6);
  const [i, f] = s.split(".");
  return { int: i, frac: f ? `.${f}` : "" };
};

/** Compact numeric to 6dp, trimming trailing zeros */
const tiny = (n: number) => {
  if (!Number.isFinite(n)) return "0";
  const s = n.toFixed(6);
  return s.replace(/0+$/g, "").replace(/\.$/, "");
};

/** Robust mobile detection to force bottom-sheet fallback where dialog is flaky */
const useForceFallback = (stacked: boolean) => {
  const [forceFallback, setForceFallback] = useState(false);
  useEffect(() => {
    if (typeof navigator === "undefined") return;

    const ua = navigator.userAgent || "";
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isAndroidWebView =
      /wv/.test(ua) || /\bVersion\/\d+\.\d+ Chrome\/\d+\.\d+/.test(ua);

    if (isIOS || isAndroidWebView || stacked) {
      setForceFallback(true);
    } else {
      setForceFallback(false);
    }
  }, [stacked]);

  return forceFallback;
};

/* ─────────────────────────────────────────────────────────────── */
/* Numeric coercion helper (accepts number or numeric-like string) */
/* ─────────────────────────────────────────────────────────────── */

const asNum = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return null;
};

/* Safe alias extractor for dataset/metaDataset without `any` */
const getAliasFrom = (obj: unknown, key: string): number | string | null => {
  if (!obj || typeof obj !== "object") return null;
  const rec = obj as Record<string, unknown>;
  const v = rec[key];
  return typeof v === "number" || typeof v === "string" ? v : null;
};

const ValuationModal: React.FC<Props> = ({
  open,
  onClose,
  meta,
  nowPulse,
  initialGlyph,
}) => {
  const mounted = useIsMounted();

  // Roots
  const dlgRef = useRef<HTMLDialogElement>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);

  // Chrome + layout refs
  const chromeRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bgRootRef = useRef<HTMLElement | null>(null);

  // State
  const [seal, setSeal] = useState<ValueSeal | null>(null);
  const [chart, setChart] = useState<ChartBundle | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  // perf refs
  const liveRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const tickIndexRef = useRef<number>(0);
  const rngRef = useRef<() => number>(() => Math.random());

  // Recharts/iOS reflow
  const [reflowKey, setReflowKey] = useState<number>(0);

  // render-gate
  const [visible, setVisible] = useState(false);

  // choose dialog vs fallback
  const [useFallback, setUseFallback] = useState(false);

  useBodyScrollLock(open);
  useFocusTrap(open, chromeRef);

  // media
  const stacked = useMedia("(max-width: 760px)");
  const chartHeight = stacked ? 160 : 220;

  // ───── POOLED BALANCE + IMPORTED GLYPHS (Verifier-parity via shared μΦ helpers) ─────
  const [importedGlyphs, setImportedGlyphs] = useState<Glyph[]>([]);
  const [balancePhi, setBalancePhi] = useState<number>(0); // stored/displayed as Φ; writes go through snap6/addΦ/subΦ

  // Amounts routed to various actions (kept snapped to 6dp)
  const [balanceForMintPhi, setBalanceForMintPhi] = useState<number>(0);
  const [sendAmountPhi, setSendAmountPhi] = useState<number>(0);

  // Derived pooled hash (deterministic from imported glyph set)
  const [pooledHash, setPooledHash] = useState<string>("");

  // flows
  const [importOpen, setImportOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [mintOpen, setMintOpen] = useState(false); // ⬅️ Mint ΦGlyph modal

  // Donors by URL (for ΦGlyph builder)
  const [donors, setDonors] = useState<DonorRow[]>([{ url: "", amount: 0 }]);

  // Donor total (Verifier-parity via μΦ)
  const totalUrlDonorsPhi = useMemo(
    () => sumΦ(donors.map((d) => Math.max(0, Number(d.amount) || 0))),
    [donors]
  );

  // Exhale value preview (Verifier-exact): donors + balanceForMintPhi
  const exhaleValuePhi = useMemo(
    () => snap6(totalUrlDonorsPhi + Math.max(0, balanceForMintPhi)),
    [totalUrlDonorsPhi, balanceForMintPhi]
  );

  // Keep a named total to pass to children AND satisfy eslint usage
  const totalDonorAmount = exhaleValuePhi;

  // viewport height var for iOS (mobile-friendly safe VH)
  useEffect(() => {
    const setVH = () => {
      if (typeof window === "undefined") return;
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    };
    setVH();
    window.addEventListener("resize", setVH, { passive: true });
    window.addEventListener("orientationchange", setVH);
    return () => {
      window.removeEventListener("resize", setVH);
      window.removeEventListener("orientationchange", setVH);
    };
  }, []);

  // background root
  useEffect(() => {
    if (typeof document === "undefined") return;
    const candidates = ["#__next", "#root", "#app", "main", "body"];
    let root: HTMLElement | null = null;
    for (const sel of candidates) {
      const el =
        sel === "body"
          ? (document.body as HTMLElement)
          : (document.querySelector(sel) as HTMLElement | null);
      if (el) {
        root = el;
        break;
      }
    }
    bgRootRef.current = root ?? document.body;
  }, []);

  // Avoid nested dialog collisions
  useEffect(() => {
    if (!open) {
      setUseFallback(false);
      return;
    }
    const otherModalOpen =
      typeof document !== "undefined" &&
      !!Array.from(document.querySelectorAll("dialog[open]")).find(
        (dlg) => !(dlg as HTMLElement).classList.contains("valuation-modal")
      );
    setUseFallback(!!otherModalOpen);
  }, [open]);

  /* ───────────────── Snap modal to top ───────────────── */
  const snapDialogToTop = useCallback(() => {
    const d = dlgRef.current;
    if (!d) return;
    d.style.position = "fixed";
    d.style.left = "50%";
    d.style.transform = "translate(-50%, 0) translateZ(0)";
    d.style.top = "max(8px, env(safe-area-inset-top))";
    d.style.margin = "0 auto auto";
  }, []);

  // Mobile/iOS: prefer bottom-sheet fallback to avoid native <dialog> quirks
  const forceFallbackOnMobile = useForceFallback(stacked);

  // OPEN/CLOSE + a11y + force chart reflow
  useEffect(() => {
    const d = dlgRef.current;
    const bg = bgRootRef.current;

    const setBgHidden = (hidden: boolean) => {
      if (!bg) return;
      if (hidden) {
        bg.setAttribute("aria-hidden", "true");
        bg.setAttribute("inert", "");
      } else {
        bg.removeAttribute("aria-hidden");
        bg.removeAttribute("inert");
      }
    };

    const usingDialog =
      supportsDialog && !useFallback && !forceFallbackOnMobile && !!d;

    if (usingDialog && d) {
      if (open && !d.open) {
        Promise.resolve().then(() => {
          try {
            d.showModal();
          } catch (err) {
            devWarn("dialog.showModal failed — falling back:", err);
            setUseFallback(true);
            setBgHidden(true);
            setVisible(true);
            return;
          }
          snapDialogToTop();
          setBgHidden(true);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              window.dispatchEvent(new Event("resize"));
              setReflowKey((k) => k + 1);
              setVisible(true);
              if (scrollRef.current) scrollRef.current.scrollTop = 0;
              setTimeout(() => {
                window.dispatchEvent(new Event("resize"));
                setReflowKey((k) => k + 1);
                snapDialogToTop();
              }, 0);
            });
          });
        });
      }
      if (!open && d.open) {
        try {
          d.close();
        } catch {
          /* no-op */
        }
        setBgHidden(false);
        setVisible(false);
      }
    } else {
      // Fallback bottom sheet
      if (open) {
        setBgHidden(true);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.dispatchEvent(new Event("resize"));
            setReflowKey((k) => k + 1);
            setVisible(true);
            if (scrollRef.current) scrollRef.current.scrollTop = 0;
          });
        });
      } else {
        setBgHidden(false);
        setVisible(false);
      }
    }

    return () => {
      const bg2 = bgRootRef.current;
      if (bg2) {
        bg2.removeAttribute("aria-hidden");
        bg2.removeAttribute("inert");
      }
    };
  }, [open, snapDialogToTop, useFallback, forceFallbackOnMobile]);

  // Keep snapped on orientation/resize
  useEffect(() => {
    setReflowKey((k) => k + 1);
    snapDialogToTop();
  }, [stacked, snapDialogToTop]);

  useEffect(() => {
    const handler = () => {
      setReflowKey((k) => k + 1);
      snapDialogToTop();
    };
    window.addEventListener("orientationchange", handler);
    window.addEventListener("resize", handler, { passive: true });
    return () => {
      window.removeEventListener("orientationchange", handler);
      window.removeEventListener("resize", handler);
    };
  }, [snapDialogToTop]);

  // Close on Escape for fallback & normalize dialog cancel
  useEffect(() => {
    const d = dlgRef.current;
    const onKey = (ev: KeyboardEvent) => {
      if (!open) return;
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    if (d) {
      const onCancel = (ev: Event) => {
        ev.preventDefault();
        onClose();
      };
      d.addEventListener("cancel", onCancel as EventListener);
      return () => {
        window.removeEventListener("keydown", onKey);
        d.removeEventListener("cancel", onCancel as EventListener);
      };
    }

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Layout metrics → CSS vars
  useEffect(() => {
    const host = (dlgRef.current ?? fallbackRef.current) as
      | HTMLElement
      | null;
    const headerEl = headerRef.current;
    const footerEl = footerRef.current;

    const update = () => {
      const headerH = headerEl?.offsetHeight ?? 0;
      const footerH = (footerEl?.offsetHeight ?? 0) + 8;
      const innerH =
        typeof window !== "undefined" ? window.innerHeight : 0;

      host?.style.setProperty("--header-h", `${headerH}px`);
      host?.style.setProperty("--footer-h", `${footerH}px`);
      const maxH = Math.max(240, innerH - headerH - footerH - 24);
      host?.style.setProperty("--content-max-h", `${maxH}px`);
    };

    update();

    const roHeader =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(update)
        : null;
    const roFooter =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(update)
        : null;

    if (headerEl && roHeader) roHeader.observe(headerEl);
    if (footerEl && roFooter) roFooter.observe(footerEl);

    const onResize = () => update();
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("orientationchange", onResize);

    return () => {
      roHeader?.disconnect();
      roFooter?.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [open]);

  /** Backdrop pointer-down handler used for BOTH dialog & fallback (closes on outside tap) */
  const onBackdropPointerDown: React.PointerEventHandler<Element> =
    useCallback(
      (e) => {
        if (e.currentTarget === e.target) onClose();
      },
      [onClose]
    );

  // ───────── Head-root carrier (Verifier parity) ─────────
  type HeadRootCarrier = {
    transfersWindowRoot?: string;
    transfersWindowRootV14?: string;
  };

  const getHeadRoot = (m: SigilMetadataLite): string => {
    const x = m as SigilMetadataLite & Partial<HeadRootCarrier>;
    return x.transfersWindowRoot ?? x.transfersWindowRootV14 ?? "";
  };

  /* ───────── Child/Derivative detection + exact child Φ extraction (bulletproof) ───────── */
  type DerivativeHints = {
    fileName?: string;
    sourceName?: string;
    name?: string;
    filename?: string;
    file?: string;
    path?: string;

    canonicalContext?: string;
    context?: string;

    // Strong child signals
    childOfHash?: string;
    sendLock?: unknown;
    childClaim?: { steps?: number; expireAtPulse?: number };

    // Exact child value fields (most authoritative first)
    childAllocationPhi?: number | string;
    branchBasePhi?: number | string;

    // Other places we’ve stashed child value before
    valuationSource?: { childValuePhi?: number | string };
    stats?: { childValuePhi?: number | string; remainingPhi?: number | string };

    // Relaxed fallbacks (only if derivative confirmed)
    remainingPhi?: number | string;
    valuePhi?: number | string;
    value?: number | string;

    // Sometimes attached via dataset/metadataset on loaders
    dataset?: Record<string, unknown>;
    metaDataset?: Record<string, unknown>;

    // ── Legacy aliases (strictly typed; no `any`)
    childValuePhi?: number | string;
    childPhi?: number | string;
    value_child_phi?: number | string;
    "child-value-phi"?: number | string;
    child_value_phi?: number | string;
  };

  /** Heuristics to declare “this is a derivative (child) glyph” — lenient like Verifier */
  const isDerivative = (m: SigilMetadataLite): boolean => {
    const mm = m as SigilMetadataLite & Partial<DerivativeHints>;

    // name-ish fields combined
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

    // context
    const ctx = String(mm.canonicalContext ?? mm.context ?? "").toLowerCase();

    // filename signals: “sigil_send”, with underscore/hyphen variants
    if (/\bsigil[_-]?send\b/.test(nameish)) return true;

    // explicit contexts
    if (ctx === "derivative" || ctx === "child") return true;

    // lineage & locks
    if (typeof mm.childOfHash === "string" && mm.childOfHash) return true;
    if (mm.sendLock && typeof mm.sendLock === "object") return true;
    if (mm.childClaim && typeof mm.childClaim === "object") return true;

    // explicit child value fields imply derivative
    if (mm.childAllocationPhi != null || mm.branchBasePhi != null) return true;
    if (mm.stats?.childValuePhi != null) return true;
    if (mm.valuationSource?.childValuePhi != null) return true;

    return false;
  };

  /** Extract the child’s *exact* Φ (6dp) from any known slot (first hit wins) */
  const getChildExactPhi = (m: SigilMetadataLite): number | null => {
    const mm = m as SigilMetadataLite & Partial<DerivativeHints>;
    const sureChild = isDerivative(m);

    const pick = (...vals: unknown[]): number | null => {
      for (const v of vals) {
        const n = asNum(v);
        if (n != null && n >= 0) return snap6(n);
      }
      return null;
    };

    // Authoritative first, then aliases, then dataset/metaDataset.
    // Relaxed fallbacks only if sure derivative.
    return (
      pick(
        // authoritative
        mm.childAllocationPhi,
        mm.branchBasePhi,
        mm.valuationSource?.childValuePhi,
        mm.stats?.childValuePhi,

        // legacy aliases (strictly typed)
        mm.childValuePhi,
        mm.childPhi,
        mm.value_child_phi,
        mm["child-value-phi"],
        mm.child_value_phi,

        // loader datasets (safe reads; cover common alias spellings)
        getAliasFrom(mm.dataset, "childValuePhi"),
        getAliasFrom(mm.metaDataset, "childValuePhi"),
        getAliasFrom(mm.dataset, "child-value-phi"),
        getAliasFrom(mm.metaDataset, "child-value-phi"),
        getAliasFrom(mm.dataset, "child_value_phi"),
        getAliasFrom(mm.metaDataset, "child_value_phi"),

        // relaxed fallbacks if confirmed derivative
        ...(sureChild
          ? [mm.stats?.remainingPhi, mm.remainingPhi, mm.valuePhi, mm.value]
          : [])
      ) ?? null
    );
  };

  /* ───────── Exact glyph Φ resolution (priority: child → last upload → initial) ───────── */
  const glyphPhiExact = useMemo<number | null>(() => {
    // 1) Prefer meta-derived child Φ if this is a derivative glyph
    if (isDerivative(meta)) {
      const v = getChildExactPhi(meta);
      if (v != null) return v; // exact 6dp child value
    }

    // 2) If user uploaded glyphs in this session, show the most recent one
    if (importedGlyphs.length >= 1) {
      const last = importedGlyphs[importedGlyphs.length - 1];
      const n = Number(last?.value);
      if (Number.isFinite(n)) return snap6(n);
    }

    // 3) Finally, fall back to the explicit initialGlyph (if any)
    if (initialGlyph && Number.isFinite(Number(initialGlyph.value))) {
      return snap6(Number(initialGlyph.value));
    }

    return null;
  }, [meta, importedGlyphs, initialGlyph]);

  /* ───────── Bootstrap valuation + series (child Φ first) ───────── */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const headHash = getHeadRoot(meta);
        const { seal: builtSeal } = await buildValueSeal(
          meta,
          nowPulse,
          sha256HexStable,
          headHash
        );

        if (!alive) return;
        setSeal(builtSeal);

        // Prefer exact child Φ if present; else model valuation
        const preferred = glyphPhiExact ?? snap6(builtSeal.valuePhi);

        rngRef.current = mulberry32(seedFrom(meta, nowPulse));
        const boot = bootstrapSeries(builtSeal, meta, nowPulse);
        setChart(boot);

        startRef.current = preferred;
        liveRef.current = preferred;
        tickIndexRef.current = boot.lineData[boot.lineData.length - 1]?.i ?? 0;
        setLivePrice(preferred);
      } catch (err) {
        devWarn("buildValueSeal/bootstrap failed:", err);
      }
    })();
    return () => {
      alive = false;
    };
  }, [meta, nowPulse, glyphPhiExact]);

  /* ───────── Breath loop (visual only; model parity preserved) ───────── */
  useEffect(() => {
    if (!seal || !chart) return;
    let timer: number | undefined;

    const tick = () => {
      const rng = rngRef.current;
      const last = liveRef.current;
      const target = glyphPhiExact ?? seal.valuePhi; // ← follow child exact Φ when present
      const noise = (rng() - 0.5) * 0.032 * target; // ±3.2%
      const next = Math.max(0, last + (target - last) * 0.12 + noise);
      const dir: "up" | "down" | null =
        next > last ? "up" : next < last ? "down" : null;

      liveRef.current = next;
      setLivePrice(next);
      setFlash(dir);
      window.setTimeout(() => setFlash(null), 520);

      setChart((prev: ChartBundle | null) => {
        if (!prev) return prev;
        const nextI = (tickIndexRef.current || 0) + 1;
        tickIndexRef.current = nextI;

        const nextSpark = [
          ...prev.sparkData.slice(1),
          { i: nextI, value: next },
        ];

        const t = nextI / (prev.lineData[prev.lineData.length - 1].i + 1);
        const premiumFactor = 0.98 + 0.08 * Math.abs(Math.sin(t * Math.PI));

        const nextLine = [
          ...prev.lineData.slice(1),
          { i: nextI, value: next, premium: next * premiumFactor },
        ];

        const y = nextLine.map((p) => p.value);
        const { slope, r2 } = linreg(y);
        const change = ((y[y.length - 1] - y[0]) / (y[0] || 1)) * 100;
        const vol =
          y.reduce(
            (a, _, k) => (k ? a + Math.abs(y[k] - y[k - 1]) : 0),
            0
          ) / (y.length - 1 || 1);

        return {
          sparkData: nextSpark,
          lineData: nextLine,
          stats: { slope, r2, change, vol },
        };
      });

      timer = window.setTimeout(tick, BREATH_MS);
    };

    timer = window.setTimeout(tick, BREATH_MS);
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [seal, chart, glyphPhiExact]);

  // Seed initial glyph into the pool (once per open)
  const seededRef = useRef(false);
  useEffect(() => {
    if (!open) {
      seededRef.current = false;
      return;
    }
    if (seededRef.current) return;

    if (initialGlyph) {
      const v = snap6(Number(initialGlyph.value ?? 0));
      setImportedGlyphs([initialGlyph]);
      setBalancePhi(v); // exact 6dp
      seededRef.current = true;
    } else {
      setImportedGlyphs([]);
      setBalancePhi(0);
      seededRef.current = true;
    }
  }, [open, initialGlyph]);

  // Recompute pooled hash whenever imported glyphs change
  useEffect(() => {
    const summarize = importedGlyphs.map((g) => ({
      h: g.hash,
      v: snap6(Number(g.value ?? 0)),
    }));
    const s = JSON.stringify(summarize);
    (async () => {
      const h = await sha256HexStable(`pool:${s}`);
      setPooledHash(h);
    })();
  }, [importedGlyphs]);

  // When a glyph is imported, add to pool & bump session baseline (Verifier exact)
  const handleImportedGlyph = useCallback((glyph: Glyph) => {
    setImportedGlyphs((prev: Glyph[]) => [...prev, glyph]);
    const v = snap6(Number(glyph.value ?? 0));
    setBalancePhi((prev: number) => addΦ(prev, v));
    // Live ticker re-center to latest imported glyph value for UX
    liveRef.current = v;
    setLivePrice(v);
    startRef.current = v;
  }, []);

  // ───────── Child-aware PV scaling (for ALL displays) ─────────
  // Display Φ: prefer exact child Φ when present
  const modelPhi = Number.isFinite(livePrice)
    ? snap6(livePrice as number)
    : snap6(seal?.valuePhi ?? 0);
  const displayPhi = glyphPhiExact ?? modelPhi;

  // Parent model Φ (for scaling baseline)
  const parentModelPhi = snap6(seal?.valuePhi ?? 0);
  const isChild = isDerivative(meta);
  const pvScaled = useMemo(() => {
    const pvParent = snap6(seal?.inputs.pv_phi ?? 0);
    const ratio =
      isChild && parentModelPhi > 0 ? displayPhi / parentModelPhi : 1;
    return snap6(Math.max(0, pvParent * Math.max(0, ratio)));
  }, [seal, isChild, parentModelPhi, displayPhi]);

  const displayUsd = displayPhi * (quotePhiForUsd(
    { meta, nowPulse, usd: 100, currentStreakDays: 0, lifetimeUsdSoFar: 0 },
    DEFAULT_ISSUANCE_POLICY
  ).usdPerPhi || 0); // keep consistent with usdPerPhi below

  const phiParts = formatPhiParts(displayPhi);

  // derived donut data (PV vs premium) — CHILD-AWARE
  const pieData = useMemo(() => {
    const pv = pvScaled;
    const p = Math.max(0, snap6(displayPhi));
    const premOnly = Math.max(0, snap6(p - pv));
    return [
      { name: "Intrinsic (PV)", value: pv },
      { name: "Premium", value: premOnly },
    ];
  }, [pvScaled, displayPhi]);

  const sessionChangePct = useMemo(() => {
    if (livePrice == null) return 0;
    const start = startRef.current || livePrice;
    return ((livePrice - start) / (start || 1)) * 100;
  }, [livePrice]);

  /* ---------- Live USD quote (same model as ExhaleNote) ---------- */
  const issuancePolicy = DEFAULT_ISSUANCE_POLICY;
  const liveQuote = useMemo(() => {
    try {
      return quotePhiForUsd(
        {
          meta,
          nowPulse,
          usd: 100,
          currentStreakDays: 0,
          lifetimeUsdSoFar: 0,
        },
        issuancePolicy
      );
    } catch {
      return { usdPerPhi: 0, phiPerUsd: 0 };
    }
  }, [meta, nowPulse, issuancePolicy]);

  const usdPerPhi = liveQuote.usdPerPhi || 0;
  const phiPerUsd = liveQuote.phiPerUsd || 0;

  const usdPerPhiText = `${usd(usdPerPhi)}/Φ`;
  const phiPerUsdText = `${tiny(snap6(phiPerUsd))} Φ/$`;

  /* ───────── Moment display analysis (UI-only) ───────── */
  const momentUi = useMemo(() => {
    const claimPulse =
      typeof meta.kaiPulse === "number"
        ? meta.kaiPulse
        : typeof meta.pulse === "number"
        ? meta.pulse
        : nowPulse;

    const s = absDigits(claimPulse);
    const fib = isFibonacciExact(claimPulse);
    const uniform = allSameDigit(s);
    const { run, digit } = longestRunSameDigit(s);
    const seq = longestConsecutiveSequence(s);

    const pulsesPerBeat = seal?.inputs?.pulsesPerBeat || 44;
    const yearPulsesApprox = 36 * pulsesPerBeat * 11 * 336;

    const genesisX = genesisProximityLift(claimPulse, yearPulsesApprox);
    const claimX = momentRarityLiftFromPulse(claimPulse);
    const momentX = seal?.inputs?.momentLift || 1;

    const lineageGM = Math.max(1e-9, momentX / (claimX * genesisX));

    const badges: string[] = [];
    if (fib) badges.push("Fibonacci pulse");
    if (uniform) badges.push(`Uniform digits (${s[0]}×${s.length})`);
    const seqLen = seq.len;
    if (seqLen >= 4) badges.push(`${seq.dir === "up" ? "Asc" : "Desc"} ${seqLen}`);

    return {
      claimPulse,
      claimX,
      genesisX,
      lineageGM,
      momentX,
      badges,
      seq,
      run,
      digit,
      uniform,
      fib,
      sevensCount: (s.match(/7/g) || []).length,
    };
  }, [meta, nowPulse, seal?.inputs?.momentLift, seal?.inputs?.pulsesPerBeat]);

  /* ───────── Drivers model (already child-aware in buildDriversSections) ───────── */
  const driversSections = useMemo(() => {
    if (!seal) return [];
    return buildDriversSections(
      seal,
      displayPhi, // child Φ flows through
      chart,
      sessionChangePct,
      meta,
      momentUi
    );
  }, [seal, displayPhi, chart, sessionChangePct, meta, momentUi]);

  /* ───────── donors editor helpers ───────── */
  const addDonor = () =>
    setDonors((rows: DonorRow[]) => [...rows, { url: "", amount: 0 }]);

  const removeDonor = (idx: number) =>
    setDonors((rows: DonorRow[]) => rows.filter((_, i) => i !== idx));

  const updateDonor = (idx: number, patch: Partial<DonorRow>) =>
    setDonors((rows: DonorRow[]) =>
      rows.map((r, i) => {
        const next = { ...r, ...patch };
        // snap donor amount to 6dp to keep exact parity
        next.amount = snap6(Math.max(0, Number(next.amount) || 0));
        return i === idx ? next : r;
      })
    );

  // Open the ΦGlyph mint modal (Exhale)
  const onMintComposite = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      onRipple(e);
      setMintOpen(true);
    },
    []
  );

  /* ---------- Pooled glyph (for Send modal) ---------- */
  const pooledGlyph: Glyph | null = useMemo(() => {
    if (!pooledHash) return null;
    const baseMeta =
      importedGlyphs.length > 0
        ? importedGlyphs[importedGlyphs.length - 1].meta
        : meta;
    return {
      hash: pooledHash,
      value: snap6(balancePhi),
      pulseCreated: nowPulse,
      meta: baseMeta,
    } as Glyph;
  }, [pooledHash, importedGlyphs, balancePhi, nowPulse, meta]);

  // ⬇️ keep hooks above; after that we can render-gate
  if (!mounted) return null;

  const ModalChrome = (
    <div
      className="val-chrome"
      ref={chromeRef}
      data-compact={stacked ? "1" : "0"}
    >
      <div className="val-aura" aria-hidden />
      <div className="val-topbar" ref={headerRef}>
        <h5 className="val-title">
          <span className="phi" aria-hidden>
            Φ
          </span>{" "}
          Asset
        </h5>
        <div className="val-top-actions" role="toolbar" aria-label="Actions">
          {!stacked && (
            <>
              <div className="balance-chip" title="Pooled Φ balance">
                Pool:&nbsp;
                <strong className="mono">
                  {currency(snap6(balancePhi))}
                </strong>
              </div>
              <input
                className="send-amt-input"
                type="number"
                step="0.000001"
                min={0}
                max={snap6(balancePhi)}
                placeholder="Φ to send"
                aria-label="Amount from pool to send"
                value={Number.isFinite(sendAmountPhi) ? sendAmountPhi : 0}
                onChange={(e) => {
                  const raw = Number(e.currentTarget.value || 0);
                  const clamped = Math.min(Math.max(0, raw), balancePhi);
                  setSendAmountPhi(snap6(clamped));
                }}
              />
              <button
                className="btn primary attach-btn"
                onClick={(ev) => {
                  onRipple(ev);
                  if (pooledGlyph && sendAmountPhi > 0) setSendOpen(true);
                }}
                aria-label="Send glyph"
                disabled={!pooledGlyph || sendAmountPhi <= 0}
                title={
                  !pooledGlyph
                    ? "Upload a glyph first"
                    : sendAmountPhi <= 0
                    ? "Enter an amount to send"
                    : "Send derivative glyph"
                }
              >
                <Gem size={16} />
                <span className="hide-xs">Send</span>
              </button>
              <button
                className="btn ghost small"
                onClick={() => setImportOpen(true)}
                title="Upload Kairos glyph"
              >
                <UploadCloud size={16} />
                <span className="small hide-xs">Upload</span>
              </button>
              <button
                className="btn secondary small"
                onClick={onMintComposite}
                title="Exhale Temple-Glyph (ZIP)"
                disabled={totalDonorAmount <= 0}
              >
                <span className="small hide-xs">Exhale</span>
              </button>
            </>
          )}

          <span className="live-chip" aria-live="polite">
            <span className="live-dot" /> LIVE
          </span>

          <button
            className="btn close-btn holo"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </div>

      {/* Body (scroll container) */}
      <div className="val-body" role="document" ref={scrollRef}>
        {seal && chart ? (
          <>
            <div className="val-layout">
              <div className="val-main">
                <section className="card kpi-card">
                  <header className="card-hd">
                    <div className="hd-left">
                      <TrendingUp size={18} />
                      <strong>Valuation</strong>
                    </div>
                    <div className="badge dim">
                      <ShieldCheck size={16} /> Kai {seal.computedAtPulse}
                    </div>
                  </header>

                  <div className="card-bd">
                    <div className="kpi-row">
                      <div className="kpi-main">
                        {/* Big Φ with inline USD — SHOW $ ONLY HERE */}
                        <div
                          className={
                            "figure-xl ticker-price " +
                            (flash === "up"
                              ? "flash-up"
                              : flash === "down"
                              ? "flash-down"
                              : "")
                          }
                          title={isChild ? "Child Φ value with indicative USD" : "Φ value with indicative USD"}
                          aria-live="polite"
                        >
                          <span className="phi-mark" aria-hidden>
                            Φ
                          </span>
                          <span className="phi-int">{phiParts.int}</span>
                          <span className="phi-frac">{phiParts.frac}</span>
                          <span className="usd-inline">≈ {usd(displayUsd)}</span>
                        </div>

                        <div className="subtle small kpi-subline">
                          <span
                            className={sessionChangePct >= 0 ? "gain" : "loss"}
                          >
                            {pct(sessionChangePct)}
                          </span>
                          &nbsp;session <span className="dot">•</span>{" "}
                          {usdPerPhiText} <span className="dot">•</span>{" "}
                          {phiPerUsdText} <span className="dot">•</span> premium ×
                          {(seal.premium ?? 1).toFixed(6)}{" "}
                          <span className="dot">•</span> moment ×
                          {(seal.inputs.momentLift ?? 1).toFixed(6)}
                        </div>
                      </div>

                      <div className="kpi-spark">
                        <div className="spark-meta">
                          <TrendingUp size={16} />
                          <span className="small subtle">
                            {`${pct(chart.stats.change)} over ${
                              chart.lineData.length
                            } steps`}
                          </span>
                        </div>

                        {visible && (
                      <LiveChart
                        data={chart.lineData}
                        live={displayPhi}                                        // child-aware
                        pv={pvScaled}                                            // already scaled in parent; disable internal scaling:
                        premiumX={seal.premium ?? 1}
                        momentX={seal.inputs.momentLift ?? 1}
                        colors={Array.from(COLORS)}
                        height={chartHeight}
                        reflowKey={reflowKey}
                        usdPerPhi={Number.isFinite(usdPerPhi) ? usdPerPhi : 0}
                        childPhiExact={glyphPhiExact ?? null}                    // ensures child at first render
                        scalePvToChild={false}
                      />


                        )}

                        {!stacked && visible && (
                          <ValueDonut
                            data={pieData}                   // CHILD-aware donut
                            colors={Array.from(COLORS)}
                            size={120}
                          />
                        )}

                        {/* MOBILE action cluster */}
                        {stacked && visible && (
                          <section
                            className="card mobile-actions actions-card"
                            aria-label="Glyph & Pool"
                          >
                            <div className="card-bd">
                              <div className="actions-balance-row">
                                <div
                                  className="balance-chip"
                                  title="Pooled Φ balance"
                                >
                                  Pool:&nbsp;
                                  <strong className="mono">
                                    {currency(snap6(balancePhi))}
                                  </strong>
                                </div>
                              </div>

                              <div className="actions-grid">
                                <input
                                  className="send-amt-input"
                                  type="number"
                                  step="0.000001"
                                  min={0}
                                  max={snap6(balancePhi)}
                                  placeholder="Φ to send"
                                  aria-label="Amount from pool to send"
                                  value={
                                    Number.isFinite(sendAmountPhi)
                                      ? sendAmountPhi
                                      : 0
                                  }
                                  onChange={(e) => {
                                    const raw = Number(e.currentTarget.value || 0);
                                    const clamped = Math.min(
                                      Math.max(0, raw),
                                      balancePhi
                                    );
                                    setSendAmountPhi(snap6(clamped));
                                  }}
                                />
                                <button
                                  className="btn primary btn-full"
                                  onClick={(ev) => {
                                    onRipple(ev);
                                    if (pooledGlyph && sendAmountPhi > 0)
                                      setSendOpen(true);
                                  }}
                                  aria-label="Send glyph"
                                  disabled={!pooledGlyph || sendAmountPhi <= 0}
                                  title={
                                    !pooledGlyph
                                      ? "Upload a glyph first"
                                      : sendAmountPhi <= 0
                                      ? "Enter an amount to send"
                                      : "Send derivative glyph"
                                  }
                                >
                                  <Gem size={16} /> Send
                                </button>
                              </div>

                              <div className="actions-grid">
                                <button
                                  className="btn ghost btn-full"
                                  onClick={() => setImportOpen(true)}
                                  title="Upload Kairos glyph"
                                >
                                  <UploadCloud size={16} /> Upload Glyph
                                </button>

                                <button
                                  className="btn secondary btn-full"
                                  onClick={onMintComposite}
                                  title="Exhale Temple-Glyph (ZIP)"
                                  disabled={totalDonorAmount <= 0}
                                >
                                  Exhale
                                </button>
                              </div>
                            </div>
                          </section>
                        )}

                        {/* MOBILE Donors */}
                        {stacked && (
                          <DonorsEditor
                            donors={donors}
                            balancePhi={snap6(balancePhi)}
                            balanceForMintPhi={snap6(balanceForMintPhi)}
                            setBalanceForMintPhi={(v) =>
                              setBalanceForMintPhi(snap6(Math.max(0, v)))
                            }
                            addDonor={addDonor}
                            removeDonor={removeDonor}
                            updateDonor={updateDonor}
                            onMintComposite={onMintComposite}
                            minting={false}
                            totalDonorAmount={totalDonorAmount}
                          />
                        )}

                        {/* MOBILE drivers */}
                        {stacked && (
                          <section
                            className="card drivers-card mobile-inline"
                            aria-label="Drivers"
                          >
                            <header className="card-hd">
                              <div className="hd-left">
                                <ShieldCheck size={16} />
                                <strong>Drivers</strong>
                              </div>
                              <div className="badge dim small">
                                live&nbsp;•&nbsp;
                                {driversSections.reduce(
                                  (n, s) => n + s.rows.length,
                                  0
                                )}{" "}
                                &nbsp;fields
                              </div>
                            </header>

                            <div className="drivers-search">
                              <input
                                type="search"
                                className="drivers-input"
                                placeholder="Filter drivers…"
                                aria-label="Filter drivers"
                                onChange={(ev) => {
                                  const term =
                                    ev.currentTarget.value.toLowerCase();
                                  const host =
                                    ev.currentTarget.closest(
                                      ".drivers-card"
                                    ) as HTMLElement | null;
                                  if (host) {
                                    host.style.setProperty(
                                      "--drivers-filter",
                                      term
                                    );
                                  }
                                }}
                              />
                            </div>

                            <div className="drivers-panel" role="list">
                              {driversSections.map((section, i) => (
                                <div
                                  className="drivers-section"
                                  key={`m-${i}`}
                                >
                                  <div className="drivers-title">
                                    {section.title}
                                  </div>
                                  <div className="drivers-grid">
                                    {section.rows.map((row, j) => (
                                      <div
                                        className="drivers-row"
                                        key={`m-${i}-${j}`}
                                        role="listitem"
                                      >
                                        <div className="drivers-k">
                                          {row.label}
                                        </div>
                                        <div
                                          className={
                                            "drivers-v" +
                                            (row.mono ? " mono" : "")
                                          }
                                        >
                                          {row.value}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </section>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Donors + Mint — DESKTOP/TABLET ONLY */}
                {!stacked && (
                  <DonorsEditor
                    donors={donors}
                    balancePhi={snap6(balancePhi)}
                    balanceForMintPhi={snap6(balanceForMintPhi)}
                    setBalanceForMintPhi={(v) =>
                      setBalanceForMintPhi(snap6(Math.max(0, v)))
                    }
                    addDonor={addDonor}
                    removeDonor={removeDonor}
                    updateDonor={updateDonor}
                    onMintComposite={onMintComposite}
                    minting={false}
                    totalDonorAmount={totalDonorAmount}
                  />
                )}

                {/* Imported glyphs summary */}
                <section className="card pool-card" aria-label="Pooled glyphs">
                  <header className="card-hd">
                    <div className="hd-left">
                      <UploadCloud size={16} />
                      <strong>Pool</strong>
                    </div>
                    <div className="badge dim small">
                      {currency(snap6(balancePhi))}
                    </div>
                  </header>
                  <div className="card-bd">
                    {importedGlyphs.length === 0 ? (
                      <div className="small subtle">
                        No glyphs added yet. Upload to start a pool.
                      </div>
                    ) : (
                      <div className="pool-list" role="list">
                        {importedGlyphs.map((g, i) => (
                          <div
                            className="pool-item"
                            key={`g-${i}`}
                            role="listitem"
                          >
                            <div className="mono small">{g.hash}</div>
                            <div className="mono small">
                              {currency(snap6(Number(g.value)))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="small subtle">
                      Pool grows with each uploaded glyph. Sending deducts from
                      the pool; Inhaling Temple-Glyphs does not.
                    </div>
                  </div>
                </section>
              </div>

              {/* RIGHT: Drivers Panel — DESKTOP ONLY */}
              {!stacked && (
                <aside className="val-aside">
                  <section className="card drivers-card">
                    <header className="card-hd">
                      <div className="hd-left">
                        <ShieldCheck size={16} />
                        <strong>Drivers</strong>
                      </div>
                      <div className="badge dim small">
                        live&nbsp;•&nbsp;
                        {driversSections.reduce(
                          (n, s) => n + s.rows.length,
                          0
                        )}
                        &nbsp;fields
                      </div>
                    </header>

                    <div className="drivers-search">
                      <input
                        type="search"
                        className="drivers-input"
                        placeholder="Filter drivers…"
                        aria-label="Filter drivers"
                        onChange={(ev) => {
                          const term =
                            ev.currentTarget.value.toLowerCase();
                          const host =
                            ev.currentTarget.closest(
                              ".drivers-card"
                            ) as HTMLElement | null;
                          if (host) {
                            host.style.setProperty("--drivers-filter", term);
                          }
                        }}
                      />
                    </div>

                    <div className="drivers-panel" role="list">
                      {driversSections.map((section, i) => (
                        <div className="drivers-section" key={i}>
                          <div className="drivers-title">{section.title}</div>
                          <div className="drivers-grid">
                            {section.rows.map((row, j) => (
                              <div
                                className="drivers-row"
                                key={`${i}-${j}`}
                                role="listitem"
                              >
                                <div className="drivers-k">{row.label}</div>
                                <div
                                  className={
                                    "drivers-v" + (row.mono ? " mono" : "")
                                  }
                                >
                                  {row.value}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </aside>
              )}
            </div>

            {/* Head Binding */}
            <section className="section">
              <h4 className="section-title">Head Binding</h4>
              <div className="grid">
                <div className="tile">
                  <span className="subtle">cumulative transfers</span>
                  <strong>{seal.headRef.cumulativeTransfers}</strong>
                </div>
                <div className="tile wide">
                  <span className="subtle">head window root</span>
                  <code className="mono">
                    {seal.headRef.transfersWindowRoot ?? "—"}
                  </code>
                </div>
                {seal.headRef.headHash && (
                  <div className="tile wide">
                    <span className="subtle">head hash</span>
                    <code className="mono">{seal.headRef.headHash}</code>
                  </div>
                )}
              </div>
            </section>
          </>
        ) : (
          <div className="card" aria-busy="true">
            <header className="card-hd">
              <div className="hd-left">
                <TrendingUp size={18} />
                <strong>Valuation</strong>
              </div>
              <div className="badge dim">Loading…</div>
            </header>
            <div className="card-bd">
              <div className="figure-xl subtle">—</div>
              <div className="small subtle">Preparing live series…</div>
            </div>
          </div>
        )}
      </div>

      <footer className="val-footer" ref={footerRef}>
        <div className="footer-actions" />
      </footer>

      {/* Upload glyph popover (adds to pool) */}
      <GlyphImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImportedGlyph}
      />

      {/* Send glyph popover (EXACT child value) */}
      {pooledGlyph && sendOpen && (
        <SendSigilModal
          isOpen={sendOpen}
          onClose={() => setSendOpen(false)}
          sourceGlyph={{
            ...pooledGlyph,
            value: snap6(sendAmountPhi), // exact 6dp child value
          }}
          onSend={(newGlyph) => {
            const spent = snap6(Number(newGlyph.value ?? 0));
            setBalancePhi((prev: number) => subΦ(prev, spent)); // exact deduct
            setSendOpen(false);
          }}
        />
      )}

      {/* Mint ΦGlyph popover (EXACT exhale value) */}
      <MintCompositeModal
        isOpen={mintOpen}
        onClose={() => setMintOpen(false)}
        donors={donors}
        balancePhi={snap6(balancePhi)}
        balanceForMintPhi={snap6(balanceForMintPhi)}
        setBalanceForMintPhi={(v) =>
          setBalanceForMintPhi(snap6(Math.max(0, v)))
        }
        addDonor={addDonor}
        removeDonor={removeDonor}
        updateDonor={updateDonor}
        totalDonorAmount={totalDonorAmount} // pass exact 6dp
        onMinted={() => {
          // hook: toast/log if desired
        }}
      />
    </div>
  );

  // Decide final rendering path
  const canUseDialog =
    supportsDialog && !useFallback && !forceFallbackOnMobile;

  return createPortal(
    canUseDialog ? (
      <dialog
        ref={dlgRef}
        className="valuation-modal"
        aria-label="Φ Valuation"
        aria-modal="true"
        onPointerDown={
          onBackdropPointerDown as React.PointerEventHandler<HTMLDialogElement>
        }
        style={{
          position: "fixed",
          left: "50%",
          transform: "translate(-50%, 0) translateZ(0)",
          top: "max(8px, env(safe-area-inset-top))",
          margin: "0 auto auto",
        }}
      >
        {ModalChrome}
      </dialog>
    ) : open ? (
      <div
        ref={fallbackRef}
        className="valuation-modal fallback-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label="Φ Valuation"
        onPointerDown={
          onBackdropPointerDown as React.PointerEventHandler<HTMLDivElement>
        }
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        tabIndex={-1}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div
          className="fallback-sheet"
          onPointerDown={(ev) => ev.stopPropagation()}
          style={{ transform: "none", marginTop: 0 }}
        >
          {ModalChrome}
        </div>
      </div>
    ) : null,
    document.body
  );
};

export default ValuationModal;
