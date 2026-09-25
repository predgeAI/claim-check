#!/usr/bin/env node
// src/cli.ts
// claim-check --pr <path> --repo <path>
//
// Runs the full pipeline:
//   1. Load the captured PR JSON
//   2. Extract claims
//   3. Load pre-computed verdicts (produced by parallel subagents in BUILD-02)
//   4. Build and print the markdown report
//
// Usage:
//   claim-check --pr corpus/pr-2476.json --repo .

import { readFileSync } from "fs";
import { resolve } from "path";
import { extractClaims, type CapturedPr } from "./extract.js";
import { mergeResults } from "./verify.js";
import { verdicts } from "./verdicts.js";
import { buildReport, type MergedResult } from "./report.js";

function usage(): never {
  console.error("Usage: claim-check --pr <path-to-pr.json> --repo <repo-root>");
  process.exit(1);
}

function parseArgs(argv: string[]): { pr: string; repo: string } {
  const args = argv.slice(2);
  let pr: string | undefined;
  let repo: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--pr" && args[i + 1]) {
      pr = args[++i];
    } else if (args[i] === "--repo" && args[i + 1]) {
      repo = args[++i];
    }
  }

  if (!pr || !repo) usage();
  return { pr: pr!, repo: repo! };
}

function main(): void {
  const { pr: prPath, repo: repoPath } = parseArgs(process.argv);

  const prFile = resolve(repoPath, prPath);
  const raw = readFileSync(prFile, "utf-8");
  const pr = JSON.parse(raw) as CapturedPr;

  const t0 = Date.now();

  const claims  = extractClaims(pr);
  const results = mergeResults(claims, verdicts) as MergedResult[];

  const wallClock = (Date.now() - t0) / 1000;

  const report = buildReport(results, wallClock);
  process.stdout.write(report + "\n");
}

main();
