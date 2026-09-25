#!/usr/bin/env node
// src/cli.ts
// claim-check --pr <path> --repo <path> [--replay]
//
// Default: runs the real executor (bob run per claim, concurrently).
// --replay: uses stored src/verdicts.ts — works offline, zero API cost.

import { readFileSync } from "fs";
import { resolve } from "path";
import { extractClaims, type CapturedPr } from "./extract.js";
import { mergeResults } from "./verify.js";
import { verdicts as storedVerdicts } from "./verdicts.js";
import { verifyAll } from "./execute.js";
import { buildReport, type MergedResult } from "./report.js";

function usage(): never {
  console.error(
    "Usage: claim-check --pr <path-to-pr.json> --repo <repo-root> [--replay] [--diff <path>] [--concurrency <n>]"
  );
  process.exit(1);
}

interface Args {
  pr:          string;
  repo:        string;
  replay:      boolean;
  diff:        string;
  concurrency: number;
}

function parseArgs(argv: string[]): Args {
  const args = argv.slice(2);
  let pr:          string | undefined;
  let repo:        string | undefined;
  let replay       = false;
  let diff         = "corpus/pr-2476.diff";
  let concurrency  = 8;

  for (let i = 0; i < args.length; i++) {
    if      (args[i] === "--pr"          && args[i + 1]) { pr   = args[++i]; }
    else if (args[i] === "--repo"        && args[i + 1]) { repo = args[++i]; }
    else if (args[i] === "--diff"        && args[i + 1]) { diff = args[++i]; }
    else if (args[i] === "--concurrency" && args[i + 1]) { concurrency = Number(args[++i]); }
    else if (args[i] === "--replay")                     { replay = true; }
  }

  if (!pr || !repo) usage();
  return { pr: pr!, repo: repo!, replay, diff, concurrency };
}

async function main(): Promise<void> {
  const { pr: prPath, repo: repoPath, replay, diff, concurrency } = parseArgs(process.argv);

  const prFile = resolve(repoPath, prPath);
  const raw    = readFileSync(prFile, "utf-8");
  const pr     = JSON.parse(raw) as CapturedPr;
  const claims = extractClaims(pr);

  let results:     MergedResult[];
  let wallClock:   number;
  let mode:        string;

  if (replay) {
    // ── Replay mode: use the frozen verdicts from BUILD-02 ────────────────
    const t0 = Date.now();
    results   = mergeResults(claims, storedVerdicts) as MergedResult[];
    wallClock = (Date.now() - t0) / 1000;
    mode      = "replay (stored verdicts from BUILD-02 — no API calls)";
  } else {
    // ── Live mode: one bob run subagent per claim, concurrently ──────────
    if (!process.env["BOB_API_KEY"]) {
      console.error("Error: BOB_API_KEY is not set. Use --replay to run offline.");
      process.exit(1);
    }
    process.stderr.write(
      `Running ${claims.length} claims via bob run (concurrency=${concurrency})…\n`
    );
    const batch = await verifyAll(claims, {
      repoRoot:    repoPath,
      diffPath:    diff,
      concurrency,
    });
    results   = mergeResults(claims, batch.verdicts) as MergedResult[];
    wallClock = batch.wallClockMs / 1000;
    mode      = `live (bob run, ${claims.length} subagents, concurrency=${concurrency})`;
  }

  const report = buildReport(results, wallClock, mode);
  process.stdout.write(report + "\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
