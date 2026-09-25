# Claim Check — does this PR do what it says?

IBM Bob 2.0 Hackathon, 25–27 Sep 2026. Team: Predge (Latcom, #15722, Approved).

## The problem, from a real review this week

A maintainer reviewing an external plugin wrote this by hand:

> "The branch was rebased, so I compared each file at `b957594` against `62edf7b`
> rather than reading a compare range. … **Does it match the description:** Matches.
> Every behavioural claim in the body holds at `62edf7b`."

That sentence is the expensive part of code review. Not reading the diff — checking
that every claim the author made is actually true in the code. It took four review
rounds on one plugin.

The cost is invisible because it looks like reading. It is really: extract N claims
from prose, locate the code for each, decide whether it holds, remember all N while
doing it. Reviewers skip it under load, and that is how a PR whose description says
"validates the payload" merges without validating the payload.

## The solution

Given a PR, Claim Check:

1. reads the PR description and the review thread, and extracts every **falsifiable**
   behavioural claim ("resource is checked fifth", "the cap is enforced by header then
   by body length"), discarding opinion and intent;
2. spawns **one subagent per claim, in parallel** — this is what makes it fast enough
   to run on every push rather than once at the end;
3. each subagent locates the relevant code with full-repository context and returns
   a verdict plus `file:line` evidence;
4. emits a review table: claim → holds / does not hold / cannot tell, each with a
   citation a human can click.

It does not approve or reject. It tells the reviewer where to look, and which claims
nobody has checked.

## Why Bob 2.0 specifically

The four features the theme names map one to one:

| Bob feature | Where it is used |
|---|---|
| Full repository context | Locating the code behind a claim, across a rebase |
| Document understanding | Reading the PR body and review thread as the source of claims |
| Subagents | One per claim, isolated so one hard claim cannot stall the rest |
| Parallel tasks | N claims verified concurrently, which is what makes it per-push viable |

A single-prompt assistant cannot do this: the claims are in prose, the evidence is
spread across files, and the work is N independent searches, not one.

## The demo

Public, real, and checkable: **KeeperHub PR #2476**, four review rounds, a maintainer
who documented his own manual process in the thread.

Three beats, ninety seconds of screen:
1. Point Claim Check at the PR. It extracts the claims from the description.
2. Subagents run in parallel; the table fills in with `file:line` citations.
3. Compare against what the maintainer concluded by hand. Where it agrees, it
   reproduces four rounds of human work. Where it disagrees is the interesting part.

**The honest hook:** on that same codebase this week we found a latent divergence
between two canonicalisation functions — the signer drops `undefined` keys, the
reviewed verifier does not. Byte-identical today, silently incompatible the moment a
field becomes conditional. Four rounds of expert human review did not surface it,
because it is not visible in any single file. That is exactly the shape of claim a
per-claim search with whole-repo context is good at and a human reader is not.

## Impact we can state

Measured on this PR, not extrapolated: number of claims in the description, how many
the tool verified, wall-clock versus the maintainer's own account of comparing files
by hand across a rebase.

## What is NOT claimed

It does not judge code quality, style or design. It does not replace the reviewer. A
"holds" verdict means evidence was found, not that the code is correct.

---

## Build plan

**Today (no Bob access yet — access opens at kickoff, 25 Sep 18:00 MSK):**
- [x] Concept locked
- [ ] Capture the PR corpus offline (description, review comments, diff) so the demo
      is reproducible and does not depend on GitHub at judging time
- [ ] Problem & Solution statement, 500 words
- [ ] Public repository skeleton + README
- [ ] Video shot list

**At kickoff:**
- [ ] Confirm the assigned IBM Bob account, install Bob IDE, check Bobcoin budget
- [ ] Build inside Bob IDE — this is a judging requirement, not a preference
- [ ] Save Bob task session summary screenshots **into the repository** (required)
- [ ] IBM Bob Usage Statement, 500 words

**Submission requirements, from the rules:**
- Public repository, MIT-compliant, original
- Bob task session screenshots from every team member, in the repo
- Video ≤ 3 minutes, ≥ 90 seconds showing the solution running, with narration
- Both statements ≤ 500 words
- Deadline: 27 Sep 18:00 MSK
