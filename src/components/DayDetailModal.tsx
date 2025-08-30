// src/components/DayDetailModal.tsx
/* ───────────────────────────────────────────────────────────────
   DayDetailModal.tsx · Atlantean Lumitech  “Kairos Kalendar — Day”
   v2.7 · Keyboard-safe Bottom Sheet • Exact Beat:Step Save Hook
   ───────────────────────────────────────────────────────────────
   • Bottom-sheet editor auto-lifts above mobile keyboards
   • Uses VisualViewport (iOS/Android) with safe fallback
   • Textarea autofocus + scroll-into-view on open
   • NEW: onSaveKaiNote callback maps Beat:Step → absolute pulse
   ─────────────────────────────────────────────────────────────── */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FC } from "react";
import { AnimatePresence, motion } from "framer-motion";
import "./DayDetailModal.css";

/* ══════════════ Types ══════════════ */
export interface HarmonicDayInfo {
  name: string;          // e.g. “Solhara”
  kaiTimestamp: string;  // display string (already formatted)
  startPulse: number;    // first Kai-Pulse of the day (integer)
}
interface Note {
  beat: number;          // 0-based beat
  step: number;          // 0–43
  text: string;
}

/* When saving from Day modal, parent may persist to global dock */
export type SaveKaiNote = (n: {
  id: string;
  text: string;
  pulse: number;
  beat: number;
  step: number;
}) => void;

/* ══════════════ Constants ══════════════ */
const TOTAL_BEATS = 36;           // 0 … 35
const BEATS_PER_CHAPTER = 12;     // → 3 chapters
const STEPS_PER_BEAT = 44;        // steps 0..43
const PULSE_MS = (3 + Math.sqrt(5)) * 1000; // ≈ 5236 ms

/* Exact mapping constants to align with WeekKalendarModal */
const DAY_PULSES = 17_491.270_421;
const BEAT_PULSES = DAY_PULSES / 36; // ≈ 486.98 pulses per beat (step blocks are 11 pulses)

/* Local storage key for per-day editor (independent of global dock) */
const STORAGE_PREFIX = "kai_notes_";

/* 4 step-categories per beat (11 each) — 0-based */
const STEP_GROUPS: Array<{ idx: number; start: number; end: number; title: string }> = [
  { idx: 0, start: 0,  end: 10, title: "Steps 0–10"   },
  { idx: 1, start: 11, end: 21, title: "Steps 11–21"  },
  { idx: 2, start: 22, end: 32, title: "Steps 22–32"  },
  { idx: 3, start: 33, end: 43, title: "Steps 33–43"  },
];

/* ══════════════ Helpers ══════════════ */
const storageKey = (p: number): string => `${STORAGE_PREFIX}${p}`;

type RawNote = Record<string, unknown>;
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

/** Parse & sanitize notes from storage without using `any`. */
const loadNotes = (p: number): Note[] => {
  try {
    const raw = localStorage.getItem(storageKey(p));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) return [];

    const out: Note[] = [];
    for (const item of parsed as unknown[]) {
      if (!isRecord(item)) continue;

      const beatU = (item as RawNote).beat;
      const stepU = (item as RawNote).step;
      const textU = (item as RawNote).text;

      const beat = typeof beatU === "number" ? beatU : Number(beatU);
      const step = typeof stepU === "number" ? stepU : Number(stepU);
      const text = typeof textU === "string" ? textU : String(textU ?? "");

      if (
        Number.isFinite(beat) &&
        Number.isFinite(step) &&
        step >= 0 &&
        step < STEPS_PER_BEAT
      ) {
        out.push({ beat, step, text });
      }
    }
    return out;
  } catch {
    return [];
  }
};

const saveNotes = (p: number, n: Note[]): void => {
  try {
    localStorage.setItem(storageKey(p), JSON.stringify(n));
  } catch {
    /* ignore quota/private-mode errors */
  }
};

/* Map Beat:Step → absolute pulse (integer) within the given day */
const beatStepToPulse = (dayStartPulse: number, beat: number, step: number): number => {
  const beatBase = Math.floor(BEAT_PULSES * beat);
  const stepOffset = step * 11; // 11 whole pulses per step bucket
  return Math.floor(dayStartPulse + beatBase + stepOffset);
};

/* ══════════════ Animation variants ══════════════ */
const collapseVariants = {
  closed: { height: 0, opacity: 0 },
  open: { height: "auto", opacity: 1 },
} as const;

