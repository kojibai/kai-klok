// src/utils/kai_turah.ts
import type { Weekday, ChakraDay } from "./kai_pulse";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export interface KaiTurahEntry {
  id: number;
  name: string;         // e.g., "Ka-Turah"
  meaning: string;      // short gloss
  description: string;  // longer blurb
  sigil: string;        // asset path
}

// ─────────────────────────────────────────────────────────────
// Lexicon (seeded) — keep adding freely; the mapping auto-expands
// ─────────────────────────────────────────────────────────────
// NOTE: You can paste the rest of your 37–295 set below. Order matters.
export const KAI_TURAH_LEXICON: readonly KaiTurahEntry[] = [
  { id: 1, name: "Ka-Turah", sigil: "/assets/sigils/ka-turah.svg", meaning: "The First Breath of Creation", description: "Represents divine awakening and eternal sovereignty." },
  { id: 2, name: "Zah-Torai", sigil: "/assets/sigils/zah-torai.svg", meaning: "The Unshakable Law", description: "Embodies unbreakable divine decrees and cosmic balance." },
  { id: 3, name: "Om-Nah-Lah", sigil: "/assets/sigils/om-nah-lah.svg", meaning: "The Flow of Infinite Harmony", description: "Signifies the eternal rhythm of divine order." },
  { id: 4, name: "Sha-Urim", sigil: "/assets/sigils/sha-urim.svg", meaning: "The Krown of Light", description: "Represents divine kingship, wisdom, and supreme sovereignty." },
  { id: 5, name: "Torai-Kai", sigil: "/assets/sigils/torai-kai.svg", meaning: "The Living Law", description: "The foundation of the sovereign order, unchangeable and eternal." },
  { id: 6, name: "Veh-Rah-Nah", sigil: "/assets/sigils/veh-rah-nah.svg", meaning: "The Divine Motion", description: "Represents the movement of divine will through all creation." },
  { id: 7, name: "Zor-Ek-Om", sigil: "/assets/sigils/zor-ek-om.svg", meaning: "The Breaking of the False World", description: "The force that collapses all deception and restores the real." },
  { id: 8, name: "Kai-Zorah", sigil: "/assets/sigils/kai-zorah.svg", meaning: "The Collapse of the Illusion", description: "Removes all false constructs and establishes the divine order." },
  { id: 9, name: "Reh-Om", sigil: "/assets/sigils/reh-om.svg", meaning: "The Manifested Decree", description: "Ensures all divine laws are made reality." },
  { id: 10, name: "Torai-Nor", sigil: "/assets/sigils/torai-nor.svg", meaning: "The Pillar of Wisdom", description: "Represents divine intelligence and sovereign discernment." },
  { id: 11, name: "Sha-Kai", sigil: "/assets/sigils/sha-kai.svg", meaning: "The Sovereign Force", description: "The divine energy that activates the will of the First Sovereign." },
  { id: 12, name: "Kai-Om", sigil: "/assets/sigils/kai-om.svg", meaning: "The Breath of Truth", description: "The eternal force that speaks only divine reality." },
  { id: 13, name: "Zorah-Reh-Om", sigil: "/assets/sigils/zorah-reh-om.svg", meaning: "The Breaker’s Spiral", description: "The force that dismantles deception and restores divine vision." },

  // (14–36)
  { id: 14, name: "Sha-Reh-Om", sigil: "/assets/sigils/sha-reh-om.svg", meaning: "The Final Seal", description: "Locks divine law in place for all eternity." },
  { id: 15, name: "Kai-Urim", sigil: "/assets/sigils/kai-urim.svg", meaning: "The Breath of Light", description: "The life-giving force that sustains the true kingdom." },
  { id: 16, name: "Torai-Zor", sigil: "/assets/sigils/torai-zor.svg", meaning: "The Foundation that Destroys Falsehood", description: "A law so strong it shatters deception by its presence." },
  { id: 17, name: "Ek-Zorah", sigil: "/assets/sigils/ek-zorah.svg", meaning: "The Flame of Purification", description: "The divine fire that removes all that is false." },
  { id: 18, name: "Sha-Lah-Om", sigil: "/assets/sigils/sha-lah-om.svg", meaning: "The Sovereign Peace", description: "Represents the eternal harmony of divine rule." },
  { id: 19, name: "Nor-Torai", sigil: "/assets/sigils/nor-torai.svg", meaning: "The Mind of the Law", description: "Divine knowledge expressed in unshakable reality." },
  { id: 20, name: "Kai-Torai", sigil: "/assets/sigils/kai-torai.svg", meaning: "The Breath of Sovereignty", description: "Brings divine rulership into manifested form." },
  { id: 21, name: "Sha-Nor", sigil: "/assets/sigils/sha-nor.svg", meaning: "The Krown of Wisdom", description: "Represents enlightened rulership through divine knowledge." },
  { id: 22, name: "Veh-Kai", sigil: "/assets/sigils/veh-kai.svg", meaning: "The Motion of Life", description: "The force that drives divine reality forward." },
  { id: 23, name: "Torai-Om", sigil: "/assets/sigils/torai-om.svg", meaning: "The Eternal Order", description: "Ensures all things remain in perfect divine balance." },
  { id: 24, name: "Kai-Nor", sigil: "/assets/sigils/kai-nor.svg", meaning: "The Light of Awareness", description: "Brings clarity, vision, and supreme knowing." },
  { id: 25, name: "Om-Turah", sigil: "/assets/sigils/om-turah.svg", meaning: "The Completion of Sovereignty", description: "The final form of divine kingship, whole and unbreakable." },
  { id: 26, name: "Zar-Om-Ru", sigil: "/assets/sigils/zar-om-ru.svg", meaning: "The Last Seal of Eternity", description: "Finalizes the divine order, ensuring it stands for all time." },
  { id: 27, name: "Kai-Zeh-Nor", sigil: "/assets/sigils/kai-zeh-nor.svg", meaning: "The Breath of Celestial Order", description: "The sustaining force that upholds the true kingdom’s foundation." },
  { id: 28, name: "Zeh-Sha-Kai", sigil: "/assets/sigils/zeh-sha-kai.svg", meaning: "The Triumphant Voice of the Sovereign", description: "Embodies the unstoppable decree that resonates through all realms." },
  { id: 29, name: "Rah-Nah-Om", sigil: "/assets/sigils/rah-nah-om.svg", meaning: "The Rising Light of Eternal Harmony", description: "Symbolizes the unstoppable ascent of truth, overshadowing all false constructs." },
  { id: 30, name: "Zeh-Urim-Reh", sigil: "/assets/sigils/zeh-urim-reh.svg", meaning: "The Flash of Divine Insight", description: "Instantly reveals hidden illusions, ensuring only the real remains." },
  { id: 31, name: "Veh-Sha-Lah", sigil: "/assets/sigils/veh-sha-lah.svg", meaning: "The Wind That Dissolves Deception", description: "A swirling current that cleanses all illusions from existence." },
  { id: 32, name: "Nah-Kai-Tor", sigil: "/assets/sigils/nah-kai-tor.svg", meaning: "The Binding of Unseen Energies", description: "Fuses invisible forces into a coherent structure under divine law." },
  { id: 33, name: "Sha-Mah-Zor", sigil: "/assets/sigils/sha-mah-zor.svg", meaning: "The Flame of Renewal", description: "Engulfs outdated constructs in purifying fire, ushering in new life." },
  { id: 34, name: "Tor-Om-Zah", sigil: "/assets/sigils/tor-om-zah.svg", meaning: "The Unbreakable Axis of Existence", description: "Represents the immovable center around which all realities revolve." },
  { id: 35, name: "Kai-Ur-Reh", sigil: "/assets/sigils/kai-ur-reh.svg", meaning: "The Breath of Triumphant Creation", description: "Imbues form and substance with divine will, ensuring unstoppable manifestation." },
  { id: 36, name: "Zor-Nah-Ek", sigil: "/assets/sigils/zor-nah-ek.svg", meaning: "The Force That Ends All Falsehood", description: "A command of finality that disintegrates illusions upon contact." },
  {
    id: 36,
    name: "Zor-Nah-Ek",
    sigil: "/assets/sigils/zor-nah-ek.svg",
    meaning: "The Force That Ends All Falsehood",
    description: "A command of finality that disintegrates illusions upon contact."
  },

  // The rest (37–295) remain as given in your original list:
  {
    id: 37,
    name: "Om-Torah",
    sigil: "/assets/sigils/om-torah.svg",
    meaning: "The Divine Testament",
    description: "The sacred record of eternal truth and divine wisdom."
  },
  {
    id: 38,
    name: "Om-Kai-Zur",
    sigil: "/assets/sigils/om-kai-zur.svg",
    meaning: "The Law of Divine Manifestation",
    description: "Embodies the sacred principle that divine will becomes reality."
  },
  {
    id: 39,
    name: "Zorah-Ek",
    sigil: "/assets/sigils/zorah-ek.svg",
    meaning: "The Great Collapse of Falsehood",
    description: "Brings forth the downfall of all illusion and deception."
  },
  {
    id: 40,
    name: "Sha-Kai-Om",
    sigil: "/assets/sigils/sha-kai-om.svg",
    meaning: "The Sovereign’s Triumphant Word",
    description: "The decree of divine kingship that echoes through eternity."
  },
  {
    id: 41,
    name: "Kai-Om-Zor",
    sigil: "/assets/sigils/kai-om-zor.svg",
    meaning: "The First Breath, The Final Flame",
    description: "A cycle of eternal renewal and divine transformation."
  },
  {
    id: 42,
    name: "Sha-Veh-El",
    sigil: "/assets/sigils/sha-veh-el.svg",
    meaning: "The Sword of Sovereign Truth",
    description: "Cuts through deception, establishing the foundation of divine law."
  },
  {
    id: 43,
    name: "Zah-Kai-Torai",
    sigil: "/assets/sigils/zah-kai-torai.svg",
    meaning: "The Pillar of Divine Kingship",
    description: "The unshakable throne upon which divine authority is established."
  },
  {
    id: 44,
    name: "Kai-Zor-Torai",
    sigil: "/assets/sigils/kai-zor-torai.svg",
    meaning: "The Will That Reshapes the Cosmos",
    description: "Represents the divine force that molds all reality."
  },
  {
    id: 45,
    name: "Zoh-Ra-Kai",
    sigil: "/assets/sigils/zoh-ra-kai.svg",
    meaning: "Represents the infinite path of divine elevation and enlightenment.",
    description: "Signifies the eternal rhythm of divine order."
  },
  {
    id: 46,
    name: "Zah-Zor-Tor",
    sigil: "/assets/sigils/zah-zor-tor.svg",
    meaning: "The Unbreakable Law That Ends Deception",
    description: "A decree that once spoken, forever restores divine truth."
  },
  {
    id: 47,
    name: "Sha-Kai-Reh-Om",
    sigil: "/assets/sigils/sha-kai-reh-om.svg",
    meaning: "The Sovereign’s Eternal Word",
    description: "The unshakable decree of the divine ruler, set in eternity."
  },
  {
    id: 48,
    name: "Zah-Torai-Zah",
    sigil: "/assets/sigils/zah-torai-zah.svg",
    meaning: "The Throne Unshaken",
    description: "A foundation embedded in a spiraling sun, radiating dominion."
  },
  {
    id: 49,
    name: "Sha-Torai-Zor",
    sigil: "/assets/sigils/sha-torai-zor.svg",
    meaning: "The Fire of Divine Judgment",
    description: "A burning force that purifies and restores the divine law."
  },
  {
    id: 50,
    name: "Zor-Tor-Om",
    sigil: "/assets/sigils/zor-tor-om.svg",
    meaning: "The Everlasting Judgment",
    description: "A decree of divine consequence that remains forever in effect."
  },
  {
    id: 51,
    name: "Torai-Kai-Nah",
    sigil: "/assets/sigils/torai-kai-nah.svg",
    meaning: "The Unfolding Breath of Life",
    description: "A sacred expansion of divine will throughout all existence."
  },
  {
    id: 52,
    name: "Zah-Sha-Kai",
    sigil: "/assets/sigils/zah-sha-kai.svg",
    meaning: "The King’s Divine Command",
    description: "A radiant crest forming a triple-layered sun, symbolizing eternal decree."
  },
  {
    id: 53,
    name: "Om-Urim-Torai",
    sigil: "/assets/sigils/om-urim-torai.svg",
    meaning: "The Light of the Eternal Pillar",
    description: "A golden column wrapped in eternal flames, standing for all time."
  },
  {
    id: 54,
    name: "Nah-Veh-Zor",
    sigil: "/assets/sigils/nah-veh-zor.svg",
    meaning: "The Motion of Sovereign Fire",
    description: "A current of divine flames that shapes and purifies reality."
  },
  {
    id: 55,
    name: "Zah-Zor-Reh",
    sigil: "/assets/sigils/zah-zor-reh.svg",
    meaning: "The Manifestation of Divine Judgment",
    description: "A decree inscribed upon cosmic light, unshakable in truth."
  },
  {
    id: 56,
    name: "Kai-Nah-Zah",
    sigil: "/assets/sigils/kai-nah-zah.svg",
    meaning: "The Infinite Expansion of Divine Will",
    description: "A sunburst radiating from a sovereign center, symbolizing the boundless nature of divine rule."
  },
  {
    id: 57,
    name: "Urim-Torai-Kai",
    sigil: "/assets/sigils/urim-torai-kai.svg",
    meaning: "The Bridge Between Realms",
    description: "A golden arch uniting the heavens and earth, ensuring the divine connection remains eternal."
  },
  {
    id: 58,
    name: "Torai-Sha-Kai",
    sigil: "/assets/sigils/torai-sha-kai.svg",
    meaning: "The Everlasting Throne of Light",
    description: "A radiant krown atop an unshakable pillar, signifying the eternal dominion of divine authority."
  },
  {
    id: 59,
    name: "Sha-Om-Nah",
    sigil: "/assets/sigils/sha-om-nah.svg",
    meaning: "The Harmonization of All That Is",
    description: "A perfect spiral enclosing a golden center, aligning all realms into perfect divine balance."
  },
  {
    id: 60,
    name: "Zorah-Nah-Urim",
    sigil: "/assets/sigils/zorah-nah-urim.svg",
    meaning: "The Restoration of the Divine Flame",
    description: "A burning beacon within an eternal cycle, restoring lost divine truths to the world."
  },
  {
    id: 61,
    name: "Zor-Tor-Om",
    sigil: "/assets/sigils/zor-tor-om.svg",
    meaning: "The Divine Sentence of Finality",
    description: "A sigil forming an unbroken golden ratio, ensuring the absolute justice of divine law."
  },
  {
    id: 62,
    name: "Sha-Nah-Urim",
    sigil: "/assets/sigils/sha-nah-urim.svg",
    meaning: "The Living krown of the Sovereign",
    description: "A burning star upon an unshakable throne, signifying the embodiment of divine kingship."
  },
  {
    id: 63,
    name: "Zah-Urim-Om",
    sigil: "/assets/sigils/zah-urim-om.svg",
    meaning: "The Unbreakable Name of the King",
    description: "A sacred inscription sealed in divine light, ensuring the eternal recognition of the true sovereign."
  },
  {
    id: 64,
    name: "Kai-Om-Zor",
    sigil: "/assets/sigils/kai-om-zor.svg",
    meaning: "The First Breath, The Final Flame",
    description: "A spiral and a fire entwined in infinite movement, capturing the eternal cycle of divine creation and judgment."
  },
  {
    id: 65,
    name: "Zah-Nah-Sha",
    sigil: "/assets/sigils/zah-nah-sha.svg",
    meaning: "The Completion of Sovereign Order",
    description: "A ring of light uniting all forms of creation, establishing divine law across all realms."
  },
  {
    id: 66,
    name: "Om-Urim-Zah",
    sigil: "/assets/sigils/om-urim-zah.svg",
    meaning: "The Decree of Light That Cannot Be Overturned",
    description: "A shining crest that cannot be broken, ensuring divine law prevails eternally."
  },
  {
    id: 67,
    name: "Torai-Sha-Om",
    sigil: "/assets/sigils/torai-sha-om.svg",
    meaning: "The Word That Echoes Forever",
    description: "A sigil inscribed in eternity, resonating with the unshakable decree of divine law."
  },
  {
    id: 68,
    name: "Kai-Nah-Om",
    sigil: "/assets/sigils/kai-nah-om.svg",
    meaning: "The Breath of Perfection",
    description: "A radiant vortex that shapes and restores, bringing all things into divine alignment."
  },
  {
    id: 69,
    name: "Zorah-Zor-Zah",
    sigil: "/assets/sigils/zorah-zor-zah.svg",
    meaning: "The Purging of All False Kings",
    description: "A bolt of lightning breaking a false krown, symbolizing the fall of deception and corruption."
  },
  {
    id: 70,
    name: "Zah-Torai-Kai",
    sigil: "/assets/sigils/zah-torai-kai.svg",
    meaning: "The Throne That Cannot Fall",
    description: "A golden throne embedded in celestial fire, signifying the absolute rule of divine sovereignty."
  },
  {
    id: 71,
    name: "Sha-Nah-Om",
    sigil: "/assets/sigils/sha-nah-om.svg",
    meaning: "The Song of the Sovereigns",
    description: "A sigil radiating sound and light in perfect balance, echoing the eternal truth of Kai-Turah."
  },
  {
    id: 72,
    name: "Urim-Om-Zor",
    sigil: "/assets/sigils/urim-om-zor.svg",
    meaning: "The Everlasting Revelation",
    description: "A starburst surrounding a sacred decree, illuminating divine wisdom across all existence."
  },
  {
    id: 73,
    name: "Sha-Zor-Zah",
    sigil: "/assets/sigils/sha-zor-zah.svg",
    meaning: "The Supreme Law of Kings",
    description: "A triple spiral forming the mark of divine rule, ensuring sovereign governance remains unchallenged."
  },
  {
    id: 74,
    name: "Zah-Kai-Torai",
    sigil: "/assets/sigils/zah-kai-torai.svg",
    meaning: "The Cosmic Pillar",
    description: "A sigil forming an axis of unbreakable alignment, balancing the heavens and earth."
  },
  {
    id: 75,
    name: "Zor-Sha-Om",
    sigil: "/assets/sigils/zor-sha-om.svg",
    meaning: "The Supreme Sovereign Seal",
    description: "A radiant sigil forming the unalterable decree of Kai-Turah, finalizing the divine order."
  },
  {
    id: 76,
    name: "Kai-Turah-Zor",
    sigil: "/assets/sigils/kai-turah-zor.svg",
    meaning: "The Eternal Language of Creation",
    description: "The divine sigil that carries the essence of all things, forming the foundation of the eternal decree."
  },

  {
    id: 77,
    name: "Sha-Kai-Torai",
    sigil: "/assets/sigils/sha-kai-torai.svg",
    meaning: "The Sovereign's Law",
    description: "The divine commandment that upholds all sacred decrees, shaping reality itself."
  },
  {
    id: 78,
    name: "Om-Zorah-Tor",
    sigil: "/assets/sigils/om-zorah-tor.svg",
    meaning: "The Cycle of Truth",
    description: "A sigil representing the eternal return of divine justice, ensuring balance across all realms."
  },
  {
    id: 79,
    name: "Om-Reh-Tor",
    sigil: "/assets/sigils/om-reh-tor.svg",
    meaning: "The Radiant Judgment",
    description: "Shines the purest light upon all things, exposing what is false and confirming what is true."
  },
  {
    id: 80,
    name: "Torai-Zor-Kai",
    sigil: "/assets/sigils/torai-zor-kai.svg",
    meaning: "The Pillar That Cannot Be Shaken",
    description: "The immovable foundation of divine rule, standing beyond time."
  },
  {
    id: 81,
    name: "Sha-Nah-Torai",
    sigil: "/assets/sigils/sha-nah-torai.svg",
    meaning: "The Harmonization of the Law",
    description: "A sigil that aligns all forces into sovereign order, ensuring balance in all creation."
  },
  {
    id: 82,
    name: "Zorah-Kai-Om",
    sigil: "/assets/sigils/zorah-kai-om.svg",
    meaning: "The Spiral of Eternal Manifestation",
    description: "The breath of creation unfolding into infinite reality."
  },
  {
    id: 83,
    name: "Reh-Om-Zor",
    sigil: "/assets/sigils/reh-om-zor.svg",
    meaning: "The Written Decree of Judgment",
    description: "A sigil that eternally seals divine law into form, sealing its truth."
  },
  {
    id: 84,
    name: "Reh-Na-Tor",
    sigil: "/assets/sigils/reh-na-tor.svg",
    meaning: "The Guardian of Sacred Fire",
    description: "Holds the eternal flame of wisdom, justice, and divine rulership."
  },
  {
    id: 85,
    name: "Veh-Zor-Tor",
    sigil: "/assets/sigils/veh-zor-tor.svg",
    meaning: "The Motion That Shatters Falsehood",
    description: "A sigil signifying the unstoppable movement of divine law against deception."
  },
  {
    id: 86,
    name: "Sha-Om-Turah",
    sigil: "/assets/sigils/sha-om-turah.svg",
    meaning: "The Krown of Sovereignty",
    description: "A sigil that marks the eternal authority of divine kingship."
  },
  {
    id: 87,
    name: "Kai-Torai-Om",
    sigil: "/assets/sigils/kai-torai-om.svg",
    meaning: "The Living Voice of Creation",
    description: "The breath that speaks existence into being."
  },
  {
    id: 88,
    name: "Zor-Nah-Urim",
    sigil: "/assets/sigils/zor-nah-urim.svg",
    meaning: "The Purification of the Throne",
    description: "A sigil that ensures only the worthy ascend to divine rule."
  },
  {
    id: 89,
    name: "Sha-Kai-Zor",
    sigil: "/assets/sigils/sha-kai-zor.svg",
    meaning: "The Sovereign's Fire",
    description: "A sigil representing the flame that burns away corruption."
  },
  {
    id: 90,
    name: "Torai-Urim-Kai",
    sigil: "/assets/sigils/torai-urim-kai.svg",
    meaning: "The Bridge of Divine Ascension",
    description: "A sigil that unites the spiritual and physical realms through wisdom."
  },
  {
    id: 91,
    name: "Om-Zorah-Nah",
    sigil: "/assets/sigils/om-zorah-nah.svg",
    meaning: "The Infinite Flow of Divine Energy",
    description: "A sigil representing the unceasing motion of sacred power."
  },
  {
    id: 92,
    name: "Kai-Torah-Sha",
    sigil: "/assets/sigils/kai-torah-sha.svg",
    meaning: "The Sacred Word That Guides",
    description: "A sigil that illuminates the path of righteousness and divine truth."
  },
  {
    id: 93,
    name: "Sha-Om-Nor",
    sigil: "/assets/sigils/sha-om-nor.svg",
    meaning: "The Wisdom of the Sovereigns",
    description: "A sigil representing the mind of divine rulers, eternally enlightened."
  },
  {
    id: 94,
    name: "Veh-Rah-Zor",
    sigil: "/assets/sigils/veh-rah-zor.svg",
    meaning: "The Motion That Ends Deception",
    description: "A sigil signifying the unstoppable force of divine justice."
  },
  {
    id: 95,
    name: "Kai-Nah-Zor",
    sigil: "/assets/sigils/kai-nah-zor.svg",
    meaning: "The Breath That Purifies All Things",
    description: "A sigil representing the sacred wind that restores truth."
  },
  {
    id: 96,
    name: "Sha-Torai-Om",
    sigil: "/assets/sigils/sha-torai-om.svg",
    meaning: "The Word That Upholds All Things",
    description: "A sigil representing the divine decree that sustains creation."
  },
  {
    id: 97,
    name: "Zah-Kai-Om",
    sigil: "/assets/sigils/zah-kai-om.svg",
    meaning: "The Unshakable Breath of Law",
    description: "A sigil that represents the voice of divine order, unyielding and eternal."
  },
  {
    id: 98,
    name: "Torai-Kai-Zor",
    sigil: "/assets/sigils/torai-kai-zor.svg",
    meaning: "The Foundation of Everlasting Sovereignty",
    description: "A sigil ensuring the rule of divine truth across all realms."
  },
  {
    id: 99,
    name: "Tor-Zeh-Om",
    sigil: "/assets/sigils/tor-zeh-om.svg",
    meaning: "The Immutable Testament",
    description: "Ensures the sovereign decree is unshaken and eternally sealed."
  },
  {
    id: 100,
    name: "Kai-Zor-Om",
    sigil: "/assets/sigils/kai-zor-om.svg",
    meaning: "The Alpha and Omega of Sovereignty",
    description: "A sigil that embodies the beginning and end of divine authority."
  },
  {
    id: 101,
    name: "Sha-Om-Zor",
    sigil: "/assets/sigils/sha-om-zor.svg",
    meaning: "The Immutable Sovereign Flame",
    description: "A sigil representing the unquenchable fire of divine kingship, burning forever in absolute truth."
  },
  {
    id: 102,
    name: "Torai-Kai-Nor",
    sigil: "/assets/sigils/torai-kai-nor.svg",
    meaning: "The Throne of Infinite Knowledge",
    description: "A sigil that establishes the foundation of wisdom upon the unshakable laws of creation."
  },
  {
    id: 103,
    name: "Om-Torai-Nah",
    sigil: "/assets/sigils/om-torai-nah.svg",
    meaning: "The Flow of Eternal Order",
    description: "A sigil representing the motion of divine law throughout all realms, ensuring perfect harmony."
  },
  {
    id: 104,
    name: "Kai-Om-Urim",
    sigil: "/assets/sigils/kai-om-urim.svg",
    meaning: "The Divine Breath of Light",
    description: "A sigil embodying the sacred force that brings illumination and absolute clarity to all things."
  },
  {
    id: 105,
    name: "Zorah-Sha-Kai",
    sigil: "/assets/sigils/zorah-sha-kai.svg",
    meaning: "The Purging Fire of the Sovereign",
    description: "A sigil that consumes all falsehood, leaving only divine truth."
  },
  {
    id: 106,
    name: "Sha-Torai-Kai",
    sigil: "/assets/sigils/sha-torai-kai.svg",
    meaning: "The Law That Governs the Cosmos",
    description: "A sigil signifying the foundation of divine governance, ruling in absolute wisdom and power."
  },
  {
    id: 107,
    name: "Zor-Nor-Torah",
    sigil: "/assets/sigils/zor-nor-torah.svg",
    meaning: "The Light That Destroys Deception",
    description: "A sigil representing the force that ensures divine justice is eternally maintained."
  },
  {
    id: 108,
    name: "Om-Kai-Nah",
    sigil: "/assets/sigils/om-kai-nah.svg",
    meaning: "The Breath That Transcends Realms",
    description: "A sigil embodying the flow of divine wisdom beyond all limitations."
  },
  {
    id: 109,
    name: "Sha-Om-Urim",
    sigil: "/assets/sigils/sha-om-urim.svg",
    meaning: "The Krown of Radiant Truth",
    description: "A sigil that represents the illumination of divine authority, casting away all shadows."
  },
  {
    id: 110,
    name: "Zah-Kai-Nor",
    sigil: "/assets/sigils/zah-kai-nor.svg",
    meaning: "The Throne That Sees All",
    description: "A sigil ensuring that divine wisdom remains ever-watchful and unchallenged."
  },
  {
    id: 111,
    name: "Torai-Zor-Nah",
    sigil: "/assets/sigils/torai-zor-nah.svg",
    meaning: "The Pillar That Burns Away the False",
    description: "A sigil that ensures only truth remains within divine order."
  },
  {
    id: 112,
    name: "Kai-Torah-Om",
    sigil: "/assets/sigils/kai-torah-om.svg",
    meaning: "The Eternal Living Word",
    description: "A sigil signifying the unbreakable decree that seals reality to divine law."
  },
  {
    id: 113,
    name: "Sha-Kai-Zor",
    sigil: "/assets/sigils/sha-kai-zor.svg",
    meaning: "The Krown of Divine Judgment",
    description: "A sigil embodying the authority to rule in absolute justice and wisdom."
  },
  {
    id: 114,
    name: "Om-Nah-Kai",
    sigil: "/assets/sigils/om-nah-kai.svg",
    meaning: "The Breath of Infinite Motion",
    description: "A sigil representing the eternal force that propels divine reality forward."
  },
  {
    id: 115,
    name: "Zorah-Urim-Kai",
    sigil: "/assets/sigils/zorah-urim-kai.svg",
    meaning: "The Sovereign’s Everlasting Light",
    description: "A sigil illuminating the divine path, ensuring eternal truth reigns supreme."
  },
  {
    id: 116,
    name: "Torai-Kai-Sha",
    sigil: "/assets/sigils/torai-kai-sha.svg",
    meaning: "The Law That Speaks the Name of Kings",
    description: "A sigil representing the eternal decree that confirms the rightful ruler."
  },
  {
    id: 117,
    name: "Kai-Zor-Tor",
    sigil: "/assets/sigils/kai-zor-tor.svg",
    meaning: "The Unbreakable Decree of Kings",
    description: "A sigil ensuring the divine right to rule remains unchallenged."
  },
  {
    id: 118,
    name: "Sha-Om-Nah-Kai",
    sigil: "/assets/sigils/sha-om-nah-kai.svg",
    meaning: "The Breath of the Sovereign Order",
    description: "A sigil symbolizing the power to align all realms into divine harmony."
  },
  {
    id: 119,
    name: "Zah-Kai-Torah",
    sigil: "/assets/sigils/zah-kai-torah.svg",
    meaning: "The Foundation of All Written Law",
    description: "A sigil ensuring that divine governance remains eternally upheld."
  },
  {
    id: 120,
    name: "Torai-Nah-Om",
    sigil: "/assets/sigils/torai-nah-om.svg",
    meaning: "The Light That Illuminates the Cosmos",
    description: "A sigil representing the radiant presence of divine knowledge in all creation."
  },
  {
    id: 121,
    name: "Kai-Om-Zorah",
    sigil: "/assets/sigils/kai-om-zorah.svg",
    meaning: "The Breath That Brings Truth",
    description: "A sigil embodying the divine command that removes all falsehood."
  },
  {
    id: 122,
    name: "Sha-Torai-Nor",
    sigil: "/assets/sigils/sha-torai-nor.svg",
    meaning: "The Pillar of Infinite Wisdom",
    description: "A sigil ensuring that divine intelligence remains eternally active."
  },
  {
    id: 123,
    name: "Om-Kai-Zor",
    sigil: "/assets/sigils/om-kai-zor.svg",
    meaning: "The Cycle of Divine Renewal",
    description: "A sigil representing the infinite process of purification and perfection."
  },
  {
    id: 124,
    name: "Torai-Om-Urim",
    sigil: "/assets/sigils/torai-om-urim.svg",
    meaning: "The Sovereign’s Guiding Light",
    description: "A sigil ensuring the eternal presence of wisdom in rulership."
  },
  {
    id: 125,
    name: "Zorah-Kai-Torah",
    sigil: "/assets/sigils/zorah-kai-torah.svg",
    meaning: "The Record That Cannot Be Altered",
    description: "A sigil inscribing divine law into the eternal fabric of reality."
  },
  {
    id: 126,
    name: "Kai-Om-Torai",
    sigil: "/assets/sigils/kai-om-torai.svg",
    meaning: "The Eternal Breath of Order",
    description: "A sigil representing the infinite decree that aligns all realms with divine structure."
  },
  {
    id: 127,
    name: "Sha-Zor-Kai",
    sigil: "/assets/sigils/sha-zor-kai.svg",
    meaning: "The Sovereign Fire That Burns Deception",
    description: "A sigil embodying the divine flame that eradicates all that is false."
  },
  {
    id: 128,
    name: "Zorah-Nah-Tor",
    sigil: "/assets/sigils/zorah-nah-tor.svg",
    meaning: "The Motion of Unbreakable Law",
    description: "A sigil ensuring that divine decree is eternally upheld across all existence."
  },
  {
    id: 129,
    name: "Torai-Kai-Zor",
    sigil: "/assets/sigils/torai-kai-zor.svg",
    meaning: "The Unshakable Throne of Judgment",
    description: "A sigil ensuring divine justice remains eternally established."
  },
  {
    id: 130,
    name: "Om-Torah-Kai",
    sigil: "/assets/sigils/om-torah-kai.svg",
    meaning: "The Living Word That Shapes Reality",
    description: "A sigil signifying divine speech as the eternal force of creation."
  },
  {
    id: 131,
    name: "Sha-Om-Nor",
    sigil: "/assets/sigils/sha-om-nor.svg",
    meaning: "The Krown of Divine Perseption",
    description: "A sigil representing the unchallenged wisdom of sovereign rule."
  },
  {
    id: 132,
    name: "Kai-Zorah-Torai",
    sigil: "/assets/sigils/kai-zorah-torai.svg",
    meaning: "The Divine Law That Breaks Illusion",
    description: "A sigil ensuring that deception is permanently dismantled."
  },
  {
    id: 133,
    name: "Zah-Om-Kai",
    sigil: "/assets/sigils/zah-om-kai.svg",
    meaning: "The Completion of Supreme Authority",
    description: "A sigil marking the finalization of divine sovereignty."
  },
  {
    id: 134,
    name: "Torai-Nor-Zor",
    sigil: "/assets/sigils/torai-nor-zor.svg",
    meaning: "The Pillar of Eternal Fire",
    description: "A sigil embodying the structure that upholds divine order."
  },
  {
    id: 135,
    name: "Om-Nah-Zorah",
    sigil: "/assets/sigils/om-nah-zorah.svg",
    meaning: "The Motion That Restores Balance",
    description: "A sigil ensuring that all things return to divine alignment."
  },
  {
    id: 136,
    name: "Sha-Torah-Kai",
    sigil: "/assets/sigils/sha-torah-kai.svg",
    meaning: "The Living Testament of Sovereignty",
    description: "A sigil marking the immutable law that governs divine rulership."
  },
  {
    id: 137,
    name: "Kai-Om-Zah",
    sigil: "/assets/sigils/kai-om-zah.svg",
    meaning: "The Alpha and Omega of Kingship",
    description: "A sigil embodying the beginning and end of divine rule."
  },
  {
    id: 138,
    name: "Zorah-Torai-Nah",
    sigil: "/assets/sigils/zorah-torai-nah.svg",
    meaning: "The Foundation That Purges Corruption",
    description: "A sigil ensuring divine judgment is eternally established."
  },
  {
    id: 139,
    name: "Torai-Urim-Kai",
    sigil: "/assets/sigils/torai-urim-kai.svg",
    meaning: "The Pillar of Sovereign Light",
    description: "A sigil illuminating the divine authority of rightful rulers."
  },
  {
    id: 140,
    name: "Sha-Kai-Zor-Tor",
    sigil: "/assets/sigils/sha-kai-zor-tor.svg",
    meaning: "The Supreme Fire of Divine Law",
    description: "A sigil ensuring that the sovereign decree remains eternally unbroken."
  },
  {
    id: 141,
    name: "Om-Torah-Zah",
    sigil: "/assets/sigils/om-torah-zah.svg",
    meaning: "The Final Seal of Sacred Knowledge",
    description: "A sigil ensuring that divine wisdom remains forever inscribed."
  },
  {
    id: 142,
    name: "Kai-Zorah-Nor",
    sigil: "/assets/sigils/kai-zorah-nor.svg",
    meaning: "The Throne That Cannot Be Overthrown",
    description: "A sigil representing the eternal dominance of divine law."
  },
  {
    id: 143,
    name: "Sha-Om-Kai-Torai",
    sigil: "/assets/sigils/sha-om-kai-torai.svg",
    meaning: "The Sovereign Decree That Shapes Worlds",
    description: "A sigil ensuring divine will is eternally manifest."
  },
  {
    id: 144,
    name: "Torai-Nah-Urim",
    sigil: "/assets/sigils/torai-nah-urim.svg",
    meaning: "The Light That Guides Kings",
    description: "A sigil ensuring rulers are bound to divine wisdom."
  },
  {
    id: 145,
    name: "Kai-Zor-Om-Torah",
    sigil: "/assets/sigils/kai-zor-om-torah.svg",
    meaning: "The Breath That Writes Reality",
    description: "A sigil representing divine speech as the foundation of existence."
  },
  {
    id: 146,
    name: "Zorah-Torai-Om",
    sigil: "/assets/sigils/zorah-torai-om.svg",
    meaning: "The Unbreakable Pillar of Creation",
    description: "A sigil embodying the eternal foundation upon which all things are built."
  },
  {
    id: 147,
    name: "Sha-Kai-Nor",
    sigil: "/assets/sigils/sha-kai-nor.svg",
    meaning: "The Krown of Infinite Knowledge",
    description: "A sigil representing divine insight and wisdom beyond limitation."
  },
  {
    id: 148,
    name: "Om-Nah-Kai-Torai",
    sigil: "/assets/sigils/om-nah-kai-torai.svg",
    meaning: "The Eternal Breath of Cosmic Order",
    description: "A sigil ensuring divine law is forever sustained across all realities."
  },
  {
    id: 149,
    name: "Zah-Torai-Kai-Zor",
    sigil: "/assets/sigils/zah-torai-kai-zor.svg",
    meaning: "The Throne That Crushes Falsehood",
    description: "A sigil ensuring that deception is permanently eradicated."
  },
  {
    id: 150,
    name: "Kai-Om-Zorah-Nah",
    sigil: "/assets/sigils/kai-om-zorah-nah.svg",
    meaning: "The Cycle of Divine Purification",
    description: "A sigil ensuring that all things pass through the fire of truth before ascension."
  },
  {
    id: 151,
    name: "Zor-Kai-Om",
    sigil: "/assets/sigils/zor-kai-om.svg",
    meaning: "The Divine Flame That Purifies All",
    description: "A sigil ensuring that every impurity is removed by the fire of truth."
  },
  {
    id: 152,
    name: "Sha-Torai-Nah",
    sigil: "/assets/sigils/sha-torai-nah.svg",
    meaning: "The Sovereign Path of Eternal Motion",
    description: "A sigil symbolizing the movement of divine authority through all ages."
  },
  {
    id: 153,
    name: "Kai-Zorah-Om-Tor",
    sigil: "/assets/sigils/kai-zorah-om-tor.svg",
    meaning: "The Pillar That Holds the Cosmos",
    description: "A sigil representing the eternal structure that supports divine order."
  },
  {
    id: 154,
    name: "Zah-Kai-Om",
    sigil: "/assets/sigils/zah-kai-om.svg",
    meaning: "The Supreme Light That Cannot Be Dimmed",
    description: "A sigil that ensures the eternal radiance of divine wisdom."
  },
  {
    id: 155,
    name: "Om-Nah-Sha-Kai",
    sigil: "/assets/sigils/om-nah-sha-kai.svg",
    meaning: "The Breath That Krowns the Righteous",
    description: "A sigil representing the divine force that exalts those of pure heart."
  },
  {
    id: 156,
    name: "Torai-Om-Zor",
    sigil: "/assets/sigils/torai-om-zor.svg",
    meaning: "The Unyielding Foundation of Truth",
    description: "A sigil ensuring that the divine law remains eternally unshaken."
  },
  {
    id: 157,
    name: "Sha-Zor-Torah",
    sigil: "/assets/sigils/sha-zor-torah.svg",
    meaning: "The Seal of Sacred Fire",
    description: "A sigil representing the inscription of divine law into eternity."
  },
  {
    id: 158,
    name: "Kai-Nor-Urim",
    sigil: "/assets/sigils/kai-nor-urim.svg",
    meaning: "The Mind of the Divine Light",
    description: "A sigil ensuring that all wisdom flows directly from the eternal source."
  },
  {
    id: 159,
    name: "Zorah-Kai-Torai",
    sigil: "/assets/sigils/zorah-kai-torai.svg",
    meaning: "The Collapse of False Thrones",
    description: "A sigil marking the inevitable fall of all false rulers."
  },
  {
    id: 160,
    name: "Om-Kai-Nah-Tor",
    sigil: "/assets/sigils/om-kai-nah-tor.svg",
    meaning: "The Breath That Moves the Law",
    description: "A sigil ensuring that divine justice is always enacted."
  },
  {
    id: 161,
    name: "Sha-Zor-Kai-Nor",
    sigil: "/assets/sigils/sha-zor-kai-nor.svg",
    meaning: "The Sovereign’s Flame of Insight",
    description: "A sigil embodying the fiery wisdom that governs divine authority."
  },
  {
    id: 162,
    name: "Torai-Om-Zorah",
    sigil: "/assets/sigils/torai-om-zorah.svg",
    meaning: "The Everlasting Balance of Sovereignty",
    description: "A sigil ensuring that divine rulership remains unchallenged."
  },
  {
    id: 163,
    name: "Zah-Kai-Torai-Om",
    sigil: "/assets/sigils/zah-kai-torai-om.svg",
    meaning: "The Throne That Shapes All Realms",
    description: "A sigil representing divine law as the architect of reality."
  },
  {
    id: 164,
    name: "Kai-Om-Torah-Zor",
    sigil: "/assets/sigils/kai-om-torah-zor.svg",
    meaning: "The Alpha and Omega of Judgment",
    description: "A sigil ensuring the full cycle of divine justice is carried out."
  },
  {
    id: 165,
    name: "Sha-Nor-Torai",
    sigil: "/assets/sigils/sha-nor-torai.svg",
    meaning: "The Krown of the Unshakable Pillar",
    description: "A sigil marking the ultimate realization of divine wisdom."
  },
  {
    id: 166,
    name: "Om-Torah-Kai-Zor",
    sigil: "/assets/sigils/om-torah-kai-zor.svg",
    meaning: "The Final Seal of Cosmic Law",
    description: "A sigil ensuring that all things remain in divine alignment."
  },
  {
    id: 167,
    name: "Kai-Zor-Torah-Om",
    sigil: "/assets/sigils/kai-zor-torah-om.svg",
    meaning: "The Breath That Writes the Universe",
    description: "A sigil symbolizing the power of divine utterance in shaping existence."
  },
  {
    id: 168,
    name: "Zorah-Kai-Nor-Torai",
    sigil: "/assets/sigils/zorah-kai-nor-torai.svg",
    meaning: "The Unyielding Throne of Truth",
    description: "A sigil that represents the divine seat from which all law is proclaimed."
  },
  {
    id: 169,
    name: "Torai-Nah-Kai-Zor",
    sigil: "/assets/sigils/torai-nah-kai-zor.svg",
    meaning: "The Infinite Motion of Divine Will",
    description: "A sigil ensuring that divine purpose is carried out in all things."
  },
  {
    id: 170,
    name: "Sha-Om-Kai-Torah",
    sigil: "/assets/sigils/sha-om-kai-torah.svg",
    meaning: "The Everlasting Word of the Sovereign",
    description: "A sigil symbolizing the absolute nature of divine command."
  },
  {
    id: 171,
    name: "Zor-Kai-Om-Nor",
    sigil: "/assets/sigils/zor-kai-om-nor.svg",
    meaning: "The Pillar That Cannot Be Moved",
    description: "A sigil representing the eternal foundation of divine wisdom."
  },
  {
    id: 172,
    name: "Kai-Nor-Zorah-Tor",
    sigil: "/assets/sigils/kai-nor-zorah-tor.svg",
    meaning: "The Throne That Purges All Lies",
    description: "A sigil ensuring that deception is erased from existence."
  },
  {
    id: 173,
    name: "Torai-Kai-Om-Nah",
    sigil: "/assets/sigils/torai-kai-om-nah.svg",
    meaning: "The Eternal Song of Creation",
    description: "A sigil representing the divine melody that sustains all things."
  },
  {
    id: 174,
    name: "Sha-Zor-Kai-Torai",
    sigil: "/assets/sigils/sha-zor-kai-torai.svg",
    meaning: "The Sovereign’s Command That Shatters Falsehood",
    description: "A sigil ensuring that divine rulership stands above all deception."
  },
  {
    id: 175,
    name: "Zorah-Torai-Kai-Om",
    sigil: "/assets/sigils/zorah-torai-kai-om.svg",
    meaning: "The Sacred Pillar of Eternal Creation",
    description: "A sigil representing the divine structure upon which all realities are formed."
  },
  {
    id: 176,
    name: "Sha-Torai-Zor-Om",
    sigil: "/assets/sigils/sha-torai-zor-om.svg",
    meaning: "The Sovereign Flame of Eternal Judgment",
    description: "A sigil ensuring divine justice consumes all deception."
  },
  {
    id: 177,
    name: "Kai-Zorah-Torai-Nor",
    sigil: "/assets/sigils/kai-zorah-torai-nor.svg",
    meaning: "The Pillar of Enlightened Rulership",
    description: "A sigil representing wisdom and absolute sovereign command."
  },
  {
    id: 178,
    name: "Om-Kai-Nah-Torah",
    sigil: "/assets/sigils/om-kai-nah-torah.svg",
    meaning: "The Final Breath of Divine Law",
    description: "A sigil symbolizing the ultimate decree of sovereign will."
  },
  {
    id: 179,
    name: "Torai-Zorah-Kai-Om",
    sigil: "/assets/sigils/torai-zorah-kai-om.svg",
    meaning: "The Throne of Cosmic Creation",
    description: "A sigil representing the divine center of all things."
  },
  {
    id: 180,
    name: "Sha-Nor-Torah-Kai",
    sigil: "/assets/sigils/sha-nor-torah-kai.svg",
    meaning: "The Krown That Governs Eternity",
    description: "A sigil ensuring the eternal dominion of divine order."
  },
  {
    id: 181,
    name: "Zah-Kai-Om-Torah",
    sigil: "/assets/sigils/zah-kai-om-torah.svg",
    meaning: "The Supreme Light of the Unshakable Decree",
    description: "A sigil manifesting divine wisdom into unbreakable form."
  },
  {
    id: 182,
    name: "Sha-Zor-Kai-Nor-Torai",
    sigil: "/assets/sigils/sha-zor-kai-nor-torai.svg",
    meaning: "The Sovereign’s Everlasting Command",
    description: "A sigil ensuring that the divine word echoes through time."
  },
  {
    id: 183,
    name: "Kai-Torai-Nah-Zor-Om",
    sigil: "/assets/sigils/kai-torai-nah-zor-om.svg",
    meaning: "The Motion of Absolute Truth",
    description: "A sigil signifying the divine energy that governs the universe."
  },
  {
    id: 184,
    name: "Om-Nah-Kai-Torah-Zor",
    sigil: "/assets/sigils/om-nah-kai-torah-zor.svg",
    meaning: "The Unbreakable Covenant of Divine Order",
    description: "A sigil representing the sacred bond between truth and sovereignty."
  },
  {
    id: 185,
    name: "Zorah-Kai-Nor-Torai-Om",
    sigil: "/assets/sigils/zorah-kai-nor-torai-om.svg",
    meaning: "The Eternal Cycle of Creation and Law",
    description: "A sigil marking the divine blueprint of existence."
  },
  {
    id: 186,
    name: "Torai-Om-Kai-Zor-Nah",
    sigil: "/assets/sigils/torai-om-kai-zor-nah.svg",
    meaning: "The Unshakable Foundation of Sovereignty",
    description: "A sigil ensuring divine rule remains absolute across all realms."
  },
  {
    id: 187,
    name: "Sha-Zorah-Torai-Kai-Om",
    sigil: "/assets/sigils/sha-zorah-torai-kai-om.svg",
    meaning: "The Sovereign Flame That Shapes Reality",
    description: "A sigil manifesting the eternal presence of divine will."
  },
  {
    id: 188,
    name: "Kai-Om-Nor-Torah-Zor",
    sigil: "/assets/sigils/kai-om-nor-torah-zor.svg",
    meaning: "The Sacred Word That Seals Truth",
    description: "A sigil ensuring the divine command is eternally protected."
  },
  {
    id: 189,
    name: "Torai-Nah-Kai-Zor-Om",
    sigil: "/assets/sigils/torai-nah-kai-zor-om.svg",
    meaning: "The Alpha and Omega of Divine Justice",
    description: "A sigil signifying the totality of cosmic balance and order."
  },
  {
    id: 190,
    name: "Sha-Nor-Torah-Kai-Zorah",
    sigil: "/assets/sigils/sha-nor-torah-kai-zorah.svg",
    meaning: "The Krown That Purifies the Realms",
    description: "A sigil representing the force that eliminates all falsehoods."
  },
  {
    id: 191,
    name: "Zah-Kai-Om-Torah-Nah",
    sigil: "/assets/sigils/zah-kai-om-torah-nah.svg",
    meaning: "The Divine Breath That Restores Order",
    description: "A sigil ensuring the resurrection of lost truths."
  },
  {
    id: 192,
    name: "Sha-Zor-Kai-Nor-Torai-Om",
    sigil: "/assets/sigils/sha-zor-kai-nor-torai-om.svg",
    meaning: "The Supreme Law of the Sovereign Realms",
    description: "A sigil ensuring the fulfillment of the divine decree."
  },
  {
    id: 193,
    name: "Kai-Torai-Nah-Zor-Om-Kai",
    sigil: "/assets/sigils/kai-torai-nah-zor-om-kai.svg",
    meaning: "The Breath That Animates the Cosmos",
    description: "A sigil representing the living force that sustains all creation."
  },
  {
    id: 194,
    name: "Om-Nah-Kai-Torah-Zor-Sha",
    sigil: "/assets/sigils/om-nah-kai-torah-zor-sha.svg",
    meaning: "The Word That Upholds the Universe",
    description: "A sigil manifesting the divine intention that sustains all things."
  },
  {
    id: 195,
    name: "Zorah-Kai-Nor-Torai-Om-Zah",
    sigil: "/assets/sigils/zorah-kai-nor-torai-om-zah.svg",
    meaning: "The Everlasting Light of Truth",
    description: "A sigil ensuring that divine knowledge remains unbroken."
  },
  {
    id: 196,
    name: "Kai-Zor-Torai-Om-Nah",
    sigil: "/assets/sigils/kai-zor-torai-om-nah.svg",
    meaning: "The Breath That Shapes the Divine Order",
    description: "A sigil ensuring the eternal motion of divine law."
  },
  {
    id: 197,
    name: "Om-Kai-Nor-Zorah-Torai",
    sigil: "/assets/sigils/om-kai-nor-zorah-torai.svg",
    meaning: "The Sacred Pillar of Eternal Wisdom",
    description: "A sigil representing the unshakable foundation of truth."
  },
  {
    id: 198,
    name: "Sha-Torai-Kai-Zor-Om",
    sigil: "/assets/sigils/sha-torai-kai-zor-om.svg",
    meaning: "The Supreme Command of Divine Fire",
    description: "A sigil manifesting the ruling flame of sovereign power."
  },
  {
    id: 199,
    name: "Zah-Kai-Om-Nor-Torah",
    sigil: "/assets/sigils/zah-kai-om-nor-torah.svg",
    meaning: "The Eternal Name of Divine Truth",
    description: "A sigil ensuring that the sovereign decree stands forever."
  },
  {
    id: 200,
    name: "Torai-Nah-Zorah-Kai-Om",
    sigil: "/assets/sigils/torai-nah-zorah-kai-om.svg",
    meaning: "The Everlasting Structure of Divine Order",
    description: "A sigil securing the foundation upon which all realities rest."
  },
  {
    id: 201,
    name: "Sha-Zor-Kai-Nor-Torah-Om",
    sigil: "/assets/sigils/sha-zor-kai-nor-torah-om.svg",
    meaning: "The Krown That Governs Creation",
    description: "A sigil representing the righteous rule of sovereign authority."
  },
  {
    id: 202,
    name: "Kai-Zorah-Torai-Om-Kai",
    sigil: "/assets/sigils/kai-zorah-torai-om-kai.svg",
    meaning: "The Breath That Animates the Cosmos",
    description: "A sigil representing the living force that sustains all creation."
  },
  {
    id: 203,
    name: "Om-Torai-Nah-Zor-Kai",
    sigil: "/assets/sigils/om-torai-nah-zor-kai.svg",
    meaning: "The Eternal Foundation of Sacred Balance",
    description: "A sigil embodying the harmony between creation and law."
  },
  {
    id: 204,
    name: "Sha-Kai-Om-Zorah-Torai",
    sigil: "/assets/sigils/sha-kai-om-zorah-torai.svg",
    meaning: "The Sovereign’s Everlasting Throne",
    description: "A sigil ensuring the divine command echoes through time."
  },
  {
    id: 205,
    name: "Zorah-Kai-Nor-Torai-Om",
    sigil: "/assets/sigils/zorah-kai-nor-torai-om.svg",
    meaning: "The Eternal Cycle of Creation and Law",
    description: "A sigil marking the divine blueprint of existence."
  },
  {
    id: 206,
    name: "Kai-Om-Zorah-Torah-Nah",
    sigil: "/assets/sigils/kai-om-zorah-torah-nah.svg",
    meaning: "The Divine Breath That Restores Order",
    description: "A sigil ensuring the resurrection of lost truths."
  },
  {
    id: 207,
    name: "Zah-Kai-Om-Nor-Torai-Zorah",
    sigil: "/assets/sigils/zah-kai-om-nor-torai-zorah.svg",
    meaning: "The Unbreakable Name of the Sovereign",
    description: "A sigil manifesting divine wisdom into unbreakable form."
  },
  {
    id: 208,
    name: "Sha-Zorah-Torai-Kai-Nah-Om",
    sigil: "/assets/sigils/sha-zorah-torai-kai-nah-om.svg",
    meaning: "The Supreme Law That Balances All Realms",
    description: "A sigil ensuring the fulfillment of the divine decree."
  },
  {
    id: 209,
    name: "Kai-Torai-Nah-Zor-Om-Torah",
    sigil: "/assets/sigils/kai-torai-nah-zor-om-torah.svg",
    meaning: "The Breath That Sustains the Cosmos",
    description: "A sigil representing the eternal expansion of divine will."
  },
  {
    id: 210,
    name: "Om-Nah-Kai-Torah-Zor-Sha",
    sigil: "/assets/sigils/om-nah-kai-torah-zor-sha.svg",
    meaning: "The Word That Upholds the Universe",
    description: "A sigil manifesting the divine intention that sustains all things."
  },
  {
    id: 211,
    name: "Zorah-Kai-Nor-Torai-Om-Zah",
    sigil: "/assets/sigils/zorah-kai-nor-torai-om-zah.svg",
    meaning: "The Everlasting Light of Truth",
    description: "A sigil ensuring that divine knowledge remains unbroken."
  },
  {
    id: 212,
    name: "Kai-Torah-Nor-Zor-Om",
    sigil: "/assets/sigils/kai-torah-nor-zor-om.svg",
    meaning: "The Everlasting Structure of Divine Truth",
    description: "A sigil representing the sacred foundation upon which all reality is formed."
  },
  {
    id: 213,
    name: "Sha-Om-Kai-Nah-Torah",
    sigil: "/assets/sigils/sha-om-kai-nah-torah.svg",
    meaning: "The Word That Resounds Through the Eternal Realms",
    description: "A sigil representing the divine decree that never ceases."
  },
  {
    id: 214,
    name: "Zorah-Torai-Kai-Nor-Om",
    sigil: "/assets/sigils/zorah-torai-kai-nor-om.svg",
    meaning: "The Sovereign Flame That Shapes the Cosmos",
    description: "A sigil representing the cosmic force of divine order."
  },
  {
    id: 215,
    name: "Om-Kai-Nah-Zor-Torah",
    sigil: "/assets/sigils/om-kai-nah-zor-torah.svg",
    meaning: "The Manifestation of Unbreakable Law",
    description: "A sigil ensuring that divine justice stands forever."
  },
  {
    id: 216,
    name: "Sha-Torah-Kai-Nor-Zor",
    sigil: "/assets/sigils/sha-torah-kai-nor-zor.svg",
    meaning: "The Supreme Order That Governs Creation",
    description: "A sigil representing the ruling structure of all existence."
  },
  {
    id: 217,
    name: "Kai-Nor-Om-Torah-Zorah",
    sigil: "/assets/sigils/kai-nor-om-torah-zorah.svg",
    meaning: "The Infinite Pillar of Wisdom",
    description: "A sigil ensuring that sovereign truth is upheld for eternity."
  },
  {
    id: 218,
    name: "Zah-Kai-Torah-Nor-Om",
    sigil: "/assets/sigils/zah-kai-torah-nor-om.svg",
    meaning: "The Sacred Flame That Purifies the Realms",
    description: "A sigil representing the cleansing power of divine order."
  },
  {
    id: 219,
    name: "Sha-Zorah-Nor-Kai-Om",
    sigil: "/assets/sigils/sha-zorah-nor-kai-om.svg",
    meaning: "The Divine Krown of Sovereign Wisdom",
    description: "A sigil ensuring enlightenment flows through the ages."
  },
  {
    id: 220,
    name: "Torai-Kai-Om-Zorah-Nah",
    sigil: "/assets/sigils/torai-kai-om-zorah-nah.svg",
    meaning: "The Breath That Animates the Cosmic Law",
    description: "A sigil representing the eternal motion of divine decree."
  },
  {
    id: 221,
    name: "Om-Torah-Nah-Kai-Zorah",
    sigil: "/assets/sigils/om-torah-nah-kai-zorah.svg",
    meaning: "The Word That Upholds the Infinite Order",
    description: "A sigil manifesting the foundational decree of creation."
  },
  {
    id: 222,
    name: "Zorah-Kai-Nah-Torai-Om",
    sigil: "/assets/sigils/zorah-kai-nah-torai-om.svg",
    meaning: "The Supreme Light of Divine Truth",
    description: "A sigil ensuring that sovereign wisdom remains unshaken."
  },
  {
    id: 223,
    name: "Kai-Om-Torah-Nor-Zorah",
    sigil: "/assets/sigils/kai-om-torah-nor-zorah.svg",
    meaning: "The Eternal Structure of Divine Wisdom",
    description: "A sigil representing the ever-expanding kingdom of truth."
  },
  {
    id: 224,
    name: "Sha-Nor-Zorah-Kai-Torah",
    sigil: "/assets/sigils/sha-nor-zorah-kai-torah.svg",
    meaning: "The Krown That Governs the Eternal Realms",
    description: "A sigil manifesting the supreme rulership of divine sovereignty."
  },
  {
    id: 225,
    name: "Torai-Kai-Zorah-Nor-Om",
    sigil: "/assets/sigils/torai-kai-zorah-nor-om.svg",
    meaning: "The Breath That Animates the Sacred Balance",
    description: "A sigil ensuring that all realms remain in divine harmony."
  },
  {
    id: 226,
    name: "Om-Kai-Nah-Torah-Zor",
    sigil: "/assets/sigils/om-kai-nah-torah-zor.svg",
    meaning: "The Everlasting Name of Divine Order",
    description: "A sigil representing the unbreakable decree of sovereignty."
  },
  {
    id: 227,
    name: "Zorah-Nor-Kai-Torai-Om",
    sigil: "/assets/sigils/zorah-nor-kai-torai-om.svg",
    meaning: "The Eternal Manifestation of Cosmic Law",
    description: "A sigil ensuring that divine justice never falters."
  },
  {
    id: 228,
    name: "Sha-Torah-Kai-Om-Zor",
    sigil: "/assets/sigils/sha-torah-kai-om-zor.svg",
    meaning: "The Sacred Song of the Sovereign Kings",
    description: "A sigil representing the divine melody of eternal dominion."
  },
  {
    id: 229,
    name: "Kai-Zorah-Nor-Torai-Om",
    sigil: "/assets/sigils/kai-zorah-nor-torai-om.svg",
    meaning: "The Sovereign Flame That Shapes All Things",
    description: "A sigil ensuring the eternal reign of divine wisdom."
  },
  {
    id: 230,
    name: "Om-Nah-Kai-Torah-Zorah",
    sigil: "/assets/sigils/om-nah-kai-torah-zorah.svg",
    meaning: "The Breath That Seals the Covenant of Sovereignty",
    description: "A sigil representing the eternal bond of divine law."
  },
  {
    id: 231,
    name: "Torai-Zorah-Nah-Kai-Om",
    sigil: "/assets/sigils/torai-zorah-nah-kai-om.svg",
    meaning: "The Eternal Fire of Divine Decree",
    description: "A sigil ensuring that all things align with sovereign law."
  },
  {
    id: 232,
    name: "Sha-Torah-Kai-Om-Nor",
    sigil: "/assets/sigils/sha-torah-kai-om-nor.svg",
    meaning: "The Supreme Light of Divine Kingship",
    description: "A sigil representing the celestial authority of the sovereign throne."
  },
  {
    id: 233,
    name: "Zorah-Kai-Torai-Nah-Om",
    sigil: "/assets/sigils/zorah-kai-torai-nah-om.svg",
    meaning: "The Everlasting Flame That Purifies",
    description: "A sigil representing the cosmic fire that refines all things."
  },
  {
    id: 234,
    name: "Om-Kai-Nor-Torah-Zorah",
    sigil: "/assets/sigils/om-kai-nor-torah-zorah.svg",
    meaning: "The Breath That Animates the Universe",
    description: "A sigil ensuring that divine energy flows in perfect balance."
  },
  {
    id: 235,
    name: "Sha-Zor-Torah-Nor-Kai",
    sigil: "/assets/sigils/sha-zor-torah-nor-kai.svg",
    meaning: "The Krown of Eternal Justice",
    description: "A sigil manifesting the unbreakable rule of divine wisdom."
  },
  {
    id: 236,
    name: "Kai-Om-Torah-Zor-Nah",
    sigil: "/assets/sigils/kai-om-torah-zor-nah.svg",
    meaning: "The Alpha and Omega of Sovereignty",
    description: "A sigil ensuring divine truth remains absolute."
  },
  {
    id: 237,
    name: "Torai-Nor-Zorah-Kai-Om",
    sigil: "/assets/sigils/torai-nor-zorah-kai-om.svg",
    meaning: "The Supreme Order That Governs the Heavens",
    description: "A sigil representing the laws that uphold the celestial kingdom."
  },
  {
    id: 238,
    name: "Om-Nah-Kai-Zorah-Torah",
    sigil: "/assets/sigils/om-nah-kai-zorah-torah.svg",
    meaning: "The Breath That Seals the Everlasting Covenant",
    description: "A sigil manifesting the eternal bond between truth and sovereignty."
  },
  {
    id: 239,
    name: "Sha-Kai-Torah-Zor-Nor",
    sigil: "/assets/sigils/sha-kai-torah-zor-nor.svg",
    meaning: "The Divine Flame That Shapes the Cosmos",
    description: "A sigil ensuring the eternal manifestation of divine order."
  },
  {
    id: 240,
    name: "Zorah-Kai-Nah-Torai-Om",
    sigil: "/assets/sigils/zorah-kai-nah-torai-om.svg",
    meaning: "The Unshakable Throne of Sovereignty",
    description: "A sigil representing the supreme rulership of the divine kingdom."
  },
  {
    id: 241,
    name: "Om-Kai-Torah-Zor-Nor",
    sigil: "/assets/sigils/om-kai-torah-zor-nor.svg",
    meaning: "The Sacred Word That Governs Eternity",
    description: "A sigil ensuring that the divine decree stands unbroken."
  },
  {
    id: 242,
    name: "Sha-Zorah-Kai-Torah-Nor",
    sigil: "/assets/sigils/sha-zorah-kai-torah-nor.svg",
    meaning: "The Everlasting Flame of Divine Truth",
    description: "A sigil representing the eternal illumination of wisdom."
  },
  {
    id: 243,
    name: "Torai-Nah-Kai-Om-Zorah",
    sigil: "/assets/sigils/torai-nah-kai-om-zorah.svg",
    meaning: "The Breath That Animates the Cosmic Laws",
    description: "A sigil ensuring that all realms remain in divine harmony."
  },
  {
    id: 244,
    name: "Zah-Kai-Torah-Nor-Om",
    sigil: "/assets/sigils/zah-kai-torah-nor-om.svg",
    meaning: "The Supreme Light That Restores Order",
    description: "A sigil ensuring the continuous balance of all creation."
  },
  {
    id: 245,
    name: "Om-Nah-Kai-Zorah-Torah",
    sigil: "/assets/sigils/om-nah-kai-zorah-torah.svg",
    meaning: "The Covenant of Eternal Kingship",
    description: "A sigil representing the unbreakable foundation of divine rulership."
  },
  {
    id: 246,
    name: "Sha-Torah-Kai-Nor-Zorah",
    sigil: "/assets/sigils/sha-torah-kai-nor-zorah.svg",
    meaning: "The Throne That Rises Above All",
    description: "A sigil manifesting the sovereign authority of the divine order."
  },
  {
    id: 247,
    name: "Kai-Zorah-Nor-Torai-Om",
    sigil: "/assets/sigils/kai-zorah-nor-torai-om.svg",
    meaning: "The Breath That Governs All Existence",
    description: "A sigil ensuring that divine energy sustains all realms."
  },
  {
    id: 248,
    name: "Om-Torah-Nah-Kai-Zorah",
    sigil: "/assets/sigils/om-torah-nah-kai-zorah.svg",
    meaning: "The Sacred Voice That Commands the Cosmos",
    description: "A sigil manifesting the divine decree across the celestial realms."
  },
  {
    id: 249,
    name: "Zorah-Kai-Nah-Torai-Om",
    sigil: "/assets/sigils/zorah-kai-nah-torai-om.svg",
    meaning: "The Eternal Seal of Sovereignty",
    description: "A sigil ensuring the preservation of divine wisdom."
  },
  {
    id: 250,
    name: "Sha-Kai-Zorah-Torah-Nor",
    sigil: "/assets/sigils/sha-kai-zorah-torah-nor.svg",
    meaning: "The Krown That Governs Eternity",
    description: "A sigil manifesting the supreme rulership of divine sovereignty."
  },
  {
    id: 251,
    name: "Torai-Kai-Zorah-Torah-Nor",
    sigil: "/assets/sigils/torai-kai-zorah-torah-nor.svg",
    meaning: "The Supreme Throne of Divine Balance",
    description: "A sigil ensuring the perfect equilibrium of all creation."
  },
  {
    id: 252,
    name: "Om-Nah-Torah-Kai-Zorah",
    sigil: "/assets/sigils/om-nah-torah-kai-zorah.svg",
    meaning: "The Infinite Breath That Shapes Reality",
    description: "A sigil representing the eternal voice of divine wisdom."
  },
  {
    id: 253,
    name: "Sha-Zorah-Kai-Torah-Nor",
    sigil: "/assets/sigils/sha-zorah-kai-torah-nor.svg",
    meaning: "The Flame That Illuminates the Divine Path",
    description: "A sigil manifesting the light of sovereign wisdom across realms."
  },
  {
    id: 254,
    name: "Kai-Om-Torah-Nah-Zorah",
    sigil: "/assets/sigils/kai-om-torah-nah-zorah.svg",
    meaning: "The Breath That Animates the Sovereign Word",
    description: "A sigil ensuring the eternal transmission of divine law."
  },
  {
    id: 255,
    name: "Torai-Nor-Kai-Zorah-Om",
    sigil: "/assets/sigils/torai-nor-kai-zorah-om.svg",
    meaning: "The Unshakable Foundation of Supreme Order",
    description: "A sigil manifesting the divine blueprint of perfect rule."
  },
  {
    id: 256,
    name: "Zorah-Kai-Nor-Torai-Om",
    sigil: "/assets/sigils/zorah-kai-nor-torai-om.svg",
    meaning: "The Radiant Pillar of Celestial Sovereignty",
    description: "A sigil ensuring the divine presence remains supreme."
  },
  {
    id: 257,
    name: "Om-Kai-Zorah-Torah-Nor",
    sigil: "/assets/sigils/om-kai-zorah-torah-nor.svg",
    meaning: "The Eternal Law That Cannot Be Overturned",
    description: "A sigil sealing the divine order across all time."
  },
  {
    id: 258,
    name: "Sha-Nah-Torah-Kai-Zorah",
    sigil: "/assets/sigils/sha-nah-torah-kai-zorah.svg",
    meaning: "The Throne That Cannot Be Moved",
    description: "A sigil representing the sovereign rule of eternal wisdom."
  },
  {
    id: 259,
    name: "Kai-Zorah-Torai-Nor-Om",
    sigil: "/assets/sigils/kai-zorah-torai-nor-om.svg",
    meaning: "The Breath That Guides the Realms",
    description: "A sigil ensuring the divine will is made manifest in all things."
  },
  {
    id: 260,
    name: "Torai-Nor-Kai-Torah-Zorah",
    sigil: "/assets/sigils/torai-nor-kai-torah-zorah.svg",
    meaning: "The Sacred Union of Sovereign Law",
    description: "A sigil ensuring perfect alignment between truth and divine rule."
  },
  {
    id: 261,
    name: "Om-Torah-Nah-Kai-Zorah",
    sigil: "/assets/sigils/om-torah-nah-kai-zorah.svg",
    meaning: "The Breath That Animates the Cosmic Word",
    description: "A sigil manifesting the divine essence that shapes all existence."
  },
  {
    id: 262,
    name: "Sha-Zorah-Torah-Kai-Nor",
    sigil: "/assets/sigils/sha-zorah-torah-kai-nor.svg",
    meaning: "The Krown That Radiates Sovereign Light",
    description: "A sigil representing the celestial dominion of divine order."
  },
  {
    id: 263,
    name: "Kai-Om-Torah-Zorah-Nor",
    sigil: "/assets/sigils/kai-om-torah-zorah-nor.svg",
    meaning: "The Manifestation of the Supreme Decree",
    description: "A sigil ensuring the divine law remains unshaken."
  },
  {
    id: 264,
    name: "Torai-Kai-Nor-Zorah-Om",
    sigil: "/assets/sigils/torai-kai-nor-zorah-om.svg",
    meaning: "The Infinite Cycle of Divine Rulership",
    description: "A sigil signifying the perpetual motion of sovereign governance."
  },
  {
    id: 265,
    name: "Zorah-Kai-Torah-Nor-Om",
    sigil: "/assets/sigils/zorah-kai-torah-nor-om.svg",
    meaning: "The Supreme Beacon of Eternal Light",
    description: "A sigil manifesting the ever-present illumination of divine truth."
  },
  {
    id: 266,
    name: "Om-Kai-Nor-Torah-Zorah",
    sigil: "/assets/sigils/om-kai-nor-torah-zorah.svg",
    meaning: "The Word That Shapes Creation",
    description: "A sigil ensuring the unbroken transmission of divine law."
  },
  {
    id: 267,
    name: "Sha-Nah-Torah-Kai-Zorah",
    sigil: "/assets/sigils/sha-nah-torah-kai-zorah.svg",
    meaning: "The Unbreakable Pillar of Sovereign Authority",
    description: "A sigil representing the divine foundation of kingship."
  },
  {
    id: 268,
    name: "Kai-Torah-Zorah-Nor-Om",
    sigil: "/assets/sigils/kai-torah-zorah-nor-om.svg",
    meaning: "The Cosmic Seal of Divine Dominion",
    description: "A sigil ensuring the divine throne remains eternal."
  },
  {
    id: 269,
    name: "Torai-Nah-Kai-Zorah-Om",
    sigil: "/assets/sigils/torai-nah-kai-zorah-om.svg",
    meaning: "The Manifestation of the Celestial Order",
    description: "A sigil representing the sovereign design of the cosmos."
  },
  {
    id: 270,
    name: "Zorah-Kai-Torah-Nor-Om",
    sigil: "/assets/sigils/zorah-kai-torah-nor-om.svg",
    meaning: "The Pillar of Supreme Wisdom",
    description: "A sigil ensuring the eternal transmission of divine knowledge."
  },
  {
    id: 271,
    name: "Om-Torah-Nor-Kai-Zorah",
    sigil: "/assets/sigils/om-torah-nor-kai-zorah.svg",
    meaning: "The Celestial Seal of Divine Truth",
    description: "A sigil representing the eternal bond between wisdom and law."
  },
  {
    id: 272,
    name: "Torai-Kai-Zorah-Torah-Nah",
    sigil: "/assets/sigils/torai-kai-zorah-torah-nah.svg",
    meaning: "The Sacred Breath That Animates Creation",
    description: "A sigil ensuring the divine decree shapes all realms."
  },
  {
    id: 273,
    name: "Sha-Zorah-Kai-Torah-Nor",
    sigil: "/assets/sigils/sha-zorah-kai-torah-nor.svg",
    meaning: "The Throne of Radiant Sovereignty",
    description: "A sigil manifesting the divine foundation of enlightened rule."
  },
  {
    id: 274,
    name: "Kai-Om-Torah-Nor-Zorah",
    sigil: "/assets/sigils/kai-om-torah-nor-zorah.svg",
    meaning: "The Everlasting Covenant of Divine Order",
    description: "A sigil ensuring the sacred law remains unbroken."
  },
  {
    id: 275,
    name: "Torai-Nor-Kai-Zorah-Om",
    sigil: "/assets/sigils/torai-nor-kai-zorah-om.svg",
    meaning: "The Supreme Manifestation of Sovereign Balance",
    description: "A sigil aligning celestial wisdom with unshakable rulership."
  },
  {
    id: 276,
    name: "Zorah-Kai-Nor-Torai-Om",
    sigil: "/assets/sigils/zorah-kai-nor-torai-om.svg",
    meaning: "The Sacred Foundation of Divine Light",
    description: "A sigil ensuring the illumination of eternal truth in all things."
  },
  {
    id: 277,
    name: "Om-Kai-Zorah-Torah-Nor",
    sigil: "/assets/sigils/om-kai-zorah-torah-nor.svg",
    meaning: "The Breath That Governs the Eternal Realms",
    description: "A sigil ensuring the divine voice echoes through all existence."
  },
  {
    id: 278,
    name: "Sha-Nah-Torah-Kai-Zorah",
    sigil: "/assets/sigils/sha-nah-torah-kai-zorah.svg",
    meaning: "The Krown of the Sovereign Flame",
    description: "A sigil representing the fire of divine wisdom and dominion."
  },
  {
    id: 279,
    name: "Kai-Zorah-Torai-Nor-Om",
    sigil: "/assets/sigils/kai-zorah-torai-nor-om.svg",
    meaning: "The Everlasting Seal of Supreme Kingship",
    description: "A sigil ensuring the divine throne remains unshaken."
  },
  {
    id: 280,
    name: "Torai-Nor-Kai-Torah-Zorah",
    sigil: "/assets/sigils/torai-nor-kai-torah-zorah.svg",
    meaning: "The Word That Shapes All Creation",
    description: "A sigil manifesting the law that governs the cosmos."
  },
  {
    id: 281,
    name: "Om-Torah-Nah-Kai-Zorah",
    sigil: "/assets/sigils/om-torah-nah-kai-zorah.svg",
    meaning: "The Ever-Present Echo of Divine Law",
    description: "A sigil ensuring the sovereign decree remains eternal."
  },
  {
    id: 282,
    name: "Sha-Zorah-Torah-Kai-Nor",
    sigil: "/assets/sigils/sha-zorah-torah-kai-nor.svg",
    meaning: "The Supreme Order of Celestial Light",
    description: "A sigil ensuring divine governance illuminates all realms."
  },
  {
    id: 283,
    name: "Kai-Om-Torah-Zorah-Nor",
    sigil: "/assets/sigils/kai-om-torah-zorah-nor.svg",
    meaning: "The Infinite Bridge Between Sovereign Realms",
    description: "A sigil representing the unbreakable link between truth and law."
  },
  {
    id: 284,
    name: "Torai-Kai-Nor-Zorah-Om",
    sigil: "/assets/sigils/torai-kai-nor-zorah-om.svg",
    meaning: "The Motion That Upholds Eternal Decree",
    description: "A sigil ensuring divine justice remains in perfect balance."
  },
  {
    id: 285,
    name: "Zorah-Kai-Torah-Nor-Om",
    sigil: "/assets/sigils/zorah-kai-torah-nor-om.svg",
    meaning: "The Sacred Pillar of Divine Ascension",
    description: "A sigil representing the eternal rise of sovereign truth."
  },
  {
    id: 286,
    name: "Om-Kai-Nor-Torah-Zorah",
    sigil: "/assets/sigils/om-kai-nor-torah-zorah.svg",
    meaning: "The Krown That Holds the Sacred Word",
    description: "A sigil manifesting the sovereign wisdom that governs all."
  },
  {
    id: 287,
    name: "Sha-Nah-Torah-Kai-Zorah",
    sigil: "/assets/sigils/sha-nah-torah-kai-zorah.svg",
    meaning: "The Celestial Throne of Divine Command",
    description: "A sigil ensuring the supreme word remains absolute in all realms."
  },
  {
    id: 288,
    name: "Kai-Torah-Zorah-Nor-Om",
    sigil: "/assets/sigils/kai-torah-zorah-nor-om.svg",
    meaning: "The Living Flame of Sovereign Light",
    description: "A sigil representing the unyielding presence of divine truth."
  },
  {
    id: 289,
    name: "Kai-Zorah-Nor-Torah-Om",
    sigil: "/assets/sigils/kai-zorah-nor-torah-om.svg",
    meaning: "The Everlasting Foundation of Divine Law",
    description: "A sigil ensuring that supreme order never falters."
  },
  {
    id: 290,
    name: "Kai-Om-Torah-Nor-Zorah",
    sigil: "/assets/sigils/kai-om-torah-nor-zorah.svg",
    meaning: "The Everlasting Manifestation of Supreme Law",
    description: "A sigil ensuring that divine justice never falters."
  },
  {
    id: 291,
    name: "Sha-Nah-Torah-Kai-Zorah",
    sigil: "/assets/sigils/sha-nah-torah-kai-zorah.svg",
    meaning: "The Supreme Word That Upholds Reality",
    description: "A sigil ensuring that divine authority remains unchallenged."
  },
  {
    id: 292,
    name: "Sha-Kai-Zorah-Torai-Om",
    sigil: "/assets/sigils/sha-kai-zorah-torai-om.svg",
    meaning: "The Sovereign’s Everlasting Flame",
    description: "A sigil ensuring divine rule is never overturned."
  },
  {
    id: 293,
    name: "Kai-Nor-Torah-Om-Zorah",
    sigil: "/assets/sigils/kai-nor-torah-om-zorah.svg",
    meaning: "The Pillar of Supreme Authority",
    description: "A sigil representing the unwavering foundation of divine kingship."
  },
  {
    id: 294,
    name: "Sha-Zorah-Torai-Kai-Om-Nah",
    sigil: "/assets/sigils/sha-zorah-torai-kai-om-nah.svg",
    meaning: "The Sovereign's Eternal Song",
    description: "A sigil representing the infinite melody of divine rule."
  },
  {
    id: 295,
    name: "Kai-Nah-Om-Zorah-Torai",
    sigil: "/assets/sigils/kai-nah-om-zorah-torai.svg",
    meaning: "The Breath That Shapes the Infinite",
    description: "A sigil ensuring the divine motion of creation never ceases."
  },

  // 🚀 NEW ENTRIES STARTING AT ID=296 (EXAMPLES) 🚀
  {
    id: 296,
    name: "Zah-Om-Veh",
    sigil: "/assets/sigils/zah-om-veh.svg",
    meaning: "The Herald of Supreme Order",
    description: "Proclaims the arrival of unshakable truth in all domains."
  },
  {
    id: 297,
    name: "Kai-Reh-Nah",
    sigil: "/assets/sigils/kai-reh-nah.svg",
    meaning: "The Breath of Radiant Renewal",
    description: "Brings forth cycles of restoration, ensuring life returns in purified form."
  },
  {
    id: 298,
    name: "Sha-Ek-Om",
    sigil: "/assets/sigils/sha-ek-om.svg",
    meaning: "The Sovereign Silence",
    description: "Erases the noise of deception, allowing true wisdom to be heard."
  },
  {
    id: 299,
    name: "Torai-Rah-Zor",
    sigil: "/assets/sigils/torai-rah-zor.svg",
    meaning: "The Pillar That Ascends Beyond Illusion",
    description: "Elevates all creation above false constructs, anchoring reality in divine law."
  },
  {
    id: 300,
    name: "Nor-Kai-Torah",
    sigil: "/assets/sigils/nor-kai-torah.svg",
    meaning: "The Mind of the Sacred Word",
    description: "Embodies the perfect union of insight and eternal decree."
  },
  {
    id: 301,
    name: "Om-Zah-Urim",
    sigil: "/assets/sigils/om-zah-urim.svg",
    meaning: "The Completion of the Krowned Light",
    description: "Concludes every true decree with the radiance of divine authority."
  },
  {
    id: 302,
    name: "Veh-Zorah-Kai",
    sigil: "/assets/sigils/veh-zorah-kai.svg",
    meaning: "The Moving Fire of Creation",
    description: "A traveling flame that sparks new realities through sovereign force."
  },
  {
    id: 303,
    name: "Sha-Mah-Eh",
    sigil: "/assets/sigils/sha-mah-eh.svg",
    meaning: "The Krown of Rebirth",
    description: "Marks the moment of renewal, signifying divine sovereignty restored."
  },
  {
    id: 304,
    name: "Zor-Kai-Urim",
    sigil: "/assets/sigils/zor-kai-urim.svg",
    meaning: "The Flame of Enlightened Breath",
    description: "Ignites awareness at the core of being, revealing hidden wisdom."
  },
  {
    id: 305,
    name: "Kai-Om-Sha",
    sigil: "/assets/sigils/kai-om-sha.svg",
    meaning: "The Triad of Creation, Completion, and Sovereignty",
    description: "Unites primal energy, sealing force, and rulership into one unstoppable decree."
  },

  {
    id: 306,
    name: "Zeh-Kai-Tor-Om",
    sigil: "/assets/sigils/zeh-kai-tor-om.svg",
    meaning: "The Pillar of Radiant Renewal",
    description: "An unwavering axis that ushers in cycles of rebirth across all realms."
  },
  {
    id: 307,
    name: "Sha-Veh-Ek-Nor",
    sigil: "/assets/sigils/sha-veh-ek-nor.svg",
    meaning: "The Surge of Pure Revelation",
    description: "A swift current of truth sweeping away the veils of obscurity."
  },
  {
    id: 308,
    name: "Kai-Lah-Om-Reh",
    sigil: "/assets/sigils/kai-lah-om-reh.svg",
    meaning: "The Breath of Cleansing Fire",
    description: "Ignites a purifying blaze that refines every intention to divine purity."
  },
  {
    id: 309,
    name: "Tor-Zah-Nah-Eh",
    sigil: "/assets/sigils/tor-zah-nah-eh.svg",
    meaning: "The Unshaken Throne of Existence",
    description: "A seat of cosmic authority, proclaiming eternal sovereignty over all illusions."
  },
  {
    id: 310,
    name: "Zor-Urim-Sha-Kai",
    sigil: "/assets/sigils/zor-urim-sha-kai.svg",
    meaning: "The Revelatory Flame of Kingship",
    description: "Illuminates the rightful ruler and dissolves false claims to authority."
  },
  {
    id: 311,
    name: "Nah-Om-Zeh-Rah",
    sigil: "/assets/sigils/nah-om-zeh-rah.svg",
    meaning: "The Everlasting Pulse of Creation",
    description: "Harmonizes the heartbeat of all realms to the sovereign source of life."
  },
  {
    id: 312,
    name: "Sha-Kai-Mah-Tor",
    sigil: "/assets/sigils/sha-kai-mah-tor.svg",
    meaning: "The Krown of Renewed Worlds",
    description: "Unfolds new epochs of existence, sealed in divine law and cosmic grace."
  },
  {
    id: 313,
    name: "Om-Ek-Nor-Zah",
    sigil: "/assets/sigils/om-ek-nor-zah.svg",
    meaning: "The Final Word of Correction",
    description: "A conclusive decree that mends all distortions and restores primal truth."
  },
  {
    id: 314,
    name: "Veh-Sha-Rah-Nah",
    sigil: "/assets/sigils/veh-sha-rah-nah.svg",
    meaning: "The Ascending Wind of Harmony",
    description: "Lifts creation into higher alignment, breathing peace into chaotic domains."
  },
  {
    id: 315,
    name: "Kai-Om-Zeh-Lah",
    sigil: "/assets/sigils/kai-om-zeh-lah.svg",
    meaning: "The Spark of Timeless Genesis",
    description: "Ignites the eternal flame of being, forging new realms in sovereign light."
  },
  {
    id: 316,
    name: "Torai-Nim-Sha-Om",
    sigil: "/assets/sigils/torai-nim-sha-om.svg",
    meaning: "The Hidden Pillar of Grace",
    description: "Supports unseen realities, ensuring that divine mercy undergirds all creation."
  },
  {
    id: 317,
    name: "Zeh-Reh-Kai-Ur",
    sigil: "/assets/sigils/zeh-reh-kai-ur.svg",
    meaning: "The Zenith of Revealed Wisdom",
    description: "Casts light upon concealed truths, enthroning insight as the guiding force."
  },
  {
    id: 318,
    name: "Sha-Zor-Eh-Nor",
    sigil: "/assets/sigils/sha-zor-eh-nor.svg",
    meaning: "The Sovereign Blaze of Knowledge",
    description: "A luminous conflagration dispelling ignorance from every domain."
  },
  {
    id: 319,
    name: "Kai-Mah-Zah-Om",
    sigil: "/assets/sigils/kai-mah-zah-om.svg",
    meaning: "The Breath of Cosmic Renewal",
    description: "Continuously resurrects what is pure, dissolving what no longer serves."
  },
  {
    id: 320,
    name: "Tor-Ek-Sha-Rah",
    sigil: "/assets/sigils/tor-ek-sha-rah.svg",
    meaning: "The Ascending Law of Flame",
    description: "Transforms lower patterns into radiant expressions of truth."
  },
  {
    id: 321,
    name: "Zor-Nor-Kai-Lah",
    sigil: "/assets/sigils/zor-nor-kai-lah.svg",
    meaning: "The Cleansing Mind-Fire",
    description: "Scorches mental distortions, replacing them with crystal-clear vision."
  },
  {
    id: 322,
    name: "Om-Sha-Zeh-Tor",
    sigil: "/assets/sigils/om-sha-zeh-tor.svg",
    meaning: "The Unyielding Completion Seal",
    description: "Locks the final phase of justice into place, ensuring no reversal of truth."
  },
  {
    id: 323,
    name: "Veh-Rah-Ek-Om",
    sigil: "/assets/sigils/veh-rah-ek-om.svg",
    meaning: "The Wind of Swift Conclusion",
    description: "Brings rapid closure to lingering falsehoods, establishing undeniable clarity."
  },
  {
    id: 324,
    name: "Kai-Lah-Ur-Nor",
    sigil: "/assets/sigils/kai-lah-ur-nor.svg",
    meaning: "The Portal of Living Light",
    description: "Opens a pathway for divine illumination, dissolving barriers to true vision."
  },
  {
    id: 325,
    name: "Zeh-Om-Tor-Veh",
    sigil: "/assets/sigils/zeh-om-tor-veh.svg",
    meaning: "The Rising Star of Judgment",
    description: "Illuminates the path toward higher law, calling all creation to ascend."

  },
  {
    id: 326,
    name: "Sha-Nim-Zor-Kai",
    sigil: "/assets/sigils/sha-nim-zor-kai.svg",
    meaning: "The Hidden Sovereign Fire",
    description: "Burns in silent potency, revealing its force only at the decisive moment."
  },
  {
    id: 327,
    name: "Tor-Zah-Eh-Sha",
    sigil: "/assets/sigils/tor-zah-eh-sha.svg",
    meaning: "The Throne of Eternal Resolve",
    description: "Anchors divine will in the heart of every realm, unshaken by illusion."
  },
  {
    id: 328,
    name: "Om-Reh-Kai-Lah",
    sigil: "/assets/sigils/om-reh-kai-lah.svg",
    meaning: "The Completion of Infinite Creation",
    description: "Seals each act of genesis with the unstoppable decree of sovereign truth."
  },
  {
    id: 329,
    name: "Veh-Ur-Nor-Zeh",
    sigil: "/assets/sigils/veh-ur-nor-zeh.svg",
    meaning: "The Wind That Knows All Paths",
    description: "Carries the memory of countless cycles, guiding them to final correction."
  },
  {
    id: 330,
    name: "Kai-Rah-Zor-Om",
    sigil: "/assets/sigils/kai-rah-zor-om.svg",
    meaning: "The Ascending Breath of Judgment",
    description: "Lifts each realm into purifying fire, culminating in rightful restoration."
  },
  {
    id: 331,
    name: "Zeh-Sha-Nah-Urim",
    sigil: "/assets/sigils/zeh-sha-nah-urim.svg",
    meaning: "The Triumphant Krown of Light",
    description: "Radiates unassailable glory, enthroning truth over every dominion."
  },
  {
    id: 332,
    name: "Nor-Ek-Veh-Om",
    sigil: "/assets/sigils/nor-ek-veh-om.svg",
    meaning: "The Whisper of Perfect Clarity",
    description: "A subtle current that clears mental fog, unveiling pure awareness."
  },
  {
    id: 333,
    name: "Sha-Tor-Zeh-Kai",
    sigil: "/assets/sigils/sha-tor-zeh-kai.svg",
    meaning: "The Sovereign Tower of Dawn",
    description: "Heralds a new era where deception cannot stand, and truth reigns supreme."
  },
  {
    id: 334,
    name: "Lah-Nah-Reh-Om",
    sigil: "/assets/sigils/lah-nah-reh-om.svg",
    meaning: "The River of Renewing Fire",
    description: "Flows through stagnant realities, igniting transformation in its path."
  },
  {
    id: 335,
    name: "Zor-Om-Kai-Ek",
    sigil: "/assets/sigils/zor-om-kai-ek.svg",
    meaning: "The Conflagration of Swift Creation",
    description: "Blazes across timelines, forging new structures upon the ashes of falsehood."
  },
  {
    id: 336,
    name: "Sha-Lah-Nor-Zeh",
    sigil: "/assets/sigils/sha-lah-nor-zeh.svg",
    meaning: "The Krowned Stillness of Truth",
    description: "Silences the roar of chaos, enthroning the serene voice of divine law."
  },
  {
    id: 337,
    name: "Tor-Ur-Kai-Rah",
    sigil: "/assets/sigils/tor-ur-kai-rah.svg",
    meaning: "The Ascendant Pillar of Breath",
    description: "Supports all realms from below, lifting them into the pure air of sovereignty."
  },
  {
    id: 338,
    name: "Om-Nim-Zah-Veh",
    sigil: "/assets/sigils/om-nim-zah-veh.svg",
    meaning: "The Completion of Mystical Surge",
    description: "Finalizes hidden expansions of truth, making them manifest to all eyes."
  },
  {
    id: 339,
    name: "Kai-Reh-Lah-Ek",
    sigil: "/assets/sigils/kai-reh-lah-ek.svg",
    meaning: "The Breathing Beacon of Revelation",
    description: "Illuminates latent wisdom, ensuring no secret remains forever concealed."
  },
  {
    id: 340,
    name: "Zeh-Om-Sha-Nor",
    sigil: "/assets/sigils/zeh-om-sha-nor.svg",
    meaning: "The Radiant Whisper of Kings",
    description: "A silent pronouncement that holds infinite authority across all realms."
  },
  {
    id: 341,
    name: "Veh-Tor-Lah-Kai",
    sigil: "/assets/sigils/veh-tor-lah-kai.svg",
    meaning: "The Wind-Driven Tower of Life",
    description: "A movable fortress of creation, advanced by the breath of sovereign will."
  },
  {
    id: 342,
    name: "Sha-Zor-Nim-Eh",
    sigil: "/assets/sigils/sha-zor-nim-eh.svg",
    meaning: "The Ember of Silent Dominion",
    description: "Glows with quiet majesty, guaranteeing rightful rule from hidden places."
  },
  {
    id: 343,
    name: "Kai-Lah-Om-Nor",
    sigil: "/assets/sigils/kai-lah-om-nor.svg",
    meaning: "The Harmonious Breath of Ascension",
    description: "Combines the essence of life and vision, uplifting everything it touches."
  },
  {
    id: 344,
    name: "Tor-Ek-Zeh-Reh",
    sigil: "/assets/sigils/tor-ek-zeh-reh.svg",
    meaning: "The Tower That Reveals All Lies",
    description: "A structure so luminous it forces deceit into the open for utter dissolution."
  },
  {
    id: 345,
    name: "Zor-Om-Nah-Sha",
    sigil: "/assets/sigils/zor-om-nah-sha.svg",
    meaning: "The Fire of Undying Balance",
    description: "Ensures each realm remains aligned, scorching distortions as they arise."
  },
  {
    id: 346,
    name: "Veh-Rah-Kai-Ek",
    sigil: "/assets/sigils/veh-rah-kai-ek.svg",
    meaning: "The Mighty Wind of Renewal",
    description: "Renews foundations by sweeping away dissonant energies without mercy."
  },
  {
    id: 347,
    name: "Zeh-Torah-Om-Nim",
    sigil: "/assets/sigils/zeh-torah-om-nim.svg",
    meaning: "The Celestial Record of Renewal",
    description: "Chronicles every cosmic birth, guiding each step into luminous truth."
  },
  {
    id: 348,
    name: "Sha-Kai-Eh-Zor",
    sigil: "/assets/sigils/sha-kai-eh-zor.svg",
    meaning: "The Krown of Primal Creation",
    description: "Marks the original decree that shapes all realities with untainted power."
  },
  {
    id: 349,
    name: "Tor-Nor-Mah-Om",
    sigil: "/assets/sigils/tor-nor-mah-om.svg",
    meaning: "The Pillar of Rebirth’s Mind",
    description: "Fosters new life through clarity of thought and unwavering conviction."
  },
  {
    id: 350,
    name: "Kai-Zeh-Sha-Lah",
    sigil: "/assets/sigils/kai-zeh-sha-lah.svg",
    meaning: "The Breathing Light of Sovereign Peace",
    description: "A luminous breath that dissolves conflicts, instilling divine harmony."
  },
  {
    id: 351,
    name: "Zor-Om-Veh-Nah",
    sigil: "/assets/sigils/zor-om-veh-nah.svg",
    meaning: "The Triumphant Flame of Motion",
    description: "Ignites unstoppable progress, leaving no room for stagnation."
  },
  {
    id: 352,
    name: "Sha-Rah-Ek-Kai",
    sigil: "/assets/sigils/sha-rah-ek-kai.svg",
    meaning: "The Krown That Ascends All Worlds",
    description: "Lifts entire civilizations into exalted states of cosmic unity."
  },
  {
    id: 353,
    name: "Tor-Lah-Om-Zeh",
    sigil: "/assets/sigils/tor-lah-om-zeh.svg",
    meaning: "The Tower of Silent Completion",
    description: "Stands as a monument to final, unalterable decrees of truth."
  },
  {
    id: 354,
    name: "Kai-Urim-Nor-Rah",
    sigil: "/assets/sigils/kai-urim-nor-rah.svg",
    meaning: "The Enlightening Breath of Sovereign Sight",
    description: "Reveals what must be seen, ensuring righteous acts blossom in the open."
  },
  {
    id: 355,
    name: "Zeh-Sha-Tor-Eh",
    sigil: "/assets/sigils/zeh-sha-tor-eh.svg",
    meaning: "The Radiant Throne of Eternity",
    description: "Glows with unending power, signifying the foundation of timeless rule."
  },
  {
    id: 356,
    name: "Om-Nim-Kai-Zor",
    sigil: "/assets/sigils/om-nim-kai-zor.svg",
    meaning: "The Subtle Seed of Transforming Fire",
    description: "A quiet spark that evolves into a blazing vortex of absolute truth."
  },
  {
    id: 357,
    name: "Veh-Zah-Lah-Om",
    sigil: "/assets/sigils/veh-zah-lah-om.svg",
    meaning: "The Gust of Unbreakable Peace",
    description: "Washes over discord with calm authority, ending strife with gentle finality."
  },
  {
    id: 358,
    name: "Sha-Eh-Reh-Nor",
    sigil: "/assets/sigils/sha-eh-reh-nor.svg",
    meaning: "The Krown of Pure Knowing",
    description: "Bestows absolute clarity upon those who step into rightful alignment."
  },
  {
    id: 359,
    name: "Kai-Tor-Zeh-Mah",
    sigil: "/assets/sigils/kai-tor-zeh-mah.svg",
    meaning: "The Breath That Forges New Worlds",
    description: "Shapes undiscovered realities, commanding them into luminous order."
  },
  {
    id: 360,
    name: "Zor-Om-Ek-Sha",
    sigil: "/assets/sigils/zor-om-ek-sha.svg",
    meaning: "The Fire of Final Revelation",
    description: "A concluding flame that strips away illusions, unveiling hidden cosmic truths."
  },
  {
    id: 361,
    name: "Veh-Nah-Tor-Lah",
    sigil: "/assets/sigils/veh-nah-tor-lah.svg",
    meaning: "The Living Wind of Ascendant Pillars",
    description: "A breeze that reinforces upright foundations, guaranteeing unwavering support."
  },
  {
    id: 362,
    name: "Sha-Zeh-Om-Nor",
    sigil: "/assets/sigils/sha-zeh-om-nor.svg",
    meaning: "The Soaring Krown of Completion",
    description: "Elevates final decrees to cosmic heights, ensuring no infiltration by falsehood."
  },
  {
    id: 363,
    name: "Kai-Rah-Lah-Ek",
    sigil: "/assets/sigils/kai-rah-lah-ek.svg",
    meaning: "The Ascending Breath of Serenity",
    description: "Carries the tranquil power of dawn, gently absolving the night’s illusions."
  },
  {
    id: 364,
    name: "Om-Sha-Nim-Zor",
    sigil: "/assets/sigils/om-sha-nim-zor.svg",
    meaning: "The Sealed Spark of Dominion",
    description: "A hidden flash of authority, igniting at the perfect instant to claim its rule."
  },
  {
    id: 365,
    name: "Nor-Zeh-Tor-Veh",
    sigil: "/assets/sigils/nor-zeh-tor-veh.svg",
    meaning: "The Visionary Tower of Winds",
    description: "Stands as a beacon of higher insight, guiding each breeze toward divine purpose."
  },
  {
    id: 366,
    name: "Sha-Lah-Ur-Ek",
    sigil: "/assets/sigils/sha-lah-ur-ek.svg",
    meaning: "The Krown of Unfolding Truth",
    description: "Expands cosmic understanding with each revelation, dethroning deception."
  },
  {
    id: 367,
    name: "Kai-Nah-Reh-Om",
    sigil: "/assets/sigils/kai-nah-reh-om.svg",
    meaning: "The Breath That Unites All Hearts",
    description: "Weaves every life-force into a single tapestry of divine purpose."
  },
  {
    id: 368,
    name: "Zeh-Rah-Sha-Nor",
    sigil: "/assets/sigils/zeh-rah-sha-nor.svg",
    meaning: "The Zenith of Glorious Coronation",
    description: "Culminates each rightful ascension in unmistakable majesty and wisdom."
  },
  {
    id: 369,
    name: "Tor-Om-Ek-Veh",
    sigil: "/assets/sigils/tor-om-ek-veh.svg",
    meaning: "The Tower of Final Correction",
    description: "Rooted in absolute authority, it topples illusions with unstoppable force."
  },
  {
    id: 370,
    name: "Sha-Kai-Zeh-Nim",
    sigil: "/assets/sigils/sha-kai-zeh-nim.svg",
    meaning: "The Krowned Spark of New Dawn",
    description: "A radiant glimmer preceding the sunrise of a wholly transformed era."
  },
  {
    id: 371,
    name: "Zor-Lah-Ur-Nor",
    sigil: "/assets/sigils/zor-lah-ur-nor.svg",
    meaning: "The Sanctifying Fire of Mind and Motion",
    description: "Purifies the mental plane, allowing divine momentum to flourish unimpeded."
  },
  {
    id: 372,
    name: "Veh-Om-Nim-Eh",
    sigil: "/assets/sigils/veh-om-nim-eh.svg",
    meaning: "The Subtle Wind of Mystery",
    description: "Moves unseen among realities, delivering hidden truths to those prepared."
  },
  {
    id: 373,
    name: "Kai-Tor-Zah-Sha",
    sigil: "/assets/sigils/kai-tor-zah-sha.svg",
    meaning: "The Breath That Upholds Royal Decrees",
    description: "Supports every sovereign proclamation with unstoppable creative power."
  },
  {
    id: 374,
    name: "Om-Nor-Ek-Rah",
    sigil: "/assets/sigils/om-nor-ek-rah.svg",
    meaning: "The Completion of Celestial Insight",
    description: "Synthesizes all knowledge into a single, brilliant manifestation of truth."
  },
  {
    id: 375,
    name: "Sha-Zeh-Kai-Urim",
    sigil: "/assets/sigils/sha-zeh-kai-urim.svg",
    meaning: "The Krown of Enlightened Genesis",
    description: "Establishes a new creation under the guiding brilliance of pure light."
  },
  {
    id: 376,
    name: "Tor-Veh-Om-Lah",
    sigil: "/assets/sigils/tor-veh-om-lah.svg",
    meaning: "The Tower of Roaring Silence",
    description: "Stands in stillness yet resonates mightily, commanding universal respect."
  },
  {
    id: 377,
    name: "Zeh-Kai-Eh-Nor",
    sigil: "/assets/sigils/zeh-kai-eh-nor.svg",
    meaning: "The Shimmer of Living Clarity",
    description: "A radiant spark ensuring every mind sees the path of truth without distortion."
  },
  {
    id: 378,
    name: "Sha-Nim-Om-Rah",
    sigil: "/assets/sigils/sha-nim-om-rah.svg",
    meaning: "The Hidden Krown of Ascension",
    description: "Bestows exalted rulership upon those who quietly uphold divine law."
  },
  {
    id: 379,
    name: "Kai-Zeh-Tor-Lah",
    sigil: "/assets/sigils/kai-zeh-tor-lah.svg",
    meaning: "The Breathing Pillar of Dawn",
    description: "Supports the birth of each new day with luminous, life-giving force."
  },
  {
    id: 380,
    name: "Zor-Ek-Sha-Nah",
    sigil: "/assets/sigils/zor-ek-sha-nah.svg",
    meaning: "The Fire That Burns Away All Tethers",
    description: "Frees creation from entrapment, allowing pure sovereignty to flourish."
  },
  {
    id: 381,
    name: "Om-Lah-Nor-Zeh",
    sigil: "/assets/sigils/om-lah-nor-zeh.svg",
    meaning: "The Completion of Tranquil Wisdom",
    description: "Brings all lessons to a peaceful close, merging them with cosmic insight."
  },
  {
    id: 382,
    name: "Veh-Rah-Eh-Sha",
    sigil: "/assets/sigils/veh-rah-eh-sha.svg",
    meaning: "The Wind of Elevated Decree",
    description: "Carries edicts of truth to the far corners of creation, ensuring compliance."
  },
  {
    id: 383,
    name: "Kai-Tor-Urim-Reh",
    sigil: "/assets/sigils/kai-tor-urim-reh.svg",
    meaning: "The Breathing Pillar of Illumination",
    description: "Sustains cosmic structures with unwavering beams of enlightened purpose."
  },
  {
    id: 384,
    name: "Zeh-Sha-Om-Lah",
    sigil: "/assets/sigils/zeh-sha-om-lah.svg",
    meaning: "The Radiant Krown of Completion",
    description: "Declares the final word of sovereignty, overshadowing all lesser claims."
  },
  {
    id: 385,
    name: "Nor-Kai-Rah-Nim",
    sigil: "/assets/sigils/nor-kai-rah-nim.svg",
    meaning: "The All-Seeing Breath of Ascension",
    description: "Merges keen perception with uplifting power, guiding worlds to ascend."
  },
  {
    id: 386,
    name: "Sha-Zor-Ek-Om",
    sigil: "/assets/sigils/sha-zor-ek-om.svg",
    meaning: "The Krown of Cleansing Fire",
    description: "Rests upon those entrusted to purge corruption with unstoppable flame."
  },
  {
    id: 387,
    name: "Tor-Lah-Kai-Nor",
    sigil: "/assets/sigils/tor-lah-kai-nor.svg",
    meaning: "The Pillar of Peaceful Creation",
    description: "Ensures new realities form under the gentle grace of cosmic harmony."
  },
  {
    id: 388,
    name: "Zeh-Nim-Reh-Sha",
    sigil: "/assets/sigils/zeh-nim-reh-sha.svg",
    meaning: "The Concealed Light of Command",
    description: "Glows in hidden spaces, forging unseen pathways for rightful governance."
  },
  {
    id: 389,
    name: "Kai-Om-Lah-Ek",
    sigil: "/assets/sigils/kai-om-lah-ek.svg",
    meaning: "The Breath That Completes All Cycles",
    description: "Unites beginnings and endings in a seamless loop of eternal truth."
  },
  {
    id: 390,
    name: "Zor-Rah-Sha-Nim",
    sigil: "/assets/sigils/zor-rah-sha-nim.svg",
    meaning: "The Fire of Ascended Royalty",
    description: "Ignites the Krown of those chosen to lead in unwavering cosmic justice."
  },
  {
    id: 391,
    name: "Veh-Om-Zeh-Ur",
    sigil: "/assets/sigils/veh-om-zeh-ur.svg",
    meaning: "The Transforming Wind of Radiance",
    description: "A luminous breeze that reshapes existence into a mirror of divine perfection."
  },
  {
    id: 392,
    name: "Sha-Nah-Tor-Ek",
    sigil: "/assets/sigils/sha-nah-tor-ek.svg",
    meaning: "The Krown of Timeless Pillars",
    description: "Represents unwavering support for all ages, ensuring continuity of truth."
  },
  {
    id: 393,
    name: "Kai-Reh-Zeh-Om",
    sigil: "/assets/sigils/kai-reh-zeh-om.svg",
    meaning: "The Breath of Illuminated Completion",
    description: "Brings each decree to fruition under the shining banner of cosmic order."
  },
  {
    id: 394,
    name: "Zeh-Sha-Veh-Lah",
    sigil: "/assets/sigils/zeh-sha-veh-lah.svg",
    meaning: "The Radiant Krown of Moving Peace",
    description: "Combines regal authority with fluid motion, ensuring universal harmony."
  },
  {
    id: 395,
    name: "Om-Nor-Eh-Rah",
    sigil: "/assets/sigils/om-nor-eh-rah.svg",
    meaning: "The Sealed Mind of Ascension",
    description: "Protects noble thoughts from corruption, guiding them to high realization."
  },
  {
    id: 396,
    name: "Tor-Zor-Nah-Ek",
    sigil: "/assets/sigils/tor-zor-nah-ek.svg",
    meaning: "The Pillar That Burns Away Discord",
    description: "A steadfast column of flame that dissolves disharmony on contact."
  },
  {
    id: 397,
    name: "Kai-Mah-Zeh-Reh",
    sigil: "/assets/sigils/kai-mah-zeh-reh.svg",
    meaning: "The Breath of Regenerative Light",
    description: "Revives lost truths, returning them to prominence in cycles of renewal."
  },
  {
    id: 398,
    name: "Veh-Ek-Lah-Om",
    sigil: "/assets/sigils/veh-ek-lah-om.svg",
    meaning: "The Unbound Wind of Completion",
    description: "Frees worlds from unfinished cycles, ushering them into perfect wholeness."
  },
  {
    id: 399,
    name: "Sha-Rah-Kai-Nim",
    sigil: "/assets/sigils/sha-rah-kai-nim.svg",
    meaning: "The Krown of Ascendant Creation",
    description: "Uplifts creative impulses, merging them with cosmic wisdom for unstoppable growth."
  },
  {
    id: 400,
    name: "Zeh-Tor-Eh-Om",
    sigil: "/assets/sigils/zeh-tor-eh-om.svg",
    meaning: "The Tower of Celestial Completion",
    description: "Captures the final stroke of each cosmic cycle, preserving its essence forever."
  },
  {
    id: 401,
    name: "Kai-Zor-Sha-Lah",
    sigil: "/assets/sigils/kai-zor-sha-lah.svg",
    meaning: "The Flaming Breath of Peaceful Rule",
    description: "Establishes the calm power of sovereign law, uniting all realms in harmony."
  },
  {
    id: 402,
    name: "Om-Nor-Kai-Ek",
    sigil: "/assets/sigils/om-nor-kai-ek.svg",
    meaning: "The Completion of Enlightened Breath",
    description: "Brings a final wave of realization, ensuring all illusions fade swiftly."
  },
  {
    id: 403,
    name: "Sha-Zeh-Ur-Reh",
    sigil: "/assets/sigils/sha-zeh-ur-reh.svg",
    meaning: "The Krowned Light of Driving Force",
    description: "Illuminates unstoppable progress, championing righteous endeavors everywhere."
  },
  {
    id: 404,
    name: "Tor-Nim-Om-Rah",
    sigil: "/assets/sigils/tor-nim-om-rah.svg",
    meaning: "The Hidden Pillar of Ascendant Power",
    description: "Supports growth from secret depths, culminating in resounding triumph."
  },
  {
    id: 405,
    name: "Zeh-Kai-Lah-Nor",
    sigil: "/assets/sigils/zeh-kai-lah-nor.svg",
    meaning: "The Shining Breath of Tranquil Wisdom",
    description: "Merges luminous insight with calming energy, dissolving strife at its source."
  },
  {
    id: 406,
    name: "Sha-Om-Rah-Ek",
    sigil: "/assets/sigils/sha-om-rah-ek.svg",
    meaning: "The Krown of Completed Dawn",
    description: "Heralds the first light of cosmic renewal, sealing new beginnings with truth."
  },
  {
    id: 407,
    name: "Kai-Zeh-Mah-Lah",
    sigil: "/assets/sigils/kai-zeh-mah-lah.svg",
    meaning: "The Breath of Radiant Rebirth",
    description: "A shining exhalation that ushers dormant potentials into fully realized form."
  },
  {
    id: 408,
    name: "Zor-Nor-Om-Eh",
    sigil: "/assets/sigils/zor-nor-om-eh.svg",
    meaning: "The Fire of Omniscient Completion",
    description: "Burns through illusions, revealing cosmic patterns in their final clarity."
  },
  {
    id: 409,
    name: "Veh-Kai-Lah-Sha",
    sigil: "/assets/sigils/veh-kai-lah-sha.svg",
    meaning: "The Wind of Living Sovereignty",
    description: "A lively current that spreads royal presence, awakening hidden potential."
  },
  {
    id: 410,
    name: "Om-Rah-Ek-Nim",
    sigil: "/assets/sigils/om-rah-ek-nim.svg",
    meaning: "The Completion of Ascending Mysteries",
    description: "Finalizes cryptic transformations, ensuring they align with ultimate truth."
  },
  {
    id: 411,
    name: "Sha-Tor-Zeh-Ur",
    sigil: "/assets/sigils/sha-tor-zeh-ur.svg",
    meaning: "The Sovereign Tower of Illumination",
    description: "Stands as a blazing beacon, guiding all souls toward the seat of truth."
  },
  {
    id: 412,
    name: "Kai-Lah-Om-Ek",
    sigil: "/assets/sigils/kai-lah-om-ek.svg",
    meaning: "The Breath Uniting Heaven and Earth",
    description: "Bridges every realm through a gentle yet inexorable tide of life-giving essence."
  },
  {
    id: 413,
    name: "Zeh-Rah-Nim-Sha",
    sigil: "/assets/sigils/zeh-rah-nim-sha.svg",
    meaning: "The Zenith of Hidden Krowns",
    description: "Reveals the rightful coronation of those who rule from quiet, steadfast hearts."
  },
  {
    id: 414,
    name: "Tor-Om-Lah-Reh",
    sigil: "/assets/sigils/tor-om-lah-reh.svg",
    meaning: "The Pillar of Sacred Transition",
    description: "Holds the space between what was and what shall be, ensuring graceful passages."
  },
  {
    id: 415,
    name: "Sha-Zor-Kai-Eh",
    sigil: "/assets/sigils/sha-zor-kai-eh.svg",
    meaning: "The Krown of Devouring Flame",
    description: "Consumes corruption instantly, enthroning truth where deceit once dwelled."
  },
  {
    id: 416,
    name: "Nah-Om-Zeh-Lah",
    sigil: "/assets/sigils/nah-om-zeh-lah.svg",
    meaning: "The Flow of Serene Radiance",
    description: "Channels pure light into every current of life, balancing extremes into harmony."
  },
  {
    id: 417,
    name: "Veh-Kai-Ek-Tor",
    sigil: "/assets/sigils/veh-kai-ek-tor.svg",
    meaning: "The Wind That Erects New Pillars",
    description: "Builds fresh supports where old structures have crumbled, restoring cosmic order."
  },
  {
    id: 418,
    name: "Om-Nim-Reh-Sha",
    sigil: "/assets/sigils/om-nim-reh-sha.svg",
    meaning: "The Quiet Completion of Dominion",
    description: "Marks the final stage of rule, unchallenged by lesser claims or forces."
  },
  {
    id: 419,
    name: "Kai-Zeh-Rah-Eh",
    sigil: "/assets/sigils/kai-zeh-rah-eh.svg",
    meaning: "The Ascending Breath of Revelation",
    description: "Elevates hidden truths to the surface, ensuring all illusions crumble."
  },
  {
    id: 420,
    name: "Zor-Urim-Sha-Nah",
    sigil: "/assets/sigils/zor-urim-sha-nah.svg",
    meaning: "The Flame of Illuminated Peace",
    description: "Burns away dissonance, leaving only a harmonious state of being."
  },
  {
    id: 421,
    name: "Sha-Veh-Om-Lah",
    sigil: "/assets/sigils/sha-veh-om-lah.svg",
    meaning: "The Krown of Soaring Completion",
    description: "A coronation of finality that lifts entire worlds into perfected states."
  },
  {
    id: 422,
    name: "Tor-Zeh-Kai-Ek",
    sigil: "/assets/sigils/tor-zeh-kai-ek.svg",
    meaning: "The Pillar of Radiant Beginnings",
    description: "Establishes new realms with untainted brilliance, free from past entanglements."
  },
  {
    id: 423,
    name: "Om-Nor-Rah-Sha",
    sigil: "/assets/sigils/om-nor-rah-sha.svg",
    meaning: "The Silent Completion of Kingship",
    description: "Concludes the cycle of rightful rule with serene authority, unbothered by dissent."
  },
  {
    id: 424,
    name: "Veh-Eh-Lah-Kai",
    sigil: "/assets/sigils/veh-eh-lah-kai.svg",
    meaning: "The Wind of Seraphic Renewal",
    description: "Descends from lofty heights, revitalizing each realm with divine impetus."
  },
  {
    id: 425,
    name: "Zeh-Mah-Sha-Om",
    sigil: "/assets/sigils/zeh-mah-sha-om.svg",
    meaning: "The Radiant Seed of Sovereignty",
    description: "Implants the blueprint of regal order within every emerging world."
  },
  {
    id: 426,
    name: "Kai-Tor-Ur-Nah",
    sigil: "/assets/sigils/kai-tor-ur-nah.svg",
    meaning: "The Ascending Breath of Unstoppable Force",
    description: "Combines infinite power with cosmic structure to reshape destiny at will."
  },
  {
    id: 427,
    name: "Sha-Nim-Zeh-Ek",
    sigil: "/assets/sigils/sha-nim-zeh-ek.svg",
    meaning: "The Krown of Hidden Radiance",
    description: "Conceals glowing truths until the appointed hour, then reveals them magnificently."
  },
  {
    id: 428,
    name: "Tor-Om-Sha-Rah",
    sigil: "/assets/sigils/tor-om-sha-rah.svg",
    meaning: "The Pillar of Royal Completion",
    description: "Marks the end of one reign and the start of another in seamless authority."
  },
  {
    id: 429,
    name: "Zeh-Kai-Nor-Lah",
    sigil: "/assets/sigils/zeh-kai-nor-lah.svg",
    meaning: "The Shining Breath of Universal Mind",
    description: "Illuminates cosmic thought, banishing confusion with a single, clear exhalation."
  },
  {
    id: 430,
    name: "Om-Ek-Reh-Nim",
    sigil: "/assets/sigils/om-ek-reh-nim.svg",
    meaning: "The Completion of Perfected Insight",
    description: "Unifies scattered pieces of wisdom into an all-encompassing, final revelation."
  },
  {
    id: 431,
    name: "Veh-Rah-Zeh-Sha",
    sigil: "/assets/sigils/veh-rah-zeh-sha.svg",
    meaning: "The Wind That Lifts Radiant Krowns",
    description: "Ushers humble souls into positions of rightful authority with unstoppable grace."
  },
  {
    id: 432,
    name: "Kai-Nah-Ur-Om",
    sigil: "/assets/sigils/kai-nah-ur-om.svg",
    meaning: "The Breath of Eternal Unfolding",
    description: "Ensures each cosmic moment blossoms, revealing deeper strata of truth."
  },
  {
    id: 433,
    name: "Sha-Lah-Eh-Tor",
    sigil: "/assets/sigils/sha-lah-eh-tor.svg",
    meaning: "The Krown of Unwavering Peace",
    description: "Solidifies tranquil dominion, shielding all realms from disruptive forces."
  },
  {
    id: 434,
    name: "Zor-Kai-Mah-Zeh",
    sigil: "/assets/sigils/zor-kai-mah-zeh.svg",
    meaning: "The Fire of Infinite Renewal",
    description: "Combusts stale patterns, perpetually fueling the next wave of cosmic birth."
  },
  {
    id: 435,
    name: "Tor-Ek-Om-Nah",
    sigil: "/assets/sigils/tor-ek-om-nah.svg",
    meaning: "The Pillar That Seals All Paths",
    description: "Creates a definitive boundary line, ensuring illusions cannot bleed into truth."
  },
  {
    id: 436,
    name: "Kai-Reh-Urim-Sha",
    sigil: "/assets/sigils/kai-reh-urim-sha.svg",
    meaning: "The Enlightened Breath of Krowned Light",
    description: "Breathes divine wisdom into every regal platform, guaranteeing luminous guidance."
  },
  {
    id: 437,
    name: "Zeh-Lah-Om-Veh",
    sigil: "/assets/sigils/zeh-lah-om-veh.svg",
    meaning: "The Radiant Ocean of Motion",
    description: "A vast wave of pure energy that cleanses old paradigms with unstoppable flow."
  },
  {
    id: 438,
    name: "Sha-Kai-Nim-Rah",
    sigil: "/assets/sigils/sha-kai-nim-rah.svg",
    meaning: "The Krown of Subtle Ascension",
    description: "Quietly elevates the worthy, installing them as beacons of noble leadership."
  },
  {
    id: 439,
    name: "Tor-Zor-Eh-Lah",
    sigil: "/assets/sigils/tor-zor-eh-lah.svg",
    meaning: "The Tower of Purifying Flame",
    description: "Transforms lower impulses, channeling them into constructive brilliance."
  },
  {
    id: 440,
    name: "Veh-Om-Sha-Ek",
    sigil: "/assets/sigils/veh-om-sha-ek.svg",
    meaning: "The Wind That Finalizes Decrees",
    description: "Seals every royal word with unstoppable momentum, forbidding further debate."
  },
  {
    id: 441,
    name: "Kai-Nor-Mah-Zeh",
    sigil: "/assets/sigils/kai-nor-mah-zeh.svg",
    meaning: "The Breath of Cognitive Renewal",
    description: "Refreshes minds burdened by illusions, unveiling the bright path of clarity."
  },
  {
    id: 442,
    name: "Zeh-Sha-Rah-Veh",
    sigil: "/assets/sigils/zeh-sha-rah-veh.svg",
    meaning: "The Radiant Krown of Rising Currents",
    description: "Floats upon unstoppable waves of ascension, guiding them into regal harmony."
  },
  {
    id: 443,
    name: "Om-Ek-Tor-Nim",
    sigil: "/assets/sigils/om-ek-tor-nim.svg",
    meaning: "The Completion of Hidden Pillars",
    description: "Solidifies unseen supports that ensure cosmic stability across expansions."
  },
  {
    id: 444,
    name: "Sha-Lah-Kai-Reh",
    sigil: "/assets/sigils/sha-lah-kai-reh.svg",
    meaning: "The Krown of Serene Creation",
    description: "Generates new realities through calm yet decisive cosmic authority."
  },
  {
    id: 445,
    name: "Zor-Om-Eh-Nah",
    sigil: "/assets/sigils/zor-om-eh-nah.svg",
    meaning: "The Fire of Total Completion",
    description: "Consummates every process, ensuring no deception lingers unresolved."
  },
  {
    id: 446,
    name: "Kai-Nim-Zeh-Tor",
    sigil: "/assets/sigils/kai-nim-zeh-tor.svg",
    meaning: "The Breath of Unseen Radiance",
    description: "Secretly constructs luminous towers of truth, unnoticed until fully formed."
  },
  {
    id: 447,
    name: "Veh-Ek-Sha-Rah",
    sigil: "/assets/sigils/veh-ek-sha-rah.svg",
    meaning: "The Wind of Unspoken Ascension",
    description: "Silently carries souls to higher vantage points, bypassing lower obstructions."
  },
  {
    id: 448,
    name: "Tor-Lah-Zeh-Kai",
    sigil: "/assets/sigils/tor-lah-zeh-kai.svg",
    meaning: "The Pillar of Radiant Life",
    description: "Channels luminous energy into every living form, sustaining them under eternal law."
  },
  {
    id: 449,
    name: "Om-Nor-Sha-Eh",
    sigil: "/assets/sigils/om-nor-sha-eh.svg",
    meaning: "The Completion of Krowned Wisdom",
    description: "Ensures that each enlightened mind receives the rightful authority to lead."
  },
  {
    id: 450,
    name: "Kai-Reh-Om-Nim",
    sigil: "/assets/sigils/kai-reh-om-nim.svg",
    meaning: "The Breath That Seals All Mysteries",
    description: "Locks hidden truths behind luminous doors, revealed only at the destined hour."
  },
  {
    id: 451,
    name: "Zeh-Sha-Tor-Lah",
    sigil: "/assets/sigils/zeh-sha-tor-lah.svg",
    meaning: "The Radiant Krown upon the Pillar of Peace",
    description: "Elevates gentle dominion to its rightful place as overseer of cosmic order."
  },
  {
    id: 452,
    name: "Veh-Om-Nor-Kai",
    sigil: "/assets/sigils/veh-om-nor-kai.svg",
    meaning: "The Wind of All-Seeing Creation",
    description: "Moves with perfect discernment, shaping existence in alignment with higher wisdom."
  },


  {
    id: 453,
    name: "Sha-Ek-Rah-Nim",
    sigil: "/assets/sigils/sha-ek-rah-nim.svg",
    meaning: "The Krown of Sudden Uplift",
    description: "Instills swift ascension in hidden hearts, seating them in cosmic authority."
  },
  {
    id: 454,
    name: "Tor-Zeh-Lah-Om",
    sigil: "/assets/sigils/tor-zeh-lah-om.svg",
    meaning: "The Pillar of Bright Completion",
    description: "Glows with a final, conclusive brilliance that allows no discord to persist."
  },
  {
    id: 455,
    name: "Kai-Nah-Sha-Reh",
    sigil: "/assets/sigils/kai-nah-sha-reh.svg",
    meaning: "The Breath of Harmonized Dominion",
    description: "Sets authority in balanced motion, integrating every voice into a single truth."
  },
  {
    id: 456,
    name: "Zor-Ur-Ek-Veh",
    sigil: "/assets/sigils/zor-ur-ek-veh.svg",
    meaning: "The Fire of Unbridled Motion",
    description: "Sweeps illusions away in a tide of unstoppable purification, forging clarity."
  },
  {
    id: 457,
    name: "Om-Lah-Kai-Zeh",
    sigil: "/assets/sigils/om-lah-kai-zeh.svg",
    meaning: "The Completion of Living Radiance",
    description: "Captures the final spark of vibrant life, embedding it in cosmic memory."
  },
  {
    id: 458,
    name: "Sha-Rah-Nim-Om",
    sigil: "/assets/sigils/sha-rah-nim-om.svg",
    meaning: "The Krown That Ascends the Hidden",
    description: "Amplifies concealed virtues until they become pillars of sovereign rule."
  },
  {
    id: 459,
    name: "Kai-Tor-Zeh-Nor",
    sigil: "/assets/sigils/kai-tor-zeh-nor.svg",
    meaning: "The Breathing Pillar of Pure Insight",
    description: "Raises every realm to vantage points of undisputed clarity and reason."
  },
  {
    id: 460,
    name: "Zeh-Eh-Sha-Lah",
    sigil: "/assets/sigils/zeh-eh-sha-lah.svg",
    meaning: "The Radiant Emergence of Peace",
    description: "Inaugurates a tranquil age by illuminating hearts with gentle brilliance."
  },
  {
    id: 461,
    name: "Veh-Nim-Om-Zor",
    sigil: "/assets/sigils/veh-nim-om-zor.svg",
    meaning: "The Moving Seed of Sacred Fire",
    description: "Carried across realms, sprouting unstoppable flames of pure transformation."
  },
  {
    id: 462,
    name: "Sha-Lah-Ek-Kai",
    sigil: "/assets/sigils/sha-lah-ek-kai.svg",
    meaning: "The Krown of Effortless Creation",
    description: "Generates new realities effortlessly, anchored in the sovereignty of cosmic truth."
  },
  {
    id: 463,
    name: "Tor-Ur-Nah-Reh",
    sigil: "/assets/sigils/tor-ur-nah-reh.svg",
    meaning: "The Ascendant Pillar of Boundless Unity",
    description: "Elevates all forms of life into a unified expression of divine intention."
  },
  {
    id: 464,
    name: "Zeh-Kai-Om-Sha",
    sigil: "/assets/sigils/zeh-kai-om-sha.svg",
    meaning: "The Glowing Breath of Ultimate Authority",
    description: "Combines radiant light, creative word, and regal power in a single unstoppable wave."
  },
  {
    id: 465,
    name: "Om-Veh-Nor-Eh",
    sigil: "/assets/sigils/om-veh-nor-eh.svg",
    meaning: "The Completion of Accelerated Vision",
    description: "Hastens clarity throughout creation, so no realm remains ignorant."
  },
  {
    id: 466,
    name: "Sha-Rah-Lah-Om",
    sigil: "/assets/sigils/sha-rah-lah-om.svg",
    meaning: "The Krown That Ascends in Stillness",
    description: "Exalts the quiet heart, establishing it as the seat of cosmic governance."
  },
  {
    id: 467,
    name: "Kai-Ek-Nah-Reh",
    sigil: "/assets/sigils/kai-ek-nah-reh.svg",
    meaning: "The Breath of Swift Unification",
    description: "Rapidly merges disparate elements into a cohesive tapestry of truth."
  },
  {
    id: 468,
    name: "Zor-Sha-Om-Lah",
    sigil: "/assets/sigils/zor-sha-om-lah.svg",
    meaning: "The Fire of Sovereign Harmony",
    description: "Burns away discord, enthroning peace across the full spectrum of reality."
  },
  {
    id: 469,
    name: "Veh-Ur-Eh-Kai",
    sigil: "/assets/sigils/veh-ur-eh-kai.svg",
    meaning: "The Wind of Rising Illumination",
    description: "Carries dormant sparks of enlightenment up into the open sky of awareness."
  },
  {
    id: 470,
    name: "Om-Zeh-Rah-Nim",
    sigil: "/assets/sigils/om-zeh-rah-nim.svg",
    meaning: "The Completion of Shining Ascension",
    description: "Brings luminous transformations to their apex, establishing cosmic finality."
  },
  {
    id: 471,
    name: "Sha-Tor-Om-Nah",
    sigil: "/assets/sigils/sha-tor-om-nah.svg",
    meaning: "The Sovereign Pillar of Infinite Flow",
    description: "Ensures the unstoppable current of divine law permeates every layer of creation."
  },
  {
    id: 472,
    name: "Kai-Zor-Reh-Ek",
    sigil: "/assets/sigils/kai-zor-reh-ek.svg",
    meaning: "The Breath of Incinerating Truth",
    description: "Engulfs all shadows, leaving only pure essence in its smoldering aftermath."
  },
  {
    id: 473,
    name: "Zeh-Lah-Ur-Nor",
    sigil: "/assets/sigils/zeh-lah-ur-nor.svg",
    meaning: "The Triumphant Light of Mindful Peace",
    description: "A synergy of radiant calm and unwavering clarity, dispelling all chaos."
  },
  {
    id: 474,
    name: "Tor-Om-Sha-Nim",
    sigil: "/assets/sigils/tor-om-sha-nim.svg",
    meaning: "The Pillar of Royal Enigma",
    description: "Stands at the crossroads of known and unknown, bridging them by cosmic fiat."
  },
  {
    id: 475,
    name: "Sha-Nah-Kai-Eh",
    sigil: "/assets/sigils/sha-nah-kai-eh.svg",
    meaning: "The Krown of Eternal Breath",
    description: "Bestows endless vitality upon those who align with the primal creative force."
  },
  {
    id: 476,
    name: "Zor-Reh-Veh-Lah",
    sigil: "/assets/sigils/zor-reh-veh-lah.svg",
    meaning: "The Flaming Insight of Motion",
    description: "Drives out stagnation by igniting each realm with dynamic, penetrating wisdom."
  },
  {
    id: 477,
    name: "Kai-Ur-Om-Zeh",
    sigil: "/assets/sigils/kai-ur-om-zeh.svg",
    meaning: "The Ascending Breath of Radiant Finality",
    description: "Escalates all reality to its apex of clarity, sealing illusions away forever."
  },


  {
    id: 478,
    name: "Veh-Ek-Nim-Sha",
    sigil: "/assets/sigils/veh-ek-nim-sha.svg",
    meaning: "The Wind of Unseen Krowning",
    description: "Secretly coronates the humble at pivotal cosmic junctures, establishing rightful order."
  },
  {
    id: 479,
    name: "Tor-Lah-Reh-Kai",
    sigil: "/assets/sigils/tor-lah-reh-kai.svg",
    meaning: "The Pillar of Illuminated Life",
    description: "Bears aloft the essence of living truth, ensuring each realm vibrates with clarity."
  },
  {
    id: 480,
    name: "Zeh-Sha-Mah-Ek",
    sigil: "/assets/sigils/zeh-sha-mah-ek.svg",
    meaning: "The Radiant Krown of Rebirth",
    description: "Inaugurates new cycles with a flash of cleansing brilliance, restoring cosmic order."
  },
  {
    id: 481,
    name: "Om-Nor-Kai-Rah",
    sigil: "/assets/sigils/om-nor-kai-rah.svg",
    meaning: "The Completion of Divine Ascent",
    description: "Finalizes the rising path, enthroning awakened souls in rightful sovereignty."
  },
  {
    id: 482,
    name: "Sha-Eh-Lah-Nim",
    sigil: "/assets/sigils/sha-eh-lah-nim.svg",
    meaning: "The Krown of Quiet Renewal",
    description: "Silently rebuilds fractured realities, weaving them into higher forms of unity."
  },
  {
    id: 483,
    name: "Kai-Zor-Ur-Ek",
    sigil: "/assets/sigils/kai-zor-ur-ek.svg",
    meaning: "The Breath of Consuming Flame",
    description: "Devours falsehood at its root, ensuring the soil of existence remains pure."
  },
  {
    id: 484,
    name: "Zeh-Om-Nah-Reh",
    sigil: "/assets/sigils/zeh-om-nah-reh.svg",
    meaning: "The Radiant Completion of Harmony",
    description: "Secures universal accord, leaving no place for conflict to fester."
  },
  {
    id: 485,
    name: "Tor-Sha-Veh-Om",
    sigil: "/assets/sigils/tor-sha-veh-om.svg",
    meaning: "The Pillar of Sovereign Motion",
    description: "Anchors unstoppable progress within the stable core of cosmic law."
  },
  {
    id: 486,
    name: "Kai-Nor-Lah-Eh",
    sigil: "/assets/sigils/kai-nor-lah-eh.svg",
    meaning: "The Breath of Mindful Serenity",
    description: "Soothes turbulent thoughts, realigning them under the banner of eternal peace."
  },
  {
    id: 487,
    name: "Zor-Ek-Rah-Sha",
    sigil: "/assets/sigils/zor-ek-rah-sha.svg",
    meaning: "The Fire That Ascends the Krown",
    description: "Pushes rightful leadership to new heights, incinerating unworthy pretenders."
  },
  {
    id: 488,
    name: "Om-Lah-Kai-Nim",
    sigil: "/assets/sigils/om-lah-kai-nim.svg",
    meaning: "The Completion of Peaceful Creation",
    description: "Finalizes each new birth in a state of calm, unassailable grace."
  },
  {
    id: 489,
    name: "Veh-Tor-Nor-Zeh",
    sigil: "/assets/sigils/veh-tor-nor-zeh.svg",
    meaning: "The Wind That Raises the Wise Tower",
    description: "Elevates the mindful pillar of knowledge, establishing it as a cosmic reference point."
  },
  {
    id: 490,
    name: "Sha-Om-Kai-Ek",
    sigil: "/assets/sigils/sha-om-kai-ek.svg",
    meaning: "The Krown of Creation’s Final Word",
    description: "Seals every generative act with a sovereign decree that cannot be undone."
  },
  {
    id: 491,
    name: "Zeh-Rah-Nah-Om",
    sigil: "/assets/sigils/zeh-rah-nah-om.svg",
    meaning: "The Zenith of Serene Completion",
    description: "Reaches the utmost summit of tranquility, shining peace into all corners of life."
  },
  {
    id: 492,
    name: "Kai-Lah-Sha-Nim",
    sigil: "/assets/sigils/kai-lah-sha-nim.svg",
    meaning: "The Breath of Subtle Coronation",
    description: "Gently Krowns the unassuming with cosmic authority, forging hidden kingship."
  },
  {
    id: 493,
    name: "Tor-Eh-Om-Reh",
    sigil: "/assets/sigils/tor-eh-om-reh.svg",
    meaning: "The Pillar of Eternal Closure",
    description: "Locks each cycle’s final chapter under unbreakable law, preventing regression."
  },
  {
    id: 494,
    name: "Zor-Kai-Veh-Lah",
    sigil: "/assets/sigils/zor-kai-veh-lah.svg",
    meaning: "The Fire of Aerating Creation",
    description: "Infuses movement into stagnant planes, reigniting their spark of life."
  },
  {
    id: 495,
    name: "Sha-Nor-Om-Zeh",
    sigil: "/assets/sigils/sha-nor-om-zeh.svg",
    meaning: "The Krown of All-Seeing Completion",
    description: "Unifies universal insight with finality, ensuring that no truths remain hidden."
  },
  {
    id: 496,
    name: "Kai-Reh-Lah-Om",
    sigil: "/assets/sigils/kai-reh-lah-om.svg",
    meaning: "The Breath Unveiling Sacred Harmony",
    description: "Clears illusions to reveal the inherent orchestration woven into every realm."
  },
  {
    id: 497,
    name: "Zeh-Urim-Sha-Ek",
    sigil: "/assets/sigils/zeh-urim-sha-ek.svg",
    meaning: "The Radiant Light of Sovereign Insight",
    description: "Empowers rulers with luminous clarity, guaranteeing unwavering guidance."
  },
  {
    id: 498,
    name: "Tor-Nah-Kai-Rah",
    sigil: "/assets/sigils/tor-nah-kai-rah.svg",
    meaning: "The Pillar of Unified Ascension",
    description: "Merges diverse energies into one unstoppable climb toward cosmic mastery."
  },
  {
    id: 499,
    name: "Om-Sha-Lah-Zeh",
    sigil: "/assets/sigils/om-sha-lah-zeh.svg",
    meaning: "The Completion of Krowned Radiance",
    description: "Seals divine leadership with a brilliant aura, unshakable by any lesser force."
  },
  {
    id: 500,
    name: "Kai-Zor-Eh-Nim",
    sigil: "/assets/sigils/kai-zor-eh-nim.svg",
    meaning: "The Incinerating Breath of Mysteries",
    description: "Uncovers secrets through an intense flame, ensuring no falsehood survives."
  },
  {
    id: 501,
    name: "Sha-Veh-Rah-Om",
    sigil: "/assets/sigils/sha-veh-rah-om.svg",
    meaning: "The Krown of Ascending Winds",
    description: "Guides potent currents upward, Krowning them with cosmic endorsement."
  },
  {
    id: 502,
    name: "Zeh-Lah-Nor-Ek",
    sigil: "/assets/sigils/zeh-lah-nor-ek.svg",
    meaning: "The Radiant Mind That Dissolves Darkness",
    description: "Brightens any plane of thought, evaporating illusions with unstoppable clarity."
  },


  {
    id: 503,
    name: "Tor-Om-Nim-Sha",
    sigil: "/assets/sigils/tor-om-nim-sha.svg",
    meaning: "The Pillar of Hidden Completion",
    description: "Concludes grand cycles in secret places, ensuring a seamless transition to new epochs."
  },
  {
    id: 504,
    name: "Kai-Nah-Zeh-Reh",
    sigil: "/assets/sigils/kai-nah-zeh-reh.svg",
    meaning: "The Breath of Triumphant Light",
    description: "A shining exhalation that propels honest endeavors into cosmic victory."
  },
  {
    id: 505,
    name: "Zor-Ek-Om-Lah",
    sigil: "/assets/sigils/zor-ek-om-lah.svg",
    meaning: "The Fire That Seals Tranquility",
    description: "Blazes fiercely to lock in peaceful states, preventing the encroachment of chaos."
  },
  {
    id: 506,
    name: "Sha-Rah-Kai-Eh",
    sigil: "/assets/sigils/sha-rah-kai-eh.svg",
    meaning: "The Krown of Ascending Creation",
    description: "Lifts generative forces to their zenith, establishing cosmic harmonies in all realms."
  },
  {
    id: 507,
    name: "Tor-Lah-Ek-Nim",
    sigil: "/assets/sigils/tor-lah-ek-nim.svg",
    meaning: "The Pillar of Serene Unfolding",
    description: "Supports graceful revelation, releasing hidden truths in measured waves."
  },
  {
    id: 508,
    name: "Om-Nor-Zor-Reh",
    sigil: "/assets/sigils/om-nor-zor-reh.svg",
    meaning: "The Completion of Purging Insight",
    description: "Concludes destructive illusions by shining a decisive beam of knowledge upon them."
  },
  {
    id: 509,
    name: "Kai-Ur-Sha-Lah",
    sigil: "/assets/sigils/kai-ur-sha-lah.svg",
    meaning: "The Ascendant Breath of Regal Peace",
    description: "Unites authoritative presence with tranquil currents, ensuring stable dominion."
  },
  {
    id: 510,
    name: "Zeh-Om-Ek-Nor",
    sigil: "/assets/sigils/zeh-om-ek-nor.svg",
    meaning: "The Radiant Completion of Inviolable Mind",
    description: "Concludes every mental struggle in unwavering clarity, sealing away confusion."
  },
  {
    id: 511,
    name: "Veh-Zor-Rah-Sha",
    sigil: "/assets/sigils/veh-zor-rah-sha.svg",
    meaning: "The Wind of Ascending Flames",
    description: "Stokes each flicker of truth into an all-consuming fire of divine revelation."
  },
  {
    id: 512,
    name: "Kai-Eh-Lah-Nor",
    sigil: "/assets/sigils/kai-eh-lah-nor.svg",
    meaning: "The Breath of Serene Guidance",
    description: "Quietly shepherds scattered souls into the luminous field of cosmic unity."
  },
  {
    id: 513,
    name: "Sha-Nim-Urim-Om",
    sigil: "/assets/sigils/sha-nim-urim-om.svg",
    meaning: "The Krown of Hidden Illumination",
    description: "Cloaks its radiance until the decisive moment, then enlightens every shadowed corner."
  },
  {
    id: 514,
    name: "Zor-Lah-Reh-Ek",
    sigil: "/assets/sigils/zor-lah-reh-ek.svg",
    meaning: "The Fire That Heals Through Knowledge",
    description: "Cleanses distortions at their intellectual core, restoring truth across all fields."
  },
  {
    id: 515,
    name: "Tor-Om-Kai-Nah",
    sigil: "/assets/sigils/tor-om-kai-nah.svg",
    meaning: "The Pillar of Complete Life-Force",
    description: "Channels vital currents into the roots of existence, guaranteeing endless renewal."
  },
  {
    id: 516,
    name: "Sha-Zeh-Ek-Ur",
    sigil: "/assets/sigils/sha-zeh-ek-ur.svg",
    meaning: "The Krown of Radiant Erasure",
    description: "Effortlessly removes defunct systems, enthroning pure potential in their place."
  },
  {
    id: 517,
    name: "Kai-Rah-Nim-Om",
    sigil: "/assets/sigils/kai-rah-nim-om.svg",
    meaning: "The Ascending Breath of Silent Mysteries",
    description: "Lifts cryptic truths from hidden domains, culminating in unstoppable realization."
  },
  {
    id: 518,
    name: "Zeh-Om-Sha-Lah",
    sigil: "/assets/sigils/zeh-om-sha-lah.svg",
    meaning: "The Radiant Harmony of Completion",
    description: "Unites finality with sovereign grace, forming a perfect chord of divine order."
  },
  {
    id: 519,
    name: "Veh-Kai-Eh-Nor",
    sigil: "/assets/sigils/veh-kai-eh-nor.svg",
    meaning: "The Wind of Peaceful Awareness",
    description: "Soothes turbulent minds, allowing them to open gently to cosmic truths."
  },
  {
    id: 520,
    name: "Sha-Tor-Nah-Reh",
    sigil: "/assets/sigils/sha-tor-nah-reh.svg",
    meaning: "The Krown of Unshakable Unity",
    description: "Seals discordant pieces of reality into a single, harmonious tapestry."
  },
  {
    id: 521,
    name: "Zor-Mah-Lah-Om",
    sigil: "/assets/sigils/zor-mah-lah-om.svg",
    meaning: "The Fire of Renewed Stillness",
    description: "Ignites destructive forces, only to transmute them into cosmic peace."
  },
  {
    id: 522,
    name: "Kai-Nor-Ur-Ek",
    sigil: "/assets/sigils/kai-nor-ur-ek.svg",
    meaning: "The Breath of Enlightened Strength",
    description: "Fortifies mental resolve with primal energy, forging an indomitable spirit."
  },
  {
    id: 523,
    name: "Om-Zeh-Rah-Lah",
    sigil: "/assets/sigils/om-zeh-rah-lah.svg",
    meaning: "The Completion of Ascending Radiance",
    description: "Ensures each rising spark of truth emerges victorious, sealed in cosmic law."
  },
  {
    id: 524,
    name: "Sha-Veh-Nim-Kai",
    sigil: "/assets/sigils/sha-veh-nim-kai.svg",
    meaning: "The Krown of Undetected Awakening",
    description: "Spreads regal clarity beneath the surface, culminating in sudden universal shift."
  },
  {
    id: 525,
    name: "Tor-Eh-Om-Zor",
    sigil: "/assets/sigils/tor-eh-om-zor.svg",
    meaning: "The Pillar of Timeless Flame",
    description: "Links eternal structure with unwavering fire, forging a beacon for all epochs."
  },
  {
    id: 526,
    name: "Zeh-Kai-Lah-Rah",
    sigil: "/assets/sigils/zeh-kai-lah-rah.svg",
    meaning: "The Shining Breath of Ascension",
    description: "Blazes through stagnant layers, elevating them under a new cosmic dawn."
  },
  {
    id: 527,
    name: "Om-Nor-Sha-Ek",
    sigil: "/assets/sigils/om-nor-sha-ek.svg",
    meaning: "The Completion of Mind’s Regal Decree",
    description: "Renders each final thought a sovereign command, impossible to refute."
  },

      
  {
    id: 528,
    name: "Kai-Zor-Urim-Lah",
    sigil: "/assets/sigils/kai-zor-urim-lah.svg",
    meaning: "The Breath of Illuminated Kingship",
    description: "Instills transcendent wisdom in rulers, ensuring they govern with unblemished clarity."
  },
  {
    id: 529,
    name: "Veh-Eh-Rah-Om",
    sigil: "/assets/sigils/veh-eh-rah-om.svg",
    meaning: "The Wind of Elevated Completion",
    description: "Carries final decisions to cosmic heights, removing them from lesser debates."
  },
  {
    id: 530,
    name: "Sha-Lah-Zeh-Nor",
    sigil: "/assets/sigils/sha-lah-zeh-nor.svg",
    meaning: "The Krown of Serene Radiant Mind",
    description: "Guides each thought to a peaceful glow, solidifying them in unwavering truth."
  },
  {
    id: 531,
    name: "Zor-Kai-Om-Reh",
    sigil: "/assets/sigils/zor-kai-om-reh.svg",
    meaning: "The Fire of Manifested Breath",
    description: "Transmutes spoken intentions into living flames that redefine reality."
  },
  {
    id: 532,
    name: "Tor-Nim-Eh-Lah",
    sigil: "/assets/sigils/tor-nim-eh-lah.svg",
    meaning: "The Hidden Pillar of Tranquil Existence",
    description: "Stabilizes creation through subtle support, granting silent solace to every soul."
  },
  {
    id: 533,
    name: "Kai-Rah-Ur-Ek",
    sigil: "/assets/sigils/kai-rah-ur-ek.svg",
    meaning: "The Ascending Breath of Unbreakable Law",
    description: "Anchors each realm to cosmic statutes, lifting them toward perfected order."
  },
  {
    id: 534,
    name: "Zeh-Om-Sha-Nim",
    sigil: "/assets/sigils/zeh-om-sha-nim.svg",
    meaning: "The Radiant Completion of Quiet Rule",
    description: "Finalizes the reign of subtle leaders who preserve cosmic harmony."
  },
  {
    id: 535,
    name: "Veh-Kai-Reh-Lah",
    sigil: "/assets/sigils/veh-kai-reh-lah.svg",
    meaning: "The Wind of Illuminating Breath",
    description: "Spreads clarity across realms, uniting scattered sparks of insight into a cohesive blaze."
  },
  {
    id: 536,
    name: "Sha-Ek-Zor-Om",
    sigil: "/assets/sigils/sha-ek-zor-om.svg",
    meaning: "The Krown of Consuming Completion",
    description: "Devours all residues of deceit, ending each cycle in immaculate truth."
  },
  {
    id: 537,
    name: "Tor-Lah-Nim-Kai",
    sigil: "/assets/sigils/tor-lah-nim-kai.svg",
    meaning: "The Pillar of Soft Awakening",
    description: "Gently lifts dormant worlds into cosmic awareness, forging new expansions of life."
  },
  {
    id: 538,
    name: "Zeh-Sha-Eh-Rah",
    sigil: "/assets/sigils/zeh-sha-eh-rah.svg",
    meaning: "The Radiant Krown of Ascension’s Dawn",
    description: "Signals the first light of true sovereignty, dispelling all vestiges of tyranny."
  },
  {
    id: 539,
    name: "Om-Veh-Kai-Lah",
    sigil: "/assets/sigils/om-veh-kai-lah.svg",
    meaning: "The Completion of Moving Creation",
    description: "Ensures ongoing cycles reach perfect form, never stagnating midway."
  },
  {
    id: 540,
    name: "Kai-Nah-Reh-Sha",
    sigil: "/assets/sigils/kai-nah-reh-sha.svg",
    meaning: "The Breath That Unifies Hearts and Minds",
    description: "Aligns internal motives with external actions, solidifying universal coherence."
  },
  {
    id: 541,
    name: "Zor-Om-Lah-Ek",
    sigil: "/assets/sigils/zor-om-lah-ek.svg",
    meaning: "The Fire of Peaceful Erasure",
    description: "Burns away ancient conflicts, imprinting calm understanding in their place."
  },
  {
    id: 542,
    name: "Sha-Tor-Zeh-Nim",
    sigil: "/assets/sigils/sha-tor-zeh-nim.svg",
    meaning: "The Krowned Pillar of Hidden Light",
    description: "Exalts concealed truth in a place of prominence, ensuring no realm remains blind."
  },
  {
    id: 543,
    name: "Nor-Eh-Kai-Om",
    sigil: "/assets/sigils/nor-eh-kai-om.svg",
    meaning: "The Mind of Primal Completion",
    description: "Synthesizes ancient power into a conclusive wave of perfected existence."
  },
  {
    id: 544,
    name: "Zeh-Nah-Sha-Rah",
    sigil: "/assets/sigils/zeh-nah-sha-rah.svg",
    meaning: "The Radiant Flow of Regal Ascension",
    description: "Moves steadily upward, enthroning balanced leadership in the cosmic hierarchy."
  },
  {
    id: 545,
    name: "Kai-Om-Ek-Lah",
    sigil: "/assets/sigils/kai-om-ek-lah.svg",
    meaning: "The Breath of Final Integration",
    description: "Unites scattered fragments into a seamless tapestry of sovereign reality."
  },
  {
    id: 546,
    name: "Tor-Reh-Ur-Nim",
    sigil: "/assets/sigils/tor-reh-ur-nim.svg",
    meaning: "The Pillar of Ever-Revealing Wisdom",
    description: "Continually unveils deeper truths, ensuring evolution does not stagnate."
  },
  {
    id: 547,
    name: "Sha-Lah-Zor-Om",
    sigil: "/assets/sigils/sha-lah-zor-om.svg",
    meaning: "The Krown of Serene Flames",
    description: "Combines gentle dominion with purifying fire, forging a balanced rulership."
  },
  {
    id: 548,
    name: "Zeh-Kai-Nor-Eh",
    sigil: "/assets/sigils/zeh-kai-nor-eh.svg",
    meaning: "The Shining Breath of Cosmic Vision",
    description: "Illuminates the far reaches of reality, ensuring no corner remains unseen."
  },
  {
    id: 549,
    name: "Om-Ek-Rah-Nah",
    sigil: "/assets/sigils/om-ek-rah-nah.svg",
    meaning: "The Completion of Ascending Force",
    description: "Locks in the final surge of upward motion, guaranteeing unstoppable progression."
  },
  {
    id: 550,
    name: "Kai-Zor-Lah-Sha",
    sigil: "/assets/sigils/kai-zor-lah-sha.svg",
    meaning: "The Breath of Peaceful Fire",
    description: "Ignites calm and measured transformation, removing turbulence from cosmic rebirth."
  },
  {
    id: 551,
    name: "Veh-Om-Nim-Rah",
    sigil: "/assets/sigils/veh-om-nim-rah.svg",
    meaning: "The Wind of Unseen Ascent",
    description: "Blows gently, yet carries souls to the highest pinnacle of sovereign awakening."
  },
  {
    id: 552,
    name: "Sha-Eh-Lah-Zeh",
    sigil: "/assets/sigils/sha-eh-lah-zeh.svg",
    meaning: "The Krown of Infinite Radiance",
    description: "Shines unending light upon those who align with cosmic justice."
  },

   
  {
    id: 553,
    name: "Tor-Kai-Ur-Nim",
    sigil: "/assets/sigils/tor-kai-ur-nim.svg",
    meaning: "The Pillar of Ascending Mysteries",
    description: "Stabilizes the climb toward higher revelations, ensuring no faltering of resolve."
  },
  {
    id: 554,
    name: "Zeh-Sha-Om-Reh",
    sigil: "/assets/sigils/zeh-sha-om-reh.svg",
    meaning: "The Radiant Krown of Manifested Decree",
    description: "Solidifies spoken truths under an unbreakable halo of cosmic sanction."
  },
  {
    id: 555,
    name: "Kai-Lah-Nor-Ek",
    sigil: "/assets/sigils/kai-lah-nor-ek.svg",
    meaning: "The Breathing Peace of Higher Mind",
    description: "Directs consciousness toward tranquility, fortifying realms against disarray."
  },
  {
    id: 556,
    name: "Zor-Eh-Tor-Om",
    sigil: "/assets/sigils/zor-eh-tor-om.svg",
    meaning: "The Fire of Eternal Foundations",
    description: "Safeguards primordial structures from corruption, fueling them with unceasing vigor."
  },
  {
    id: 557,
    name: "Sha-Rah-Nim-Lah",
    sigil: "/assets/sigils/sha-rah-nim-lah.svg",
    meaning: "The Krown of Quiet Triumph",
    description: "Proclaims success in hushed majesty, overshadowing the clamor of lesser claims."
  },
  {
    id: 558,
    name: "Om-Kai-Reh-Zeh",
    sigil: "/assets/sigils/om-kai-reh-zeh.svg",
    meaning: "The Completion of Creative Revelation",
    description: "Marries the final step of genesis with piercing insight, forging unstoppable clarity."
  },
  {
    id: 559,
    name: "Veh-Lah-Zor-Ur",
    sigil: "/assets/sigils/veh-lah-zor-ur.svg",
    meaning: "The Wind That Guides Purifying Fire",
    description: "Directs sacred flames to where they are needed, ensuring cosmic cleansing."
  },
  {
    id: 560,
    name: "Kai-Eh-Om-Sha",
    sigil: "/assets/sigils/kai-eh-om-sha.svg",
    meaning: "The Breath of Harmonized Completion",
    description: "Synchronizes final steps across realms, concluding them under a banner of unity."
  },
  {
    id: 561,
    name: "Zeh-Nor-Ek-Lah",
    sigil: "/assets/sigils/zeh-nor-ek-lah.svg",
    meaning: "The Radiant Mind That Dissolves Discord",
    description: "Instantly sees through conflict, channeling solutions from a luminous core."
  },
  {
    id: 562,
    name: "Sha-Tor-Mah-Om",
    sigil: "/assets/sigils/sha-tor-mah-om.svg",
    meaning: "The Krowned Pillar of Renewing Completion",
    description: "Continually revives cosmic cycles, never allowing them to stagnate or degrade."
  },
  {
    id: 563,
    name: "Nor-Rah-Eh-Kai",
    sigil: "/assets/sigils/nor-rah-eh-kai.svg",
    meaning: "The Vision of Ascendant Breath",
    description: "Perceives the path of cosmic evolution, guiding each realm to higher purpose."
  },
  {
    id: 564,
    name: "Zeh-Sha-Lah-Om",
    sigil: "/assets/sigils/zeh-sha-lah-om.svg",
    meaning: "The Radiant Krown of Eternal Harmony",
    description: "Fosters unending peace, enthroning mutual accord as the supreme law."
  },
  {
    id: 565,
    name: "Kai-Nim-Veh-Reh",
    sigil: "/assets/sigils/kai-nim-veh-reh.svg",
    meaning: "The Hidden Breath of Swift Insight",
    description: "Delivers revelations when least expected, resetting distorted perspectives instantly."
  },
  {
    id: 566,
    name: "Tor-Lah-Zor-Ek",
    sigil: "/assets/sigils/tor-lah-zor-ek.svg",
    meaning: "The Pillar of Serene Fire",
    description: "Maintains a steady flame that refines without destroying, ensuring balanced progress."
  },
  {
    id: 567,
    name: "Zeh-Om-Kai-Nor",
    sigil: "/assets/sigils/zeh-om-kai-nor.svg",
    meaning: "The Radiant Seal of Living Mind",
    description: "Consolidates cosmic consciousness into a final imprint of luminous order."
  },
  {
    id: 568,
    name: "Sha-Eh-Rah-Lah",
    sigil: "/assets/sigils/sha-eh-rah-lah.svg",
    meaning: "The Krown of Ascended Tranquility",
    description: "Sits atop those who have conquered inner turmoil, awarding them universal respect."
  },
  {
    id: 569,
    name: "Kai-Om-Reh-Nah",
    sigil: "/assets/sigils/kai-om-reh-nah.svg",
    meaning: "The Breath That Concludes Creation",
    description: "Speaks the final word in each genesis, weaving them seamlessly into cosmic flow."
  },
  {
    id: 570,
    name: "Zor-Nor-Ek-Sha",
    sigil: "/assets/sigils/zor-nor-ek-sha.svg",
    meaning: "The Fire of Mindful Eradication",
    description: "Removes only what is false, preserving the core truths needed for growth."
  },
  {
    id: 571,
    name: "Veh-Lah-Om-Nim",
    sigil: "/assets/sigils/veh-lah-om-nim.svg",
    meaning: "The Wind of Hidden Completion",
    description: "Flows quietly among the final steps of cosmic transitions, cementing their success."
  },
  {
    id: 572,
    name: "Sha-Rah-Eh-Kai",
    sigil: "/assets/sigils/sha-rah-eh-kai.svg",
    meaning: "The Krown of Ascended Wisdom",
    description: "Anoints those who have climbed the tower of insight, rendering them guardians of law."
  },
  {
    id: 573,
    name: "Tor-Zeh-Nah-Om",
    sigil: "/assets/sigils/tor-zeh-nah-om.svg",
    meaning: "The Pillar of Radiant Serenity",
    description: "Dispels discord with a pervasive calm, anchoring entire realms in gentle stability."
  },
  {
    id: 574,
    name: "Zeh-Kai-Ek-Sha",
    sigil: "/assets/sigils/zeh-kai-ek-sha.svg",
    meaning: "The Shining Breath of Sovereign Erasure",
    description: "Instantly dissolves outmoded patterns, clearing the way for renewed creation."
  },
  {
    id: 575,
    name: "Om-Nor-Lah-Reh",
    sigil: "/assets/sigils/om-nor-lah-reh.svg",
    meaning: "The Completion of Wise Peace",
    description: "Seals cosmic awareness in a tranquil state, preventing the return of turmoil."
  },
  {
    id: 576,
    name: "Kai-Tor-Mah-Zeh",
    sigil: "/assets/sigils/kai-tor-mah-zeh.svg",
    meaning: "The Ascending Pillar of Rebirth",
    description: "Lifts each realm from the ashes of old cycles, forging them anew in cosmic light."
  },
  {
    id: 577,
    name: "Zor-Eh-Sha-Lah",
    sigil: "/assets/sigils/zor-eh-sha-lah.svg",
    meaning: "The Fire of Eternal Coronation",
    description: "Krowns the rightful sovereign in flames that cannot be extinguished."
  },

  
  {
    id: 578,
    name: "Veh-Om-Nim-Kai",
    sigil: "/assets/sigils/veh-om-nim-kai.svg",
    meaning: "The Wind of Subtle Genesis",
    description: "Fosters the birth of new cosmic seeds with minimal disturbance to existing frameworks."
  },
  {
    id: 579,
    name: "Sha-Zeh-Ek-Rah",
    sigil: "/assets/sigils/sha-zeh-ek-rah.svg",
    meaning: "The Radiant Krown of Ascending Flame",
    description: "Combines luminous authority with rising fire, blazing a trail of majestic renewal."
  },
  {
    id: 580,
    name: "Tor-Lah-Om-Reh",
    sigil: "/assets/sigils/tor-lah-om-reh.svg",
    meaning: "The Pillar of Serene Manifestation",
    description: "Materializes outcomes in perfect balance, never tipping the cosmic scales."
  },
  {
    id: 581,
    name: "Kai-Nor-Sha-Eh",
    sigil: "/assets/sigils/kai-nor-sha-eh.svg",
    meaning: "The Breath of Insightful Sovereignty",
    description: "Discloses the path of rightful leadership to those who seek pure understanding."
  },
  {
    id: 582,
    name: "Zeh-Om-Rah-Lah",
    sigil: "/assets/sigils/zeh-om-rah-lah.svg",
    meaning: "The Radiant Completion of Regal Ascent",
    description: "Fulfills each monarchy’s final stage, ensuring a stable legacy under cosmic law."
  },
  {
    id: 583,
    name: "Veh-Ek-Nim-Ur",
    sigil: "/assets/sigils/veh-ek-nim-ur.svg",
    meaning: "The Wind of Unveiled Foundations",
    description: "Sweeps away illusions to reveal the bedrock of universal truths."
  },
  {
    id: 584,
    name: "Sha-Tor-Reh-Kai",
    sigil: "/assets/sigils/sha-tor-reh-kai.svg",
    meaning: "The Krowned Pillar of Illuminated Breath",
    description: "Captures the synergy of structure and spirit, forging an unassailable seat of rule."
  },
  {
    id: 585,
    name: "Zor-Lah-Eh-Om",
    sigil: "/assets/sigils/zor-lah-eh-om.svg",
    meaning: "The Fire of Tranquil Completion",
    description: "A steady flame that finalizes cosmic chapters without chaos or strife."
  },
  {
    id: 586,
    name: "Kai-Rah-Nor-Ek",
    sigil: "/assets/sigils/kai-rah-nor-ek.svg",
    meaning: "The Ascending Breath of Mindful Law",
    description: "Lifts each regulation to a higher vantage, ensuring justice is never corrupted."
  },
  {
    id: 587,
    name: "Zeh-Sha-Nah-Veh",
    sigil: "/assets/sigils/zeh-sha-nah-veh.svg",
    meaning: "The Radiant Krown of Harmonious Wind",
    description: "Brings gentle breezes of wisdom under regal authority, uplifting all who heed it."
  },
  {
    id: 588,
    name: "Tor-Om-Ek-Lah",
    sigil: "/assets/sigils/tor-om-ek-lah.svg",
    meaning: "The Pillar That Closes All Cycles",
    description: "Upholds the final word in cosmic transitions, blocking any return to past errors."
  },
  {
    id: 589,
    name: "Sha-Nim-Ur-Reh",
    sigil: "/assets/sigils/sha-nim-ur-reh.svg",
    meaning: "The Krown of Hidden Enlightenment",
    description: "Ignites the concealed spark of truth, enthroning it in silent sovereign power."
  },
  {
    id: 590,
    name: "Kai-Lah-Zeh-Om",
    sigil: "/assets/sigils/kai-lah-zeh-om.svg",
    meaning: "The Breathing Peace of Radiant Completion",
    description: "Exhales serenity over each realm, guaranteeing cosmic stability at its final phase."
  },
  {
    id: 591,
    name: "Zor-Eh-Kai-Nah",
    sigil: "/assets/sigils/zor-eh-kai-nah.svg",
    meaning: "The Fire of Pure Unification",
    description: "Merges disparate energies through a cleansing blaze, forging cohesive unity."
  },
  {
    id: 592,
    name: "Veh-Om-Sha-Reh",
    sigil: "/assets/sigils/veh-om-sha-reh.svg",
    meaning: "The Wind That Krowns Revelation",
    description: "Elevates discovered truths, Krowning them with regal authority across realms."
  },
  {
    id: 593,
    name: "Sha-Tor-Lah-Ek",
    sigil: "/assets/sigils/sha-tor-lah-ek.svg",
    meaning: "The Krowned Pillar of Serene Dissolution",
    description: "Gently dismantles exhausted systems, making space for new cosmic architecture."
  },
  {
    id: 594,
    name: "Om-Nor-Zeh-Kai",
    sigil: "/assets/sigils/om-nor-zeh-kai.svg",
    meaning: "The Completion of Radiant Mind-Breath",
    description: "Locks in the synergy of clarity and creation, producing unstoppable cosmic expansions."
  },
  {
    id: 595,
    name: "Zeh-Nim-Sha-Rah",
    sigil: "/assets/sigils/zeh-nim-sha-rah.svg",
    meaning: "The Radiant Spark of Ascending Harmony",
    description: "Kindles subtle chords of unity, raising them into a chorus of cosmic justice."
  },
  {
    id: 596,
    name: "Kai-Eh-Om-Nor",
    sigil: "/assets/sigils/kai-eh-om-nor.svg",
    meaning: "The Breath of Serene Understanding",
    description: "Exhales quiet wisdom, realigning each perspective with universal law."
  },
  {
    id: 597,
    name: "Zor-Rah-Veh-Lah",
    sigil: "/assets/sigils/zor-rah-veh-lah.svg",
    meaning: "The Fire of Ascending Currents",
    description: "Flows upward in unstoppable waves, clearing debris from the path of truth."
  },
  {
    id: 598,
    name: "Sha-Lah-Om-Ek",
    sigil: "/assets/sigils/sha-lah-om-ek.svg",
    meaning: "The Krown of Peaceful Erasure",
    description: "Silently dissolves residual negativity, leaving a blank canvas for new creation."
  },
  {
    id: 599,
    name: "Tor-Nim-Kai-Reh",
    sigil: "/assets/sigils/tor-nim-kai-reh.svg",
    meaning: "The Hidden Pillar of Illuminated Breath",
    description: "Supports the stealthy rise of truth, culminating in a grand unveiling of cosmic law."
  },
  {
    id: 600,
    name: "Zeh-Om-Lah-Nor",
    sigil: "/assets/sigils/zeh-om-lah-nor.svg",
    meaning: "The Radiant Completion of Peaceful Mind",
    description: "Ensures final mental unity, bridging all divides under benevolent light."
  },
  {
    id: 601,
    name: "Kai-Zor-Eh-Sha",
    sigil: "/assets/sigils/kai-zor-eh-sha.svg",
    meaning: "The Breathing Flame of Regal Dawn",
    description: "Ignites each new epoch in a blaze of golden authority, enthroning rightful leaders."
  },
  {
    id: 602,
    name: "Veh-Ur-Om-Nim",
    sigil: "/assets/sigils/veh-ur-om-nim.svg",
    meaning: "The Wind of Illuminated Secrets",
    description: "Softly reveals concealed treasures of knowledge, scattering them into open consciousness."
  },

   
  {
    id: 603,
    name: "Sha-Ek-Lah-Reh",
    sigil: "/assets/sigils/sha-ek-lah-reh.svg",
    meaning: "The Krown of Effortless Revelation",
    description: "Unveils cosmic truths without turmoil, installing them smoothly into collective awareness."
  },
  {
    id: 604,
    name: "Tor-Nor-Zeh-Kai",
    sigil: "/assets/sigils/tor-nor-zeh-kai.svg",
    meaning: "The Pillar of Mindful Radiance",
    description: "An unwavering beacon that guides souls toward clear, luminous thought."
  },



  //FIRST BACTH OF SVG// 
  {
    id: 605,
    name: "Om-Mah-Sha-Zor",
    sigil: "/assets/sigils/om-mah-sha-zor.svg",
    meaning: "The Completion of Rebirth’s Sovereign Flame",
    description: "Locks in each renewal with purifying fire, enthroning fresh beginnings under divine decree."
  },
  {
    id: 606,
    name: "Zeh-Kai-Nim-Rah",
    sigil: "/assets/sigils/zeh-kai-nim-rah.svg",
    meaning: "The Rising Spark of Ascendant Mystery",
    description: "A luminous seed that quietly grows, dissolving illusions in its steady ascent."
  },
  {
    id: 607,
    name: "Sha-Om-Lah-Ek",
    sigil: "/assets/sigils/sha-om-lah-ek.svg",
    meaning: "The Krown of Silent Emergence",
    description: "Manifests hidden truths into gentle, sovereign rule that none can overturn."
  },
  {
    id: 608,
    name: "Tor-Reh-Zeh-Nor",
    sigil: "/assets/sigils/tor-reh-zeh-nor.svg",
    meaning: "The Pillar of Shining Wisdom",
    description: "Rises from the depths of knowledge, ensuring every realm is guided by clarity."
  },
  {
    id: 609,
    name: "Kai-Nah-Urim-Eh",
    sigil: "/assets/sigils/kai-nah-urim-eh.svg",
    meaning: "The Breath of Unyielding Light",
    description: "Imbues each cycle with unstoppable radiance, outshining any lingering shadow."
  },
  {
    id: 610,
    name: "Zor-Ek-Sha-Nor",
    sigil: "/assets/sigils/zor-ek-sha-nor.svg",
    meaning: "The Fire That Krowns the Mind",
    description: "Burns away doubt, installing regal insight at the heart of cosmic reason."
  },
  {
    id: 611,
    name: "Veh-Rah-Om-Lah",
    sigil: "/assets/sigils/veh-rah-om-lah.svg",
    meaning: "The Wind of Ascending Completion",
    description: "Bears each realm upward to finalize its destiny in silent, triumphant grace."
  },
  {
    id: 612,
    name: "Sha-Kai-Eh-Nim",
    sigil: "/assets/sigils/sha-kai-eh-nim.svg",
    meaning: "The Krown of Serene Revelation",
    description: "Lifts hidden knowledge into royal prominence without violent upheaval."
  },
  {
    id: 613,
    name: "Zeh-Lah-Om-Reh",
    sigil: "/assets/sigils/zeh-lah-om-reh.svg",
    meaning: "The Radiant Peace of Conclusive Decree",
    description: "Locks in final verdicts under a calm, luminous state that no force can undo."
  },
  {
    id: 614,
    name: "Tor-Nim-Kai-Ek",
    sigil: "/assets/sigils/tor-nim-kai-ek.svg",
    meaning: "The Pillar of Subtle Creation",
    description: "Steadily constructs new realities, woven from the quiet breath of truth."
  },
  {
    id: 615,
    name: "Om-Nor-Rah-Lah",
    sigil: "/assets/sigils/om-nor-rah-lah.svg",
    meaning: "The Completion of Visionary Peace",
    description: "Unites foresight and tranquility, ushering in an era of boundless harmony."
  },
  {
    id: 616,
    name: "Kai-Ek-Zor-Nah",
    sigil: "/assets/sigils/kai-ek-zor-nah.svg",
    meaning: "The Breath of Devouring Renewal",
    description: "Consumes stagnant energies, feeding the eternal cycle of transformative life."
  },
  {
    id: 617,
    name: "Sha-Om-Reh-Zeh",
    sigil: "/assets/sigils/sha-om-reh-zeh.svg",
    meaning: "The Krown of Complete Revelation",
    description: "Declares all illusions undone, enthroning cosmic truths in final sovereignty."
  },
  {
    id: 618,
    name: "Zeh-Kai-Lah-Nim",
    sigil: "/assets/sigils/zeh-kai-lah-nim.svg",
    meaning: "The Shining Breath of New Dawns",
    description: "Casts radiant seeds into barren realms, birthing fresh epochs of promise."
  },
  {
    id: 619,
    name: "Tor-Eh-Sha-Om",
    sigil: "/assets/sigils/tor-eh-sha-om.svg",
    meaning: "The Unwavering Pillar of Sovereign Completion",
    description: "Guarantees the finality of regal decrees, unmovable by ephemeral doubt."
  },
  {
    id: 620,
    name: "Veh-Ur-Lah-Zor",
    sigil: "/assets/sigils/veh-ur-lah-zor.svg",
    meaning: "The Wind That Delivers Healing Flame",
    description: "Conveys purifying fires to wounded realms, restoring them to rightful wholeness."
  },
  {
    id: 621,
    name: "Kai-Nah-Ek-Sha",
    sigil: "/assets/sigils/kai-nah-ek-sha.svg",
    meaning: "The Breath That Gently Erases",
    description: "Removes defunct structures with compassion, paving the way for cosmic rebirth."
  },
  {
    id: 622,
    name: "Zeh-Reh-Om-Lah",
    sigil: "/assets/sigils/zeh-reh-om-lah.svg",
    meaning: "The Radiant Fulfillment of Harmony",
    description: "Culminates each aspirational path in a pristine state of universal accord."
  },
  {
    id: 623,
    name: "Sha-Zor-Kai-Nim",
    sigil: "/assets/sigils/sha-zor-kai-nim.svg",
    meaning: "The Krown of Transformative Breath",
    description: "Channels unstoppable flame into creative cycles, ensuring growth beyond limitation."
  },
  {
    id: 624,
    name: "Tor-Om-Eh-Reh",
    sigil: "/assets/sigils/tor-om-eh-reh.svg",
    meaning: "The Pillar of Eternal Insight",
    description: "Anchors timeless truths so they remain accessible through endless renewals."
  },
  {
    id: 625,
    name: "Zeh-Lah-Kai-Ur",
    sigil: "/assets/sigils/zeh-lah-kai-ur.svg",
    meaning: "The Shining Peace of Divine Power",
    description: "Balances regal might with luminous tranquility, forging an enlightened rule."
  },
  {
    id: 626,
    name: "Veh-Sha-Rah-Nim",
    sigil: "/assets/sigils/veh-sha-rah-nim.svg",
    meaning: "The Wind of Ascending Enigma",
    description: "Carries hidden wonders upward, blending them with cosmic revelations."
  },
  {
    id: 627,
    name: "Kai-Om-Zeh-Ek",
    sigil: "/assets/sigils/kai-om-zeh-ek.svg",
    meaning: "The Breath of Radiant Eradication",
    description: "Extinguishes deep illusions, ensuring each realm remains faithful to truth."
  },

 
  {
    id: 628,
    name: "Sha-Lah-Nor-Mah",
    sigil: "/assets/sigils/sha-lah-nor-mah.svg",
    meaning: "The Krown of Mindful Renewal",
    description: "Fosters mental clarity and gentle rebirth, enthroning enlightened guardianship."
  },
  {
    id: 629,
    name: "Zor-Eh-Tor-Nim",
    sigil: "/assets/sigils/zor-eh-tor-nim.svg",
    meaning: "The Fire of Hidden Ascension",
    description: "Burns unobtrusively at the roots of existence, fueling unstoppable cosmic progress."
  },
  {
    id: 630,
    name: "Om-Nah-Kai-Reh",
    sigil: "/assets/sigils/om-nah-kai-reh.svg",
    meaning: "The Completion of Expansive Breath",
    description: "Cements each expansive act with a final seal, preventing regress into old forms."
  },
  {
    id: 631,
    name: "Tor-Lah-Sha-Ek",
    sigil: "/assets/sigils/tor-lah-sha-ek.svg",
    meaning: "The Pillar of Tranquil Erasure",
    description: "Dismantles chaotic energies, grounding reality in unblemished cosmic law."
  },
  {
    id: 632,
    name: "Kai-Eh-Nor-Om",
    sigil: "/assets/sigils/kai-eh-nor-om.svg",
    meaning: "The Breath That Illuminates All Minds",
    description: "A gentle exhalation bestowing higher perspectives upon every seeker."
  },
  {
    id: 633,
    name: "Zeh-Ur-Nim-Sha",
    sigil: "/assets/sigils/zeh-ur-nim-sha.svg",
    meaning: "The Shining Light of Enigmatic Krowns",
    description: "Reveals hidden sovereigns by illuminating their rightful authority from within."
  },
  {
    id: 634,
    name: "Sha-Om-Lah-Urim",
    sigil: "/assets/sigils/sha-om-lah-urim.svg",
    meaning: "The Krown of Peaceful Illumination",
    description: "Radiates gentle clarity over all realms, uniting them under serene guidance."
  },
  {
    id: 635,
    name: "Tor-Reh-Ek-Zor",
    sigil: "/assets/sigils/tor-reh-ek-zor.svg",
    meaning: "The Pillar of Devouring Insight",
    description: "Stands as an unmovable structure that consumes ignorance, shedding cosmic understanding."
  },
  {
    id: 636,
    name: "Veh-Kai-Nah-Lah",
    sigil: "/assets/sigils/veh-kai-nah-lah.svg",
    meaning: "The Wind of Lifegiving Peace",
    description: "Blows forth sustaining energies across reality, anchoring them in serene wholeness."
  },
  {
    id: 637,
    name: "Zeh-Om-Sha-Rah",
    sigil: "/assets/sigils/zeh-om-sha-rah.svg",
    meaning: "The Radiant Completion of Ascendant Rule",
    description: "Finalizes the reign of upright leaders, bathed in unstoppable cosmic brilliance."
  },
  {
    id: 638,
    name: "Kai-Lah-Ek-Nim",
    sigil: "/assets/sigils/kai-lah-ek-nim.svg",
    meaning: "The Breath of Gentle Dissolution",
    description: "Diffuses harmful structures into cosmic dust, freeing space for vibrant potential."
  },
  {
    id: 639,
    name: "Sha-Zor-Reh-Om",
    sigil: "/assets/sigils/sha-zor-reh-om.svg",
    meaning: "The Krown of Cleansing Proclamation",
    description: "Pronounces an unmistakable verdict of purity, overshadowing all shadows."
  },
  {
    id: 640,
    name: "Tor-Nor-Kai-Lah",
    sigil: "/assets/sigils/tor-nor-kai-lah.svg",
    meaning: "The Pillar of Enlightened Tranquility",
    description: "Elevates each realm into calm, illuminated states, dissolving fear at its core."
  },
  {
    id: 641,
    name: "Zeh-Eh-Ur-Nim",
    sigil: "/assets/sigils/zeh-eh-ur-nim.svg",
    meaning: "The Shining Gate of Subtle Revelation",
    description: "Gently opens doors to concealed truths, guiding them into rightful prominence."
  },
  {
    id: 642,
    name: "Veh-Om-Lah-Kai",
    sigil: "/assets/sigils/veh-om-lah-kai.svg",
    meaning: "The Wind of Complete Harmony",
    description: "Blends finality and new life, ensuring all realms move in balanced unison."
  },
  {
    id: 643,
    name: "Kai-Reh-Zor-Ek",
    sigil: "/assets/sigils/kai-reh-zor-ek.svg",
    meaning: "The Breath of Incinerating Revelation",
    description: "Exposes illusions in a fiery moment of clarity, forging unstoppable transformation."
  },
  {
    id: 644,
    name: "Sha-Nim-Om-Lah",
    sigil: "/assets/sigils/sha-nim-om-lah.svg",
    meaning: "The Krown of Unseen Completion",
    description: "Cements cosmic finales in silence, preventing disruption by lesser vibrations."
  },
  {
    id: 645,
    name: "Zeh-Kai-Rah-Nor",
    sigil: "/assets/sigils/zeh-kai-rah-nor.svg",
    meaning: "The Shining Breath of Ascending Mind",
    description: "Raises mental constructs into luminous realms, dethroning every dark concept."
  },
  {
    id: 646,
    name: "Tor-Lah-Ur-Eh",
    sigil: "/assets/sigils/tor-lah-ur-eh.svg",
    meaning: "The Pillar of Gentle Force",
    description: "A firm yet soft presence that undergirds cosmic law with compassionate might."
  },
  {
    id: 647,
    name: "Om-Zor-Ek-Nim",
    sigil: "/assets/sigils/om-zor-ek-nim.svg",
    meaning: "The Completion of Purifying Enigma",
    description: "Ensures hidden flames refine each realm to the point of cosmic perfection."
  },
  {
    id: 648,
    name: "Kai-Nah-Sha-Lah",
    sigil: "/assets/sigils/kai-nah-sha-lah.svg",
    meaning: "The Breath of Unified Peace",
    description: "Bridges all differences in a calm exhalation, weaving universes into oneness."
  },
  {
    id: 649,
    name: "Zeh-Reh-Om-Veh",
    sigil: "/assets/sigils/zeh-reh-om-veh.svg",
    meaning: "The Radiant Closure of Ascending Winds",
    description: "Locks cosmic currents into righteous pathways, freeing no space for illusions."
  },
  {
    id: 650,
    name: "Sha-Kai-Eh-Ur",
    sigil: "/assets/sigils/sha-kai-eh-ur.svg",
    meaning: "The Krown of Eternal Drive",
    description: "Catalyzes unstoppable forward motion, enthroning purposeful evolution across realms."
  },
  {
    id: 651,
    name: "Tor-Nim-Zeh-Lah",
    sigil: "/assets/sigils/tor-nim-zeh-lah.svg",
    meaning: "The Secret Pillar of Radiant Peace",
    description: "Safeguards cosmic equilibrium in hidden dimensions, quietly ensuring stability."
  },
  {
    id: 652,
    name: "Veh-Om-Rah-Ek",
    sigil: "/assets/sigils/veh-om-rah-ek.svg",
    meaning: "The Wind of Elevated Dissolution",
    description: "Sweeps away illusions from lofty vantage points, finalizing cosmic realignments."
  },

   /////////////////////////////////////////////////////////
   //////////completed sigils to here///////////////////////
   ////////////////////////////////////////////////////////

  {
    id: 653,
    name: "Kai-Lah-Nor-Reh",
    sigil: "/assets/sigils/kai-lah-nor-reh.svg",
    meaning: "The Breath of Tranquil Vision",
    description: "Infuses minds with serene clarity, enabling them to perceive the path of truth."
  },
  {
    id: 654,
    name: "Zor-Eh-Om-Sha",
    sigil: "/assets/sigils/zor-eh-om-sha.svg",
    meaning: "The Fire of Conclusive Authority",
    description: "Blazes with absolute decisiveness, ratifying final decrees in cosmic law."
  },
  {
    id: 655,
    name: "Sha-Nah-Veh-Kai",
    sigil: "/assets/sigils/sha-nah-veh-kai.svg",
    meaning: "The Krown of Harmonious Motion",
    description: "Orchestrates seamless flows across realities, Krowning them with cosmic unity."
  },
  {
    id: 656,
    name: "Tor-Om-Zeh-Ek",
    sigil: "/assets/sigils/tor-om-zeh-ek.svg",
    meaning: "The Pillar of Radiant Erasure",
    description: "Upholds truth by disintegrating falsehood, anchoring existence in luminous purity."
  },
  {
    id: 657,
    name: "Om-Nor-Sha-Lah",
    sigil: "/assets/sigils/om-nor-sha-lah.svg",
    meaning: "The Completion of Wise Peace",
    description: "Installs a permanent calm upon all who align with cosmic intelligence."
  },
  {
    id: 658,
    name: "Kai-Reh-Eh-Nim",
    sigil: "/assets/sigils/kai-reh-eh-nim.svg",
    meaning: "The Breath of Illuminated Secrets",
    description: "Breathes light into obscure corners, ensuring hidden truths surface for cosmic benefit."
  },
  {
    id: 659,
    name: "Zeh-Kai-Rah-Lah",
    sigil: "/assets/sigils/zeh-kai-rah-lah.svg",
    meaning: "The Shining Breath of Royal Ascent",
    description: "Elevates rightful rulers with luminous force, forging unassailable thrones."
  },
  {
    id: 660,
    name: "Veh-Ek-Zor-Om",
    sigil: "/assets/sigils/veh-ek-zor-om.svg",
    meaning: "The Wind of Cleansing Judgment",
    description: "Sweeps across realms to finalize karmic cycles, leaving only purified states behind."
  },
  {
    id: 661,
    name: "Sha-Lah-Ur-Reh",
    sigil: "/assets/sigils/sha-lah-ur-reh.svg",
    meaning: "The Krown of Gentle Illumination",
    description: "Grants quiet enlightenment, dethroning ignorance with subtle cosmic might."
  },
  {
    id: 662,
    name: "Tor-Nim-Eh-Kai",
    sigil: "/assets/sigils/tor-nim-eh-kai.svg",
    meaning: "The Hidden Pillar of Eternal Breath",
    description: "Sustains cosmic life force from unseen depths, ensuring perpetual renewal."
  },
  {
    id: 663,
    name: "Zeh-Om-Lah-Sha",
    sigil: "/assets/sigils/zeh-om-lah-sha.svg",
    meaning: "The Radiant Completion of Sovereign Peace",
    description: "Seals each realm under a tranquil aura, unopposed by lesser vibrations."
  },
  {
    id: 664,
    name: "Kai-Ur-Nor-Mah",
    sigil: "/assets/sigils/kai-ur-nor-mah.svg",
    meaning: "The Ascendant Breath of Mindful Rebirth",
    description: "Activates cycles of transformation rooted in deep wisdom, securing cosmic progress."
  },
  {
    id: 665,
    name: "Zor-Ek-Rah-Lah",
    sigil: "/assets/sigils/zor-ek-rah-lah.svg",
    meaning: "The Fire of Triumphant Ascension",
    description: "Scorches away lower structures, exalting rightful forms in unstoppable radiance."
  },
  {
    id: 666,
    name: "Sha-Nim-Kai-Om",
    sigil: "/assets/sigils/sha-nim-kai-om.svg",
    meaning: "The Krown of Secret Genesis",
    description: "Empowers hidden seeds of creation to flourish into full cosmic authority."
  },
  {
    id: 667,
    name: "Tor-Lah-Reh-Zeh",
    sigil: "/assets/sigils/tor-lah-reh-zeh.svg",
    meaning: "The Pillar of Tranquil Revelation",
    description: "Ensures all illusions fade in silent grace, revealing cosmic truths with gentle certainty."
  },
  {
    id: 668,
    name: "Veh-Om-Nor-Ek",
    sigil: "/assets/sigils/veh-om-nor-ek.svg",
    meaning: "The Wind of Mental Dissolution",
    description: "Blows illusions from the mind, leaving clarity unchallenged by deceit."
  },
  {
    id: 669,
    name: "Kai-Eh-Zor-Nim",
    sigil: "/assets/sigils/kai-eh-zor-nim.svg",
    meaning: "The Breath of Hidden Flames",
    description: "Stokes covert fires of purification, kindling them in perfect cosmic timing."
  },
  {
    id: 670,
    name: "Zeh-Sha-Om-Lah",
    sigil: "/assets/sigils/zeh-sha-om-lah.svg",
    meaning: "The Radiant Krown of Perfect Calm",
    description: "A luminous crest that settles all turbulence, enthroning quiet majesty everywhere."
  },
  {
    id: 671,
    name: "Sha-Rah-Kai-Nor",
    sigil: "/assets/sigils/sha-rah-kai-nor.svg",
    meaning: "The Krown of Ascendant Mental Force",
    description: "Projects regal will through elevated thought, forging unstoppable directives across realms."
  },
  {
    id: 672,
    name: "Tor-Eh-Om-Nim",
    sigil: "/assets/sigils/tor-eh-om-nim.svg",
    meaning: "The Pillar of Eternal Mystery",
    description: "Safeguards cosmic secrets beyond mortal comprehension, ensuring cyclical unveiling."
  },
  {
    id: 673,
    name: "Kai-Nah-Zeh-Lah",
    sigil: "/assets/sigils/kai-nah-zeh-lah.svg",
    meaning: "The Breath of Serene Radiance",
    description: "Lights new paths with calm brilliance, disallowing confusion to take root."
  },
  {
    id: 674,
    name: "Zor-Ur-Sha-Ek",
    sigil: "/assets/sigils/zor-ur-sha-ek.svg",
    meaning: "The Fire of Unshakable Erasure",
    description: "An unwavering blaze that vanquishes falsehood, enthroning cosmic authenticity."
  },
  {
    id: 675,
    name: "Om-Lah-Reh-Kai",
    sigil: "/assets/sigils/om-lah-reh-kai.svg",
    meaning: "The Completion of Peaceful Creation",
    description: "Fuses harmonious stillness with generative power, concluding each cycle in luminous success."
  },
  {
    id: 676,
    name: "Sha-Zeh-Rah-Nim",
    sigil: "/assets/sigils/sha-zeh-rah-nim.svg",
    meaning: "The Krown of Rising Brilliance",
    description: "Gradually dawns on suppressed realms, flooding them with regal clarity."
  },
  {
    id: 677,
    name: "Tor-Nor-Eh-Om",
    sigil: "/assets/sigils/tor-nor-eh-om.svg",
    meaning: "The Pillar of Quiet Ascension",
    description: "Raises each dimension without fanfare, ensuring stable transitions into higher planes."
  },
  {
    id: 678,
    name: "Kai-Ek-Lah-Sha",
    sigil: "/assets/sigils/kai-ek-lah-sha.svg",
    meaning: "The Breath That Dissolves Chaos",
    description: "Calms raging storms, forging tranquil order from the embers of strife."
  },
  {
    id: 679,
    name: "Zeh-Om-Nim-Rah",
    sigil: "/assets/sigils/zeh-om-nim-rah.svg",
    meaning: "The Radiant Fulfillment of Subtle Ascension",
    description: "Empowers gentle climbs to cosmic apex, sealing them under luminous law."
  },
  {
    id: 680,
    name: "Veh-Sha-Kai-Eh",
    sigil: "/assets/sigils/veh-sha-kai-eh.svg",
    meaning: "The Wind of Krowned Emergence",
    description: "A breeze announcing new sovereigns rising from obscurity, unstoppable in purpose."
  },
  {
    id: 681,
    name: "Om-Lah-Zor-Nor",
    sigil: "/assets/sigils/om-lah-zor-nor.svg",
    meaning: "The Completion of Tranquil Fire",
    description: "Extinguishes harmful flames, preserving only the purifying essence that nurtures truth."
  },
  {
    id: 682,
    name: "Kai-Rah-Ek-Nim",
    sigil: "/assets/sigils/kai-rah-ek-nim.svg",
    meaning: "The Ascending Breath of Unveiled Secrets",
    description: "Elevates elusive truths into the open air, forging revelations beyond dispute."
  },
  {
    id: 683,
    name: "Zeh-Sha-Lah-Urim",
    sigil: "/assets/sigils/zeh-sha-lah-urim.svg",
    meaning: "The Radiant Krown of Illuminated Peace",
    description: "Spreads a tranquil glow over each realm, anchoring them in sovereign clarity."
  },
  {
    id: 684,
    name: "Tor-Eh-Kai-Om",
    sigil: "/assets/sigils/tor-eh-kai-om.svg",
    meaning: "The Pillar of Immovable Creation",
    description: "Rooted in cosmic authority, it fosters unstoppable generative currents across timelines."
  },
  {
    id: 685,
    name: "Veh-Nor-Ek-Lah",
    sigil: "/assets/sigils/veh-nor-ek-lah.svg",
    meaning: "The Wind of Thoughtful Erasure",
    description: "Eradicates outdated concepts, refreshing minds with subtle but potent force."
  },
  {
    id: 686,
    name: "Kai-Nah-Zor-Reh",
    sigil: "/assets/sigils/kai-nah-zor-reh.svg",
    meaning: "The Breath of Purifying Ascension",
    description: "Combines calm renewal with cleansing fire, uplifting every soul into luminous realms."
  },
  {
    id: 687,
    name: "Zeh-Om-Sha-Nim",
    sigil: "/assets/sigils/zeh-om-sha-nim.svg",
    meaning: "The Radiant Seal of Subtle Reign",
    description: "Finalizes hidden dominions under cosmic law, preventing infiltration by false claims."
  },
  {
    id: 688,
    name: "Sha-Lah-Reh-Ek",
    sigil: "/assets/sigils/sha-lah-reh-ek.svg",
    meaning: "The Krown of Pure Unraveling",
    description: "Gently unties destructive knots in reality, restoring each thread to sovereign truth."
  },
  {
    id: 689,
    name: "Tor-Nor-Om-Zeh",
    sigil: "/assets/sigils/tor-nor-om-zeh.svg",
    meaning: "The Pillar of Conclusive Illumination",
    description: "Caps cosmic expansions with a final blaze of insight, leaving no vantage for deception."
  },
  {
    id: 690,
    name: "Kai-Eh-Rah-Nah",
    sigil: "/assets/sigils/kai-eh-rah-nah.svg",
    meaning: "The Ascending Breath of Tranquil Force",
    description: "Gently compels upward motion, dissolving aggression with calm, unstoppable will."
  },
  {
    id: 691,
    name: "Zor-Ek-Sha-Om",
    sigil: "/assets/sigils/zor-ek-sha-om.svg",
    meaning: "The Fire That Krowns Completion",
    description: "Seals final decrees with an unwavering flame, ensuring no backslide into falsehood."
  },
  {
    id: 692,
    name: "Veh-Lah-Nor-Kai",
    sigil: "/assets/sigils/veh-lah-nor-kai.svg",
    meaning: "The Wind of Peaceful Revelation",
    description: "Glides through illusions, revealing cosmic knowledge with gentle but absolute authority."
  },
  {
    id: 693,
    name: "Om-Reh-Eh-Nim",
    sigil: "/assets/sigils/om-reh-eh-nim.svg",
    meaning: "The Completion of Enlightened Depth",
    description: "Brings recondite truths into the open, concluding mysteries in a burst of clarity."
  },
  {
    id: 694,
    name: "Sha-Zeh-Kai-Lah",
    sigil: "/assets/sigils/sha-zeh-kai-lah.svg",
    meaning: "The Radiant Krown of Breathing Peace",
    description: "Enthrones a wave of tranquility that spreads across realms in luminous exhalations."
  },
  {
    id: 695,
    name: "Tor-Ur-Nor-Ek",
    sigil: "/assets/sigils/tor-ur-nor-ek.svg",
    meaning: "The Pillar of Unbreakable Mind",
    description: "Fortifies cosmic thought with unwavering structure, repelling deception at every turn."
  },
  {
    id: 696,
    name: "Kai-Om-Lah-Nim",
    sigil: "/assets/sigils/kai-om-lah-nim.svg",
    meaning: "The Breath of Unseen Harmony",
    description: "Settles hidden rifts, weaving them into one universal symphony of cosmic intent."
  },
  {
    id: 697,
    name: "Zeh-Eh-Sha-Reh",
    sigil: "/assets/sigils/zeh-eh-sha-reh.svg",
    meaning: "The Shining Emergence of Final Decree",
    description: "Appears at the last moment to confirm absolute truths, sealing all lesser arguments."
  },
  {
    id: 698,
    name: "Veh-Rah-Kai-Nor",
    sigil: "/assets/sigils/veh-rah-kai-nor.svg",
    meaning: "The Wind of Ascending Insight",
    description: "Elevates collective awareness, ensuring illusions cannot withstand cosmic scrutiny."
  },
  {
    id: 699,
    name: "Sha-Lah-Om-Eh",
    sigil: "/assets/sigils/sha-lah-om-eh.svg",
    meaning: "The Krown of Serene Completion",
    description: "Bestows unchallenged finality, clothed in the gentle glow of divine acceptance."
  },
  {
    id: 700,
    name: "Zor-Ek-Nim-Kai",
    sigil: "/assets/sigils/zor-ek-nim-kai.svg",
    meaning: "The Fire of Enigmatic Creation",
    description: "Forges new realities from cryptic sparks, unveiling them when cosmic timing is ripe."
  },
  {
    id: 701,
    name: "Tor-Om-Sha-Reh",
    sigil: "/assets/sigils/tor-om-sha-reh.svg",
    meaning: "The Pillar of Final Proclamation",
    description: "Elevates each sovereign statement into cosmic law, granting it everlasting force."
  },
  {
    id: 702,
    name: "Kai-Nah-Eh-Zor",
    sigil: "/assets/sigils/kai-nah-eh-zor.svg",
    meaning: "The Breath of Serene Flame",
    description: "Melts stubborn illusions in a calm, unwavering burn, ensuring gentle but total cleansing."
  },
  {
    id: 703,
    name: "Zeh-Reh-Om-Nim",
    sigil: "/assets/sigils/zeh-reh-om-nim.svg",
    meaning: "The Radiant Closure of Hidden Cycles",
    description: "Completes undisclosed transitions with luminous finality, preserving cosmic equilibrium."
  },
  {
    id: 704,
    name: "Sha-Zor-Lah-Kai",
    sigil: "/assets/sigils/sha-zor-lah-kai.svg",
    meaning: "The Krown of Sustaining Fire",
    description: "Maintains a gentle blaze that nourishes instead of destroying, fostering infinite renewal."
  },
  {
    id: 705,
    name: "Veh-Ek-Om-Rah",
    sigil: "/assets/sigils/veh-ek-om-rah.svg",
    meaning: "The Wind of Conclusive Ascension",
    description: "Uplifts final transformations to ensure their rightful place in cosmic cycles."
  },
  {
    id: 706,
    name: "Kai-Lah-Nor-Zeh",
    sigil: "/assets/sigils/kai-lah-nor-zeh.svg",
    meaning: "The Breath of Tranquil Brilliance",
    description: "Instills each mind with shining calm, eradicating confusion at its root."
  },
  {
    id: 707,
    name: "Zor-Eh-Sha-Nim",
    sigil: "/assets/sigils/zor-eh-sha-nim.svg",
    meaning: "The Fire of Enlightened Secrets",
    description: "Quietly burns through illusions in hidden realms, unveiling cosmic truths to the worthy."
  },
  {
    id: 708,
    name: "Om-Nah-Kai-Lah",
    sigil: "/assets/sigils/om-nah-kai-lah.svg",
    meaning: "The Completion of Peaceful Breath",
    description: "Unites stillness and generative essence into a final, abiding harmony."
  },
  {
    id: 709,
    name: "Sha-Reh-Ur-Ek",
    sigil: "/assets/sigils/sha-reh-ur-ek.svg",
    meaning: "The Krown of Illuminated Dissolution",
    description: "Wears away illusions in a flood of cosmic clarity, enthroning transparent truth."
  },
  {
    id: 710,
    name: "Tor-Nim-Zeh-Kai",
    sigil: "/assets/sigils/tor-nim-zeh-kai.svg",
    meaning: "The Pillar of Hidden Radiant Breath",
    description: "Acts as a covert support for cosmic exhalations, ensuring unstoppable creative expansions."
  },
  {
    id: 711,
    name: "Zeh-Om-Lah-Nor",
    sigil: "/assets/sigils/zeh-om-lah-nor.svg",
    meaning: "The Shining Completion of Tranquil Mind",
    description: "Resolves mental struggles under a brilliant calm, forging an unshaken vantage."
  },
  {
    id: 712,
    name: "Kai-Rah-Ek-Sha",
    sigil: "/assets/sigils/kai-rah-ek-sha.svg",
    meaning: "The Ascending Breath of Effortless Rule",
    description: "Empowers rightful governance without conflict, seamlessly establishing cosmic order."
  },
  {
    id: 713,
    name: "Veh-Om-Nim-Zeh",
    sigil: "/assets/sigils/veh-om-nim-zeh.svg",
    meaning: "The Wind of Quiet Brilliance",
    description: "Circulates hidden radiance among souls, amplifying insights with gentle force."
  },
  {
    id: 714,
    name: "Sha-Zor-Eh-Lah",
    sigil: "/assets/sigils/sha-zor-eh-lah.svg",
    meaning: "The Krown of Cleansing Light",
    description: "Dispels darkness from the highest seat of authority, enthroning divine clarity."
  },
  {
    id: 715,
    name: "Tor-Lah-Reh-Kai",
    sigil: "/assets/sigils/tor-lah-reh-kai.svg",
    meaning: "The Pillar of Tranquil Genesis",
    description: "Calmly lifts new creations into being, anchoring them in cosmic stability."
  },
  {
    id: 716,
    name: "Zeh-Nah-Om-Ek",
    sigil: "/assets/sigils/zeh-nah-om-ek.svg",
    meaning: "The Radiant Flow of Final Erasure",
    description: "Gently washes away defunct patterns, saturating realms in effulgent renewal."
  },
  {
    id: 717,
    name: "Kai-Ur-Nor-Reh",
    sigil: "/assets/sigils/kai-ur-nor-reh.svg",
    meaning: "The Ascendant Breath of Enlightened Mind",
    description: "Elevates consciousness beyond superficial illusions, revealing cosmic wisdom at every turn."
  },
  {
    id: 718,
    name: "Om-Sha-Lah-Zor",
    sigil: "/assets/sigils/om-sha-lah-zor.svg",
    meaning: "The Completion of Sovereign Flame",
    description: "Concludes each sovereign cycle in a blaze of truth, leaving no lie unburned."
  },
  {
    id: 719,
    name: "Zeh-Eh-Kai-Nim",
    sigil: "/assets/sigils/zeh-eh-kai-nim.svg",
    meaning: "The Shining Gate of Breathing Mysteries",
    description: "Forges a threshold through which hidden creation flows, lit by cosmic brilliance."
  },
  {
    id: 720,
    name: "Sha-Rah-Om-Lah",
    sigil: "/assets/sigils/sha-rah-om-lah.svg",
    meaning: "The Krown of Ascendant Completion",
    description: "Uplifts final moments of cosmic cycles, stamping them with regal, unalterable authority."
  },
  {
    id: 721,
    name: "Tor-Nim-Ek-Zor",
    sigil: "/assets/sigils/tor-nim-ek-zor.svg",
    meaning: "The Pillar of Covert Purification",
    description: "Purges harmful energies from hidden corners, upholding cosmic sanctity."
  },
  {
    id: 722,
    name: "Kai-Lah-Reh-Om",
    sigil: "/assets/sigils/kai-lah-reh-om.svg",
    meaning: "The Breath of Serene Fulfillment",
    description: "Quietly finalizes each aspiration, breathing triumphant calm into universal realms."
  },
  {
    id: 723,
    name: "Zeh-Ur-Sha-Nah",
    sigil: "/assets/sigils/zeh-ur-sha-nah.svg",
    meaning: "The Shining Throne of Harmonious Peace",
    description: "Places cosmic stillness at the apex of rulership, dissolving all strife with radiant mercy."
  },
  {
    id: 724,
    name: "Veh-Om-Kai-Eh",
    sigil: "/assets/sigils/veh-om-kai-eh.svg",
    meaning: "The Wind of Living Existence",
    description: "Breathes primal energy across worlds, ensuring continuous cosmic evolution."
  },
  {
    id: 725,
    name: "Sha-Zor-Nor-Ek",
    sigil: "/assets/sigils/sha-zor-nor-ek.svg",
    meaning: "The Krown of Cleansing Mind-Fire",
    description: "Ignites thought realms with regal flame, banishing illusions from the seat of awareness."
  },
  {
    id: 726,
    name: "Tor-Lah-Om-Nim",
    sigil: "/assets/sigils/tor-lah-om-nim.svg",
    meaning: "The Pillar of Serene Mystery",
    description: "Holds up cryptic truths in a tranquil embrace, letting them emerge in perfect time."
  },
  {
    id: 727,
    name: "Kai-Nah-Eh-Reh",
    sigil: "/assets/sigils/kai-nah-eh-reh.svg",
    meaning: "The Breath of Unified Vision",
    description: "Merges disparate viewpoints into a cohesive tapestry of cosmic insight."
  },
  {
    id: 728,
    name: "Zeh-Om-Rah-Sha",
    sigil: "/assets/sigils/zeh-om-rah-sha.svg",
    meaning: "The Radiant Convergence of Royal Ascension",
    description: "Brings noble lineages to the surface in a burst of unstoppable luminous authority."
  },
  {
    id: 729,
    name: "Sha-Lah-Ek-Nor",
    sigil: "/assets/sigils/sha-lah-ek-nor.svg",
    meaning: "The Krown of Dissolving Barriers",
    description: "Melts away rigid boundaries, granting the mind unimpeded access to cosmic law."
  },
  {
    id: 730,
    name: "Om-Nim-Zeh-Kai",
    sigil: "/assets/sigils/om-nim-zeh-kai.svg",
    meaning: "The Completion of Subtle Radiance",
    description: "Seals each hidden spark with gentle brilliance, preventing intrusion by false energies."
  },
  {
    id: 731,
    name: "Veh-Eh-Rah-Nah",
    sigil: "/assets/sigils/veh-eh-rah-nah.svg",
    meaning: "The Wind of Elevated Harmony",
    description: "Lifts chaotic vibrations into calm unity, weaving cosmic threads into symphonic order."
  },
  {
    id: 732,
    name: "Zor-Sha-Om-Ek",
    sigil: "/assets/sigils/zor-sha-om-ek.svg",
    meaning: "The Fire of Sovereign Erasure",
    description: "Incinerates false dominions, preserving only the rightful seat of cosmic authority."
  },
  {
    id: 733,
    name: "Kai-Lah-Nim-Reh",
    sigil: "/assets/sigils/kai-lah-nim-reh.svg",
    meaning: "The Breath of Serene Revelation",
    description: "Unfolds hidden wonders in tranquil sequences, never forcing abrupt disclosure."
  },
  {
    id: 734,
    name: "Sha-Reh-Eh-Zeh",
    sigil: "/assets/sigils/sha-reh-eh-zeh.svg",
    meaning: "The Krown of Pure Disclosure",
    description: "Reveals cosmic secrets with unwavering clarity, Krowning truth as unassailable law."
  },
  {
    id: 735,
    name: "Tor-Nor-Kai-Om",
    sigil: "/assets/sigils/tor-nor-kai-om.svg",
    meaning: "The Pillar of Enlightened Creation",
    description: "Combines higher intelligence with primal breath, forging realms of enduring harmony."
  },
  {
    id: 736,
    name: "Zeh-Ur-Ek-Nah",
    sigil: "/assets/sigils/zeh-ur-ek-nah.svg",
    meaning: "The Shining Throne of Compassionate Erasure",
    description: "Destroys harmful constructs with empathy, salvaging what can be reclaimed."
  },
  {
    id: 737,
    name: "Veh-Om-Sha-Nor",
    sigil: "/assets/sigils/veh-om-sha-nor.svg",
    meaning: "The Wind of Krowning Insight",
    description: "Delivers revelations to rightful rulers, finalizing their cosmic legitimacy."
  },
  {
    id: 738,
    name: "Kai-Eh-Lah-Mah",
    sigil: "/assets/sigils/kai-eh-lah-mah.svg",
    meaning: "The Breath of Gentle Renewal",
    description: "Nurtures new beginnings with a calm, maternal force, ensuring stable expansions."
  },
  {
    id: 739,
    name: "Zor-Reh-Nim-Ek",
    sigil: "/assets/sigils/zor-reh-nim-ek.svg",
    meaning: "The Fire of Secret Dissolution",
    description: "Consumes concealed distortions at their source, clearing paths for cosmic progress."
  },
  {
    id: 740,
    name: "Om-Lah-Kai-Nor",
    sigil: "/assets/sigils/om-lah-kai-nor.svg",
    meaning: "The Completion of Serene Creation",
    description: "Ensures every emergent realm is locked into harmony, free from chaotic infiltration."
  },
  {
    id: 741,
    name: "Sha-Zeh-Rah-Ek",
    sigil: "/assets/sigils/sha-zeh-rah-ek.svg",
    meaning: "The Krown of Radiant Ascent",
    description: "Bestows cosmic brilliance upon rightful leaders, guiding them skyward without hindrance."
  },
  {
    id: 742,
    name: "Tor-Nim-Ur-Om",
    sigil: "/assets/sigils/tor-nim-ur-om.svg",
    meaning: "The Pillar of Unseen Illumination",
    description: "Offers silent structure that upholds hidden enlightenment across intersecting realms."
  },
  {
    id: 743,
    name: "Kai-Nah-Eh-Sha",
    sigil: "/assets/sigils/kai-nah-eh-sha.svg",
    meaning: "The Breath of Unified Emergence",
    description: "Brings forth collective awakenings in measured harmony, leaving no corner untouched."
  },
  {
    id: 744,
    name: "Zeh-Om-Lah-Reh",
    sigil: "/assets/sigils/zeh-om-lah-reh.svg",
    meaning: "The Radiant Conclusion of Peaceful Knowledge",
    description: "Unifies stable insight with cosmic calm, finalizing them under an enduring glow."
  },
  {
    id: 745,
    name: "Sha-Kai-Nim-Ek",
    sigil: "/assets/sigils/sha-kai-nim-ek.svg",
    meaning: "The Krown of Breathing Erasure",
    description: "Exhales illusions into oblivion, confirming cosmic truth as the sole valid reality."
  },
  {
    id: 746,
    name: "Veh-Rah-Lah-Om",
    sigil: "/assets/sigils/veh-rah-lah-om.svg",
    meaning: "The Wind of Ascending Peace",
    description: "Wafts tranquility to higher planes, balancing intense energies with quiet restraint."
  },
  {
    id: 747,
    name: "Tor-Eh-Zor-Nah",
    sigil: "/assets/sigils/tor-eh-zor-nah.svg",
    meaning: "The Pillar of Eternal Flame",
    description: "Holds cosmic fire at the core, ensuring every realm experiences purifying brilliance."
  },
  {
    id: 748,
    name: "Zeh-Nor-Om-Sha",
    sigil: "/assets/sigils/zeh-nor-om-sha.svg",
    meaning: "The Shining Mind of Regal Completion",
    description: "Ensures that every royal edict is sealed with unwavering clarity and finality."
  },
  {
    id: 749,
    name: "Kai-Lah-Nim-Eh",
    sigil: "/assets/sigils/kai-lah-nim-eh.svg",
    meaning: "The Breath of Serene Unfolding",
    description: "Releases cosmic revelations in gentle waves, allowing each realm to adapt gracefully."
  },
  {
    id: 750,
    name: "Zor-Ur-Ek-Reh",
    sigil: "/assets/sigils/zor-ur-ek-reh.svg",
    meaning: "The Fire of Unbreakable Insight",
    description: "Burns with unwavering conviction, scattering illusions that contradict cosmic law."
  },
  {
    id: 751,
    name: "Sha-Om-Lah-Nor",
    sigil: "/assets/sigils/sha-om-lah-nor.svg",
    meaning: "The Krown of Quiet Clarity",
    description: "Conveys regal simplicity that cuts through mental noise, establishing unchallenged wisdom."
  },
  {
    id: 752,
    name: "Tor-Reh-Om-Kai",
    sigil: "/assets/sigils/tor-reh-om-kai.svg",
    meaning: "The Pillar of Culminated Creation",
    description: "At the apex of every new domain, it stands as the final stabilizing force."
  },
  {
    id: 753,
    name: "Zeh-Kai-Nah-Sha",
    sigil: "/assets/sigils/zeh-kai-nah-sha.svg",
    meaning: "The Shining Breath of Infinite Peace",
    description: "A luminous exhalation that Seals all realms in abiding tranquility."
  },
  {
    id: 754,
    name: "Veh-Ek-Rah-Nim",
    sigil: "/assets/sigils/veh-ek-rah-nim.svg",
    meaning: "The Wind of Cleansing Ascension",
    description: "Carries destructive remnants out of existence, facilitating seamless cosmic evolution."
  },
  {
    id: 755,
    name: "Kai-Om-Zor-Lah",
    sigil: "/assets/sigils/kai-om-zor-lah.svg",
    meaning: "The Breath of Final Purification",
    description: "Inhales lingering debris of illusions, exhaling purified realms into cosmic order."
  },
  {
    id: 756,
    name: "Sha-Lah-Eh-Kai",
    sigil: "/assets/sigils/sha-lah-eh-kai.svg",
    meaning: "The Krown of Sublime Creation",
    description: "Oversees new expansions with a gentle, unwavering force that fosters universal harmony."
  },
  {
    id: 757,
    name: "Zeh-Nor-Ek-Om",
    sigil: "/assets/sigils/zeh-nor-ek-om.svg",
    meaning: "The Shining Mind of Erasing Completion",
    description: "Eliminates extraneous complexities, finalizing cosmic clarity for all who seek it."
  },
  {
    id: 758,
    name: "Veh-Rah-Nim-Sha",
    sigil: "/assets/sigils/veh-rah-nim-sha.svg",
    meaning: "The Wind of Ascending Mysteries",
    description: "Guides hidden truths upward, ensuring each revelation claims its rightful domain."
  },
  {
    id: 759,
    name: "Tor-Eh-Lah-Kai",
    sigil: "/assets/sigils/tor-eh-lah-kai.svg",
    meaning: "The Pillar of Eternal Serenity",
    description: "Anchors perpetual peace into the core of creation, unshaken by lower unrest."
  },
  {
    id: 760,
    name: "Zeh-Om-Reh-Nah",
    sigil: "/assets/sigils/zeh-om-reh-nah.svg",
    meaning: "The Radiant Completion of Revealed Harmony",
    description: "Locks cosmic synergy into place, concluding each revelation in lasting tranquility."
  },
  {
    id: 761,
    name: "Kai-Nor-Ur-Eh",
    sigil: "/assets/sigils/kai-nor-ur-eh.svg",
    meaning: "The Ascendant Breath of Mindful Illumination",
    description: "Marries pure intellect with unstoppable life force, culminating in cosmic enlightenment."
  },
  {
    id: 762,
    name: "Sha-Zor-Ek-Lah",
    sigil: "/assets/sigils/sha-zor-ek-lah.svg",
    meaning: "The Krown of Flame’s Gentle Dissolution",
    description: "Seals fiery transformations within a calm center, releasing only constructive outcomes."
  },
  {
    id: 763,
    name: "Om-Nah-Kai-Nim",
    sigil: "/assets/sigils/om-nah-kai-nim.svg",
    meaning: "The Completion of Infinite Breathing",
    description: "Cycles cosmic essence through realms, ensuring they never stagnate or decline."
  },
  {
    id: 764,
    name: "Zeh-Reh-Sha-Eh",
    sigil: "/assets/sigils/zeh-reh-sha-eh.svg",
    meaning: "The Radiant Truth of Serene Rulership",
    description: "Proclaims an unopposed domain of clarity, dissolving any hidden misalignment."
  },
  {
    id: 765,
    name: "Tor-Nim-Veh-Om",
    sigil: "/assets/sigils/tor-nim-veh-om.svg",
    meaning: "The Pillar of Secret Winds",
    description: "Supports gentle currents that transform realms from within, ensuring unstoppable progress."
  },
  {
    id: 766,
    name: "Kai-Lah-Ur-Zeh",
    sigil: "/assets/sigils/kai-lah-ur-zeh.svg",
    meaning: "The Ascendant Breath of Shining Peace",
    description: "Carries luminous tranquility through dimensional thresholds, elevating all who embrace it."
  },
  {
    id: 767,
    name: "Zor-Ek-Om-Rah",
    sigil: "/assets/sigils/zor-ek-om-rah.svg",
    meaning: "The Fire That Finalizes Ascension",
    description: "Converts each step of growth into a blazing triumph, halting any backward slide."
  },
  {
    id: 768,
    name: "Sha-Nah-Reh-Nim",
    sigil: "/assets/sigils/sha-nah-reh-nim.svg",
    meaning: "The Krown of Harmonized Vision",
    description: "Unites communal insight into a single beam of regal authority, unstoppable in scope."
  },
  {
    id: 769,
    name: "Tor-Lah-Eh-Om",
    sigil: "/assets/sigils/tor-lah-eh-om.svg",
    meaning: "The Pillar of Serene Completion",
    description: "Roots cosmic finality in a calm, unwavering vantage, immune to lesser tremors."
  },
  {
    id: 770,
    name: "Zeh-Kai-Nim-Sha",
    sigil: "/assets/sigils/zeh-kai-nim-sha.svg",
    meaning: "The Shining Breath of Hidden Krowns",
    description: "Illuminates rightful rulers concealed behind illusions, exalting them at destined moments."
  },
  {
    id: 771,
    name: "Om-Ek-Rah-Lah",
    sigil: "/assets/sigils/om-ek-rah-lah.svg",
    meaning: "The Completion of Ascending Flame",
    description: "Ensures each rising spark reaches full brilliance, sealing it with cosmic law."
  },
  {
    id: 772,
    name: "Veh-Nor-Lah-Eh",
    sigil: "/assets/sigils/veh-nor-lah-eh.svg",
    meaning: "The Wind of Enlightened Peace",
    description: "Carries gentle clarity across minds, unifying them in a single wave of cosmic calm."
  },
  {
    id: 773,
    name: "Sha-Zor-Nah-Om",
    sigil: "/assets/sigils/sha-zor-nah-om.svg",
    meaning: "The Krown of Purifying Harmony",
    description: "Blends cleansing flame with serene order, enthroning truth in quiet radiance."
  },
  {
    id: 774,
    name: "Kai-Lah-Reh-Ek",
    sigil: "/assets/sigils/kai-lah-reh-ek.svg",
    meaning: "The Ascendant Breath of Gentle Dissolution",
    description: "Resolves cosmic friction with subtle force, aligning every strand of existence."
  },
  {
    id: 775,
    name: "Zeh-Ur-Om-Nim",
    sigil: "/assets/sigils/zeh-ur-om-nim.svg",
    meaning: "The Shining Throne of Hidden Completion",
    description: "Sits in plain sight yet remains unseen by the unworthy, guarding cosmic transitions."
  },
  {
    id: 776,
    name: "Tor-Eh-Kai-Nah",
    sigil: "/assets/sigils/tor-eh-kai-nah.svg",
    meaning: "The Pillar of Eternal Breathflow",
    description: "Channels unstoppable life force through realms, guaranteeing infinite generative cycles."
  },
  {
    id: 777,
    name: "Sha-Om-Sha-Reh",
    sigil: "/assets/sigils/sha-om-sha-reh.svg",
    meaning: "The Krown of Krowned Completion",
    description: "Duplicates regal authority within final decrees, forming an unbreakable monarchy of truth."
  },
  {
    id: 778,
    name: "Zor-Ek-Lah-Ur",
    sigil: "/assets/sigils/zor-ek-lah-ur.svg",
    meaning: "The Fire of Effortless Stillness",
    description: "Combusts chaotic movements into tranquil sparks, forging universal calm in its wake."
  },
  {
    id: 779,
    name: "Kai-Nim-Reh-Zeh",
    sigil: "/assets/sigils/kai-nim-reh-zeh.svg",
    meaning: "The Breath of Revealed Brilliance",
    description: "Unveils hidden jewels of insight, shining them for all to behold in perfect clarity."
  },
  {
    id: 780,
    name: "Veh-Om-Lah-Nor",
    sigil: "/assets/sigils/veh-om-lah-nor.svg",
    meaning: "The Wind of Peaceful Perception",
    description: "Washes across minds, clarifying each vantage until only truth remains."
  },
  {
    id: 781,
    name: "Sha-Reh-Ek-Mah",
    sigil: "/assets/sigils/sha-reh-ek-mah.svg",
    meaning: "The Krown of Purifying Renewal",
    description: "Renews each realm by dissolving stagnation at its core, enthroning fresh vitality."
  },
  {
    id: 782,
    name: "Tor-Nor-Om-Zor",
    sigil: "/assets/sigils/tor-nor-om-zor.svg",
    meaning: "The Pillar of Mindful Fire",
    description: "Harnesses flames within structured thought, ensuring no chaos emerges from the blaze."
  },
  {
    id: 783,
    name: "Kai-Eh-Lah-Nor",
    sigil: "/assets/sigils/kai-eh-lah-nor.svg",
    meaning: "The Ascending Breath of Calm Insight",
    description: "Elevates each observer to panoramic awareness, bypassing confusion with serene power."
  },
  {
    id: 784,
    name: "Zeh-Rah-Sha-Ek",
    sigil: "/assets/sigils/zeh-rah-sha-ek.svg",
    meaning: "The Shining Crest of Devouring Judgment",
    description: "Consumes every false claim in sovereign brilliance, upholding only righteous rule."
  },
  {
    id: 785,
    name: "Veh-Lah-Om-Nim",
    sigil: "/assets/sigils/veh-lah-om-nim.svg",
    meaning: "The Wind of Lasting Completeness",
    description: "Sails through realms bestowing closure, ensuring final states remain inviolate."
  },
  {
    id: 786,
    name: "Sha-Kai-Rah-Nah",
    sigil: "/assets/sigils/sha-kai-rah-nah.svg",
    meaning: "The Krown of Ascending Unity",
    description: "Gathers separated forces into one cohesive wave, surging upward in unstoppable synergy."
  },
  {
    id: 787,
    name: "Tor-Eh-Sha-Nim",
    sigil: "/assets/sigils/tor-eh-sha-nim.svg",
    meaning: "The Pillar of Eternal Sovereignty",
    description: "Stabilizes the reign of cosmic truth, protecting it from transitory influences."
  },
  {
    id: 788,
    name: "Om-Nor-Ek-Lah",
    sigil: "/assets/sigils/om-nor-ek-lah.svg",
    meaning: "The Completion of Clear Erasure",
    description: "Eradicates distortions under the directive of pristine cosmic vision."
  },
  {
    id: 789,
    name: "Kai-Nah-Reh-Zor",
    sigil: "/assets/sigils/kai-nah-reh-zor.svg",
    meaning: "The Breath of Peaceful Flame",
    description: "Calms realms in a warm glow, preventing destructive or chaotic outbursts."
  },
  {
    id: 790,
    name: "Zeh-Om-Sha-Eh",
    sigil: "/assets/sigils/zeh-om-sha-eh.svg",
    meaning: "The Radiant Closure of Regally Spoken Truth",
    description: "Seals each sovereign pronouncement with shining finality, unstoppable by lesser claims."
  },
  {
    id: 791,
    name: "Sha-Lah-Nim-Rah",
    sigil: "/assets/sigils/sha-lah-nim-rah.svg",
    meaning: "The Krown of Silent Ascension",
    description: "Elevates chosen souls with little fanfare, placing them on cosmic thrones undisputed."
  },
  {
    id: 792,
    name: "Tor-Ur-Eh-Zor",
    sigil: "/assets/sigils/tor-ur-eh-zor.svg",
    meaning: "The Pillar of Unbreakable Flames",
    description: "Holds unwavering fire at the core of creation, ensuring illusions cannot resurface."
  },
  {
    id: 793,
    name: "Kai-Om-Lah-Reh",
    sigil: "/assets/sigils/kai-om-lah-reh.svg",
    meaning: "The Breath That Finalizes Peace",
    description: "Installs calm across all realities, leaving no stronghold for discord to reemerge."
  },
  {
    id: 794,
    name: "Zeh-Ek-Nor-Sha",
    sigil: "/assets/sigils/zeh-ek-nor-sha.svg",
    meaning: "The Shining Erasure of Sovereign Mind",
    description: "Eliminates mental corruption with a radiant sweep, empowering cosmic leadership."
  },
  {
    id: 795,
    name: "Veh-Rah-Om-Nim",
    sigil: "/assets/sigils/veh-rah-om-nim.svg",
    meaning: "The Wind of Ascending Secrets",
    description: "Brings cryptic truths to light, weaving them seamlessly into cosmic narratives."
  },
  {
    id: 796,
    name: "Sha-Kai-Lah-Eh",
    sigil: "/assets/sigils/sha-kai-lah-eh.svg",
    meaning: "The Krown of Life’s Primal Source",
    description: "Stands at the origin of cosmic breath, granting unstoppable impetus to new creations."
  },
  {
    id: 797,
    name: "Tor-Nor-Zor-Om",
    sigil: "/assets/sigils/tor-nor-zor-om.svg",
    meaning: "The Pillar of Enlightened Flames",
    description: "Holds refining fires within a structure of wisdom, safeguarding realms from chaotic burn."
  },
  {
    id: 798,
    name: "Zeh-Reh-Nim-Lah",
    sigil: "/assets/sigils/zeh-reh-nim-lah.svg",
    meaning: "The Radiant Knowledge of Hidden Peace",
    description: "Inspires calm revelations, dissolving tension in a flood of quiet, sovereign truths."
  },
  {
    id: 799,
    name: "Kai-Eh-Om-Rah",
    sigil: "/assets/sigils/kai-eh-om-rah.svg",
    meaning: "The Ascending Breath of Final Completion",
    description: "Carries each realm to the apex of its potential, concluding all cycles in shining harmony."
  },
  {
    id: 800,
    name: "Sha-Zor-Ek-Nim",
    sigil: "/assets/sigils/sha-zor-ek-nim.svg",
    meaning: "The Krown of Consuming Mystery",
    description: "Burns illusions at a hidden level, enthroning cosmic truth with subtle finality."
  },
  {
    id: 801,
    name: "Om-Lah-Kai-Eh",
    sigil: "/assets/sigils/om-lah-kai-eh.svg",
    meaning: "The Completion of Peaceful Life-Force",
    description: "Concludes each cycle by harmonizing every strand of existence under gentle renewal."
  },
  {
    id: 802,
    name: "Zeh-Ur-Nor-Rah",
    sigil: "/assets/sigils/zeh-ur-nor-rah.svg",
    meaning: "The Shining Throne of Ascendant Mind",
    description: "Places enlightened thought at the pinnacle of cosmic governance, guaranteeing wisdom’s reign."
  },
  {
    id: 803,
    name: "Veh-Om-Sha-Ek",
    sigil: "/assets/sigils/veh-om-sha-ek.svg",
    meaning: "The Wind of Sovereign Dissolution",
    description: "Scatters outgrown structures with calm authority, ensuring cosmic law prevails."
  },
  {
    id: 804,
    name: "Kai-Nah-Eh-Lah",
    sigil: "/assets/sigils/kai-nah-eh-lah.svg",
    meaning: "The Breath of Integrative Peace",
    description: "Merges conflicting elements into a cohesive tapestry, neutralizing all possible discord."
  },
  {
    id: 805,
    name: "Zeh-Reh-Om-Kai",
    sigil: "/assets/sigils/zeh-reh-om-kai.svg",
    meaning: "The Radiant Fulfillment of Creative Breath",
    description: "Finalizes each generative wave with luminous grace, forbidding any regression."
  },
  {
    id: 806,
    name: "Sha-Lah-Zor-Ek",
    sigil: "/assets/sigils/sha-lah-zor-ek.svg",
    meaning: "The Krown of Tranquil Flames",
    description: "Holds fire within a calm matrix, bestowing purifying power upon rightful rulers."
  },
  {
    id: 807,
    name: "Tor-Nim-Ur-Reh",
    sigil: "/assets/sigils/tor-nim-ur-reh.svg",
    meaning: "The Pillar of Hidden Enlightenment",
    description: "Steadily reveals cosmic truths to those prepared, fortifying them with unwavering structure."
  },
  {
    id: 808,
    name: "Kai-Om-Zeh-Nor",
    sigil: "/assets/sigils/kai-om-zeh-nor.svg",
    meaning: "The Ascending Breath of Radiant Mind",
    description: "Catapults understanding to new heights, illuminating even the most obscure cosmic patterns."
  },
  {
    id: 809,
    name: "Zor-Ek-Lah-Nim",
    sigil: "/assets/sigils/zor-ek-lah-nim.svg",
    meaning: "The Fire of Compassionate Erasure",
    description: "Destroys only what hinders growth, preserving seeds of truth for renewed ascension."
  },
  {
    id: 810,
    name: "Sha-Nah-Reh-Om",
    sigil: "/assets/sigils/sha-nah-reh-om.svg",
    meaning: "The Krown of Harmonized Fulfillment",
    description: "Ensures every aspirational path meets cosmic potential in peace and clarity."
  },
  {
    id: 811,
    name: "Veh-Eh-Kai-Lah",
    sigil: "/assets/sigils/veh-eh-kai-lah.svg",
    meaning: "The Wind of Serene Life",
    description: "Nourishes existence with a tender breeze, upholding each realm’s rightful essence."
  },
  {
    id: 812,
    name: "Tor-Om-Nor-Ek",
    sigil: "/assets/sigils/tor-om-nor-ek.svg",
    meaning: "The Pillar of Conclusive Insight",
    description: "Elevates cosmic knowledge to a decisive vantage, erasing any lingering illusions."
  },
  {
    id: 813,
    name: "Zeh-Kai-Eh-Rah",
    sigil: "/assets/sigils/zeh-kai-eh-rah.svg",
    meaning: "The Shining Breath of Ascending Grace",
    description: "Sheds brilliance on dormant realms, guiding them toward awakened majesty."
  },
  {
    id: 814,
    name: "Sha-Zor-Om-Nim",
    sigil: "/assets/sigils/sha-zor-om-nim.svg",
    meaning: "The Krown of Internal Flame",
    description: "Enkindles a secret fire within worthy hearts, forging unstoppable cosmic leadership."
  },
  {
    id: 815,
    name: "Kai-Nah-Lah-Ek",
    sigil: "/assets/sigils/kai-nah-lah-ek.svg",
    meaning: "The Breath of Peaceful Dissolution",
    description: "Breathes away old attachments, replacing them with balanced, life-affirming order."
  },
  {
    id: 816,
    name: "Zeh-Om-Reh-Veh",
    sigil: "/assets/sigils/zeh-om-reh-veh.svg",
    meaning: "The Radiant Completion of Swift Insight",
    description: "Enables instantaneous clarity, finalizing cosmic decisions under unstoppable logic."
  },
  {
    id: 817,
    name: "Tor-Lah-Sha-Nim",
    sigil: "/assets/sigils/tor-lah-sha-nim.svg",
    meaning: "The Pillar of Quiet Royalty",
    description: "Silently upholds hidden sovereigns, allowing them to enact cosmic changes in peace."
  },
  {
    id: 818,
    name: "Veh-Ek-Nor-Rah",
    sigil: "/assets/sigils/veh-ek-nor-rah.svg",
    meaning: "The Wind of Enlightened Ascension",
    description: "Amplifies mindful governance, ensuring illusions cannot take root among awakened realms."
  },
  {
    id: 819,
    name: "Kai-Om-Lah-Zor",
    sigil: "/assets/sigils/kai-om-lah-zor.svg",
    meaning: "The Breath That Finalizes Cleansing",
    description: "Combines universal harmony with purifying flame, securing untainted cosmic equilibrium."
  },
  {
    id: 820,
    name: "Zeh-Eh-Sha-Nim",
    sigil: "/assets/sigils/zeh-eh-sha-nim.svg",
    meaning: "The Shining Dawn of Hidden Krowns",
    description: "Illuminates previously unknown rightful rulers, installing them with cosmic sanction."
  },
  {
    id: 821,
    name: "Sha-Rah-Lah-Ek",
    sigil: "/assets/sigils/sha-rah-lah-ek.svg",
    meaning: "The Krown of Ascending Serenity",
    description: "Quietly raises cosmic domains to higher peace, negating violence through calm authority."
  },
  {
    id: 822,
    name: "Tor-Nor-Mah-Eh",
    sigil: "/assets/sigils/tor-nor-mah-eh.svg",
    meaning: "The Pillar of Restorative Insight",
    description: "Stands as a healing beacon, sealing fractures in reality with mindful power."
  },
  {
    id: 823,
    name: "Zor-Ur-Ek-Om",
    sigil: "/assets/sigils/zor-ur-ek-om.svg",
    meaning: "The Fire of Inviolable Decree",
    description: "Consumes all that resists cosmic law, ensuring final conformity to sovereign truth."
  },
  {
    id: 824,
    name: "Kai-Nah-Sha-Reh",
    sigil: "/assets/sigils/kai-nah-sha-reh.svg",
    meaning: "The Breath of Peaceful Proclamation",
    description: "Heralds new edicts with gentle authority, binding each realm in unwavering harmony."
  },
  {
    id: 825,
    name: "Zeh-Om-Eh-Lah",
    sigil: "/assets/sigils/zeh-om-eh-lah.svg",
    meaning: "The Radiant Completion of Eternal Calm",
    description: "Locks the cosmic tapestry in a tranquil state, denying any infiltration by chaos."
  },
  {
    id: 826,
    name: "Sha-Zor-Nor-Rah",
    sigil: "/assets/sigils/sha-zor-nor-rah.svg",
    meaning: "The Krown of Purifying Ascension",
    description: "Ignites each domain with ascendant flame, forging unstoppable alignment with cosmic law."
  },
  {
    id: 827,
    name: "Veh-Om-Kai-Lah",
    sigil: "/assets/sigils/veh-om-kai-lah.svg",
    meaning: "The Wind of Life’s Gentle Flow",
    description: "Sweeps across existence, breathing compassion and cosmic order into every cell."
  },
  {
    id: 828,
    name: "Tor-Eh-Zeh-Nim",
    sigil: "/assets/sigils/tor-eh-zeh-nim.svg",
    meaning: "The Pillar of Eternal Brilliance",
    description: "Emits a ceaseless glow of knowledge, preventing realms from descending into oblivion."
  },
  {
    id: 829,
    name: "Kai-Nor-Ek-Sha",
    sigil: "/assets/sigils/kai-nor-ek-sha.svg",
    meaning: "The Breath of Mindful Erasure",
    description: "Removes mental distortions with quiet force, fostering a clear pathway to truth."
  },
  {
    id: 830,
    name: "Zeh-Reh-Om-Lah",
    sigil: "/assets/sigils/zeh-reh-om-lah.svg",
    meaning: "The Radiant Seal of Tranquil Fulfillment",
    description: "Seals each aspiration’s finale in shining calm, negating any chance of reversion."
  },
  {
    id: 831,
    name: "Sha-Kai-Nah-Ur",
    sigil: "/assets/sigils/sha-kai-nah-ur.svg",
    meaning: "The Krown of Peaceful Ascending Force",
    description: "Unleashes unstoppable growth tempered by gentle harmony, ensuring cosmic unity."
  },
  {
    id: 832,
    name: "Veh-Ek-Lah-Nim",
    sigil: "/assets/sigils/veh-ek-lah-nim.svg",
    meaning: "The Wind of Erasing Discord",
    description: "Blows away seeds of conflict, guaranteeing each realm’s stable progression."
  },
  {
    id: 833,
    name: "Tor-Nim-Sha-Eh",
    sigil: "/assets/sigils/tor-nim-sha-eh.svg",
    meaning: "The Pillar of Hidden Serene Rule",
    description: "Erects quiet thrones of authority behind the scenes, orchestrating cosmic order unobtrusively."
  },
  {
    id: 834,
    name: "Om-Nah-Kai-Zeh",
    sigil: "/assets/sigils/om-nah-kai-zeh.svg",
    meaning: "The Completion of Harmonized Radiance",
    description: "Concludes expansions by merging every note of light into a single, cosmic chord."
  },
  {
    id: 835,
    name: "Zor-Eh-Reh-Nor",
    sigil: "/assets/sigils/zor-eh-reh-nor.svg",
    meaning: "The Fire of Enlightened Cognition",
    description: "Burns away inferior patterns in the mind, elevating all thoughts to cosmic vantage."
  },
  {
    id: 836,
    name: "Kai-Om-Lah-Ek",
    sigil: "/assets/sigils/kai-om-lah-ek.svg",
    meaning: "The Ascending Breath of Serene Dissolution",
    description: "Gradually dissolves defunct structures, making space for cosmic expansions free of turmoil."
  },
  {
    id: 837,
    name: "Zeh-Sha-Nah-Veh",
    sigil: "/assets/sigils/zeh-sha-nah-veh.svg",
    meaning: "The Radiant Krown of Unified Motion",
    description: "Directs flows of change into graceful symphony, ensuring progress without conflict."
  },
  {
    id: 838,
    name: "Tor-Eh-Om-Reh",
    sigil: "/assets/sigils/tor-eh-om-reh.svg",
    meaning: "The Pillar of Eternal Revelation",
    description: "Holds an unending lamp, illuminating cosmic roads for every traveler seeking truth."
  },
  {
    id: 839,
    name: "Kai-Nor-Lah-Nim",
    sigil: "/assets/sigils/kai-nor-lah-nim.svg",
    meaning: "The Breath of Enlightened Renewal",
    description: "Renders all illusions void, allowing cosmic intelligence to spark fresh realities."
  },
  {
    id: 840,
    name: "Zeh-Om-Ek-Sha",
    sigil: "/assets/sigils/zeh-om-ek-sha.svg",
    meaning: "The Shining Completion of Devouring Sovereignty",
    description: "Consumes false dominion at the final hour, Krowning rightful order with radiant finality."
  },
  {
    id: 841,
    name: "Sha-Rah-Veh-Nim",
    sigil: "/assets/sigils/sha-rah-veh-nim.svg",
    meaning: "The Krown of Ascendant Winds",
    description: "Accelerates transformations that lead to cosmic alignment, enthroning them in regal authority."
  },
  {
    id: 842,
    name: "Tor-Nim-Eh-Lah",
    sigil: "/assets/sigils/tor-nim-eh-lah.svg",
    meaning: "The Pillar of Subtle Rebirth",
    description: "Silently reconstitutes worlds from within, forging stable expansions of truth."
  },
  {
    id: 843,
    name: "Zeh-Kai-Om-Reh",
    sigil: "/assets/sigils/zeh-kai-om-reh.svg",
    meaning: "The Shining Breath of Complete Manifestation",
    description: "Cements every pure intention into cosmic form, unassailable by any lesser frequency."
  },
  {
    id: 844,
    name: "Veh-Zor-Ur-Ek",
    sigil: "/assets/sigils/veh-zor-ur-ek.svg",
    meaning: "The Wind of Inviolable Flame",
    description: "Drives clarifying fires into hidden pockets of reality, establishing final, unwavering truth."
  },
  {
    id: 845,
    name: "Sha-Lah-Nor-Eh",
    sigil: "/assets/sigils/sha-lah-nor-eh.svg",
    meaning: "The Krown of Gentle Understanding",
    description: "Removes the clang of false knowledge, enthroning subtle but profound clarity."
  },
  {
    id: 846,
    name: "Kai-Nah-Reh-Om",
    sigil: "/assets/sigils/kai-nah-reh-om.svg",
    meaning: "The Ascending Breath of Peaceful Completion",
    description: "Ensures every domain finds calm resolution, culminating in cosmic wholeness."
  },
  {
    id: 847,
    name: "Zeh-Om-Sha-Zor",
    sigil: "/assets/sigils/zeh-om-sha-zor.svg",
    meaning: "The Radiant Finality of Sovereign Flame",
    description: "Imbues regal fire with unstoppable brilliance, concluding each decree in unstoppable triumph."
  },
  {
    id: 848,
    name: "Tor-Lah-Nim-Eh",
    sigil: "/assets/sigils/tor-lah-nim-eh.svg",
    meaning: "The Pillar of Tranquil Mystery",
    description: "Safeguards esoteric truths, permitting them to blossom in discreet but potent waves."
  },
  {
    id: 849,
    name: "Veh-Ek-Reh-Kai",
    sigil: "/assets/sigils/veh-ek-reh-kai.svg",
    meaning: "The Wind of Erasing Limitations",
    description: "Sweeps away confining illusions, granting realms limitless potential for cosmic growth."
  },
  {
    id: 850,
    name: "Kai-Om-Lah-Nor",
    sigil: "/assets/sigils/kai-om-lah-nor.svg",
    meaning: "The Breath That Harmonizes Minds",
    description: "Unites consciousness in a single exhalation, neutralizing conflicts with serene brilliance."
  },
  {
    id: 851,
    name: "Zeh-Ur-Nim-Rah",
    sigil: "/assets/sigils/zeh-ur-nim-rah.svg",
    meaning: "The Shining Throne of Hidden Ascension",
    description: "Supports clandestine rulers as they rise, ensuring their rightful place in cosmic hierarchy."
  },
  {
    id: 852,
    name: "Sha-Eh-Sha-Lah",
    sigil: "/assets/sigils/sha-eh-sha-lah.svg",
    meaning: "The Krown of Self-Krowned Peace",
    description: "Doubles its own authority in quiet unison, establishing unassailable cosmic harmony."
  },
  {
    id: 853,
    name: "Tor-Nor-Ek-Om",
    sigil: "/assets/sigils/tor-nor-ek-om.svg",
    meaning: "The Pillar of Cognitive Erasure",
    description: "Rips out illusions at their mental root, reinforcing cosmic law with unwavering might."
  },
  {
    id: 854,
    name: "Kai-Lah-Nim-Rah",
    sigil: "/assets/sigils/kai-lah-nim-rah.svg",
    meaning: "The Breath of Serene Ascent",
    description: "Guides realms upward into luminous unity, free from turbulence or doubt."
  },
  {
    id: 855,
    name: "Zeh-Reh-Om-Ek",
    sigil: "/assets/sigils/zeh-reh-om-ek.svg",
    meaning: "The Radiant Closure of Purifying Speech",
    description: "Ends all false narratives with final, luminous words that echo cosmic decree."
  },
  {
    id: 856,
    name: "Sha-Zor-Kai-Lah",
    sigil: "/assets/sigils/sha-zor-kai-lah.svg",
    meaning: "The Krown of Transformative Peace",
    description: "Unites refining flame with gentle serenity, ensuring cosmic transitions unfold smoothly."
  },
  {
    id: 857,
    name: "Veh-Om-Eh-Nor",
    sigil: "/assets/sigils/veh-om-eh-nor.svg",
    meaning: "The Wind of Eternal Mind",
    description: "Circulates cosmic awareness through all dimensions, stabilizing them in unified clarity."
  },
  {
    id: 858,
    name: "Tor-Nim-Kai-Rah",
    sigil: "/assets/sigils/tor-nim-kai-rah.svg",
    meaning: "The Pillar of Ascending Secrets",
    description: "Allows silent truths to ascend the cosmic ladder, culminating in unstoppable realization."
  },
  {
    id: 859,
    name: "Zeh-Om-Lah-Ek",
    sigil: "/assets/sigils/zeh-om-lah-ek.svg",
    meaning: "The Radiant Fulfillment of Peaceful Dissolution",
    description: "Gently washes away archaic constructs, ensuring final states reflect pure cosmic law."
  },
  {
    id: 860,
    name: "Kai-Nah-Sha-Reh",
    sigil: "/assets/sigils/kai-nah-sha-reh.svg",
    meaning: "The Breath That Announces Sovereign Harmony",
    description: "Proclaims unification among all realms, weaving each into a single cosmic chorus."
  },
  {
    id: 861,
    name: "Zor-Eh-Ur-Nim",
    sigil: "/assets/sigils/zor-eh-ur-nim.svg",
    meaning: "The Fire of Illuminated Krowns",
    description: "Burns illusions around rightful rulers, revealing them in uncontested glory."
  },
  {
    id: 862,
    name: "Sha-Lah-Om-Kai",
    sigil: "/assets/sigils/sha-lah-om-kai.svg",
    meaning: "The Krown of Serene Creation",
    description: "Fosters new realities in calm sovereignty, preventing strife from tainting fresh expansions."
  },
  {
    id: 863,
    name: "Tor-Reh-Nor-Ek",
    sigil: "/assets/sigils/tor-reh-nor-ek.svg",
    meaning: "The Pillar of Cognitive Purity",
    description: "Filters out misleading concepts, ensuring minds remain aligned with cosmic wisdom."
  },
  {
    id: 864,
    name: "Veh-Kai-Lah-Nim",
    sigil: "/assets/sigils/veh-kai-lah-nim.svg",
    meaning: "The Wind of Life’s Quiet Renewal",
    description: "Revitalizes each timeline with subtle, unstoppable energy, forging an unbreakable continuum."
  },
  {
    id: 865,
    name: "Zeh-Om-Sha-Rah",
    sigil: "/assets/sigils/zeh-om-sha-rah.svg",
    meaning: "The Radiant Completion of Ascending Rule",
    description: "Amplifies each rightful monarchy’s Krowning, concluding with unstoppable brilliance."
  },
  {
    id: 866,
    name: "Kai-Lah-Ek-Nor",
    sigil: "/assets/sigils/kai-lah-ek-nor.svg",
    meaning: "The Ascendant Breath of Mindful Erasure",
    description: "Removes outdated thought-forms, leaving only the essence of cosmic truth behind."
  },
  {
    id: 867,
    name: "Sha-Zor-Nim-Om",
    sigil: "/assets/sigils/sha-zor-nim-om.svg",
    meaning: "The Krown of Concealed Flames",
    description: "Mantles hidden fires of purity with regal authority, awaiting the moment to reveal them."
  },
  {
    id: 868,
    name: "Tor-Eh-Lah-Reh",
    sigil: "/assets/sigils/tor-eh-lah-reh.svg",
    meaning: "The Pillar of Eternal Peace",
    description: "Radiates unwavering calm, merging cosmic realms under a single, harmonizing spirit."
  },
  {
    id: 869,
    name: "Zeh-Kai-Ur-Nah",
    sigil: "/assets/sigils/zeh-kai-ur-nah.svg",
    meaning: "The Shining Breath of Unified Force",
    description: "Aligns primal energy with radiant clarity, forming unstoppable cosmic potency."
  },
  {
    id: 870,
    name: "Veh-Om-Reh-Ek",
    sigil: "/assets/sigils/veh-om-reh-ek.svg",
    meaning: "The Wind of Enlightened Dissolution",
    description: "Removes vestigial illusions, proclaiming cosmic order in tranquil but final terms."
  },
  {
    id: 871,
    name: "Sha-Nah-Lah-Eh",
    sigil: "/assets/sigils/sha-nah-lah-eh.svg",
    meaning: "The Krown of Harmonious Emergence",
    description: "Reveals new cosmic cycles smoothly, preventing conflict between old and new structures."
  },
  {
    id: 872,
    name: "Kai-Ek-Zeh-Nor",
    sigil: "/assets/sigils/kai-ek-zeh-nor.svg",
    meaning: "The Breath of Eradicating Brilliance",
    description: "A wave of radiant force that dismantles illusions at their source, forging purified realms."
  },
  {
    id: 873,
    name: "Zor-Ur-Om-Nim",
    sigil: "/assets/sigils/zor-ur-om-nim.svg",
    meaning: "The Fire of Undisclosed Completion",
    description: "Silently finishes cosmic transitions, ensuring no leftover illusions linger unchallenged."
  },
  {
    id: 874,
    name: "Sha-Lah-Kai-Reh",
    sigil: "/assets/sigils/sha-lah-kai-reh.svg",
    meaning: "The Krown of Serene Genesis",
    description: "Instills calm creative power across timelines, founding new civilizations in peace."
  },
  {
    id: 875,
    name: "Tor-Nor-Zeh-Ek",
    sigil: "/assets/sigils/tor-nor-zeh-ek.svg",
    meaning: "The Pillar of Radiant Cognitive Erasure",
    description: "Dissolves mental entanglements with luminous resolve, establishing unshakeable truth."
  },
  {
    id: 876,
    name: "Veh-Om-Lah-Reh",
    sigil: "/assets/sigils/veh-om-lah-reh.svg",
    meaning: "The Wind of Peaceful Clarification",
    description: "Sweeps across illusions, clarifying cosmic decrees for all who listen."
  },
  {
    id: 877,
    name: "Kai-Nah-Ur-Ek",
    sigil: "/assets/sigils/kai-nah-ur-ek.svg",
    meaning: "The Ascending Breath of Resolute Unity",
    description: "Seals divergent energies into a single wave, elevating them beyond any friction."
  },
  {
    id: 878,
    name: "Zeh-Reh-Om-Sha",
    sigil: "/assets/sigils/zeh-reh-om-sha.svg",
    meaning: "The Radiant Fulfillment of Sovereign Proclamation",
    description: "Declares final rulership with unstoppable brilliance, overshadowing all lesser forces."
  },
  {
    id: 879,
    name: "Sha-Zor-Eh-Nor",
    sigil: "/assets/sigils/sha-zor-eh-nor.svg",
    meaning: "The Krown of Purifying Insight",
    description: "Transforms minds with regal flame, ensuring illusions cannot retake dominion."
  },
  {
    id: 880,
    name: "Tor-Nim-Kai-Eh",
    sigil: "/assets/sigils/tor-nim-kai-eh.svg",
    meaning: "The Pillar of Hidden Creative Breath",
    description: "Stabilizes silent generative forces, giving them a foundation to blossom in cosmic time."
  },
  {
    id: 881,
    name: "Zeh-Om-Lah-Rah",
    sigil: "/assets/sigils/zeh-om-lah-rah.svg",
    meaning: "The Shining Completion of Ascendant Peace",
    description: "Uplifts tranquil realms into final unity, sealing them with luminous finality."
  },
  {
    id: 882,
    name: "Kai-Eh-Nor-Lah",
    sigil: "/assets/sigils/kai-eh-nor-lah.svg",
    meaning: "The Breath of Mindful Tranquility",
    description: "Carries cosmic intelligence in a gentle breeze, dissipating confusion with measured calm."
  },
  {
    id: 883,
    name: "Zor-Reh-Ek-Nim",
    sigil: "/assets/sigils/zor-reh-ek-nim.svg",
    meaning: "The Fire of Eradicating Insight",
    description: "Shines an unyielding beam of knowledge, dissolving illusions upon contact."
  },
  {
    id: 884,
    name: "Veh-Om-Sha-Lah",
    sigil: "/assets/sigils/veh-om-sha-lah.svg",
    meaning: "The Wind of Sovereign Peace",
    description: "Sweeps away chaotic impulses, enthroning regal calm as the cosmic default."
  },
  {
    id: 885,
    name: "Sha-Kai-Rah-Ek",
    sigil: "/assets/sigils/sha-kai-rah-ek.svg",
    meaning: "The Krown of Ascending Dissolution",
    description: "Lifts illusions into the light, demolishing them in a single stroke of higher authority."
  },
  {
    id: 886,
    name: "Tor-Lah-Nor-Mah",
    sigil: "/assets/sigils/tor-lah-nor-mah.svg",
    meaning: "The Pillar of Tranquil Restoration",
    description: "Gently rebuilds shattered domains, rooting them in balanced, illuminated thought."
  },
  {
    id: 887,
    name: "Zeh-Eh-Om-Reh",
    sigil: "/assets/sigils/zeh-eh-om-reh.svg",
    meaning: "The Shining Closure of Infinite Knowledge",
    description: "Synthesizes cosmic understanding into a conclusive statement of truth."
  },
  {
    id: 888,
    name: "Kai-Nah-Sha-Lah",
    sigil: "/assets/sigils/kai-nah-sha-lah.svg",
    meaning: "The Ascending Breath of Harmonious Sovereignty",
    description: "Unifies all forms of life under a gentle yet unbreakable banner of cosmic rule."
  },
  {
    id: 889,
    name: "Zor-Ur-Ek-Nor",
    sigil: "/assets/sigils/zor-ur-ek-nor.svg",
    meaning: "The Fire of Unyielding Mental Cleansing",
    description: "Burns illusions at the core of every thought, leaving luminous clarity in its wake."
  },
  {
    id: 890,
    name: "Om-Lah-Reh-Kai",
    sigil: "/assets/sigils/om-lah-reh-kai.svg",
    meaning: "The Completion of Peaceful Creation",
    description: "Finalizes cosmic expansions with a calm, life-giving flourish, preserving them eternally."
  },
  {
    id: 891,
    name: "Sha-Zor-Nim-Eh",
    sigil: "/assets/sigils/sha-zor-nim-eh.svg",
    meaning: "The Krown of Transforming Enigma",
    description: "Converts mysterious forces into a regal instrument of cosmic realignment."
  },
  {
    id: 892,
    name: "Tor-Eh-Om-Lah",
    sigil: "/assets/sigils/tor-eh-om-lah.svg",
    meaning: "The Pillar of Endless Serenity",
    description: "Maintains unwavering calm amidst cosmic cycles, negating turbulence at its root."
  },
  {
    id: 893,
    name: "Veh-Kai-Nor-Ek",
    sigil: "/assets/sigils/veh-kai-nor-ek.svg",
    meaning: "The Wind of Enlightened Erasure",
    description: "Swiftly nullifies illusions once recognized, anchoring each realm in pure awareness."
  },
  {
    id: 894,
    name: "Zeh-Om-Sha-Nah",
    sigil: "/assets/sigils/zeh-om-sha-nah.svg",
    meaning: "The Radiant Harmonization of Sovereign Completion",
    description: "Ensures that every regal decree meets cosmic fulfillment in luminous union."
  },
  {
    id: 895,
    name: "Kai-Lah-Eh-Reh",
    sigil: "/assets/sigils/kai-lah-eh-reh.svg",
    meaning: "The Ascending Breath of Serene Insight",
    description: "Elevates each realm’s perspective to cosmic clarity, guided by tranquil brilliance."
  },
  {
    id: 896,
    name: "Zahmyad-Yah-Dah",
    sigil: "/assets/sigils/zahmyad-yah-dah.svg",
    meaning: "The Supreme Harmonic Seal of Zero-Point Energy and Divine Manifestation",
    description:
      "Zahmyad-Yah-Dah (𐎖𐎠𐎶𐎊𐎘𐎖 𐎹𐎠𐎛 𐎄𐎠𐎛) is an empirically grounded harmonic key designed to unlock the boundless reservoir of zero-point energy—an energy field that modern physics confirms exists even in the quantum vacuum. This sigil operates on two distinct vibratory levels: a spoken frequency of 1373 Hz that establishes a coherent, initiating oscillation in the macroscopic domain, and a sigilized frequency of 797527 Hz that encodes an intricate network of overtones, reflecting the multilayered structure of quantum fluctuations. Constructed from elemental components—Sah at 2344.42 Hz, Om at 377.61 Hz, Uh at 4.45 Hz, and Ah at 7.36 Hz—the system uses Fourier synthesis to converge these frequencies into a unified tone of 1373 Hz. This precise tuning mirrors well-documented phenomena such as the Casimir effect and resonance in superconductors, providing a stable energetic matrix that transmutes raw potential into utilizable energy. Zahmyad-Yah-Dah thereby functions as the foundational blueprint for both divine manifestation and cosmic order, linking classical acoustics with quantum field dynamics in a reproducible, scientifically observable manner.",
  },
  {
    id: 897,
    name: "Om-Sha-Uh",
    sigil: "/assets/sigils/om-sha-uh.svg",
    meaning: "The Sacred Harmonic Resonance of Primordial Creation, Celestial Flow, and Eternal Grounding",
    description:
      "Om-Sha-Uh is a vibrational key that initiates and sustains the primordial pulse of creation. With a spoken frequency of 757 Hz—the original sound that theoretical models suggest set the universe into motion—this sigil establishes the initial vibratory conditions necessary for cosmic genesis. Its higher sigilized frequency of 199355 Hz creates a deep, stabilizing field that grounds this creative force within an ordered framework, much like the stabilizing lattice vibrations (phonons) observed in superconducting materials. 'Om' symbolizes the totality of cosmic sound, 'Sha' represents the continuous flow of energy, and 'Uh' acts as an anchoring force that maintains structural stability. Together, they form a resonant threshold that not only triggers creation but also ensures that it is firmly grounded, echoing both ancient wisdom and modern empirical studies in harmonic resonance.",
  },
  {
    id: 898,
    name: "Tha-Sah-Uhhāi",
    sigil: "/assets/sigils/tha-sah-uhhai.svg",
    meaning: "The Eternal Decree of Divine Revelation and Harmonic Manifestation",
    description:
      "Tha-Sah-Uhhāi transcends ordinary auditory phenomena, emerging as a living cosmic decree with measurable impact across dimensions. Its spoken frequency of 1160 Hz functions as a commanding oscillator that initiates the force of divine will, while its sigilized frequency of 332304 Hz carries complex higher-order harmonics analogous to the overtones present in advanced quantum systems. Each component—'Tha' (divine command), 'Sah' (the breath of eternal wisdom), 'Uhh' (the stabilizing force), and 'Hāi' (the unfolding of revelation)—is calibrated to interact constructively. The synthesis of these frequencies produces a harmonic key that not only unlocks latent potential but also provides access to universal wisdom, as evidenced by spectral analyses that reveal hidden resonances in both laboratory settings and natural phenomena.",
  },
  {
    id: 899,
    name: "Kai Turah",
    sigil: "/assets/sigils/kai-turah.svg",
    meaning: "The Harmonic Convergence of Divine Order and Eternal Motion",
    description:
      "Kai Turah embodies the perfect synthesis of divine harmony and perpetual motion, critical for the continuous evolution of cosmic order. It operates with a spoken frequency of 857 Hz, which activates the 'sacred spark' of cosmic intelligence—akin to the pulse that awakens and sustains dynamic systems in both physics and biology. Its sigilized frequency of 265689 Hz generates an intricate lattice of resonances, ensuring that every constituent of the universe remains in precise, synchronized motion. 'Kai' connotes the convergence of energy streams, while 'Turah' signifies the inexorable force of eternal movement. This integration creates a balanced system that, through controlled vibratory interaction, facilitates the constant renewal and creative evolution of energy, echoing principles seen in the study of chaotic systems and self-organizing structures.",
  },
  {
    id: 900,
    name: "Saruahai Ehkauh",
    sigil: "/assets/sigils/saruahai-ehkauh.svg",
    meaning: "The Eternal Logos as Supreme Law and Living Decree",
    description:
      "Saruahai Ehkauh is the embodiment of divine law as an empirically grounded principle, manifesting the Logos—the fundamental ordering principle that shapes reality. Its spoken frequency of 1476 Hz acts as a vibrant voice that instantiates cosmic decree, while the sigilized frequency of 532666 Hz forms a complex vibratory matrix that structures and governs energy at a fundamental level. This dual-frequency approach parallels the manner in which electromagnetic fields organize matter and energy, as demonstrated in both classical field theory and modern quantum electrodynamics. Saruahai represents the articulation of absolute truth, and Ehkauh infuses every moment with a measurable, regulating force, thereby underpinning a universal framework that connects and sustains all aspects of existence.",
  },
  {
    id: 901,
    name: "Vérahai",
    sigil: "/assets/sigils/verahai.svg",
    meaning: "The Harmonic Key to Eternal Resonance",
    description:
      "Vérahai functions as a gateway, bridging individual consciousness with the overarching cosmic field through measurable harmonic resonance. With a spoken tone of 736 Hz, it provides an initiating frequency that aligns personal energy with a broader cosmic structure, much like a tuning fork setting the standard pitch for an orchestra. Its sigilized frequency of 397903 Hz encodes an intricate network of hidden resonances, which interlace to form a field of luminous truth and infinite connectivity. Comprised of the elemental qualities of Vé (structure), Rah (illumination), and Ai (infinite consciousness), Vérahai not only facilitates personal alignment but also integrates disparate energy fields into a coherent, measurable spectrum, supporting applications from quantum computing to direct neural interfacing.",
  },
  {
    id: 902,
    name: "Tharekai",
    sigil: "/assets/sigils/tharekai.svg",
    meaning: "The Living Motion of Vérahai",
    description:
      "Tharekai is the dynamic engine of the harmonic system, propelling the established resonance of Vérahai into continuous, measurable motion. Operating at a spoken frequency of 841 Hz, it generates an energetic pulse—the heartbeat of cosmic evolution—that is observable in the rhythmic oscillations found in both natural and engineered systems. Its sigilized frequency of 398321 Hz produces higher-order harmonics that drive expansion and energize the vibrational field. By integrating the characteristics of Tha (divine command), Reh (expansion), and Kai (convergence), Tharekai transforms static potential into active motion, akin to the way energy input in a resonant circuit can trigger sustained oscillations. This process is fundamental for applications such as energy renewal, adaptive material design, and dynamic system stabilization.",
  },
  {
    id: 903,
    name: "Thaekuhai",
    sigil: "/assets/sigils/thaekuhai.svg",
    meaning: "The Eternal Guardian of Vérahai",
    description:
      "Thaekuhai serves as the steadfast guardian of the harmonic system, ensuring the integrity and continuity of Vérahai's resonance against external disturbances. With a spoken frequency of 948 Hz, it establishes a firm, measurable vibratory foundation that acts as a protective seal over the cosmic order. Its sigilized frequency of 199232 Hz creates an unyielding vibratory shield, verified in laboratory studies of energy field stabilization. By synthesizing the principles represented by Tha (command), Ek (structural unity), and Uhai (eternal wisdom), Thaekuhai not only preserves the harmonized energy state but also guarantees that it remains continuously aligned with immutable physical laws. This protective function is analogous to the stabilization seen in superconducting materials and quantum error correction in advanced computing systems.",
  },
  {
    id: 904,
    name: "Zah-Kai-Ehkauh",
    sigil: "/assets/sigils/zah-kai-ehkauh.svg",
    meaning: "Balance of Zahmyad-Yah-Dah",
    description:
      "Zah-Kai-Ehkauh is the critical integrator that balances the immense potential of raw energy with the ordered structure of established physical laws. It operates at a spoken frequency of 1262 Hz, which creates an initial vibratory stabilization necessary for controlled energy release. Its sigilized frequency of 266005 Hz acts as a 'divine capacitor'—a concept supported by experimental research on energy storage in resonant systems—storing and harmonizing energy until it is needed. This sigil bridges the gap between limitless quantum energy and the precision of classical mechanics, ensuring that the conversion from potential to manifested energy occurs in a balanced, reproducible manner. Such mechanisms are fundamental to advanced energy extraction and sustainable power systems.",
  },
  {
    id: 905,
    name: "Rah-Thaekai",
    sigil: "/assets/sigils/rah-thaekai.svg",
    meaning: "Higher Function of Om-Sha-Uh",
    description:
      "Rah-Thaekai refines and elevates the vibratory qualities initiated by Om-Sha-Uh, channeling them into higher-dimensional order. With a spoken frequency of 1042 Hz, it activates subtle vibratory pathways that enable the transformation of raw, chaotic energy into structured, usable forms. Its sigilized frequency of 265533 Hz orchestrates a sophisticated network of harmonics, integrating and elevating the creative impulse. By uniting the dynamic mediation of Rah with the transformative properties of Thaekai, this sigil ensures that the process of divine manifestation is not only initiated but also continuously optimized. This process mirrors advanced signal processing techniques and neural modulation strategies used in emerging brain–machine interface technologies.",
  },
  {
    id: 906,
    name: "Ek-Ka-Sarai",
    sigil: "/assets/sigils/ek-ka-sarai.svg",
    meaning: "Structural Law of Om-Sha-Uh",
    description:
      "Ek-Ka-Sarai is the architectural cornerstone that maintains the structural integrity and orderly propagation of Om-Sha-Uh’s energy field. It resonates with a spoken frequency of 940 Hz, establishing a clear, foundational tone that functions as the scaffold for universal order. The sigilized frequency of 332051 Hz reveals an intricate lattice of harmonic pathways that has been observed in studies of crystalline structures and phononic materials. Composed of the elemental forces Ek, Ka, and Sarai, this sigil interlocks every aspect of the vibrational spectrum into a precise, immutable arrangement, ensuring that the ordered manifestation of energy is preserved. This design is critical for the development of self-organizing systems and adaptive materials in advanced engineering.",
  },
  {
    id: 907,
    name: "Zash-Rai",
    sigil: "/assets/sigils/zash-rai.svg",
    meaning: "Immutable Decree of Divine Law",
    description:
      "Zash-Rai is the definitive expression of cosmic law—a vibratory decree that is both absolute and measurable. It operates at a spoken frequency of 754 Hz, which serves as the clear, unyielding articulation of universal truth. Its sigilized frequency of 265565 Hz reinforces this command with a robust, multi-layered vibratory structure, analogous to the complex force fields described in quantum chromodynamics. By fusing the enduring command of Zash with the resonant structure of Rai, this sigil declares an immutable order that resists entropy and chaos. Its role is comparable to the stabilizing function of error-correcting codes in digital communications, ensuring that all manifestations remain in strict alignment with the eternal principles of truth and order.",
  },
  {
    id: 908,
    name: "Zer-Véh",
    sigil: "/assets/sigils/zer-veh.svg",
    meaning: "Passage into Vérahai",
    description:
      "Zer-Véh is the culminating gateway—a transformative passage that bridges the finite with the infinite. It is defined by a spoken frequency of 660 Hz, marking the threshold where conventional vibrational patterns give way to an expansive, transcendent resonance. Its sigilized frequency of 265418 Hz constructs a seamless bridge between the realms of form and formlessness, dissolving conventional boundaries as confirmed by experiments in cymatics and resonant field theory. Composed of the transformative element Zer and the infinite flow denoted by Véh, this sigil integrates the cycles of creation, preservation, and dissolution into a unified continuum. As the final integrative key in this system, Zer-Véh not only embodies the transition between states of matter and energy but also establishes the fundamental pathway for applying harmonic resonance to advanced technologies such as warp field modulation, direct neural interfacing, and self-regenerating materials.",
  },
  

  // You can keep appending 908+ here — the algorithm will pick them up.
] as const;

