/* v14 offline verifier: fast, chunked, ZK-aware */

import type { SigilMetadata } from "./types";
import {
  sumSegments,
  headCanonicalHashV14,
  hashTransferSenderSide,
  hashTransfer,
  buildReceiveMessageV14,
  buildSendMessageV14,
  stableStringify,        // ← keep import
  hashAny as hashAnyImpl,
} from "./sigilUtils";
import { verifySig } from "./keys";
import { tryVerifyGroth16 } from "./zk";
import { phiFromPublicKey } from "./crypto";

export type SovereignVerifyReport = {
  ok: boolean;
  count: number;
  issues: string[];
  entries: Array<{
    index: number;
    prevHeadOk: boolean;
    send: {
      sigOk: boolean;
      leafOk: boolean | "missing-window";
      zk?: {
        present: boolean;
        stampHashOk?: boolean;
        verified?: boolean | null; // null = groth16 unavailable
      };
    };
    receive?: {
      sigOk: boolean;
      leafOk: boolean | "missing-window";
      zk?: {
        present: boolean;
        stampHashOk?: boolean;
        verified?: boolean | null;
      };
    };
  }>;
};

function isHex(s: string, bytes = 16): boolean {
  return /^[0-9a-f]+$/i.test(s) && s.length === bytes * 2;
}

