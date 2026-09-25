// src/run.ts — run extractClaims against corpus/pr-2476.json and print results

import { readFileSync } from "fs";
import { extractClaims, type CapturedPr } from "./extract.js";

const raw = readFileSync("corpus/pr-2476.json", "utf-8");
const pr = JSON.parse(raw) as CapturedPr;

const claims = extractClaims(pr);

console.log(`\nFound ${claims.length} claims in pr-2476\n`);
console.log("=".repeat(72));

for (const c of claims) {
  console.log(`\n${c.id}  [${c.source}]`);
  console.log(`   ${c.text}`);
  console.log(`   SOURCE: "${c.sourceQuote}"`);
}

console.log(`\n${"=".repeat(72)}`);
console.log(`Total: ${claims.length} claims`);