/* ══════════════ Accessible key handler (Enter/Space) ══════════════ */
const onEnterOrSpace =
  (fn: () => void) =>
  (e: React.KeyboardEvent<HTMLElement>): void => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };

/* ══════════════ Hook: keyboard inset (VisualViewport) ══════════════ */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;

    const compute = () => {
      if (!vv) {
        setInset(0);
        return;
      }
      const hidden = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
      setInset(Math.round(hidden));
    };

    compute();

    if (vv) {
      vv.addEventListener("resize", compute);
      vv.addEventListener("scroll", compute);
    }
    window.addEventListener("resize", compute);

    return () => {
      if (vv) {
        vv.removeEventListener("resize", compute);
        vv.removeEventListener("scroll", compute);
      }
      window.removeEventListener("resize", compute);
    };
  }, []);

  return inset;
}

/* ══════════════ Component ══════════════ */
const DayDetailModal: FC<{
  day: HarmonicDayInfo;
  onClose: () => void;
  onSaveKaiNote?: SaveKaiNote; // NEW: push to global dock in parent
}> = ({ day, onClose, onSaveKaiNote }) => {
  /* ───────── state ───────── */
  const [notes, setNotes] = useState<Note[]>(() => loadNotes(day.startPulse));
  const [editing, setEditing] = useState<Note | null>(null);

  // Accordion: nothing open by default
  const [openChapter, setOpenChapter] = useState<number>(-1); // –1 ⇒ all closed
  const [openBeat, setOpenBeat] = useState<number | null>(null);

  // within-beat step group (0..3), none open by default
  const [openGroup, setOpenGroup] = useState<number | null>(null);

  // Reset openBeat whenever chapter changes
  useEffect(() => setOpenBeat(null), [openChapter]);

  // Reset openGroup whenever beat changes
  useEffect(() => setOpenGroup(null), [openBeat]);

  // Persist notes on change/day switch
  useEffect(() => {
    saveNotes(day.startPulse, notes);
  }, [day.startPulse, notes]);

  /* ───────── structure ───────── */
  const chapters = useMemo(() => {
    const num = Math.ceil(TOTAL_BEATS / BEATS_PER_CHAPTER); // 3
    return Array.from({ length: num }, (_, c) => {
      const start = c * BEATS_PER_CHAPTER; // 0, 12, 24
      const end = Math.min(start + BEATS_PER_CHAPTER, TOTAL_BEATS);
      const beats = Array.from({ length: end - start }, (_, i) => {
        const beatIdx = start + i;
        return {
          beat: beatIdx,
          steps: Array.from({ length: STEPS_PER_BEAT }, (_, s) => s), // 0..43
        };
      });
      return { chapter: c, title: `Beats ${start}–${end - 1}`, beats };
    });
  }, []);

  /* ───────── refs + scroll-to-current-step (coarse) ───────── */
  const listRef = useRef<HTMLDivElement>(null);

  const scrollToApproxCurrent = useCallback(() => {
    if (openChapter === -1 || openBeat == null) return;
    const msOffset = Date.now() - day.startPulse * PULSE_MS;
    const globalStepIdx = Math.max(0, Math.floor(msOffset / PULSE_MS)); // coarse
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-step-index="${globalStepIdx}"]`
    );
    el?.scrollIntoView({ block: "center" });
  }, [day.startPulse, openBeat, openChapter]);

  useEffect(() => {
    scrollToApproxCurrent();
  }, [scrollToApproxCurrent]);

  /* ───────── notes helpers ───────── */
  const findNote = useCallback(
    (b: number, s: number) => notes.find((n) => n.beat === b && n.step === s),
    [notes]
  );

  const upsertNote = (beat: number, step: number, text: string): void => {
    setNotes((prev) => {
      const idx = prev.findIndex((n) => n.beat === beat && n.step === step);
      return idx >= 0
        ? prev.map((n, i) => (i === idx ? { ...n, text } : n))
        : [...prev, { beat, step, text }];
    });
  };

  /* ───────── tap-friendly handlers (pointer) ───────── */
  const toggleChapter = useCallback(
    (chapter: number) => {
      setOpenChapter((prev) => (prev === chapter ? -1 : chapter));
    },
    [setOpenChapter]
  );

  const toggleBeat = useCallback(
    (beat: number) => {
      setOpenBeat((prev) => (prev === beat ? null : beat));
    },
    [setOpenBeat]
  );

  const toggleGroup = useCallback(
    (groupIdx: number) => {
      setOpenGroup((prev) => (prev === groupIdx ? null : groupIdx));
    },
    []
  );

  /* ───────── focus safety ───────── */
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const btn = panelRef.current?.querySelector<HTMLButtonElement>(".close-btn");
    btn?.focus();
  }, []);

  /* ───────── keyboard-safe editor ───────── */
  const kbInset = useKeyboardInset();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // When editor opens (or inset changes), ensure textarea is visible & focused
  useEffect(() => {
    if (!editing) return;
    const t = window.setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 60);
    return () => window.clearTimeout(t);
  }, [editing, kbInset]);

  /* ══════════════ UI ══════════════ */
  return (
    <AnimatePresence>
      {/* Backdrop is visible but does NOT intercept clicks */}
      <motion.div
        className="day-modal-backdrop"
        style={{ pointerEvents: "none" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.85 }}
        exit={{ opacity: 0 }}
      />

      {/* Modal Panel */}
      <motion.section
        ref={panelRef}
        className="day-modal"
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-title"
      >
        {/* Header (sticky) */}
        <header className="day-header">
          <h2 id="day-title">
            {day.name} <span>• {day.kaiTimestamp}</span>
          </h2>
          <button
            type="button"
            className="close-btn"
            onPointerUp={onClose}
            onKeyDown={onEnterOrSpace(onClose)}
            aria-label="Close Day Detail"
          >
            ✕
          </button>
        </header>

        {/* Accordion list */}
        <div className="beat-list" ref={listRef}>
          {chapters.map(({ chapter, title, beats }) => {
            const chapterOpen = openChapter === chapter;
            return (
              <div className="chapter-container" key={chapter}>
                {/* Chapter toggle */}
                <button
                  type="button"
                  className={`chapter-header ${chapterOpen ? "open" : ""}`}
                  aria-expanded={chapterOpen}
                  aria-controls={`chapter-${chapter}`}
                  onPointerUp={() => toggleChapter(chapter)}
                  onKeyDown={onEnterOrSpace(() => toggleChapter(chapter))}
                >
                  {title}
                  <span className="chevron" aria-hidden="true" />
                </button>

                <AnimatePresence initial={false}>
                  {chapterOpen && (
                    <motion.div
                      id={`chapter-${chapter}`}
                      className="chapter-body"
                      variants={collapseVariants}
                      initial="closed"
                      animate="open"
                      exit="closed"
                      transition={{ type: "tween", duration: 0.24 }}
                    >
                      {beats.map(({ beat, steps }) => {
                        const beatOpen = openBeat === beat;

                        return (
                          <div className="beat-accordion" key={beat}>
                            {/* Beat toggle */}
                            <button
                              type="button"
                              className={`beat-header ${beatOpen ? "open" : ""}`}
                              aria-expanded={beatOpen}
                              aria-controls={`beat-${beat}`}
                              onPointerUp={() => toggleBeat(beat)}
                              onKeyDown={onEnterOrSpace(() => toggleBeat(beat))}
                            >
                              Beat&nbsp;{beat}
                              <span className="chevron" aria-hidden="true" />
                            </button>

                            <AnimatePresence initial={false}>
                              {beatOpen && (
                                <motion.div
                                  id={`beat-${beat}`}
                                  className="beat-steps"
                                  variants={collapseVariants}
                                  initial="closed"
                                  animate="open"
                                  exit="closed"
                                  transition={{ type: "tween", duration: 0.24 }}
                                >
                                  {/* ── Four step-groups inside the open beat ── */}
                                  {STEP_GROUPS.map(({ idx, start, end, title }) => {
                                    const groupOpen = openGroup === idx;
                                    return (
                                      <div className="group-accordion" key={idx}>
                                        <button
                                          type="button"
                                          className={`group-header ${groupOpen ? "open" : ""}`}
                                          aria-expanded={groupOpen}
                                          aria-controls={`beat-${beat}-group-${idx}`}
                                          onPointerUp={() => toggleGroup(idx)}
                                          onKeyDown={onEnterOrSpace(() => toggleGroup(idx))}
                                        >
                                          {title}
                                          <span className="chevron" aria-hidden="true" />
                                        </button>

                                        <AnimatePresence initial={false}>
                                          {groupOpen && (
                                            <motion.div
                                              id={`beat-${beat}-group-${idx}`}
                                              className="group-body"
                                              variants={collapseVariants}
                                              initial="closed"
                                              animate="open"
                                              exit="closed"
                                              transition={{ type: "tween", duration: 0.2 }}
                                            >
                                              {steps
                                                .filter((s) => s >= start && s <= end)
                                                .map((step) => {
                                                  const note = findNote(beat, step);
                                                  const globalIdx =
                                                    beat * STEPS_PER_BEAT + step;
                                                  const openEditor = (): void =>
                                                    setEditing({
                                                      beat,
                                                      step,
                                                      text: note?.text ?? "",
                                                    });

                                                  return (
                                                    <div
                                                      key={step}
                                                      role="button"
                                                      tabIndex={0}
                                                      data-step-index={globalIdx}
                                                      className={`step-row${note ? " has-note" : ""}`}
                                                      onPointerUp={openEditor}
                                                      onKeyDown={onEnterOrSpace(openEditor)}
                                                    >
                                                      <span className="step-index">
                                                        Step&nbsp;{step}
                                                      </span>
                                                      {note && (
                                                        <span className="step-note-preview">
                                                          {note.text.length > 42
                                                            ? `${note.text.slice(0, 42)}…`
                                                            : note.text}
                                                        </span>
                                                      )}
                                                    </div>
                                                  );
                                                })}
                                            </motion.div>
                                          )}
                                        </AnimatePresence>
                                      </div>
                                    );
                                  })}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Bottom-sheet editor (keyboard-safe) */}
        <AnimatePresence>
          {editing && (
            <>
              {/* The sheet’s own backdrop CAN dismiss the sheet (friendly) */}
              <motion.div
                className="note-editor-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.8 }}
                exit={{ opacity: 0 }}
                onPointerUp={() => setEditing(null)}
              />
              <motion.div
                className="note-editor"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "tween", duration: 0.24 }}
                role="dialog"
                aria-label={
                  editing
                    ? `Edit note for Beat ${editing.beat}, Step ${editing.step}`
                    : "Edit note"
                }
                onPointerDown={(e: React.PointerEvent<HTMLDivElement>) => e.stopPropagation()}
                // Keyboard avoidance: lift above the software keyboard
                style={{
                  bottom: kbInset,
                  paddingBottom: "max(12px, env(safe-area-inset-bottom))",
                }}
              >
                <h4>
                  Beat&nbsp;{editing.beat} • Step&nbsp;{editing.step}
                </h4>
                <textarea
                  ref={textareaRef}
                  autoFocus
                  value={editing.text}
                  placeholder="Add your resonance note…"
                  onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                  onFocus={() =>
                    textareaRef.current?.scrollIntoView({ block: "center", behavior: "smooth" })
                  }
                />
                <footer>
                  <button
                    type="button"
                    className="btn-cancel"
                    onPointerUp={() => setEditing(null)}
                    onKeyDown={onEnterOrSpace(() => setEditing(null))}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-save"
                    disabled={!editing.text.trim()}
                    onPointerUp={() => {
                      const text = editing.text.trim();
                      if (!text) return;
                      // Save in the Day editor
                      upsertNote(editing.beat, editing.step, text);
                      // Push to global notes dock with exact Beat:Step → absolute pulse
                      const pulse = beatStepToPulse(day.startPulse, editing.beat, editing.step);
                      const id =
                        typeof crypto !== "undefined" && "randomUUID" in crypto
                          ? crypto.randomUUID()
                          : `kai_${Date.now()}_${Math.random().toString(36).slice(2)}`;
                      onSaveKaiNote?.({ id, text, pulse, beat: editing.beat, step: editing.step });
                      setEditing(null);
                    }}
                    onKeyDown={onEnterOrSpace(() => {
                      const text = editing.text.trim();
                      if (!text) return;
                      upsertNote(editing.beat, editing.step, text);
                      const pulse = beatStepToPulse(day.startPulse, editing.beat, editing.step);
                      const id =
                        typeof crypto !== "undefined" && "randomUUID" in crypto
                          ? crypto.randomUUID()
                          : `kai_${Date.now()}_${Math.random().toString(36).slice(2)}`;
                      onSaveKaiNote?.({ id, text, pulse, beat: editing.beat, step: editing.step });
                      setEditing(null);
                    })}
                  >
                    Save
                  </button>
                </footer>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </motion.section>
    </AnimatePresence>
  );
};

export default DayDetailModal;