const YIELD_EVERY = 8;
const rAF = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export async function verifySovereignOffline(head: SigilMetadata): Promise<SovereignVerifyReport> {
  const hardened = head.hardenedTransfers ?? [];
  const windowTransfers = head.transfers ?? [];
  const issues: string[] = [];
  const entries: SovereignVerifyReport["entries"] = [];

  // Optional Φ anchor (informational only)
  if (head.creatorPublicKey && head.userPhiKey) {
    try {
      const phi = await phiFromPublicKey(head.creatorPublicKey);
      if (phi !== head.userPhiKey) issues.push("Φ anchor mismatch (informational)");
    } catch {
      issues.push("Φ anchor decode failed (informational)");
    }
  }

  // Precompute
  const baseCum = sumSegments(head);
  const prevRootsP = Promise.all(hardened.map((_, i) => headCanonicalHashV14(head, baseCum + i)));
  const sendLeavesP = Promise.all(
    hardened.map(async (_t, i) => (windowTransfers[i] ? hashTransferSenderSide(windowTransfers[i]) : null))
  );
  const recvLeavesP = Promise.all(
    hardened.map(async (_t, i) => (windowTransfers[i] ? hashTransfer(windowTransfers[i]) : null))
  );

  const [prevRoots, sendLeaves, recvLeaves] = await Promise.all([prevRootsP, sendLeavesP, recvLeavesP]);

  // Choose a fallback vkey if needed (inline beats global)
  const fallbackVkey = head.zkVerifyingKey ?? (typeof window !== "undefined" ? window.SIGIL_ZK_VKEY : undefined);

  for (let i = 0; i < hardened.length; i++) {
    if (i > 0 && i % YIELD_EVERY === 0) await rAF();

    const t = hardened[i];

    const entry: SovereignVerifyReport["entries"][number] = {
      index: i,
      prevHeadOk: false,
      send: { sigOk: false, leafOk: "missing-window" },
    };

    // prev-head pinning
    entry.prevHeadOk = t.previousHeadRoot === prevRoots[i];
    if (!entry.prevHeadOk) issues.push(`prevHead mismatch at #${i}`);

    // nonce sanity
    if (typeof t.nonce !== "string" || !isHex(t.nonce, 16)) {
      issues.push(`nonce invalid at #${i} (expected 16-byte hex)`);
    }

    // SEND leaf binding
    if (sendLeaves[i]) {
      entry.send.leafOk = t.transferLeafHashSend === sendLeaves[i];
      if (!entry.send.leafOk) issues.push(`sender-side leaf hash mismatch at #${i}`);
    }

    // SEND signature
    {
      const msgS = buildSendMessageV14(head, {
        previousHeadRoot: t.previousHeadRoot,
        senderKaiPulse: t.senderKaiPulse ?? 0,
        senderPubKey: t.senderPubKey ?? "",
        nonce: t.nonce ?? "",
        transferLeafHashSend: t.transferLeafHashSend ?? "",
      });
      entry.send.sigOk = !!t.senderPubKey && (await verifySig(t.senderPubKey, msgS, t.senderSig));
      if (!entry.send.sigOk) issues.push(`send signature invalid at #${i}`);
    }

    // RECEIVE (optional)
    if (t.receiverSig && t.receiverPubKey) {
      entry.receive = { sigOk: false, leafOk: "missing-window" };

      if (recvLeaves[i]) {
        entry.receive.leafOk = t.transferLeafHashReceive === recvLeaves[i];
        if (!entry.receive.leafOk) issues.push(`receive leaf hash mismatch at #${i}`);
      }

      const msgR = buildReceiveMessageV14({
        previousHeadRoot: t.previousHeadRoot,
        senderSig: t.senderSig,
        receiverKaiPulse: t.receiverKaiPulse ?? 0,
        receiverPubKey: t.receiverPubKey,
        transferLeafHashReceive: t.transferLeafHashReceive ?? "",
      });
      entry.receive.sigOk = await verifySig(t.receiverPubKey, msgR, t.receiverSig);
      if (!entry.receive.sigOk) issues.push(`receive signature invalid at #${i}`);
    }

    // ZK SEND (optional): stamp/bundle hash checks + verify
    if (t.zkSendBundle) {
      entry.send.zk = { present: true };

      const b = t.zkSendBundle;
      const publicHash = await hashAnyImpl(b.publicSignals);
      const proofHash = await hashAnyImpl(b.proof);
      const vkeyChosen = b.vkey ?? fallbackVkey;
      const vkeyHash = vkeyChosen ? await hashAnyImpl(vkeyChosen) : undefined;

      const stampOk =
        t.zkSend &&
        t.zkSend.scheme === "groth16" &&
        (t.zkSend.curve ? t.zkSend.curve === "BLS12-381" : true) &&
        t.zkSend.publicHash === publicHash &&
        t.zkSend.proofHash === proofHash &&
        (t.zkSend.vkeyHash ? t.zkSend.vkeyHash === vkeyHash : true);

      entry.send.zk.stampHashOk = !!stampOk;
      if (!stampOk) issues.push(`ZK SEND stamp/bundle hash mismatch at #${i}`);

      const verified = await tryVerifyGroth16({
        proof: b.proof,
        publicSignals: b.publicSignals,
        vkey: b.vkey,
        fallbackVkey,
      });
      entry.send.zk.verified = verified;
      if (t.zkSend) t.zkSend.verified = verified === true;
      if (verified === false) issues.push(`ZK SEND verification failed at #${i}`);
    } else if (t.zkSend) {
      entry.send.zk = { present: false };
    }

    // ZK RECEIVE (optional)
    if (t.zkReceiveBundle) {
      if (!entry.receive) entry.receive = { sigOk: false, leafOk: "missing-window" };
      entry.receive.zk = { present: true };

      const b = t.zkReceiveBundle;
      const publicHash = await hashAnyImpl(b.publicSignals);
      const proofHash = await hashAnyImpl(b.proof);
      const vkeyChosen = b.vkey ?? fallbackVkey;
      const vkeyHash = vkeyChosen ? await hashAnyImpl(vkeyChosen) : undefined;

      const stampOk =
        t.zkReceive &&
        t.zkReceive.scheme === "groth16" &&
        (t.zkReceive.curve ? t.zkReceive.curve === "BLS12-381" : true) &&
        t.zkReceive.publicHash === publicHash &&
        t.zkReceive.proofHash === proofHash &&
        (t.zkReceive.vkeyHash ? t.zkReceive.vkeyHash === vkeyHash : true);

      entry.receive.zk.stampHashOk = !!stampOk;
      if (!stampOk) issues.push(`ZK RECV stamp/bundle hash mismatch at #${i}`);

      const verified = await tryVerifyGroth16({
        proof: b.proof,
        publicSignals: b.publicSignals,
        vkey: b.vkey,
        fallbackVkey,
      });
      entry.receive.zk.verified = verified;
      if (t.zkReceive) t.zkReceive.verified = verified === true;
      if (verified === false) issues.push(`ZK RECV verification failed at #${i}`);
    }

    // Monotonicity hint (non-fatal)
    if (i > 0 && hardened[i - 1].senderKaiPulse != null && t.senderKaiPulse != null) {
      if ((t.senderKaiPulse as number) < (hardened[i - 1].senderKaiPulse as number)) {
        issues.push(`senderKaiPulse decreased at #${i}`);
      }
    }

    entries.push(entry);
  }

  return { ok: issues.length === 0, count: hardened.length, issues, entries };
}

/* Make the stableStringify import “used” without altering behavior */
export { stableStringify as __keep_stableStringify };
