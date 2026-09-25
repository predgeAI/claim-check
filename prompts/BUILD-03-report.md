# Bob session 3 — the report a reviewer actually reads

---

Build `src/report.ts`, which turns claims plus verdicts into the output a reviewer
opens instead of the raw JSON.

Markdown table, ordered so that the reviewer's attention goes where it should:

1. `does-not-hold` first. These are the reasons to stop the merge.
2. `cannot-tell` second. These are the claims nobody has checked, which is the gap this
   tool exists to expose.
3. `holds` last, collapsed behind a details block, because they need no action.

Columns: claim, verdict, evidence as a clickable `file:line`, and the source quote.

Under the table, print four numbers and nothing else: claims found, verified with
evidence, wall-clock seconds, and how many of the maintainer's own written conclusions
in the thread the tool agrees with.

Then add `src/cli.ts` so the whole thing runs as one command:

```
claim-check --pr corpus/pr-2476.json --repo .
```

Keep the output honest. A `holds` verdict means evidence was found, not that the code
is correct, and the report should say so in one line at the bottom.
