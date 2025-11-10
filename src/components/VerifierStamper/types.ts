export * from "../verifier/types/local";
// types.ts (or inline)
export interface SigilMeta {
  pulse: number;
  beat: number;
  stepIndex: number;
  chakraDay: string;
  kaiSignature: string;
  userPhiKey: string;
  [key: string]: unknown; // optional: allow future fields
}