# IBM Bob Usage Statement

Claim Check was built inside Bob IDE across four sessions in one night. Nothing in `src/`
was written by hand. The prompts that produced it are in `prompts/`, in the order they ran,
so the build is reproducible rather than merely described.

**Session 1 — document understanding.** Bob read a captured pull request: the description,
eight comments and seven review threads, 44,718 characters of prose. The task was not
summarisation but extraction: pull every claim a reader could falsify by opening the
repository, and discard intent, opinion and future tense. Bob produced 29 claims, each
carrying the verbatim quote it came from, so a reviewer can check the rewrite against the
original. This is the part a single prompt handles badly, because the claims are scattered
through argument rather than listed.

**Session 2 — subagents and parallel tasks.** One subagent per claim, 29 running
concurrently, each with full-repository context and none seeing the others. Isolation was
the point: a hard claim stalls its own subagent and nothing else, and no subagent is biased
by a neighbour's verdict. Each returned one of three verdicts with `file:line` evidence. We
instructed Bob that `cannot tell` must never be dressed up as `holds`, because a claim
nobody has checked is the most useful thing this tool can surface.

**Session 3 — whole-repository context.** Bob assembled the report, ordering it by what
should stop a merge rather than by claim number, and wrote the CLI around it.

**Session 4 — adversarial self-test.** We asked Bob to compare its own output against the
maintainer's hand-written conclusions in the same thread, and to write down every
disagreement, including the ones where the tool is wrong.

**What it found.** Of 29 claims, 28 held and one did not. The failing claim was ours: the
description said every outbound request passes through an always-on SSRF guard, and Bob
located a connection-test function calling the raw `fetch` global on an operator-supplied
URL. Four rounds of expert human review, including a pass in which each behavioural claim
was checked by hand, had not caught it. We fixed it, added six tests, and disclosed it
ourselves in the pull request thread the same night.

**What we would rather say than not.** Bob returned zero `cannot tell` verdicts, which is
suspiciously clean, and session 4 exists partly to probe whether the subagents reach for a
verdict when the evidence is thin. The tool also has a ceiling we already knew about: it
verifies claims that were made. A latent defect in this same codebase — two canonicalisation
functions that disagree on `undefined` keys — appears in no claim, so no subagent could look
for it. That is a boundary of the method, not a bug in Bob.

Each of Bob's four advertised capabilities carried a distinct part of this. Remove any one
and the tool either misses claims or takes longer than reading the diff.
