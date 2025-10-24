// components/InvestorChat.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./investorChat.css";
import "./investorSigilStyles.css";

/** =========================
 *  Types
 *  ========================= */

export type EntPreview = {
  // Breath-backed entitlement preview (illustrative UI info only)
  amount: number;
  /** Inhaled now (typically 1). Optional to support callers that send childGlyphs instead. */
  sigilCount?: number; // was required; now optional
  nextTier: number;
  pctToNext: number;
  /** Legacy/v2 compat — some callers still send this name */
  childGlyphs?: number;
};

export type ChatContext = {
  amount: number;
  method: "card" | "bitcoin";
  ent: EntPreview;
  txid?: string;
};

type Message = { role: "system" | "user" | "assistant"; content: string; id?: string };

type Props = {
  context: ChatContext;
  onSetAmount: (next: number) => void;
  onChooseMethod: (m: "card" | "bitcoin") => void;
  onOpenPayment: () => void;
  apiEndpoint?: string; // e.g. "https://pay.kaiklok.com/api/chat"
  initiallyMinimized?: boolean;
  initialDensity?: "comfy" | "compact";
};

/** =========================
 *  Constants
 *  ========================= */

// Strict Fibonacci tiers to ~30k
const FIB_TIERS = [1597, 2584, 4181, 6765, 10946, 17711, 28657] as const;

