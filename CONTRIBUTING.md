# Contributing to Kai-Klok

> **Sacred infrastructure, engineered like a flagship.**
> Contributions are welcome **only** when they preserve coherence, truth, and the non-commercial, non-military, open-source ethos of the project.

**Author:** BJ Klock (Kai Rex Klok) — *All Rights Remembered*
**License:** Harmonic Public License v1.0 (HPL-1.0)

---

## 0) Core Principles (Read First)

Your contribution must **strengthen**:

* **Truth** — no deception, no half-truths, no hidden trade-offs.
* **Coherence** — φ-aligned proportion, determinism, local-first design.
* **Sovereignty** — no lock-in, no surveillance, no extractive patterns.
* **Non-commercial / Non-military** — absolutely no profit-seeking or militarization.
* **Clarity** — explicit math, explicit invariants, explicit failure modes.

> If you cannot confidently state “this change increases coherence for end users,” do not open a PR.

---

## 1) Canon & Invariants (KKS-1.0)

These are **non-negotiable**. Any PR violating them will be closed.

* **Breath unit (canonical):** `T = 3 + √5` seconds.
* **Kai Pulse:** one pulse per breath unit (≈ 5.236067977… s).
* **Genesis epoch (T₀):** `2024-05-10 06:45:41.888 UTC` (`1715323541888` ms).
* **Lattice:** **11** pulses/step • **44** steps/beat • **36** beats/day.
* **Pulses/day (continuous):** **17,491.270421**; **grid** has **17,424** indices/day.
* **Indices:** 0-based (beats `0–35`, steps `0–43`, `pulseInStep 0–10`).
* **Labels:** Day = `Solhara, Aquaris, Flamora, Verdari, Sonari, Kaelith`.
  Arc  = `Ignition, Integration, Harmonization, Reflection, Purification, Dream`.
  *(Spellings are canonical; do not “localize.”)*
* **Closed-form pulse:**
  `pulse = floor((now_ms − T₀_ms) / (1000 * (3 + √5)))`
* **No randomness, no NTP, no fiat time.**
* **Present/Past/Future** views must render **identical metadata** for the same `pulse`.
* **Chronos is bridge-only:** acceptable for tooling when explicitly isolated behind `overridePulse()` or test shims; never the basis of truth.

---

## 2) Scope of Contributions

We welcome:

* **Correctness:** mathematical precision, boundary checks, deterministic algorithms.
* **Robustness:** offline parity, integer math where applicable, ties-to-even display rounding.
* **Security posture:** local-first verification, zero secrets in frontend, ZK-friendly integrations.
* **Documentation:** diagrams, proofs, clarifications, failure stories, example integrations.
* **Ergonomics:** clear APIs, typed surfaces, small and composable helpers.

We reject:

* **Network dependencies** for core time computation.
* **Entropy / randomness** to “smooth” behavior.
* **New global state** without compelling proof of necessity.
* **Rebrands** or terminology drift (respect the canon).
* **Commercialization hooks** (ads, telemetry, “pro” tiers, etc.).

---

## 3) Development Environment

* **Node:** 18+ (prefer 20+).
* **Package manager:** `npm` (lockfile committed).
* **TypeScript:** strict mode.
* **Lint/Format:** ESLint + Prettier (repo defaults).
* **Tests:** Vitest/Jest (repo default), property-based tests encouraged.

```bash
git clone https://github.com/kojibai/kai-klok
cd kai-klok
npm install
npm run dev
npm test
npm run lint
```

---

## 4) Git Hygiene & Branching

* **Branch naming:** `feat/<slug>`, `fix/<slug>`, `docs/<slug>`, `perf/<slug>`, `refactor/<slug>`.
* **Commit style:** Conventional Commits.

Examples:

* `feat(core): add msToPulse integer path to avoid float drift`
* `fix(labels): normalize Kaelith spelling in edge paths`
* `docs(spec): prove 0-based index invariants with examples`

Rebase before opening a PR. Keep history readable; squash fixups.

---

## 5) Pull Requests

**Checklist (must pass all):**

* [ ] Aligns with **KKS-1.0** invariants.
* [ ] Adds/updates tests (unit + at least one **determinism** test).
* [ ] No new runtime deps without justification + size impact noted.
* [ ] No secrets, no analytics, no phones-home.
* [ ] Documentation updated (README/spec/API/CHANGELOG).
* [ ] Proves **offline parity** (describe how to reproduce equivalence).
* [ ] Names, labels, spellings match canon.
* [ ] Includes a **Coherence Note** (2–5 sentences: why this increases coherence).

