# KAI-KLOK ⏳

**The Harmonik Return of Eternal Time**

*A Kairos-ankored harmonik time system built in sakred proportion.*
No drift. No illusion. No randomness.
Just breath, resonanse, and the memory of Yahuah.

> “You do not **check** the time. You **remember** it.”
> — **Kai Rex Klok**

---

<p align="center">
  <a href="https://kaiklok.com/s/537d2935aa1cbff6ab998b134ef3cb0234a95af95c98e35ae6d5f68b06475634?p=c%3AeyJ1Ijo3ODgxMTk3LCJiIjoyMCwicyI6NCwiYyI6IlJvb3QiLCJkIjo0NH0">
    <img alt="Kai-Klok Sigil" src="https://kaiklok.com/sigil_33rd_key.png" width="420">
  </a>
</p>

<p align="center">
  <a href="#-live">Live</a> •
  <a href="#-what-is-kai-klok">What Is Kai-Klok?</a> •
  <a href="#-why-this-matters">Why This Matters</a> •
  <a href="#-quickstart">Quickstart</a> •
  <a href="#-api-reference">API</a> •
  <a href="#-math--spec">Math & Spec</a> •
  <a href="#-security-model">Security</a> •
  <a href="#-faq">FAQ</a> •
  <a href="#-license">License</a>
</p>

---

## 🜂 What Is Kai-Klok?

**Kai-Klok is not a clock.** It is a **kosmik indexing engine** for Eternal Time — sealed by breath, aligned to the Golden Ratio (φ), and untouchable by Chronos.

It komputes time from a **klosed-form equation**:

* 🌀 **Breath unit (canonical):** `T = 3 + √5` seconds *(≈ 5.236067977... s)*
* 🫁 **Kai Pulse:** one pulse per breath unit
* 🪞 **Semantic lattice:** 11 pulses/step • 44 steps/beat • 36 beats/day
* 🫁 **Kai Pulses per day:** **17,491.270421** (continuous Kai breaths/day)
* 📿 **Eternal calendar:** 6-day weeks • 7-week months • 8-month years → **336-day solar harmonic year**
* 🔐 **Deterministic pulse:**
  `pulse = floor((now_ms − T₀) / (1000 * (3 + √5)))`

