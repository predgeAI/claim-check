// src/run-verify.ts — merge claims with verdicts and print the review table

import { readFileSync } from "fs";
import { extractClaims, type CapturedPr } from "./extract.js";
import { mergeResults } from "./verify.js";
import { verdicts } from "./verdicts.js";

const raw = readFileSync("corpus/pr-2476.json", "utf-8");
const pr = JSON.parse(raw) as CapturedPr;
const claims = extractClaims(pr);
const results = mergeResults(claims, verdicts);

// Tally
const holds = results.filter((r) => r.verdict.verdict === "holds").length;
const doesNotHold = results.filter((r) => r.verdict.verdict === "does-not-hold").length;
const cannotTell = results.filter((r) => r.verdict.verdict === "cannot-tell").length;

const SYMBOL: Record<string, string> = {
  "holds": "✅",
  "does-not-hold": "❌",
  "cannot-tell": "❓",
};

console.log("\nClaim Check — pr-2476 verification results");
console.log("=".repeat(80));

for (const r of results) {
  const sym = SYMBOL[r.verdict.verdict];
  console.log(`\n${r.id}  ${sym}  ${r.verdict.verdict.toUpperCase()}`);
  console.log(`   Claim:     ${r.text}`);
  console.log(`   Evidence:  ${r.verdict.evidence}`);
  console.log(`   Reasoning: ${r.verdict.reasoning}`);
  console.log(`   Source:    [${r.source}] "${r.sourceQuote.slice(0, 100)}${r.sourceQuote.length > 100 ? "…" : ""}"`);
}

console.log(`\n${"=".repeat(80)}`);
console.log(`Summary: ${results.length} claims  |  ✅ ${holds} holds  |  ❌ ${doesNotHold} does-not-hold  |  ❓ ${cannotTell} cannot-tell`);