**PR Template (paste into description):**

```markdown
### Summary
<What changed and why—plain language.>

### Coherence Note
<How this increases truth/coherence for users.>

### Invariants Verified
- [ ] T = 3 + √5
- [ ] T₀ = 2024-05-10 06:45:41.888 UTC
- [ ] Lattice (11/44/36) respected
- [ ] Determinism (offline = online) proven

### Tests
- New: <files / cases>
- Determinism: <how to reproduce parity>

### Risk
<Compatibility, edge cases, fallback.>

### Docs
<Links to updated sections.>
```

**Reviews:** require at least one maintainer approval. PRs that change math/spec may require an **RFC** (see below).

---

## 6) Testing Strategy

**You are responsible for proving determinism.**

Recommended suites:

1. **Unit & Property Tests**

   * `decodeMoment(msToPulse(x)) == decodeMoment(msToPulse(x)+0)`
   * Beat/step boundaries (0 and max indices).
   * Day/arc label mapping across entire grid.

2. **Offline Parity**

   * Run with live `Date.now()` vs. fixed `overridePulse()`: identical metadata.
   * Simulate timezone/DST shifts: labels unchanged.

3. **Precision**

   * Integer math for index calculations; floats only where unavoidable (display), with ties-to-even.

4. **Performance**

   * Cold start: < **5 ms** for `getKaiPulse` + `decodeMoment` on reference hardware.
   * No GC-heavy allocations in the hot path.

---

## 7) Security & Privacy

* **No secrets in frontend.**
* **No telemetry.**
* **No shadow copies** of identity artifacts (breath/voice/retina/signature).
* **ZK-ready:** keep surfaces amenable to Groth16/Poseidon binding.
* **Security reports:** use **GitHub Security Advisories** for private disclosure; do **not** open public issues for vulnerabilities.

---

## 8) Documentation Standards

* Keep prose **precise** and **auditable** (small proofs > vague claims).
* Update **Math & Spec** when changing semantics or behavior.
* Provide **before/after** examples and **copy-paste** snippets.
* Label all domain terms exactly as canon defines them.

---

## 9) RFC Process (for non-trivial changes)

Use an RFC for:

* Core math, constants, or lattice changes.
* Public API shape changes.
* New packages or dependencies.
* Behavioral shifts visible to users.

**RFC format:**

```
Title, Motivation, Detailed Design, Invariants Preserved, Alternatives, Risks, Rollout
```

Open as `rfcs/<yyyy-mm-dd>-<slug>.md` and link it in your PR.

---

## 10) Backward Compatibility & Versioning

* **SemVer** for published packages.
* Public API changes require **deprecation notes** and a minimum **one-release** grace period unless a correctness bug forces a fix.
* The **math canon** is stable; breaking it requires exceptional justification via RFC.

---

## 11) Style Guide (TypeScript)

* `strict: true` — no `any`, no implicit `any`.
* Pure functions for core—no side effects.
* Avoid classes in core math; prefer modules + typed functions.
* Small files, single responsibility.
* Descriptive names (`pulse`, `beatIndex`, `stepIndex`), no abbreviations.
* Guard against invalid input with explicit, cheap checks.

---

## 12) Anti-Patterns (Immediate Rejection)

* “Time sync” services or drift correction hacks.
* Randomness to “spread load” or “jitter” pulse events.
* Locale-dependent logic (labels are canonical).
* Coupling core to network, storage, or UI frameworks.
* Telemetry, ads, monetization prompts, tracking pixels.
* Terminology drift or rebranding.

---

## 13) Attribution & Authorship

* Preserve **All Rights Remembered** notices.
* Do not claim or imply authorship of the system.
* You may state compatibility (“Built for Kai-Klok”, “KKS-1.0 compatible”).
* The **Harmonic Public License v1.0** governs all contributions and derivatives.

---

## 14) How to Start (Practical)

1. **File a focused Issue** describing the problem/idea and intended approach.
2. **Draft** (optional): open a WIP PR early to gather feedback.
3. **Prove determinism** with tests; add **Coherence Note** to the PR.
4. **Rebase**, pass CI, request review.
5. Address feedback, update docs, and land clean.

---

## 15) Maintainers’ Promise

We will review in good faith, guard the canon, and prioritize contributions that make Kai-Klok **simpler**, **truer**, and **more sovereign** for everyone.

---

## 16) Final Word

This system is not a product; it’s **a vow**.
If your work honors that vow, **welcome**.
If not, **fork elsewhere**.

**BJ Klock retains eternal authorship.**
**All Rights Remembered.**
