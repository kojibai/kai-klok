// gen-input.mjs
import { buildPoseidon } from "circomlibjs";
import { writeFileSync } from "fs";

const secret = 123456789n;

const poseidon = await buildPoseidon(); // this returns a promise
const hash = poseidon.F.toString(poseidon([secret]));

const input = {
  secret: secret.toString(),
  expectedHash: hash
};

writeFileSync("zk/input.json", JSON.stringify(input, null, 2));
console.log("✅ input.json written:", input);
