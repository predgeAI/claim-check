# IBM Bob Usage Statement

Claim Check was built inside Bob IDE across five sessions in one night. Nothing in `src/`
was written by hand. The prompts are in `prompts/`, in the order they ran, so the build is
reproducible rather than described.

**Session 1 — document understanding.** Bob read a captured pull request: the description,
eight comments and seven review threads, 44,718 characters of prose. The task was
extraction, not summary: pull every claim a reader could falsify by opening the repository,
and discard intent and opinion. Bob produced 29 claims, each
carrying the verbatim quote it came from. This is the part a single prompt handles badly,
because the claims are scattered through argument rather than listed.

**Session 2 — subagents and parallel tasks.** One subagent per claim, 29 running
concurrently, each with full-repository context and none seeing the others. Isolation was
the point: a hard claim stalls only its own subagent, and none is biased by a neighbour.
Each returned one of three verdicts with `file:line` evidence, and we instructed Bob that
`cannot tell` must never be dressed up as `holds`.

**Session 3 — whole-repository context.** Bob assembled the report, ordering it by what
should stop a merge rather than by claim number, and wrote the CLI.

**Session 5 — a live executor.** Sessions 1 to 4 froze the 29 verdicts into TypeScript, so
the tool reported a sub-0.1-second wall-clock that only measured formatting. Rather than
publish that with a footnote, we had Bob write `src/execute.ts`, which spawns one `bob run`
subprocess per claim over Bob Shell and produces the verdicts for real; `--replay` still
serves the stored run when no budget remains.

**Session 4 — adversarial self-test.** We asked Bob to compare its own output against the
maintainer's hand-written conclusions in the same thread, and to record every disagreement,
including where the tool is wrong.

**What it found.** Of 29 claims, 28 held and one did not. The failing claim was ours: the
description said every outbound request passes through an always-on SSRF guard, and Bob
located a connection-test function calling the raw `fetch` global on an operator-supplied
URL. Four rounds of expert human review had not caught it. We fixed it, added six tests, and disclosed it
ourselves in the pull request thread the same night.

**What we would rather say than not.** Bob returned zero `cannot tell` verdicts, which is
suspiciously clean; session 4 exists partly to probe whether the subagents reach for a
verdict on thin evidence. The tool also has a ceiling: it verifies claims that were made. A
latent defect in this same codebase — two canonicalisation functions that disagree on
`undefined` keys — appears in no claim, so no subagent could look for it. That is a boundary
of the method, not a bug in Bob.

Each of Bob's advertised capabilities carried a distinct part of this. Remove any one and
the tool either misses claims or takes longer than reading the diff.