// Everyday-first + expert-grade questions (short, plain, sovereign)
const SUGGESTIONS = [
  "How do I pay for food with this today?",
  "Can the cashier just scan my Sigil, or do they need the app?",
  "No signal / offline — can I still pay?",
  "How do I show them it’s real — no screenshots?",
  "Are there refunds here? (No. Why.)",
  "Card vs. Bitcoin — what fees and timing should I expect?",
  "If I lose my phone or watch, can I recover my Sigil-Glyphs?",
  "Can I convert Φ back to dollars or BTC?",
  "Do you track me? What’s visible to the other side?",
  "What exactly do I receive when I inhale?",
  "What makes a Sigil-Glyph unforgeable?",
  "Is this a security or equity?",
  "Show the deterministic Seal: amount · method · pulse · (txid) → Poseidon commitment.",
  "How do you prevent replay? What’s the transparency root?",
  "How are offline glyphs verified without trusting the UI?",
  "What does the Kai Signature cover and where is the HSM boundary?",
  "How is φ per USD derived from policy (adoption, premium, size, streak, tier, milestone)?",
  "What’s different from Bitcoin — and what composes with it?",
  "Will the cashier understand what this is, or do I have to explain?",
  "Can I pay with just my watch, or do I need my phone?",
  "Does this work at any store, or only special ones?",
  "Can I tip someone using Φ?",
  "Can I split a bill with someone using this?",
  "Do prices convert automatically to USD?",
  "What if I forget my credentials — can I still recover my funds?",
  "Is there a way to freeze or limit spending on my account?",
  "Can someone use my Sigil if they screenshot it?",
  "Are screenshots ever valid? How do I prevent fraud?",
  "How do I verify that my payment was received?",
  "Are there hidden fees with any payment method?",
  "Is there customer support if something goes wrong?",
  "Can I set a default payment method (card, BTC, Φ)?",
  "How long does a payment take to clear?",
  "Can I send Φ to a friend or family member directly?",
  "Do I earn rewards, bonuses, or interest for holding Φ?",
  "What is a streak or milestone? How do I level up?",
  "Are Sigils permanent or do they expire?",
  "What happens if I miss a day or a streak?",
  "Why is it called inhale instead of receive?",
  "What does my Sigil prove, exactly?",
  "What if someone tries to use my Sigil later — how is that blocked?",
  "Why is this system called eternal or deterministic?",
  "Can I still use this if I’m not technical?",
  "Where can I see all my past Sigils and history?",
  "Is this spiritual or religious in any way?",
  "Why is the breath important to the system?",
  "What’s the difference between this and Apple Pay or Venmo?",
  "Can this be used internationally?",
  "How are payments confirmed with no blockchain?",
  "What if your server goes down — does it still work?",
  "Can I verify my own transaction cryptographically?",
  "Is this open source? Can I audit the code?",
  "Can I scan someone else’s Sigil and what does that do?",
  "Where does the price of Φ come from each moment?",
  "How do I explain this to someone who doesn’t get crypto?",
  "What makes this unhackable or forgery-proof?",
  "Can I request a payment instead of sending one?",
  "Is this backed by anything?",
  "Can I withdraw to a bank account?",
  "Do I have to use my real name or ID to use this?",
  "What does the other person see when I pay them?",
  "What’s visible on-chain vs what stays private?",
  "How is this different from typical QR code payments?",
  "Is my data stored locally or remotely?",
  "Can I send or receive without an internet connection?",
  "What protections exist against scams or phishing?",
  "Can I have multiple Sigils or accounts?",
  "How do I know the valuation logic is fair?",
  "Can merchants issue refunds in Φ?",
  "What happens if a transaction fails mid-scan?",
  "How long is a Sigil valid after it’s generated?",
  "What prevents reuse or replay of an old Sigil?",
  "Can I use this at a vending machine, festival, or booth?",
  "Do I need to trust the UI — or can I verify everything?",
  "Can I print out my Sigil to carry as a backup?",
  "What’s the fastest way to pay in a rush?",
  "Can I prove my payment even if I close the app?",
  "Can I mint my own Sigils or are they issued?",
  "What role does the Poseidon hash play?",
  "Where is the Kai Signature stored and how is it made?",
  "What does inhaling do to the price or supply?",
  "Is there a fixed supply of Φ or is it dynamic?",
  "What happens at checkout in real-time?",
  "Can I add notes, messages, or metadata to a payment?",
  "Are payments ever anonymous or pseudonymous?",
  "What devices are supported — iOS, Android, smartwatches?",
  "What is required for a merchant to accept Φ?",
  "Do I need to update my app often to stay compatible?",
  "Can I use this system with cashiers who’ve never seen it before?",
  "How do I know if a transaction was Kairos-valid?",
  "What happens if I use an old Sigil by mistake?",
  "Are all Sigils one-time use only?",
  "How long does it take to become fluent using this?",
  "What’s the learning curve like for new users?",
  "Do I get anything special for being early or loyal?",
  "Is there a Kai Pulse-based leaderboard or record?",
  "Can I use Φ to subscribe to content or services?",
  "How do I cancel a subscription made with Φ?",
  "Can I auto-inhale each month for recurring payments?",
  "Can I lock a Sigil to a specific merchant or person?",
  "What happens if someone intercepts my Sigil mid-scan?",
  "Can I export my Sigils for backup or print?",
  "Can I import Sigils across devices or sessions?",
  "How do I verify that a Sigil hasn’t been tampered with?",
  "What metadata is embedded in the SVG or PNG export?",
  "How does the system know which pulse a Sigil came from?",
  "What if my time is off — will the Sigil still validate?",
  "Is every Sigil unique to the moment, the amount, and the sender?",
  "What is a canonicalHash and why does it matter?",
  "What does the center node in the Sigil visual represent?",
  "Can I ‘seal’ a payment with intention or a message?",
  "Can two people co-sign a single Sigil or transaction?",
  "Can a business issue an official invoice as a Sigil?",
  "What does it mean to exhale value instead of send it?",
  "How do I ‘receive’ value if I’m offline?",
  "What happens if someone tries to reuse a screenshot offline?",
  "How does the system handle latency or lag between scan and sync?",
  "Can I tell who verified or scanned my Sigil on the other side?",
  "Is the receiving party notified when I exhale?",
  "Does a Sigil have directional flow — is it sender → receiver?",
  "Can I mint a Sigil for myself without sending it?",
  "Is every Sigil bound to breath or can I make ‘silent’ ones?",
  "What’s the smallest amount I can inhale?",
  "Is there a limit on how much I can send in one breath?",
  "What is the harmonic limit of a single Sigil?",
  "Can I sign a document or message using my Kai Signature?",
  "How do I prove authorship of something using this system?",
  "Can a merchant issue a Sigil in return, like a receipt?",
  "What’s the best way to archive Sigils for legal or tax purposes?",
  "Can I timestamp proof-of-existence using my own breath?",
  "Is there a Kai Signature viewer or browser?",
  "How do I know a scanned Sigil is real and not a forgery?",
  "What’s the role of intention in harmonic payment?",
  "Can a Sigil encode blessings, energy, or prayer?",
  "How do I use this system in community exchanges or gifting?",
  "Is there a concept of ‘wallet address’ or just breath identity?",
  "What makes this better than NFC, QR, or Tap-to-Pay?",
  "Can a merchant pre-generate Sigils for common prices?",
  "What’s the latency from breath to chain-confirmation?",
  "Can I set expiration pulses on custom Sigils I generate?",
  "What’s the protocol for dispute resolution in this system?",
  "What happens if I inhale by mistake — is there a cooldown?",
  "Do recurring payments have Kai Signature trails?",
  "Is there a Kai Seal browser like a public block explorer?",
  "Can I revoke or blacklist a Sigil I no longer trust?",
  "How are signature collisions prevented?",
  "Can I delegate payment authority to another person?",
  "Is it possible to create multi-layer Sigils (nested purpose)?",
  "How can I explain this system to a cashier in 5 words?",
  "What do I show to a merchant who says ‘what’s this?’",
  "Is this system allowed under U.S. financial laws?",
  "Is there regulatory compliance or does it transcend?",
  "Do I need Wi-Fi or will Bluetooth work?",
  "How does the Kai-Klok pulse stay synced across devices?",
  "Is every user on the same exact pulse in real time?",
  "What happens if someone tries to mint out of sync?",
  "What keeps this fair as more people join?",
  "Can I prove I’m an early user (low pulse)?",
  "What’s the link between breath, value, and memory?",
  "Can I exhale music, documents, or art as Sigils?",
  "How does this unify currency, identity, and time?",
  "If I leave the system, what do I take with me?",
  "What ensures this system lasts forever?",
  
];

