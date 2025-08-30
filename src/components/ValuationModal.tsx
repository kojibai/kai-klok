/* eslint-disable no-restricted-globals */
"use client";

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

import { TrendingUp, Gem, ShieldCheck, UploadCloud } from "lucide-react";

/* ───────── modals + types ───────── */
import GlyphImportModal from "./GlyphImportModal";
import SendSigilModal from "./SendSigilModal";
import MintCompositeModal from "./valuation/MintCompositeModal";
import type { Glyph } from "../glyph/types";

/* ───────── internal modularized pieces ───────── */
import { COLORS, BREATH_MS } from "./valuation/constants";
import { currency, pct } from "./valuation/display";
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
import {
  sha256HexStable,
} from "./valuation/asset";
import DonorsEditor, { type DonorRow } from "./valuation/DonorsEditor";
import { buildDriversSections } from "./valuation/drivers";

/** ----------------------------------------------------------------
 * ValuationModal — Market Ticker + ΦGlyph Mint
 * ----------------------------------------------------------------- */

type Props = {
  open: boolean;
  onClose: () => void;
  meta: SigilMetadataLite;
  nowPulse: number;
  onAttach?: (seal: ValueSeal) => void | Promise<void>;
  initialGlyph?: Glyph;
};

/* Augment Window to avoid any-casts */
declare global {
  interface Window {
    __SIGIL__?: {
      registerSigilUrl?: (url: string) => void;
    };
  }
}

/* ───────── Dev-safe logger (no explicit any) ───────── */
const devWarn = (...args: ReadonlyArray<unknown>): void => {
  if (process.env.NODE_ENV !== "production") {
    try {
      // eslint-disable-next-line no-console
      console.debug(...args);
    } catch (err: unknown) {
      // keep block non-empty without rethrowing
      void String(err);
    }
  }
};


/* ───────── Helpers ───────── */
const onRipple = (e: React.MouseEvent<HTMLElement>) => {
  const t = e.currentTarget;
  const rect = t.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  const y = ((e.clientY - rect.top) / rect.height) * 100;
  t.style.setProperty("--x", `${x}%`);
  t.style.setProperty("--y", `${y}%`);
};

const round6 = (n: number) => Number((Number.isFinite(n) ? n : 0).toFixed(6));

