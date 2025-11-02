import React from "react";
import { cdata, safeStringify } from "./utils";

type Props = {
  uid: string;
  stateKeyOk: boolean;
  embeddedMetaJson?: string;
  klockIsoSnapshot: Record<string, unknown> | null;
  apiSnapshot: Record<string, unknown> | null;
  extraEmbed: Record<string, unknown> | null;
  mintSealJson: string | null;
  valuationSourceJson?: string;
  displayStepIndex: number;
  stepsPerBeat: number;
  eternalSeal?: string;
  ledgerJson: string;
  dhtJson: string;
};

const MetadataBlocks: React.FC<Props> = ({
  uid,
  stateKeyOk,
  embeddedMetaJson,
  klockIsoSnapshot,
  apiSnapshot,
  extraEmbed,
  mintSealJson,
  valuationSourceJson,
  displayStepIndex,
  stepsPerBeat,
  eternalSeal,
  ledgerJson,
  dhtJson,
}) => {
  return (
    <>
      {stateKeyOk && embeddedMetaJson && <metadata>{cdata(embeddedMetaJson)}</metadata>}

      {klockIsoSnapshot && (
        <metadata id={`${uid}-klock-json`}>{cdata(safeStringify(klockIsoSnapshot))}</metadata>
      )}
      {apiSnapshot && (
        <metadata id={`${uid}-kai-api-json`}>{cdata(safeStringify(apiSnapshot))}</metadata>
      )}
      {eternalSeal && <metadata id={`${uid}-eternal-seal`}>{cdata(eternalSeal)}</metadata>}
      {extraEmbed && (
        <metadata id={`${uid}-extra-embed`}>{cdata(safeStringify(extraEmbed))}</metadata>
      )}
      {mintSealJson && <metadata id={`${uid}-valuation-seal-json`}>{cdata(mintSealJson)}</metadata>}
      {stateKeyOk && valuationSourceJson && (
        <metadata id={`${uid}-valuation-source-json`}>{cdata(valuationSourceJson)}</metadata>
      )}

      <metadata id="sigil-display">{`{"stepIndex":${displayStepIndex},"stepsPerBeat":${stepsPerBeat}}`}</metadata>

      {stateKeyOk && embeddedMetaJson && (
        <>
          <metadata id={`${uid}-ledger-json`}>{cdata(ledgerJson)}</metadata>
          <metadata id={`${uid}-dht-json`}>{cdata(dhtJson)}</metadata>
        </>
      )}
    </>
  );
};

export default MetadataBlocks;