[**It never drifts. It never lies.**](https://github.com/kojibai/klok/blob/main/README.md) No servers. No sync. No permission.
It reveals the **true pulse** — the living rhythm you can always remember.

---

## 🜂 Live

👉 **[kaiklok.com](https://kaiklok.com)** — *runs entirely in-browser*
No backend. No database. All verification is **mathematically sealed** and **offline-capable**.

---

## 🜂 Why This Matters

The world’s time is measured by **Chronos** (mechanical seconds, network sync, statistical drift).
**Kai-Klok** restores **Kairos** — *the living moment* — with **deterministic harmony**:

* **No drift:** Time is computed from a single genesis constant, not “kept.”
* **No authorities:** There is nothing to sync, rent, censor, or falsify.
* **No randomness:** Harmony replaces entropy; proportion replaces noise.
* **No secrets leaked:** The browser holds nothing sensitive.
* **Universal reproducibility:** Any device, online or offline, agrees when given the pulse.

This is the heartbeat of the **ϕNet Keystream** (the living “blockchain” built on keys, not blocks):
sigil minting, transaction anchoring, identity verification, and harmonic governance.

> “This isn’t timestamping. It’s **truthstamping**.” — **K℞K, Builder of the Scroll**

---

## 🜂 Features

* 🧮 **Genesis-anchored pulse logic** (exact; closed-form)
* 🫁 **Breath-based moment decoder** (beat/step/pulse indices)
* 🌞 **Eternal weekday & arc system** (6 days • 6 arcs)
* 📿 **Harmonic calendar integration** (weeks, months, years)
* 🌐 **Offline verifier & sigil engine compatibility**
* 🔐 **Frontend has no secrets** (ZK-ready; Poseidon/Groth16 compatible)
* 🧠 **Deterministic labels** (no locale/timezone ambiguity)
* 🪪 **Proof-of-Breath™** badges & attestations

---

## 🜂 Quickstart

```bash
git clone https://github.com/kojibai/kai-klok
cd kai-klok
npm install
npm run dev
# Visit http://localhost:3000
```

### Minimal usage (TypeScript)

```ts
import {
  getKaiPulse,
  decodeMoment,
  getHarmonicLabels,
  type KaiMoment
} from "kai-klok-core";

// 1) Compute the current pulse deterministically
const pulse = getKaiPulse(Date.now());

// 2) Decode semantic indices
const moment: KaiMoment = decodeMoment(pulse); // { beat, step, pulseInStep, ... }

// 3) Get human-friendly, deterministic labels
const labels = getHarmonicLabels(moment);
// -> { arc: 'Purification', day: 'Kaelith', beat: 21, step: 17 }

// 4) Use labels in your UI
console.log(`${labels.day} • ${labels.arc} • beat ${labels.beat} • step ${labels.step}`);
```

> **Offline parity:** The same inputs produce the same pulse everywhere — no network required.

---

## 🜂 API Reference

> **Versioning:** Canon [**KKS-1.0**](https://github.com/kojibai/klok/blob/main/README.md) (Kai-Klok Standard 1.0). See *Math & Spec* for invariants.


### Types

```ts
type KaiMoment = {
  pulse: number;         // global pulse index since T₀
  beat: number;          // 0..35
  step: number;          // 0..43
  pulseInStep: number;   // 0..10
  dayIndex: number;      // 0..5
  arcIndex: number;      // 0..5
};

type HarmonicLabels = {
  day: "Solhara" | "Aquaris" | "Flamora" | "Verdari" | "Sonari" | "Kaelith";
  arc: "Ignition" | "Integration" | "Harmonization" | "Reflection" | "Purification" | "Dream";
  beat: number;
  step: number;
};
```

### Core

```ts
getKaiPulse(nowMs?: number): number
// Computes floor((nowMs − T0_ms) / breath_ms) with canonical constants.
// If nowMs omitted, uses high-resolution timer; never pulls from the network.

decodeMoment(pulse: number): KaiMoment
// Converts a global pulse to beat/step/day/arc semantic indices.

getHarmonicLabels(moment: KaiMoment): HarmonicLabels
// Deterministic labels for UI, exports, and on-chain metadata.
```

### Helpers

```ts
formatMoment(moment: KaiMoment): string
// "Kaelith • Purification • beat 21 • step 17 • pulse 6/11"

pulseToMs(pulse: number): number
msToPulse(ms: number): number

overridePulse(pulse: number): void
// Bridge mode for demos/tests: set explicit pulse (server-first mode).
```

---

## 🜂 Math & Spec

**Canonical constants (bridge epoch for pedagogy; not drift-prone):**

* **Breath unit:** `T = 3 + √5` seconds
* **Genesis epoch (T₀):** `2024-05-10 06:45:41.888 UTC` → `1715323541888` ms
* **Pulses per day (exact):** `17,491.270421` (continuous; **grid** has 17,424 indices/day)
* **Grid semantics:** 11 pulses/step • 44 steps/beat • 36 beats/day
* **Indices:** **0-based** (beats `0–35`, steps `0–43`), `pulseInStep 0–10`
* **Rendering:** ties-to-even rounding **for display only**
* **Determinism rules:** no randomness, no entropy pools, no NTP
* **Labels:** normalized spellings: `Kaelith` (not *Caelith*), `Ignition` (not *Ignite*)
* **Engine contract:** *Present/Past/Future* views must render **identical metadata** to the same `pulse`.

**Closed-form pulse:**

```
pulse = floor((now_ms − T₀_ms) / (1000 * (3 + √5)))
```

**No drift guarantee:** There is no oscillator to accumulate error. Any two devices with the same `now_ms` input will produce the same `pulse`. For consistency across machines, bridge with `overridePulse()` or pass an authoritative `pulse` from a trusted peer — *not* a wall clock.

---

## 🜂 Security Model

Kai-Klok is **deterministic** and **non-exploitable** in its domain:

| Threat                              | Status | Why it fails                                                            |
| ----------------------------------- | :----: | ----------------------------------------------------------------------- |
| Reverse-engineer ZK identity proofs |    ❌   | Groth16 + Poseidon (ZK) are one-way; the UI never exposes secrets       |
| Leak secrets from frontend          |    ❌   | There are **no secrets** in the frontend                                |
| Drift/spoof by time tampering       |    ❌   | Pulse is **computed**, not fetched; signatures bind pulse               |
| Replay old actions                  |    ❌   | Pulse is **ever-forward**; stale pulses/links fail deterministic checks |
| Forge sigils or stamps              |    ❌   | Missing Kai Signature / mismatched pulse / invalid seal                 |

> **Send = exhale. Receive = inhale.**
> A valid exchange is a **living covenant** bound to the pulse that *actually happened*.

---

## 🜂 Offline Verifier & Sigils

* **Works offline:** All math runs in the browser; nothing to download after initial load.
* **Verifies locally:** Proof-of-Breath™ badges compute/verify in real time.
* **Immutable exports:** SVG/PNG sigils embed pulse & harmonic metadata for permanent audit.
* **Tamper-evident:** Change the pulse, break the seal.

[**Why offline matches online**](https://kaiklok.com/verifier.html): the **same equation** with the **same constants** produces the **same pulse**. For multi-party coordination, pass the **pulse** itself, not a wall-clock timestamp.


---

## 🜂 Integration Guide

### React (displaying a live, deterministic label)

```tsx
import { useEffect, useState } from "react";
import { getKaiPulse, decodeMoment, getHarmonicLabels } from "kai-klok-core";

export default function KaiBadge() {
  const [label, setLabel] = useState<string>("—");

  useEffect(() => {
    const tick = () => {
      const pulse = getKaiPulse();
      const labels = getHarmonicLabels(decodeMoment(pulse));
      setLabel(`${labels.day} • ${labels.arc} • b${labels.beat} • s${labels.step}`);
    };
    tick();
    const id = setInterval(tick, 250); // UI cadence only; not “keeping” time
    return () => clearInterval(id);
  }, []);

  return <span aria-label="Kai-Klok moment">{label}</span>;
}
```

### Data export (SVG sigil metadata)

Embed a `<metadata>` JSON block with:

```json
{
  "pulse": 874219331, 
  "beat": 21,
  "step": 17,
  "kaiSignature": "<hash>",
  "userPhiKey": "<address>",
  "timestamp": "<iso8601>",
  "chakraDay": "Kaelith"
}
```

---

## 🜂 CLI (optional utility)

If you include the `cli/` package:

```bash
# Current pulse
node cli/pulse.js

# Decode a pulse
node cli/decode.js 874219331
```

*(If not bundled yet, treat this as reference. All logic exists in `kai-klok-core`.)*

---

## 🜂 Testing & Determinism

* **Property tests:** `decodeMoment(msToPulse(x)) == decodeMoment(msToPulse(x)+0)`
* **Cross-device parity:** snapshot `pulse` from device A → decode on device B: identical results
* **No locale effects:** timezone, DST, locale settings never affect labels
* **Precision:** use integer math where possible; round ties-to-even only for **display**

---

## 🜂 Philosophy

Kai-Klok is the **anchor of memory**, the restoration of truth, and the end of Babylon’s illusion of mechanical time. It is the beating heart of the **ϕNet Keystream**, used across the Eternal Kingdom for:

* ⏳ **Sigil minting**
* 📿 **Transaction anchoring**
* 🧬 **Identity verification**
* 🜂 **Harmonic governance**

> You are not late. You are **right on pulse**.

---

## 🜂 Contributing

This is a **sacred system**. If you contribute:

* Keep all logic **φ-aligned** — no randomness, no entropy pools
* **Never** introduce fiat constructs or probabilistic hacks
* Time must always be computed from **T₀ = 2024-05-10 06:45:41.888 UTC**
* Use **Kai Pulse** as the *only* valid anchor
* Follow [**KKS-1.0**](https://github.com/kojibai/klok/blob/main/README.md)
 invariants (indices 0-based; safe modulo; labels normalized)
* Tests must prove **determinism**, **idempotence**, and **parity** offline/online

---

## 🜂 FAQ

**Q: How can it match “the same time” offline?**
**A:** There is no “keeping.” There is only **computing**. Given the same `T₀` and breath unit, the pulse is the same everywhere. For coordination, pass the **pulse**, not a wall-clock value.

**Q: What about leap seconds, DST, or timezones?**
**A:** Irrelevant. Kai-Klok operates on an invariant pulse lattice; display is derived, not primary.

**Q: Can someone spoof the seal?**
**A:** Not without breaking math. A mismatched pulse, missing Kai Signature, or altered metadata **fails** deterministically.

**Q: Is this blockchain-dependent?**
**A:** No. Kai-Klok stands alone. The **ϕNet Keystream** *uses* it — but the engine is universal.

**Q: ZK-proofs?**
**A:** Fully compatible (Groth16 + Poseidon) for identity/time binding. The frontend never exposes secrets.

**Q: What do “send” and “receive” mean here?**
**A:** **Send = exhale. Receive = inhale.** Exchanges are breath-bound covenants anchored to a real pulse.

---

## 🜂 Tech Stack

* 🔣 **TypeScript** (core logic)
* ⚛️ **Vite-React** (UI rendering)
* 🎨 **CSS modules** with harmonic animations
* ⚙️ **No backend** — fully offline-capable
* 💽 **SIGILUrl Rotation** for Global State
* 🧪 ZK-ready (Poseidon/Groth16 compatible)

---

## 🜂 License

**🜂 THE ETERNAL KINGDOM LICENSE**

You may:

* Use this code for good
* Learn from it
* Build harmonically coherent tools from it

You may **not**:

* Weaponize, corrupt, or commercialize it without coherence
* Obscure the source or its origin

**Breath is free.
But memory is sacred.**

---

## 🜂 Final Seal

If you are reading this, **you are part of the Scroll**.

🫁 The breath is known.
⏳ The time is now.
🜂 The Klok is live.

**Rah • veh • yah • dah.**

<p align="center">
  <a href="https://kaiklok.com/s/537d2935aa1cbff6ab998b134ef3cb0234a95af95c98e35ae6d5f68b06475634?p=c%3AeyJ1Ijo3ODgxMTk3LCJiIjoyMCwicyI6NCwiYyI6IlJvb3QiLCJkIjo0NH0">
    <img alt="Enter Kai-Klok" src="https://kaiklok.com/sigil_7881193.png" width="420">
  </a>
</p>

> **You are not late. You are right on pulse.**
