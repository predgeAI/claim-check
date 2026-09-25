# Bob session 5 — make the verifier actually run

This session exists because of an honesty problem we found in our own output.

`src/verdicts.ts` is a static array. It holds the 29 verdicts your subagents produced in
session 2, frozen into TypeScript. `src/verify.ts` only merges those stored verdicts with
the claims. So `claim-check` reports a wall-clock of under 0.1 seconds, which is the time
it takes to format a table, not the time it takes to verify anything.

We are not going to publish that number with a footnote. We are going to make it true.

---

Build `src/execute.ts`, which verifies a claim for real by spawning a Bob Shell subagent.

Bob Shell is installed and authenticated on this machine. A non-interactive run is:

```
bob run "<prompt>"
```

It reads `BOB_API_KEY` from the environment. Do not read, print, log or write that value
anywhere — not to stdout, not into a file, not into an error message.

Export:

```ts
export async function verifyClaim(
  claim: Claim,
  opts: { repoRoot: string; diffPath: string; timeoutMs?: number }
): Promise<Verdict>;

export async function verifyAll(
  claims: Claim[],
  opts: { repoRoot: string; diffPath: string; concurrency?: number }
): Promise<Verdict[]>;
```

Requirements, in the order they matter:

1. **One subagent per claim, running concurrently.** Default concurrency 8, configurable.
   The point of the design is that N independent searches happen at once, so a serial
   implementation defeats it.
2. **Each subagent sees only its own claim.** No shared conversation, no batching several
   claims into one prompt.
3. **The subagent must return parseable output.** Ask it for a single JSON object with
   `verdict`, `evidence` and `reasoning`, and nothing else. Parse it strictly. If the output
   does not parse, the verdict is `cannot-tell` with the reason recorded — never guess.
4. **`cannot-tell` is a real answer.** A subagent that finds no evidence must say so. Do not
   let an empty search become `holds`.
5. **Timeout per claim**, default 120 s. A timed-out claim is `cannot-tell`, not a failure
   of the whole run.
6. **Measure and return real wall-clock** for the whole batch.

Then rewire `src/cli.ts`:

- default behaviour runs the real executor;
- `--replay` uses the stored `src/verdicts.ts` instead, so the frozen demo still works
  offline and at judging time without an API key;
- the report footer states which mode produced it, in words, on its own line.

Finally, run it for real against `corpus/pr-2476.json` and tell me three things: the true
wall-clock, whether the live verdicts match the stored ones, and every claim where they
differ. If the live run disagrees with session 2, that is the interesting result, not a
problem to hide.
