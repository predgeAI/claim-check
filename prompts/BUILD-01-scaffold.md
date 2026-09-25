# Bob session 1 — scaffold the extractor

Paste this into Bob as the first task. It builds the piece that turns prose into
falsifiable claims.

---

You are working in this repository. Read `docs/CONCEPT.md` first so you know what we
are building, then read `corpus/pr-2476.json`, which is a captured pull request: its
description, its review comments and its review threads.

Build `src/extract.ts`, a module that exports:

```ts
export type Claim = {
  id: string;            // c01, c02, ...
  text: string;          // the claim, rewritten as a single testable sentence
  source: "description" | "review-comment" | "review-thread";
  sourceQuote: string;   // the exact substring it came from, for citation
};

export function extractClaims(pr: CapturedPr): Claim[];
```

Rules for what counts as a claim, and these matter more than the code:

- A claim is falsifiable by reading the repository. "The cap is checked against
  content-length before the body is read" is a claim. "This is cleaner" is not.
- Intent is not a claim. "We plan to add tests" is not a claim.
- A claim about the future is not a claim. Only what the code is said to do now.
- Split compound sentences. "It validates the payload and rejects 429s as EXTERNAL" is
  two claims, because one can hold while the other does not.
- Keep the original wording in `sourceQuote`. The reviewer has to be able to see where
  a claim came from without trusting the rewrite.

Do not verify anything yet. This session only produces the list.

When you are done, run it against `corpus/pr-2476.json` and print the claims as a
numbered list, with the source quote under each one. Tell me how many you found.