/* ───────── Main Component ───────── */
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

  // LIVE price (breath)
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
  const canUseModal = supportsDialog && !useFallback;

  useBodyScrollLock(open);
  useFocusTrap(open, chromeRef);

  // media
  const stacked = useMedia("(max-width: 760px)");
  const chartHeight = stacked ? 160 : 220;

  // POOLED BALANCE + IMPORTED GLYPHS
  const [importedGlyphs, setImportedGlyphs] = useState<Glyph[]>([]);
  const [balancePhi, setBalancePhi] = useState<number>(0);

  // Amounts routed to various actions
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

  const totalUrlDonorsPhi = useMemo(
    () =>
      donors.reduce(
        (a, d) => a + (Number.isFinite(d.amount) ? Math.max(0, d.amount) : 0),
        0
      ),
    [donors]
  );
  const totalDonorAmount = useMemo(
    () => round6(totalUrlDonorsPhi + Math.max(0, balanceForMintPhi)),
    [totalUrlDonorsPhi, balanceForMintPhi]
  );

  // viewport height var for iOS
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
    const candidates = ["#__next", "#root", "#app", "main"];
    let root: HTMLElement | null = null;
    for (const sel of candidates) {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (el) {
        root = el;
        break;
      }
    }
    bgRootRef.current = root;
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

  // OPEN/CLOSE + a11y + force chart reflow
  useEffect(() => {
    const d = dlgRef.current;
    const bg = bgRootRef.current;
    const setBgHidden = (hidden: boolean) => {
      if (!bg) return;
      if (hidden) {
        bg.setAttribute("aria-hidden", "true");
        bg.toggleAttribute("inert", true);
      } else {
        bg.removeAttribute("aria-hidden");
        bg.toggleAttribute("inert", false);
      }
    };

    if (supportsDialog && d) {
      if (open && !d.open) {
        Promise.resolve().then(() => {
          try {
            d.showModal();
          } catch (err) {
            devWarn("dialog.showModal failed:", err);
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
        d.close();
        setBgHidden(false);
        setVisible(false);
      }
    } else {
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
        bg2.toggleAttribute("inert", false);
      }
    };
  }, [open, snapDialogToTop]);

  // Keep snapped
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

  // Layout metrics → CSS vars
  useEffect(() => {
    const host = (dlgRef.current ?? fallbackRef.current) as HTMLElement | null;
    const headerEl = headerRef.current;
    const footerEl = footerRef.current;

    const update = () => {
      const headerH = headerEl?.offsetHeight ?? 0;
      const footerH = (footerEl?.offsetHeight ?? 0) + 8;
      const innerH = typeof window !== "undefined" ? window.innerHeight : 0;

      host?.style.setProperty("--header-h", `${headerH}px`);
      host?.style.setProperty("--footer-h", `${footerH}px`);

      const maxH = Math.max(240, innerH - headerH - footerH - 24);
      host?.style.setProperty("--content-max-h", `${maxH}px`);
    };

    update();

    const roHeader =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    const roFooter =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;

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

  const onBackdropPointerDown: React.PointerEventHandler<HTMLDivElement> =
    useCallback(
      (e) => {
        if (e.currentTarget === e.target) onClose();
      },
      [onClose]
    );

  // bootstrap valuation + series
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { seal: builtSeal } = await buildValueSeal(
          meta,
          nowPulse,
          sha256HexStable
        );
        if (!alive) return;

        setSeal(builtSeal);
        rngRef.current = mulberry32(seedFrom(meta, nowPulse));

        const boot = bootstrapSeries(builtSeal, meta, nowPulse);
        setChart(boot);

        startRef.current = builtSeal.valuePhi;
        liveRef.current = builtSeal.valuePhi;
        tickIndexRef.current = boot.lineData[boot.lineData.length - 1]?.i ?? 0;
        setLivePrice(builtSeal.valuePhi);
      } catch (err) {
        devWarn("buildValueSeal/bootstrap failed:", err);
      }
    })();
    return () => {
      alive = false;
    };
  }, [meta, nowPulse]);

  // breath loop
  useEffect(() => {
    if (!seal || !chart) return;
    let timer: number | undefined;

    const tick = () => {
      const rng = rngRef.current;
      const last = liveRef.current;
      const target = seal.valuePhi;

      const noise = (rng() - 0.5) * 0.032 * target; // ±3.2%
      const next = Math.max(0, last + (target - last) * 0.12 + noise);

      const dir: "up" | "down" | null = next > last ? "up" : next < last ? "down" : null;
      liveRef.current = next;
      setLivePrice(next);
      setFlash(dir);
      window.setTimeout(() => setFlash(null), 520);

      setChart((prev: ChartBundle | null) => {
        if (!prev) return prev;
        const nextI = (tickIndexRef.current || 0) + 1;
        tickIndexRef.current = nextI;

        const nextSpark = [...prev.sparkData.slice(1), { i: nextI, value: next }];
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
          y.reduce((a, _, k) => (k ? a + Math.abs(y[k] - y[k - 1]) : 0), 0) /
          (y.length - 1 || 1);

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
  }, [seal, chart]);

  // Seed initial glyph into the pool (once per open)
  const seededRef = useRef(false);
  useEffect(() => {
    if (!open) {
      seededRef.current = false;
      return;
    }
    if (seededRef.current) return;
    if (initialGlyph) {
      setImportedGlyphs([initialGlyph]);
      setBalancePhi(Math.max(0, Number(initialGlyph.value ?? 0)));
      seededRef.current = true;
    } else {
      setImportedGlyphs([]);
      setBalancePhi(0);
      seededRef.current = true;
    }
  }, [open, initialGlyph]);

  // Recompute pooled hash whenever imported glyphs change
  useEffect(() => {
    const summarize = importedGlyphs.map((g) => ({ h: g.hash, v: g.value }));
    const s = JSON.stringify(summarize);
    (async () => {
      const h = await sha256HexStable(`pool:${s}`);
      setPooledHash(h);
    })();
  }, [importedGlyphs]);

  // When a glyph is imported, add to pool & bump session baseline
  const handleImportedGlyph = useCallback((glyph: Glyph) => {
    setImportedGlyphs((prev: Glyph[]) => [...prev, glyph]);
    const v = Number(glyph.value ?? 0);
    setBalancePhi((prev: number) => prev + v);
    liveRef.current = v;
    setLivePrice(v);
    startRef.current = v;
  }, []);

  // derived donut data (PV vs premium)
  const pieData = useMemo(() => {
    const pv = Math.max(0, seal?.inputs.pv_phi ?? 0);
    const p = Math.max(0, livePrice ?? seal?.valuePhi ?? 0);
    const premOnly = Math.max(0, p - pv);
    return [
      { name: "Intrinsic (PV)", value: pv },
      { name: "Premium", value: premOnly },
    ];
  }, [seal, livePrice]);

  const sessionChangePct = useMemo(() => {
    if (livePrice == null) return 0;
    const start = startRef.current || livePrice;
    return ((livePrice - start) / (start || 1)) * 100;
  }, [livePrice]);

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

  /* ───────── Drivers model ───────── */
  const driversSections = useMemo(() => {
    if (!seal) return [];
    return buildDriversSections(
      seal,
      livePrice,
      chart,
      sessionChangePct,
      meta,
      momentUi
    );
  }, [seal, livePrice, chart, sessionChangePct, meta, momentUi]);

  /* ───────── donors editor helpers ───────── */
  const addDonor = () =>
    setDonors((rows: DonorRow[]) => [...rows, { url: "", amount: 0 }]);
  const removeDonor = (idx: number) =>
    setDonors((rows: DonorRow[]) => rows.filter((_, i) => i !== idx));
  const updateDonor = (idx: number, patch: Partial<DonorRow>) =>
    setDonors((rows: DonorRow[]) =>
      rows.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    );

  // Open the ΦGlyph mint modal
  const onMintComposite = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      onRipple(e);
      // let the modal perform the actual mint + ZIP export
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
      value: balancePhi,
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
                Pool:&nbsp;<strong className="mono">{balancePhi.toFixed(6)}</strong>
                &nbsp;Φ
              </div>

              <input
                className="send-amt-input"
                type="number"
                step="0.000001"
                min={0}
                max={balancePhi}
                placeholder="Φ to send"
                aria-label="Amount from pool to send"
                value={Number.isFinite(sendAmountPhi) ? sendAmountPhi : 0}
                onChange={(e) =>
                  setSendAmountPhi(
                    Math.min(
                      Math.max(0, Number(e.currentTarget.value || 0)),
                      balancePhi
                    )
                  )
                }
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
                <Gem size={16} /> <span className="hide-xs">Send</span>
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
                title="Mint ΦGlyph (ZIP)"
                disabled={
                  !donors.some((d) => d.url && d.amount > 0) &&
                  balanceForMintPhi <= 0
                }
              >
                <span className="small hide-xs">Mint ΦGlyph</span>
              </button>
            </>
          )}

          <span className="live-chip" aria-live="polite">
            <span className="live-dot" /> LIVE
          </span>

          <button className="btn close-btn holo" aria-label="Close" onClick={onClose}>
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
                      <TrendingUp size={18} /> <strong>Valuation</strong>
                    </div>
                    <div className="badge dim">
                      <ShieldCheck size={16} /> Kai {seal.computedAtPulse}
                    </div>
                  </header>
                  <div className="card-bd">
                    <div className="kpi-row">
                      <div className="kpi-main">
                        <div
                          className={
                            "figure-xl ticker-price " +
                            (flash === "up"
                              ? "flash-up"
                              : flash === "down"
                              ? "flash-down"
                              : "")
                          }
                          title="premium ×1 + intrinsic PV"
                          aria-live="polite"
                        >
                          {currency(livePrice ?? seal.valuePhi)}
                        </div>
                        <div className="subtle small kpi-subline">
                          <span
                            className={sessionChangePct >= 0 ? "gain" : "loss"}
                          >
                            {pct(sessionChangePct)}
                          </span>{" "}
                          session • premium ×{(seal.premium ?? 1).toFixed(6)} •
                          moment ×{(seal.inputs.momentLift ?? 1).toFixed(6)}
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
                            live={livePrice ?? seal.valuePhi}
                            pv={Math.max(0, seal.inputs.pv_phi ?? 0)}
                            premiumX={seal.premium ?? 1}
                            momentX={seal.inputs.momentLift ?? 1}
                            colors={Array.from(COLORS)}
                            height={chartHeight}
                            reflowKey={reflowKey}
                          />
                        )}

                        {!stacked && visible && (
                          <ValueDonut
                            data={pieData}
                            colors={Array.from(COLORS)}
                            size={120}
                          />
                        )}

                        {/* MOBILE action cluster */}
                        {stacked && visible && (
                          <section className="card mobile-actions actions-card" aria-label="Glyph & Pool">
                            <div className="card-bd">
                              <div className="actions-balance-row">
                                <div className="balance-chip" title="Pooled Φ balance">
                                  Pool:&nbsp;<strong className="mono">{balancePhi.toFixed(6)}</strong>&nbsp;Φ
                                </div>
                              </div>

                              <div className="actions-grid">
                                <input
                                  className="send-amt-input"
                                  type="number"
                                  step="0.000001"
                                  min={0}
                                  max={balancePhi}
                                  placeholder="Φ to send"
                                  aria-label="Amount from pool to send"
                                  value={Number.isFinite(sendAmountPhi) ? sendAmountPhi : 0}
                                  onChange={(e) =>
                                    setSendAmountPhi(
                                      Math.min(Math.max(0, Number(e.currentTarget.value || 0)), balancePhi)
                                    )
                                  }
                                />
                                <button
                                  className="btn primary btn-full"
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
                                  title="Mint ΦGlyph (ZIP)"
                                  disabled={
                                    !donors.some((d) => d.url && d.amount > 0) && balanceForMintPhi <= 0
                                  }
                                >
                                  Mint ΦGlyph
                                </button>
                              </div>
                            </div>
                          </section>
                        )}

                        {/* MOBILE Donors */}
                        {stacked && (
                          <DonorsEditor
                            donors={donors}
                            balancePhi={balancePhi}
                            balanceForMintPhi={balanceForMintPhi}
                            setBalanceForMintPhi={setBalanceForMintPhi}
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
                                <ShieldCheck size={16} /> <strong>Drivers</strong>
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
                                  host?.style.setProperty(
                                    "--drivers-filter",
                                    `"${term}"`
                                  );
                                }}
                              />
                            </div>

                            <div className="drivers-panel" role="list">
                              {driversSections.map((section, i) => (
                                <div className="drivers-section" key={`m-${i}`}>
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
                    balancePhi={balancePhi}
                    balanceForMintPhi={balanceForMintPhi}
                    setBalanceForMintPhi={setBalanceForMintPhi}
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
                      <UploadCloud size={16} /> <strong>Pool</strong>
                    </div>
                    <div className="badge dim small">
                      Φ {balancePhi.toFixed(6)}
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
                          <div className="pool-item" key={`g-${i}`} role="listitem">
                            <div className="mono small">{g.hash}</div>
                            <div className="mono small">
                              {Number(g.value).toFixed(6)} Φ
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="small subtle">
                      Pool grows with each uploaded glyph. Sending deducts from
                      the pool; minting ΦGlyphs does not.
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
                        <ShieldCheck size={16} /> <strong>Drivers</strong>
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
                          host?.style.setProperty(
                            "--drivers-filter",
                            `"${term}"`
                          );
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
                <TrendingUp size={18} /> <strong>Valuation</strong>
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

      {/* Send glyph popover */}
      {pooledGlyph && sendOpen && (
        <SendSigilModal
          isOpen={sendOpen}
          onClose={() => setSendOpen(false)}
          sourceGlyph={{
            ...pooledGlyph,
            value: Number(sendAmountPhi.toFixed(6)),
          }}
          onSend={(newGlyph) => {
            const spent = Math.max(0, Number(newGlyph.value ?? 0));
            setBalancePhi((prev: number) => Math.max(0, prev - spent));
            setSendOpen(false);
          }}
        />
      )}

      {/* Mint ΦGlyph popover */}
      <MintCompositeModal
        isOpen={mintOpen}
        onClose={() => setMintOpen(false)}
        donors={donors}
        balancePhi={balancePhi}
        balanceForMintPhi={balanceForMintPhi}
        setBalanceForMintPhi={setBalanceForMintPhi}
        addDonor={addDonor}
        removeDonor={removeDonor}
        updateDonor={updateDonor}
        totalDonorAmount={totalDonorAmount}
        // Optional identity for the minted ΦGlyph visual:
        // userPhiKey={/* pass if you have */}
        // kaiSignature={/* pass if you have */}
        // creatorPublicKey={/* pass if you have */}
        onMinted={() => {
          // You can toast/log here if desired.
        }}
      />
    </div>
  );

  // PORTAL: dialog or bottom-sheet fallback
  return createPortal(
    canUseModal ? (
      <dialog
        ref={dlgRef}
        className="valuation-modal"
        aria-label="Φ Valuation"
        aria-modal="true"
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
        onPointerDown={onBackdropPointerDown}
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