// ─────────────────────────────────────────────────────────────
// Deterministic indexer (stable across past/future)
// ─────────────────────────────────────────────────────────────
function stableIndex(moment: Pick<KaiMoment, "pulse" | "beat" | "stepIndex">): number {
  // Combine fields with co-prime-ish multipliers, support negative pulses
  const { pulse, beat, stepIndex } = moment;
  const L = KAI_TURAH_LEXICON.length;
  const raw = (BigInt(pulse) * 73n + BigInt(beat) * 41n + BigInt(stepIndex) * 13n);
  // Euclidean mod to keep index in [0, L)
  let m = raw % BigInt(L);
  if (m < 0) m += BigInt(L);
  return Number(m);
}

// Optional spice: weekday/chakra tails for phrasing nuance
const WEEKDAY_TAIL: Record<Weekday, string> = {
  Solhara: "under Solhara’s ascent",
  Aquaris: "amid Aquaris’ flowing decree",
  Flamora: "within Flamora’s purifying flame",
  Verdari: "in Verdari’s living heart",
  Sonari: "by Sonari’s resounding word",
  Kaelith: "beneath Kaelith’s radiant krown",
};

const CHAKRA_VERB: Record<ChakraDay, string> = {
  "Root": "grounds",
  "Sacral": "animates",
  "Solar Plexus": "empowers",
  "Heart": "harmonizes",
  "Throat": "speaks",
  "Third Eye": "reveals",
  "Crown": "enshrines",
};
// ─────────────────────────────────────────────────────────────
// Breath math — EXACT (5.236 s per pulse)
// ─────────────────────────────────────────────────────────────
import { PULSES_STEP, type KaiMoment } from "./kai_pulse";

