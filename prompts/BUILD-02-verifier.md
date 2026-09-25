# Bob session 2 — one subagent per claim, running in parallel

Paste this after session 1 produced a claim list.

---

Now build the verification layer in `src/verify.ts`.

For each claim produced by `extractClaims`, spawn **one subagent**, and run them **in
parallel**. Each subagent gets:

- the claim text and its source quote,
- full repository context,
- the diff at `corpus/pr-2476.diff`.

Each subagent returns exactly this and nothing else:

```ts
export type Verdict = {
  claimId: string;
  verdict: "holds" | "does-not-hold" | "cannot-tell";
  evidence: string;      // file:line, or several, separated by commas
  reasoning: string;     // at most two sentences
};
```

The three verdicts are not interchangeable, so be strict about them:

- `holds` — code was found that does what the claim says. Evidence is mandatory.
- `does-not-hold` — code was found that contradicts the claim. Evidence is mandatory.
- `cannot-tell` — no evidence either way was located. This is a legitimate answer and
  must never be dressed up as `holds`. A claim nobody can check is the single most
  useful thing this tool can surface.

Isolation matters: one hard claim must not stall or bias the others. Each subagent
sees its own claim only.

When it runs, show me the parallel tasks executing, then the raw verdicts.
