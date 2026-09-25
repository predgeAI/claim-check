// src/execute.ts
// Real executor: spawns one `bob run` subprocess per claim, concurrently.
// Each subagent sees only its own claim; no shared context; no batching.
//
// BOB_API_KEY must be set in the environment. It is never read, printed,
// logged or written by this module — it is forwarded opaquely to the child.

import { spawn } from "child_process";
import { readFileSync } from "fs";
import { resolve } from "path";
import type { Claim } from "./extract.js";
import type { Verdict } from "./verify.js";

// ── Constants ────────────────────────────────────────────────────────────────

const BOB_BIN = "/Users/amir/.nvm/versions/node/v24.18.0/bin/bob";
// Prepend node 24 so bob's own require() resolves correctly.
const BOB_NODE_PATH = "/Users/amir/.nvm/versions/node/v24.18.0/bin";

const DEFAULT_TIMEOUT_MS  = 120_000;
const DEFAULT_CONCURRENCY = 8;

// ── Prompt builder ───────────────────────────────────────────────────────────
//
// Each subagent receives:
//   - the claim text and source quote
//   - the relevant portion of the diff (read from diffPath)
//   - strict instructions to return a single JSON object, nothing else
//
// The JSON schema must match Verdict exactly (minus claimId, which we add).

function buildPrompt(claim: Claim, diffContent: string): string {
  return `You are a code-verification subagent for the Claim Check tool.
Your ONLY job is to verify ONE claim against the provided diff.
Do not read files, browse the web, or do anything other than read the diff below.

CLAIM:
id: "${claim.id}"
text: "${claim.text}"
sourceQuote: "${claim.sourceQuote.replace(/"/g, '\\"').slice(0, 300)}"

DIFF (the full code added by the PR — search this for evidence):
\`\`\`diff
${diffContent.slice(0, 32_000)}
\`\`\`

VERDICT RULES:
- "holds"          → code found that does exactly what the claim says. Evidence is MANDATORY.
- "does-not-hold"  → code found that contradicts the claim. Evidence is MANDATORY.
- "cannot-tell"    → no evidence either way was located. Use this honestly; never dress up an empty search as "holds".

Evidence must be "filename:line" or "filename:line1-line2". Use the paths from the diff headers (e.g. "plugins/predge/steps/predge-core.ts:34").

Return EXACTLY this JSON object and NOTHING ELSE — no markdown fences, no explanation, no preamble:
{"verdict":"holds"|"does-not-hold"|"cannot-tell","evidence":"file:line","reasoning":"at most two sentences"}`;
}

// ── JSON extraction ───────────────────────────────────────────────────────────
//
// Bob Shell --format json emits a single JSON envelope line:
//   {"type":"result","status":"success","stats":{...},"last_message":"<escaped>"}
//
// Strategy:
//   1. Parse the outer envelope and read last_message (which is itself a JSON string).
//   2. Fall back to scanning all lines for any {...} containing "verdict".

function parseVerdictObject(text: string): Verdict["verdict"] | null {
  try {
    const obj = JSON.parse(text) as Record<string, unknown>;
    const v = obj["verdict"];
    if (v === "holds" || v === "does-not-hold" || v === "cannot-tell") return v;
  } catch { /* not JSON */ }
  return null;
}

function extractVerdict(claimId: string, raw: string): Verdict {
  // ── Strategy 1: parse the bob --format json envelope ────────────────────
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const envelope = JSON.parse(trimmed) as Record<string, unknown>;
      // last_message holds the model's final text, which we asked to be JSON.
      const lastMsg = envelope["last_message"];
      if (typeof lastMsg === "string") {
        const inner = lastMsg.trim();
        const v = parseVerdictObject(inner);
        if (v !== null) {
          const obj = JSON.parse(inner) as Record<string, unknown>;
          return {
            claimId,
            verdict:   v,
            evidence:  typeof obj["evidence"]  === "string" ? obj["evidence"]  : "",
            reasoning: typeof obj["reasoning"] === "string" ? obj["reasoning"] : "",
          };
        }
      }
    } catch { /* not a valid envelope line */ }
  }

  // ── Strategy 2: scan all {...} blocks in raw output ─────────────────────
  const matches = [...raw.matchAll(/\{[^{}]{0,500}\}/g)];
  for (let i = matches.length - 1; i >= 0; i--) {
    try {
      const obj = JSON.parse(matches[i][0]) as Record<string, unknown>;
      const v = obj["verdict"];
      if (v === "holds" || v === "does-not-hold" || v === "cannot-tell") {
        return {
          claimId,
          verdict:   v,
          evidence:  typeof obj["evidence"]  === "string" ? obj["evidence"]  : "",
          reasoning: typeof obj["reasoning"] === "string" ? obj["reasoning"] : "",
        };
      }
    } catch { /* skip */ }
  }

  // ── Nothing parseable ────────────────────────────────────────────────────
  const tail = raw.slice(-400).replace(/\n/g, " ");
  return {
    claimId,
    verdict:   "cannot-tell",
    evidence:  "",
    reasoning: `Output did not contain a parseable verdict JSON. Raw tail: ${tail.slice(0, 200)}`,
  };
}

