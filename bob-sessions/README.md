# Bob task session screenshots

Evidence that Claim Check was built and run inside IBM Bob IDE, as the
hackathon rules require. Every screenshot is a real Bob task session, with the
subagent prompt, its reasoning over the captured diff, and the Bobcoin cost.

- **session-1.png** — the real executor (`src/execute.ts`) open in the Bob
  editor, one verification task selected, and the task history: `Recent(46)`.
- **session-2.png** — a subagent verifying the 64 KiB body-length claim: it
  reads `corpus/pr-2476.diff`, cites lines 778, 779 and 788 and the comment at
  295-303, and returns `partially`. Cost 0.111.
- **session-3.png** — a subagent verifying subject binding, with its reasoning
  and the final JSON verdict `{"verdict":"holds","evidence":"...:541", ...}`.
- **session-4.png** — a subagent verifying claim c01 (the signal fetch),
  verdict `holds`, cost 0.048; the task list shows the per-task costs.
- **session-5.png** — the full working environment: Bob IDE with the 46-task
  history, the live review app, and the terminal.

Budget: the run exhausted the 40-Bobcoin allowance (visible as "Budget
Exceeded" in several shots), which is why the demo runs in `--replay` from the
stored verdicts.