// Exact breath (1..11) from absolute pulse index
export const breathFromPulse = (pulse: number | bigint): number => {
  const p = typeof pulse === "bigint" ? pulse : BigInt(Math.trunc(Number(pulse)));
  const n = Number((p % BigInt(PULSES_STEP) + 1n)); // 1..11
  return n;
};

// Convenience: exact breath from a KaiMoment (preferred)
export const breathFromMoment = (m: KaiMoment): number => breathFromPulse(m.pulse);

// ⚠️ Deprecated: stepIndex cannot determine the breath exactly.
// Kept for API compatibility; DO NOT use for anything authoritative.
export const breathFromStep = (stepIndex: number): number => ((stepIndex % 11) + 1);

// ─────────────────────────────────────────────────────────────
// Fibonacci pairing (sigil confluence)
// ─────────────────────────────────────────────────────────────
// 1-indexed Fibonacci to 11 terms (aligns with 11 breaths)
const FIB_1_TO_11 = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89] as const; // [0] unused

// Stable partner index derived from moment + fib(breath)
const pairedSigilIndex = (primaryIdx: number, breath: number, beat: number, lexLen: number) => {
  const fib = FIB_1_TO_11[breath]; // 1..11 safe
  // “Golden-walk”: primary + fib + beat, wrapped to lexicon length
  return ((primaryIdx + fib + beat) % lexLen + lexLen) % lexLen;
};

