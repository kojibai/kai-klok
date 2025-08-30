import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const pub = resolve("public");
const htmlPath = resolve(pub, "verifier.html");
const corePath = resolve(pub, "verifier-core.js");
const outPath  = resolve(pub, "verifier.inline.html");

const html = await readFile(htmlPath, "utf8");
const core = await readFile(corePath, "utf8");

// Replace the external script tag with an inline one.
const out = html.replace(
  /<script\s+src=["']\.\/verifier-core\.js["']><\/script>/i,
  `<script>${core}\n</script>`
);

await writeFile(outPath, out, "utf8");
console.log("Wrote", outPath);
