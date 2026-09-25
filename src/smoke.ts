// src/smoke.ts — run verifyClaim on c01, c02, c03 only, report cost + wall-clock
// Usage: tsx src/smoke.ts

import { readFileSync } from "fs";
import { verifyClaim } from "./execute.js";
import { extractClaims, type CapturedPr } from "./extract.js";

const pr = JSON.parse(readFileSync("corpus/pr-2476.json", "utf-8")) as CapturedPr;
const allClaims = extractClaims(pr);
const targets = allClaims.filter((c) => ["c01", "c02", "c03"].includes(c.id));

const opts = { repoRoot: ".", diffPath: "corpus/pr-2476.diff" };

console.log(`Smoke-testing ${targets.length} claims concurrently via bob run…\n`);

const t0 = Date.now();
const results = await Promise.all(
  targets.map(async (claim) => {
    const claimT0 = Date.now();
    const verdict = await verifyClaim(claim, opts);
    const claimMs = Date.now() - claimT0;
    return { claim, verdict, claimMs };
  })
);
const wallMs = Date.now() - t0;

let totalCost = 0;
for (const { claim, verdict, claimMs } of results) {
  totalCost += verdict.costBobcoins;
  console.log(`${claim.id}  ${verdict.verdict.toUpperCase()}`);
  console.log(`   claim:     ${claim.text.slice(0, 90)}`);
  console.log(`   evidence:  ${verdict.evidence || "(none)"}`);
  console.log(`   reasoning: ${verdict.reasoning.slice(0, 120)}`);
  console.log(`   time:      ${(claimMs / 1000).toFixed(1)} s`);
  console.log(`   cost:      ${verdict.costBobcoins.toFixed(3)} Bobcoins`);
  console.log();
}

console.log(`Wall-clock (3 concurrent): ${(wallMs / 1000).toFixed(1)} s`);
console.log(`Total cost:                ${totalCost.toFixed(3)} Bobcoins`);
console.log(`Average per claim:         ${(totalCost / targets.length).toFixed(3)} Bobcoins`);
