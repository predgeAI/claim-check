// src/verify.ts
// Verification layer: one Verdict per Claim, produced by parallel subagents.
// This module owns the Verdict type; actual verification is in src/verdicts.ts
// (the collected subagent outputs).

import type { Claim } from "./extract.js";

export type Verdict = {
  claimId: string;
  verdict: "holds" | "does-not-hold" | "cannot-tell";
  evidence: string;   // file:line, or several, separated by commas
  reasoning: string;  // at most two sentences
};

/**
 * Given an array of Verdicts (one per Claim), return them indexed by claimId
 * for fast lookup in the runner.
 */
export function indexVerdicts(verdicts: Verdict[]): Map<string, Verdict> {
  return new Map(verdicts.map((v) => [v.claimId, v]));
}

/**
 * Merge claims with their verdicts for the final report.
 */
export function mergeResults(
  claims: Claim[],
  verdicts: Verdict[]
): Array<Claim & { verdict: Verdict }> {
  const idx = indexVerdicts(verdicts);
  return claims.map((c) => {
    const v = idx.get(c.id);
    if (!v) throw new Error(`No verdict for claim ${c.id}`);
    return { ...c, verdict: v };
  });
}
