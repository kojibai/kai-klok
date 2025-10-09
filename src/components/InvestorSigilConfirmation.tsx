import React, { useEffect, useState } from "react";
import type { InvestorSubmission } from "./InvestorSigilModal";
import { momentFromUTC } from "../utils/kai_pulse";
import KaiSigil from "./KaiSigil";
import { exportSigilAsSvg } from "../utils/svgMeta";
import "./investorSigilStyles.css";

type Props = {
  submission: InvestorSubmission;
  kaiSignature: string;
  userPhiKey: string;
  onDone: () => void;
  onBack: () => void;
};

const InvestorSigilConfirmation: React.FC<Props> = ({
  submission,
  kaiSignature,
  userPhiKey,
  onDone,
  onBack,
}) => {
  const [pulse, setPulse] = useState<number>(0);
  const [timestamp, setTimestamp] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const kai = momentFromUTC(new Date());
    setPulse(kai.pulse);
    setTimestamp(new Date().toISOString());
  }, []);

  const handleDownload = async () => {
    setSaving(true);

    const metadata = {
      amount: submission.amount,
      email: submission.email,
      note: submission.note,
      timestamp,
      kaiPulse: pulse,
      userPhiKey,
      kaiSignature,
      investmentId: `INV-${kaiSignature.slice(0, 8)}`,
      projectTag: "kai-klok",
    };

    await exportSigilAsSvg("investor-sigil", metadata);

    setSaving(false);
  };

  return (
    <div className="investor-confirmation">
      <h2 className="investor-confirmation-title">🎉 Investment Confirmed</h2>
      <p className="investor-confirmation-sub">
        Your sigil below is your eternal receipt + login key to claim your return when the drop concludes.
      </p>

      {/* Put the ID on a wrapper so the exporter can grab the <svg> within */}
      <div id="investor-sigil" className="investor-sigil-container">
        <KaiSigil
          pulse={pulse}
          beat={0}
          /* stepIndex → stepPct (0..1). 0 index == 0% */
          stepPct={0}
          /* chakraDay expects a chakra label, not a weekday. Sonari → Throat */
          chakraDay="Throat"
          /* Optional: control size if you want a consistent export size */
          size={240}
          /* Optional: keep deterministic hashing like other usages */
          hashMode="deterministic"
          origin=""
          /* If KaiSigil supports these extra props, keep them; otherwise remove. */
          kaiSignature={kaiSignature as unknown as never}
          userPhiKey={userPhiKey as unknown as never}
        />
      </div>

      <div className="investor-button-row">
        <button className="investor-button cancel" onClick={onBack}>
          Back
        </button>
        <button className="investor-button glow" onClick={handleDownload} disabled={saving}>
          {saving ? "Saving..." : "Export Sigil"}
        </button>
        <button className="investor-button" onClick={onDone}>
          Claim Later →
        </button>
      </div>
    </div>
  );
};

export default InvestorSigilConfirmation;