// ── Single-claim executor ────────────────────────────────────────────────────

export type VerdictWithCost = Verdict & { costBobcoins: number };

export async function verifyClaim(
  claim: Claim,
  opts: { repoRoot: string; diffPath: string; timeoutMs?: number },
): Promise<VerdictWithCost> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const diffContent = readFileSync(resolve(opts.repoRoot, opts.diffPath), "utf-8");
  const prompt = buildPrompt(claim, diffContent);

  return new Promise<VerdictWithCost>((resolve_) => {
    // Build child environment: inherit everything, prepend node 24 to PATH.
    // BOB_API_KEY is forwarded opaquely from process.env — never logged.
    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      PATH: `${BOB_NODE_PATH}:${process.env.PATH ?? ""}`,
    };

    const child = spawn(
      BOB_BIN,
      [
        "run",
        "--format", "json",
        "--max-turns", "4",
        "--disable-subagents",
        "--disable-mcp",
        prompt,
      ],
      {
        env: childEnv,
        cwd: opts.repoRoot,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve_({
        claimId:      claim.id,
        verdict:      "cannot-tell",
        evidence:     "",
        reasoning:    `bob run timed out after ${timeoutMs / 1000}s`,
        costBobcoins: 0,
      });
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      // Use stdout first; fall back to stderr if stdout is empty.
      const combined = stdout.trim() || stderr.trim();

      if (code !== 0 && !combined) {
        resolve_({
          claimId:      claim.id,
          verdict:      "cannot-tell",
          evidence:     "",
          reasoning:    `bob run exited with code ${code ?? "null"} and no output`,
          costBobcoins: 0,
        });
        return;
      }

      // Extract cost from the bob json envelope if present.
      let costBobcoins = 0;
      for (const line of combined.split("\n")) {
        try {
          const env = JSON.parse(line.trim()) as Record<string, unknown>;
          const stats = env["stats"] as Record<string, unknown> | undefined;
          if (typeof stats?.["session_costs"] === "number") {
            costBobcoins = stats["session_costs"] as number;
            break;
          }
        } catch { /* skip */ }
      }

      resolve_({ ...extractVerdict(claim.id, combined), costBobcoins });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve_({
        claimId:      claim.id,
        verdict:      "cannot-tell",
        evidence:     "",
        reasoning:    `Failed to spawn bob: ${err.message}`,
        costBobcoins: 0,
      });
    });
  });
}

// ── Batch executor ────────────────────────────────────────────────────────────
//
// Runs up to `concurrency` claims at once. Returns verdicts in the same order
// as the input claims array. Wall-clock is measured over the whole batch.

export type BatchResult = {
  verdicts:      Verdict[];
  wallClockMs:   number;
  totalBobcoins: number;
};

export async function verifyAll(
  claims: Claim[],
  opts: { repoRoot: string; diffPath: string; concurrency?: number; timeoutMs?: number },
): Promise<BatchResult> {
  const concurrency = opts.concurrency ?? DEFAULT_CONCURRENCY;
  const results: VerdictWithCost[] = new Array(claims.length);
  const t0 = Date.now();

  // Simple semaphore-style pool: process claims in index order, keeping at
  // most `concurrency` in-flight at once.
  let nextIdx = 0;

  async function worker(): Promise<void> {
    while (true) {
      const idx = nextIdx++;
      if (idx >= claims.length) return;
      results[idx] = await verifyClaim(claims[idx], opts);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, claims.length) }, () => worker());
  await Promise.all(workers);

  const totalBobcoins = results.reduce((sum, v) => sum + (v?.costBobcoins ?? 0), 0);
  return { verdicts: results, wallClockMs: Date.now() - t0, totalBobcoins };
}
