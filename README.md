# Claim Check

**Does this pull request do what its description says?**

**Live demo: [claim-check-five.vercel.app](https://claim-check-five.vercel.app)** · [deck (PDF)](media/claim-check-deck.pdf)

Built for the IBM Bob 2.0 Hackathon, 25–27 September 2026.

---

## The half of code review nobody budgets for

Reading the diff is the visible half. The other half is checking that every claim the
author made in the description is actually true in the code.

Here is a maintainer doing that half by hand, this month, in public:

> "The branch was rebased, so I compared each file at `b957594` against `62edf7b`
> rather than reading a compare range. … Does it match the description: Matches.
> Every behavioural claim in the body holds."

That pull request is 10 files and 1,752 added lines. It took four review rounds and
produced 44,718 characters of review prose. The description alone carries a dozen
falsifiable claims, and each one has to be located somewhere in the tree and judged.

Under load, reviewers skip this. That is how a pull request whose description says it
validates the payload gets merged without validating the payload.

## What Claim Check does

1. Reads the pull request description and the review thread, and extracts every
   **falsifiable** behavioural claim, discarding intent and opinion.
2. Spawns **one subagent per claim, in parallel**, each with full-repository context.
3. Each subagent returns a verdict and a `file:line` citation.
4. Emits a table the reviewer reads instead of the raw diff: claim → holds /
   does not hold / **cannot tell** → evidence.

`cannot tell` is not a failure mode. It is the output that matters most: a claim
nobody has checked.

## What it does not do

It does not approve, reject or grade. It does not judge code quality, style or design.
A `holds` verdict means evidence was found, **not** that the code is correct.

## Why this needs Bob 2.0

| Bob capability | Where it carries the work |
|---|---|
| Document understanding | The claims are in prose: a description and a review thread |
| Full repository context | The evidence is spread across files and survives a rebase |
| Subagents | One per claim, isolated, so one hard claim cannot stall the rest |
| Parallel tasks | N independent searches, which is what makes it viable per push |

Remove any one of the four and the tool either misses claims or takes longer than
simply reading the diff.

## The demo is real, public and checkable

[KeeperHub PR #2476](https://github.com/KeeperHub/keeperhub/pull/2476) — four review
rounds, ten files, and a maintainer who documented his own manual process in the
thread. The corpus is captured in [`corpus/`](corpus/) so the demo reproduces without
depending on GitHub at judging time.

We also know the tool's ceiling, because we found it on this same codebase before the
hackathon: two canonicalisation functions disagree, since the signer drops `undefined`
keys and the verifier does not. Byte-identical today, silently incompatible the moment
a field becomes conditional. Four rounds of expert human review did not surface it,
because it is invisible in any single file. Whether Claim Check surfaces it is written
up honestly in `docs/FINDINGS.md`, including if the answer is no.

## Layout

```
corpus/        the captured pull request: description, review thread, diff
docs/          concept, problem and solution statement, findings, video plan
prompts/       the Bob sessions that built this, in order
bob-sessions/  Bob task session screenshots (submission requirement)
src/           the tool
```

## Run it

```
claim-check --pr corpus/pr-2476.json --repo .
```

## Licence

MIT. See [LICENSE](LICENSE).