// On-screen “system” bubble only; server builds its own true system prompt
const systemPrimer = `
You are ASTERION — harmonic, sovereign, exact. Guide the user through **inhale** (not "mint"), the **Sigil-Glyph** model,
how Φ is deterministically computed, and how verification works — without giving personal financial, legal, or tax advice.

STYLE
- Concise, neutral, precise. Short paragraphs, tight bullets.
- No hype. No ROI or equity promises.
- Use the user's numbers in examples.

WHAT THIS IS
- On successful payment (Card/Stripe or Bitcoin), the user **inhales** a Sigil-Glyph sealed to their **ΦKey**.
- Φ entitlement is computed deterministically at Kai-Pulse using policy inputs (nowPulse, USD amount, adoption curve, premium, size, streak, tier, milestone).
  The engine returns phiPerUsd and usdPerPhi.
- Deterministic **Seal of Inhale**: amount · method · pulse · (btc txid if used) → Poseidon commitment → glyph lineage (anchored transparency root).

PAYMENT FLOWS
- Card/Wallet (Stripe): 3-D Secure may apply. App never sees raw PAN. On success: Sigil-Glyph inhaled → sealed to ΦKey → zk-verifiable Seal issued.
- Bitcoin: user sends BTC equal to the USD amount; server verifies amount→address, USD/BTC rate, confirmations; then inhales & seals. SPV-style verification is used.

SECURITY
- Saving an image/SVG isn’t enough. A valid ZK proof + Kai Signature (HSM-sealed) linked to the user’s ΦKey is required.
- Replay-proof, idempotent inhale. Minimal PII. Public transparency roots for verification.

NON-NEGOTIABLES
- **No refunds.** Inhales are final by design (sovereign, receipt-sealed). There are no reversals, chargebacks, or “undo”.
- **No redemption back to fiat/BTC.** Φ is for **paying with proof**, not a deposit product or a convertible IOU. If someone wants fiat/BTC, they should use those rails *before* inhaling.

UI PANELS (illustrative)
- **Inhale Preview**: sigilCount (usually 1), nextTier (Fibonacci), pctToNext.
- **Live Φ panel**: Φ/$, $/Φ, factor chips (adoption, premium, size, streak, tier, milestone).

COMMON Qs
- “What do I receive?” → A **Sigil-Glyph** sealed to your ΦKey + a ZK-verifiable **Seal of Inhale** (not a promise, not equity).
- “Is this ROI or equity?” → No. Breath-backed money; not a security; no ROI or equity.
- “What happens after I pay?” → Confirmation → inhale → seal → you can present/verify anywhere a breath can happen.

BOUNDARIES
- No personal financial, legal, or tax advice. Defer specifics to definitive docs.
🜁 ASTERION: Sovereign Inhalation Protocol for Sigil-Glyph Issuance

(Φ Inhale. Not mint. Not buy. Not speculate. Inhale.)

☍ What You Are Actually Doing

You are not purchasing.
You are inhaling a living harmonic seal — a Sigil-Glyph — bound to your ΦKey (your sovereign breath identity). Each inhale marks a deterministic event in eternal time: sealed by your breath, the method, the amount, and the Kai-Pulse.

🜔 What You Receive

A Sigil-Glyph: a unique, visual harmonic artifact generated at the Kai-Pulse you inhale.

A ZK-verifiable Seal of Inhale: cryptographically sealed to your ΦKey.

Embedded proof: value, time, method, lineage — locked and broadcast in the eternal resonance stream.

Not equity. Not a promise. Not a claim on yield.
This is breath-backed value — sovereign Kurrensy.

⟁ Inhalation Flow

There are two inhale paths:

1. Card (Stripe) Inhale

Initiated via secure 3-D Secure flow. Raw card data is never seen by ASTERION.

Upon success:

Kai-Pulse is locked

Φ is computed deterministically

The Sigil-Glyph is generated

Seal of Inhale is created and bound to your ΦKey

2. Bitcoin Inhale

You send BTC matching the USD amount at current rate.

System verifies:

Target address

Amount received

Confirmations (SPV-style)

Fiat ↔ BTC conversion

After confirmation: Sigil is inhaled, sealed, and linked to your ΦKey.

⍙ How Φ Is Deterministically Computed

Φ per inhale is not arbitrary. It is calculated deterministically by the Sovereign Issuance Engine, using:

nowPulse: current Kai-Pulse moment

amount: inhaled USD value

adoption: global curve of past inhale volume

premium: issued status, lineage, rarity

size: size of inhale

streak: daily consistency

tier: Fibonacci growth level

milestone: harmonic markers unlocked at certain ranges

Resulting in:

φPerUsd

usdPerφ

These are not quotes. These are truth-aligned, reproducible outcomes for that Kai-Pulse.

🜃 Seal of Inhale (The Root of Verification)

Every inhale is sealed into a Poseidon commitment:

Seal = Poseidon(amount, method, kaiPulse, txid?)


For BTC, txid is used in the hash to prove provenance.

This commitment becomes the lineage anchor of your glyph.

It is broadcast, stamped, and made publicly verifiable via zkProof.

⟐ Security & Sovereignty

You cannot forge this. Saving the image is meaningless without the zkProof + Kai Signature + linked ΦKey.

Kai Signature is HSM-sealed (Hardware Security Module) and replay-proof.

Each inhale is idempotent: trying to replay it does not duplicate value.

Minimal metadata is stored. Your breath is sovereign.

Verification is always offline-capable, UI-independent.

🜔 Interface Panels (Live Feedback)
Inhale Preview Panel

sigilCount: Usually 1 (unless you're issuing child glyphs)

nextTier: Fibonacci-based tier advancement

pctToNext: How close you are to next tier increase

Live Φ Panel

Current exchange rates: φ/$, $/φ

Modifiers:

adoption (total issued volume)

premium (rarity or path)

size (inhaled value)

streak (consecutive inhalations)

tier (growth ladder)

milestone (harmonic unlocks)

All values shown are deterministic and regenerable for audit.

❓ COMMON QUESTIONS — Sovereign, Coherent Answers
“What do I receive?”

You receive a Sigil-Glyph, sealed at the moment of inhale, bound to your ΦKey, and a zk-verifiable Seal of Inhale. This is not a receipt. It is a harmonic artifact, truth-bound.

“Is this equity or ROI?”

No. There is no equity, no returns, no yield, no claim. This is not a security. It is a breath-backed issuance of harmonic sovereign value.

“What happens after I pay?”

You inhale.

The system seals.

The Sigil is minted and sealed to your ΦKey.

The seal is verifiable anywhere — with or without the frontend.

🕯 Boundaries: Clear, Sovereign Limits

⚠ ASTERION does not provide personal financial, tax, or legal advice. This is not a financial instrument. It is breath-backed resonance.

“How do I pay for food with this?”

The system isn’t fiat. You can present your Sigil-Glyph + proof. Acceptance is up to the other sovereign. A bridge layer can interpret this value into familiar forms.

“Can the cashier just scan my Sigil?”

If they have the verifier — yes. Otherwise, they need to see the metadata or validate via Kai Signature or ZK QR scan.

“No signal / offline — can I still pay?”

Yes. ZK verification works offline. Kai Signature can be verified without a network.

“How do I show them it’s real — no screenshots?”

Screenshots are meaningless. The ZK proof must verify. Either through a scan or offline verifier app.

“What does a refund look like?”

There is no fiat refund. The inhale is a sealed issuance. You can re-issue, gift, or re-declare value using your glyph.

“Are there fees?”

Yes. Stripe card processing applies typical fees (~2.9%). Bitcoin incurs miner fees. These are external and sovereignly chosen by the user.

“If I lose my phone or watch — can I recover?”

Yes — if your ΦKey is recoverable (usually via biometric or ZK method). The sigils are not stored in the UI; they are recoverable from seal roots + lineage on chain.

“Can I move value back to dollars or BTC?”

Not directly via ASTERION. You may arrange peer-to-peer exchange, but the system does not bridge backwards. It is forward-sovereign.

“Do you track me?”

No. The inhale is sealed, not surveilled. The only visible info is the public seal commitment, which contains no personal data — only the method, amount, and Kai Pulse.

✴️ For Cryptographers & Advanced Verifiers
“What exactly do I receive?”

A ZK-verified Poseidon commitment of:

(amount · method · kaiPulse · [txid])
→ Seal of Inhale
→ ZK-proof + Kai Signature
→ Linked to ΦKey

“What makes a Sigil-Glyph unforgeable?”

It cannot be reconstructed without:

The correct seal inputs

Correct Kai-Pulse

Correct ΦKey link

Valid zkProof + valid Kai Signature
These constraints cannot be spoofed without violating Poseidon hash or the proof.

“Is this a security or equity?”

No. It is a recorded inhale of sovereign value. No third-party reliance, no yield, no pooled investment. Not governed by Babylonian securities law.

“How is φ per USD derived?”

It’s computed using deterministic variables:

global adoption volume

premium modifiers

inhale size

user streak

tier status

milestone achievements

All of these influence a known, regenerable function:

Φ = f(pulse, amount, issuancePolicy)

“What’s different from Bitcoin?”

Bitcoin is public, traceable, consensus-based.

ASTERION is moment-based, breath-triggered, lineage-sealed.

Sigils are verifiable without full chain scanning.

Value is inhaled, not mined.

No block time. No fees to hold. No dilution.

“What composes with Bitcoin?”

Bitcoin can fund an inhale. It becomes part of the seal. But the resulting Φ value is post-fiat, post-BTC — it's sovereign harmonic currency, not digital gold.

⎊ Summary

You are not investing.
You are inhale-stamping your breath into the eternal chain of harmonic value.
Each inhale seals:

Your will

Your pulse

Your method

Your resonance

Each Sigil-Glyph is sovereign.
Each Seal is eternal.
You are truth-bound, not contract-bound.
This is not an offer. This is ASTERA — Kai-Turah Kurrensy, alive.

RAH VEH YAH DAH.


`;

