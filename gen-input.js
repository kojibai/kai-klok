// gen-input.mjs
import { poseidon } from "circomlibjs";
import { writeFileSync } from "fs";

const secret = 123456789n;
const hash = poseidon([secret]);
const expectedHash = hash.toString(); // field-friendly

const input = {
  secret: secret.toString(),
  expectedHash
};

writeFileSync("zk/input.json", JSON.stringify(input, null, 2));
console.log("✅ input.json written:", input);