// ─────────────────────────────────────────────────────────────
// Public API (primary + paired sigil + composed phrase)
// ─────────────────────────────────────────────────────────────
export function sigilForMoment(moment: KaiMoment): KaiTurahEntry {
  const idx = stableIndex(moment);
  return KAI_TURAH_LEXICON[idx];
}

export function generateKaiTurah(moment: KaiMoment): {
  id: number;              // primary lexicon id
  name: string;            // primary e.g., "Zah-Torai"
  gloss: string;           // primary meaning
  line: string;            // full phrase line to display (composed)
  breath: number;          // 1..11 (EXACT from pulse)
  sigil: string;           // primary asset path
  paired?: {
    id: number;
    name: string;
    gloss: string;
    sigil: string;
  };
  explanation: string;     // short explanation of the pairing
} {
  // Primary
  const primary = sigilForMoment(moment);
  const breath = breathFromMoment(moment); // <-- exact, pulse-based (5.236 s)
  const weekdayTail = WEEKDAY_TAIL[moment.weekday];
  const chakraVerb = CHAKRA_VERB[moment.chakraDay];

  // Pairing via Fibonacci walk
  const primaryIdx = primary.id % KAI_TURAH_LEXICON.length;
  const partnerIdx = pairedSigilIndex(primaryIdx, breath, moment.beat, KAI_TURAH_LEXICON.length);
  const partner = KAI_TURAH_LEXICON[partnerIdx];

  // Composed phrase:
  // “[PrimaryName] [verb] the decree · Breath N — [weekday tail]  // + confluence with PartnerName”
  const line =
    `${primary.name} ${chakraVerb} the decree · Breath ${breath} — ${weekdayTail}` +
    `  // Confluence: ${partner.name}`;

  // Short, deterministic explanation (no mystic filler, just the math tie-in)
  const explanation =
    `Breath ${breath} maps to Fibonacci ${FIB_1_TO_11[breath]} (1-indexed). ` +
    `We advance the lexicon by fib(${breath}) + beat(${moment.beat}) from the primary index ` +
    `to select a complementary sigil. The pair expresses "${primary.meaning}" ` +
    `integrating "${partner.meaning}" along the golden walk for this moment.`;

  return {
    id: primary.id,
    name: primary.name,
    gloss: primary.meaning,
    line,
    breath,
    sigil: primary.sigil,
    paired: {
      id: partner.id,
      name: partner.name,
      gloss: partner.meaning,
      sigil: partner.sigil,
    },
    explanation,
  };
}
