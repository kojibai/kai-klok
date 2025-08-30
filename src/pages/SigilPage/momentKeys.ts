// src/pages/SigilPage/momentKeys.ts
import { sha256Hex } from "./utils";

export async function deriveMomentKeys(sigil: {
  pulse: number;
  beat: number;
  stepsPerBeat?: number;
  chakraDay?: string;
}, canon: string, nowPulse: number, nowBeatIdx: number, nowStepIdx: number) {
  const stepsL = (sigil.stepsPerBeat ?? 44) as number;
  const stepIndexL = Math.floor((sigil.pulse % (stepsL * 11)) / 11);

  const seed = [
    "kai.v1",
    sigil.pulse,
    sigil.beat,
    stepIndexL,
    stepsL,
    sigil.chakraDay ?? "",
    canon || "",
    nowPulse,
    nowBeatIdx,
    nowStepIdx,
  ].join("|");

  const ownerHex = await sha256Hex("owner|" + seed);
  const kaiHex = await sha256Hex("kaisig|" + seed);

  return {
    ownerPhiKey: `phikey_${ownerHex.slice(0, 48)}`,
    kaiSig: `kai_sig_${kaiHex.slice(0, 48)}`,
  };
}
