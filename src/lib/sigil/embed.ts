import { packLedger } from "../ledger/log";
import type { LedgerV1, PackedLedgerV1 } from "../ledger/types";
import type { DhtBlock } from "../sync/dht";

export type EmbeddedBundle = {
  ledger: PackedLedgerV1;
  dht?: DhtBlock;
  // keep your existing fields unchanged:
  valuation?: unknown;
  valuationSource?: unknown;
  valuationRuntime?: unknown;
  valuationLiveAtExport?: number | null;
  weekdayResolved?: string | null;
};

export async function buildEmbeddedBundle(args: {
  ledger: LedgerV1;
  dht?: DhtBlock;
  carry: Pick<EmbeddedBundle, "valuation"|"valuationSource"|"valuationRuntime"|"valuationLiveAtExport"|"weekdayResolved">;
}): Promise<EmbeddedBundle> {
  const packed = await packLedger(args.ledger);
  return {
    ledger: packed,
    dht: args.dht,
    ...args.carry,
  };
}
