// scripts/live-run.mjs
//
// WRITTEN BY HAND, not by Bob. Everything in src/ was built inside Bob IDE; this
// driver was written at 2am to diagnose the live executor Bob built in session 5,
// after it returned a false "holds" on c02. Kept in the repository because it is
// the evidence for the universal-claim finding in docs/FINDINGS.md.
//
// Differences from src/execute.ts that matter:
//   --mode ask         the verifier is read-only; agent mode can write files, and a
//                      checker that can edit the code it is judging is a hole
//   stdin closed       without it `bob run` waits for input and hangs to timeout
//   universal claims   "every/always/never/all" get a counterexample-search prompt
//                      and must list every location checked
//   --max-cost         per-claim ceiling so a stuck run cannot drain the budget
//
// Paths below are this machine's; adjust NODE_BIN for yours.

import { spawn } from "node:child_process";
import fs from "node:fs";

const REPO = "/Users/amir/Documents/Playground/claim-check";
const NODE_BIN = "/Users/amir/.nvm/versions/node/v24.18.0/bin";
const BOB = `${NODE_BIN}/bob`;
const OUT = process.env.OUT || "/tmp/live-verdicts2.jsonl";
const CONCURRENCY = Number(process.env.CONCURRENCY || 8);
const TIMEOUT_MS = 150_000;
const MAX_COST = process.env.MAX_COST || "0.5";
const ONLY = (process.env.ONLY || "").split(",").filter(Boolean);

let claims = JSON.parse(fs.readFileSync("/tmp/claims.json", "utf8"));
if (ONLY.length) claims = claims.filter((c) => ONLY.includes(c.id));
fs.writeFileSync(OUT, "");

// A claim about ALL cases cannot be confirmed by one example; it can only be
// refuted by a counterexample. Detect the quantifier in either the rewrite or
// the author's original words.
const UNIVERSAL = /\b(every|always|always-on|never|all|any|none|no\s+\w+\s+(is|are|can)|nothing|only)\b/i;

function prompt(c) {
  const universal = UNIVERSAL.test(c.text) || UNIVERSAL.test(c.sourceQuote);
  const rule = universal
    ? `THIS IS A UNIVERSAL CLAIM. It says something is true in EVERY case. Finding one place where it is true does NOT make it hold. You must search the ENTIRE diff for a counterexample — every call site, every code path, every file that could be affected, including tests, connection checks and helpers, not only the main path. List every location you checked in "checked". The verdict is "holds" ONLY if you checked all of them and found no exception. If you found an exception, the verdict is "does-not-hold" and the evidence is the exception. If you could not be sure you covered every path, the verdict is "cannot-tell".`
    : `Locate the code that settles this claim.`;
  return `You are verifying ONE claim about a pull request. You are read-only: do not modify any file. The diff is at corpus/pr-2476.diff in this repository.

CLAIM: ${JSON.stringify(c.text)}
ORIGINAL WORDS: ${JSON.stringify(c.sourceQuote)}

${rule}

Reply with a single JSON object and nothing else:
{"verdict":"holds"|"does-not-hold"|"cannot-tell","evidence":"file:line","checked":["file:line", "..."],"reasoning":"at most two sentences"}

If you find no evidence either way, the verdict is cannot-tell. Never report holds without evidence.`;
}

function extractVerdict(text) {
  if (!text) return null;
  // The model often wraps its JSON in a markdown fence. Strip it, then parse.
  let t = String(text).replace(/```(?:json)?/gi, "").trim();
  try { const j = JSON.parse(t); if (j && j.verdict) return j; } catch {}
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) { try { const j = JSON.parse(t.slice(a, b + 1)); if (j && j.verdict) return j; } catch {} }
  return null;
}

function runOne(c) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const universal = UNIVERSAL.test(c.text) || UNIVERSAL.test(c.sourceQuote);
    const env = { ...process.env, PATH: `${NODE_BIN}:${process.env.PATH}` };
    const args = ["run", "--mode", "ask", "--format", "json", "--max-cost", MAX_COST, "--disable-subagents", prompt(c)];
    // stdin closed: without this, bob waits for input that never arrives.
    const p = spawn(BOB, args, { cwd: REPO, env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    const timer = setTimeout(() => p.kill("SIGTERM"), TIMEOUT_MS);
    p.on("close", (code) => {
      clearTimeout(timer);
      let env2 = null; try { env2 = JSON.parse(out); } catch {}
      const last = env2?.last_message ?? out;
      const v = extractVerdict(typeof last === "string" ? last : JSON.stringify(last));
      const cost = typeof env2?.stats?.session_costs === "number" ? env2.stats.session_costs : null;
      const wall = (Date.now() - t0) / 1000;
      const rec = v
        ? { id: c.id, universal, verdict: v.verdict, evidence: v.evidence || "", checked: v.checked || [], reasoning: v.reasoning || "", cost, wall, exit: code }
        : { id: c.id, universal, verdict: "cannot-tell", evidence: "", checked: [], reasoning: `no parseable verdict (exit ${code})`, cost, wall, exit: code, rawTail: (out + err).slice(-400) };
      fs.appendFileSync(OUT, JSON.stringify(rec) + "\n");
      process.stdout.write(`${c.id} ${universal ? "∀" : " "} ${rec.verdict.padEnd(14)} cost=${cost ?? "?"} ${wall.toFixed(1)}s\n`);
      resolve(rec);
    });
  });
}

const t0 = Date.now();
const queue = [...claims], results = [];
async function worker() { while (queue.length) results.push(await runOne(queue.shift())); }
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, claims.length) }, worker));
const wall = (Date.now() - t0) / 1000;
const cost = results.reduce((s, r) => s + (typeof r.cost === "number" ? r.cost : 0), 0);
const n = (k) => results.filter((r) => r.verdict === k).length;
console.log(`\nИТОГО: ${results.length} · wall-clock ${wall.toFixed(1)}s · стоимость ${cost.toFixed(3)}`);
console.log(`holds ${n("holds")} · does-not-hold ${n("does-not-hold")} · cannot-tell ${n("cannot-tell")}`);