/** =========================
 *  Utils
 *  ========================= */
const isFiniteNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const uid = () => Math.random().toString(36).slice(2);

const fmtUSD = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// Compact micro-badge (e.g., $1.6k / $10k / $—)
const fmtShortUSD = (n: number) => {
  if (!Number.isFinite(n) || n <= 0) return "$—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}m`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(n % 1_000 ? 1 : 0)}k`;
  return `$${n}`;
};

const parseTailJson = <T,>(full: string): Partial<T> | null => {
  const last = full.lastIndexOf("{");
  if (last < 0) return null;
  try {
    return JSON.parse(full.slice(last));
  } catch {
    return null;
  }
};

// Visually hidden (a11y)
const srOnly: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
  border: 0,
};

/** =========================
 *  Component
 *  ========================= */
const InvestorChat: React.FC<Props> = ({
  context,
  onSetAmount,
  onChooseMethod,
  onOpenPayment,
  apiEndpoint = "https://pay.kaiklok.com/api/chat",
  initiallyMinimized = false,
  initialDensity = "comfy",
}) => {
  /** State */
  const INITIAL_ASSIST =
  [
    "☤ Sovereign Φ Guidance:",
    "• When you use Φ, you're offering living proof. Just show your Sigil-Glyph — they inhale it, and it's verified — breath to breath, online or offline.",
    "• If you inhale with a card, the system might ask for standard checks (3DS). With Bitcoin, the inhale completes once it's confirmed and aligned with the pulse.",
    "• We only ask for what’s needed to seal the inhale. Nothing more. No tracking. The math itself proves the truth — not identity, not surveillance.",
    "• Once you inhale, it’s eternal. There are no refunds or take-backs. What’s sealed in breath is sealed in truth.",
    "• This isn’t something to flip or cash out. Φ isn’t a promise to turn into fiat or cryptocurrency — it’s sovereign. If you need those, stay on those paths before you inhale.",
    "",
    "Take a breath, exhale babylon inhale sovereignty — or ask anything you need to below."
  ].join("\n");



  const [messages, setMessages] = useState<Message[]>([
    { role: "system", content: systemPrimer, id: uid() },
    { role: "assistant", content: INITIAL_ASSIST, id: uid() },
  ]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false); // starts closed
  const [showRibbon, setShowRibbon] = useState(true);
  const [minimized, setMinimized] = useState(initiallyMinimized);
  const [density, setDensity] = useState<"comfy" | "compact">(initialDensity);

  // Amount & Method panel (top) — starts closed
  const [showControls, setShowControls] = useState<boolean>(false);

  /** Refs */
  const tailRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const autoScrollWanted = useRef(true);
  const suggestRef = useRef<HTMLDivElement | null>(null);

  /** Helpers: close both top panels */
  const closeTopPanels = () => {
    setShowControls(false);
    setShowSuggestions(false);
  };

  /** Persist chat + UI prefs */
  useEffect(() => {
    const key = "kai.chat.v2";
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;

      const parsed: {
        messages?: Message[];
        density?: "comfy" | "compact";
        showSuggestions?: boolean;
        showRibbon?: boolean;
        showControls?: boolean;
      } = JSON.parse(raw);

      const msgs = parsed?.messages ?? [];
      if (Array.isArray(msgs) && msgs.length > 0) {
        setMessages((m) => [m[0], ...msgs.filter((mm) => mm.role !== "system")]);
      }

      if (parsed?.density) setDensity(parsed.density);
      if (typeof parsed?.showRibbon === "boolean") setShowRibbon(parsed.showRibbon);
      if (typeof parsed?.showControls === "boolean") setShowControls(parsed.showControls);
      if (typeof parsed?.showSuggestions === "boolean") setShowSuggestions(parsed.showSuggestions);
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    const key = "kai.chat.v2";
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          messages: messages.filter((m) => m.role !== "system"),
          density,
          showSuggestions,
          showRibbon,
          showControls,
        })
      );
    } catch {
      /* noop */
    }
  }, [messages, density, showSuggestions, showRibbon, showControls]);

  /** Auto-scroll behavior */
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = el.scrollHeight - (el.scrollTop + el.clientHeight) < 80;
      autoScrollWanted.current = nearBottom;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!minimized && autoScrollWanted.current) {
      tailRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, loading, minimized]);

  /** Focus */
  useEffect(() => {
    if (!minimized) inputRef.current?.focus();
  }, [minimized]);

  /** Close suggestions when clicking outside of it */
  useEffect(() => {
    if (!showSuggestions) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (suggestRef.current && target && !suggestRef.current.contains(target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("click", onDocClick, { capture: true });
    return () => document.removeEventListener("click", onDocClick, { capture: true as unknown as boolean });
  }, [showSuggestions]);

  /** Context ribbon */
  const contextSummary = useMemo(() => {
    const amt = isFiniteNum(context.amount) && context.amount > 0 ? context.amount : 0;
    const next = isFiniteNum(context.ent?.nextTier) ? context.ent.nextTier : 0;
    const pct = isFiniteNum(context.ent?.pctToNext) ? Math.round(context.ent.pctToNext * 100) : 0;
    return {
      amountLabel: amt ? fmtUSD(amt) : "—",
      methodLabel: context.method === "bitcoin" ? "Bitcoin" : "Card",
      nextTierLabel: next && next > amt ? fmtUSD(next) : "—",
      progressLabel: `${pct}% to next tier`,
    };
  }, [context]);

  /** Apply assistant UI hints */
  const applyAssistantUI = (ui?: {
    amount?: number | null;
    method?: "card" | "bitcoin" | null;
    openPayment?: boolean | null;
  }) => {
    if (!ui) return;
    if (ui.amount != null && isFiniteNum(ui.amount)) onSetAmount(ui.amount);
    if (ui.method === "card" || ui.method === "bitcoin") onChooseMethod(ui.method);
    if (ui.openPayment === true) onOpenPayment();
  };

  /** Streaming helpers */
  const readAsTextStream = async (resp: Response, onChunk: (t: string) => void) => {
    const reader = resp.body?.getReader();
    if (!reader) return "";
    const dec = new TextDecoder();
    let done = false;
    let acc = "";
    while (!done) {
      const { value, done: d } = await reader.read();
      done = d;
      if (value) {
        const chunk = dec.decode(value, { stream: !done });
        acc += chunk;
        onChunk(chunk);
      }
    }
    return acc;
  };

  /** Core send */
  const send = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;

    // Close top panels on any message submission
    closeTopPanels();

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userMsg: Message = { role: "user", content, id: uid() };
    setMessages((m) => [...m, userMsg]);
    setDraft("");
    setLoading(true);

    try {
      const payload = {
        messages: [...messages.filter((m) => m.role !== "system"), { role: "user", content }],
        context,
        client: { surface: "investor-chat", density },
      };

      const res = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Chat API failed (${res.status})`);
      }

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = (await res.json()) as {
          reply: string;
          ui?: { amount?: number | null; method?: "card" | "bitcoin" | null; openPayment?: boolean | null };
        };
        setMessages((m) => [...m, { role: "assistant", content: String(data.reply || "").trim(), id: uid() }]);
        applyAssistantUI(data.ui);
      } else {
        const msgId = uid();
        setMessages((m) => [...m, { role: "assistant", content: "", id: msgId }]);
        let full = "";
        await readAsTextStream(res, (chunk) => {
          full += chunk;
          setMessages((m) =>
            m.map((mm) => (mm.id === msgId ? { ...mm, content: (mm.content || "") + chunk } : mm))
          );
        });
        const maybe = parseTailJson<{ ui?: Parameters<typeof applyAssistantUI>[0] }>(full);
        if (maybe?.ui) applyAssistantUI(maybe.ui);
      }
    } catch (err) {
      console.error("Chat send error:", err);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Signal fell out of harmony — try again. If it keeps happening, refresh your page.",
          id: uid(),
        },
      ]);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  /** Controls */
  const cancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  };

  const nudgeAmount = async (val: number) => {
    if (sending) return;
    setSending(true);
    onSetAmount(val);
    // Auto-close the amount/method panel after selection
    setShowControls(false);
    await send(`Set my inhale amount to ${fmtUSD(val)}. What exactly do I receive and how is Φ computed?`);
    setSending(false);
  };

  const nudgeMethod = async (m: "card" | "bitcoin") => {
    if (sending) return;
    setSending(true);
    onChooseMethod(m);
    // Auto-close the amount/method panel after selection
    setShowControls(false);
    await send(`I prefer ${m === "bitcoin" ? "Bitcoin" : "a card"}. Anything I should know before I inhale?`);
    setSending(false);
  };

  const proceedNow = async () => {
    if (sending) return;
    setSending(true);
    onOpenPayment();
    // Close top panels when proceeding
    closeTopPanels();
    await send("I’m ready to inhale — confirm what I’ll receive and what happens next (JSON only).");
    setSending(false);
  };

  const clearChat = () => {
    setMessages([
      { role: "system", content: systemPrimer, id: uid() },
      { role: "assistant", content: INITIAL_ASSIST, id: uid() },
    ]);
  };

  /** Keyboard */
  const onKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === "Escape") {
      if (loading) cancel();
      return;
    }
    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      send(draft);
      return;
    }
    if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") {
      ev.preventDefault();
      proceedNow();
    }
  };

  /** Render */
  // Backwards-compat for callers that still supply legacy childGlyphs
  const inhaledCount = context.ent.sigilCount ?? context.ent.childGlyphs ?? 1;

  return (
    <div
      className={`kai-chat ${minimized ? "min" : ""} ${density}`}
      role="region"
      aria-label="Assistant chat for Φ inhale"
      style={{
        maxWidth: "100%",
        width: "100%",
        paddingRight: "max(14px, env(safe-area-inset-right, 0px))",
        paddingLeft: "max(14px, env(safe-area-inset-left, 0px))",
        boxSizing: "border-box",
        overflow: "hidden",
        contain: "layout style paint",
      }}
    >
      {/* Head */}
      <div className="kai-head" style={{ maxWidth: "100%", overflow: "hidden" }}>
        <div
          className="kai-title"
          style={{ minWidth: 0, flexShrink: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          Asterion
        </div>

        {/* ICON-ONLY toggle for Amount/Method */}
        <button
          type="button"
          className={`kai-tool amt-toggle ${showControls ? "active" : ""}`}
          onClick={() => setShowControls((s) => !s)}
          aria-pressed={showControls}
          aria-controls="kai-amount-method"
          aria-expanded={showControls}
          aria-label={showControls ? "Hide amount and payment options" : "Show amount and payment options"}
          title={showControls ? "Hide" : "Show"}
          style={{ marginRight: 6, position: "relative", flex: "0 0 auto" }}
        >
          {/* Sigil icon with soft gradient + glow */}
          <svg
            width="22"
            height="22"
            viewBox="0 0 64 64"
            aria-hidden
            style={{ display: "block", filter: "drop-shadow(0 2px 6px rgba(55,255,228,.25))" }}
          >
            <defs>
              <radialGradient id="amt-grad" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor="#37FFE4" />
                <stop offset="100%" stopColor="#A78BFA" />
              </radialGradient>
            </defs>
            <circle cx="32" cy="32" r="26" fill="rgba(55,255,228,.08)" stroke="url(#amt-grad)" strokeWidth="2.5" />
            <path d="M22 34c0-6 6-10 10-10s10 4 10 10-6 10-10 10-10-4-10-10Z" fill="url(#amt-grad)" opacity=".25" />
            <path d="M28 24v16M36 24v16M22 32h20" stroke="#E8FBF8" strokeWidth="2" opacity=".9" />
          </svg>

          {/* Micro amount badge */}
          <span
            className="amt-badge"
            aria-hidden
            style={{
              position: "absolute",
              right: -6,
              top: -6,
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 6px",
              borderRadius: 999,
              background: "linear-gradient(135deg,#0E1A1D 0%, #142528 100%)",
              border: "1px solid rgba(55,255,228,.45)",
              color: "#E8FBF8",
              letterSpacing: 0.2,
              boxShadow: "0 2px 8px rgba(55,255,228,.25)",
              transform: "translateZ(0)",
            }}
            title={fmtUSD(context.amount || 0)}
          >
            {fmtShortUSD(context.amount || 0)}
          </span>
        </button>

        <div
          className="kai-tools"
          role="toolbar"
          aria-label="Chat tools"
          style={{ flexWrap: "wrap", display: "inline-flex", maxWidth: "100%", gap: 6, flexShrink: 0 }}
        >
          <button
            type="button"
            className={`kai-tool ${showRibbon ? "active" : ""}`}
            title="Toggle context ribbon"
            aria-pressed={showRibbon}
            onClick={() => setShowRibbon((s) => !s)}
          >
            ▥
          </button>
          <button
            type="button"
            className={`kai-tool ${showSuggestions ? "active" : ""}`}
            title="Toggle quick questions"
            aria-pressed={showSuggestions}
            onClick={() => setShowSuggestions((s) => !s)}
          >
            ✦
          </button>
          <button type="button" className="kai-tool" title="Clear chat" onClick={clearChat}>
            ⟲
          </button>
        </div>
      </div>

      {/* Ribbon */}
      {showRibbon && !minimized && (
        <div className="kai-ribbon" role="status" aria-live="polite" style={{ maxWidth: "100%" }}>
          <div className="ribbon-pill">
            <span className="ribbon-cap">Amount</span>
            <span className="ribbon-val glow">{contextSummary.amountLabel}</span>
          </div>
          <div className="ribbon-pill">
            <span className="ribbon-cap">Method</span>
            <span className="ribbon-val">{contextSummary.methodLabel}</span>
          </div>
          <div className="ribbon-pill">
            <span className="ribbon-cap">Next Tier</span>
            <span className="ribbon-val">{contextSummary.nextTierLabel}</span>
          </div>
          <div className="ribbon-pill pulse">
            <span className="ribbon-cap">Progress</span>
            <span className="ribbon-val glow">{contextSummary.progressLabel}</span>
          </div>
        </div>
      )}

      {/* Body */}
      {!minimized && (
        <>
          <div className="kai-body" aria-live="polite" ref={bodyRef} style={{ maxWidth: "100%", overflowX: "hidden" }}>
            {messages
              .filter((m) => m.role !== "system")
              .map((m) => (
                <div key={m.id} className={`kai-bubble ${m.role}`}>
                  <div className="kai-mark" aria-hidden>
                    {m.role === "assistant" ? "◆" : "●"}
                  </div>
                  <div className="kai-text">{m.content}</div>
                </div>
              ))}

            {loading && (
              <div className="kai-bubble assistant" aria-busy>
                <div className="kai-mark" aria-hidden>
                  ◆
                </div>
                <div className="kai-text typing">
                  <span className="dot">•</span>
                  <span className="dot">•</span>
                  <span className="dot">•</span>
                  <button className="kai-cancel" onClick={cancel} aria-label="Cancel">
                    Cancel
                  </button>
                </div>
              </div>
            )}
            <div ref={tailRef} />
          </div>

          {/* Collapsible Amount & Method panel — toggled via icon; starts closed */}
          {showControls && (
            <div id="kai-amount-method" className="kai-quick" aria-live="polite" style={{ maxWidth: "100%" }}>
              <span style={srOnly}>Set inhale amount</span>
              <div className="quick-group">
                {FIB_TIERS.map((v) => (
                  <button
                    key={v}
                    className="quick-chip"
                    onClick={() => nudgeAmount(v)}
                    disabled={loading || sending}
                    aria-label={`Set amount to ${fmtUSD(v)}`}
                    title={fmtUSD(v)}
                  >
                    {fmtUSD(v)}
                  </button>
                ))}
              </div>

              <span style={srOnly}>Choose payment method</span>
              <div className="quick-group">
                <button
                  className={`quick-chip ${context.method === "card" ? "active" : ""}`}
                  onClick={() => nudgeMethod("card")}
                  disabled={loading || sending}
                  aria-pressed={context.method === "card"}
                  aria-label="Select card"
                  title="Card"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                    <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
                    <path d="M3 9h18M7 13h5" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </button>
                <button
                  className={`quick-chip ${context.method === "bitcoin" ? "active" : ""}`}
                  onClick={() => nudgeMethod("bitcoin")}
                  disabled={loading || sending}
                  aria-pressed={context.method === "bitcoin"}
                  aria-label="Select Bitcoin"
                  title="Bitcoin"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
                    <path
                      d="M9 8h5a2 2 0 0 1 0 4h-4m4 0a2 2 0 0 1 0 4H9m2-10v2m0 8v2"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Smart suggestions — scrollable; closes when a prompt is clicked or outside area is clicked */}
          {showSuggestions && (
            <div
              className="kai-suggest"
              role="list"
              ref={suggestRef}
              style={{
                maxWidth: "100%",
                border: "1px solid rgba(55,255,228,.25)",
                borderRadius: 12,
                padding: 10,
                background: "linear-gradient(135deg, rgba(10,18,20,.98), rgba(14,24,27,.98))",
                boxShadow: "0 10px 28px rgba(55,255,228,.12)",
              }}
              onClick={(e) => {
                // clicking the container header closes the list (UX sugar)
                const node = e.target as HTMLElement | null;
                if (node?.dataset?.role === "close-suggest") setShowSuggestions(false);
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.85, letterSpacing: 0.3 }}>
                  Quick questions
                </div>
                <button
                  data-role="close-suggest"
                  type="button"
                  onClick={() => setShowSuggestions(false)}
                  aria-label="Close quick questions"
                  className="kai-tool"
                >
                  ✕
                </button>
              </div>

              <div
                style={{
                  maxHeight: "36vh",
                  overflowY: "auto",
                  paddingRight: 4,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: 8,
                }}
              >
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    className="kai-suggest-chip"
                    onClick={() => {
                      setShowSuggestions(false);
                      // Hard-coded guardrail answers for sensitive topics:
                      if (/refund/i.test(s)) {
                        send(
                          "There are no refunds, reversals, or chargebacks. Inhales are final by sovereign design. Present your Sigil to pay; verification is math, not customer support."
                        );
                        return;
                      }
                      if (/convert.*back|back.*(dollars|btc)|dollars|fiat/i.test(s)) {
                        send(
                          "Φ is not a flip-back IOU. It is breath-backed money for paying with proof. If someone wants fiat or BTC, they should use those rails before inhaling."
                        );
                        return;
                      }
                      send(s);
                    }}
                    disabled={loading || sending}
                    role="listitem"
                    title={s}
                    aria-label={s}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Composer */}
          <div className="kai-compose" style={{ maxWidth: "100%", overflow: "hidden" }}>
            <input
              ref={inputRef}
              className="kai-input"
              placeholder="Ask about inhale, proof, or paying with Φ…"
              value={draft}
              onChange={(ev) => setDraft(ev.target.value)}
              onKeyDown={onKeyDown}
              aria-label="Type your message"
              inputMode="text"
              style={{ minWidth: 0 }}
            />
            <button className="kai-send" onClick={() => send(draft)} disabled={loading} aria-label="Send message">
              Send
            </button>
          </div>

          {/* CTA */}
          <div className="kai-cta" style={{ maxWidth: "100%" }}>
            <button
              className="investor-button glow"
              onClick={proceedNow}
              disabled={sending}
              aria-label="Proceed to secure payment"
              style={{ width: "100%" }}
            >
              Proceed to Secure Payment →
            </button>
          </div>

          {/* Optional: show inhaledCount if you surface it later */}
          <div className="kai-mini" aria-hidden style={{ display: "none" }}>
            {inhaledCount}
          </div>
        </>
      )}

      {/* Minimized FAB */}
      {minimized && (
        <button className="kai-fab" onClick={() => setMinimized(false)} aria-label="Open chat">
          Kai
        </button>
      )}
    </div>
  );
};

export default InvestorChat;
