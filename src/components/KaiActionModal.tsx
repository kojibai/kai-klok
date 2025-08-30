/* ────────────────────────────────────────────────────────────────
   KaiActionModal.tsx · Harmonic Action Creator
   v1.0 · Seal intentions + actions into the Eternal Kalendar
   • Replaces NoteModal
   • Uses current Kai-Pulse + intention + type → Kai Signature
   • Stores to memory with optional sigil/glyph logic
────────────────────────────────────────────────────────────────── */

import { useEffect, useRef, useState } from "react";
import { computeKaiSignature } from "../utils/kai";
import "./KaiActionModal.css";

export type ActionType =
  | "note"
  | "contract"
  | "transmit"
  | "invocation"
  | "reflection";

export interface HarmonicEntry {
  id: string;
  pulse: number;
  intention: string;
  actionType: ActionType;
  kai_signature: string;
  chakra?: string;
  sigilUrl?: string; // optional future feature
}

interface Props {
  pulse: number;
  onSave: (entry: HarmonicEntry) => void;
  onClose: () => void;
}

const KaiActionModal = ({ pulse, onSave, onClose }: Props) => {
  const [intention, setIntention] = useState("");
  const [actionType, setActionType] = useState<ActionType>("note");
  const [saving, setSaving] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => textareaRef.current?.focus(), []);

  const handleSave = async () => {
    if (!intention.trim()) return;
    setSaving(true);
    try {
      const sig = await computeKaiSignature(pulse, intention);
      setSignature(sig);
      const entry: HarmonicEntry = {
        id: `${pulse}-${Date.now()}`,
        pulse,
        intention: intention.trim(),
        actionType,
        kai_signature: sig,
      };
      onSave(entry);
      onClose();
    } catch (err) {
      console.error("Kai Signature error:", err);
      alert("Something went wrong while sealing this action.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="kai-action-backdrop" onClick={onClose}>
      <div
        className="kai-action-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold mb-4">
          Seal Harmonic Action @ Pulse {Math.round(pulse)}
        </h2>

        {/* Intention Input */}
        <label className="block mb-3">
          <span className="text-sm font-medium mb-1 inline-block">
            Intention
          </span>
          <textarea
            ref={textareaRef}
            className="w-full p-2 border rounded"
            rows={4}
            value={intention}
            onChange={(e) => setIntention(e.target.value)}
            placeholder="Speak your act into light…"
          />
        </label>

        {/* Action Type Dropdown */}
        <label className="block mb-4">
          <span className="text-sm font-medium mb-1 inline-block">
            Action Type
          </span>
          <select
            className="w-full p-2 border rounded"
            value={actionType}
            onChange={(e) => setActionType(e.target.value as ActionType)}
          >
            <option value="note">Note</option>
            <option value="contract">Contract</option>
            <option value="transmit">Transmit</option>
            <option value="invocation">Invocation</option>
            <option value="reflection">Reflection</option>
          </select>
        </label>

        {/* Buttons */}
        <div className="flex justify-between mt-6">
          <button
            className="text-gray-600 hover:text-red-600 transition"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 transition"
            onClick={handleSave}
            disabled={!intention.trim() || saving}
          >
            {saving ? "Sealing…" : "Seal Action"}
          </button>
        </div>

        {/* Optional Debug Info */}
        {signature && (
          <p className="mt-4 text-xs break-words">
            <strong>kai_signature:</strong> {signature}
          </p>
        )}
      </div>
    </div>
  );
};

export default KaiActionModal;
