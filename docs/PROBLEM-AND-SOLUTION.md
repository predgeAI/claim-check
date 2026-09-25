# Problem & Solution Statement (≤500 words)

## The problem

Reviewing a pull request has two halves. Reading the diff is the visible half. The
other half is checking that every claim the author made in the description is actually
true in the code, and that is where the time goes.

Here is a maintainer doing that half by hand this month:

> "The branch was rebased, so I compared each file at `b957594` against `62edf7b`
> rather than reading a compare range. … Does it match the description: Matches.
> Every behavioural claim in the body holds."

That pull request is 10 files and 1,752 added lines. It took four review rounds and
produced 44,718 characters of review prose. The description alone carries a dozen
falsifiable claims — "the cap is checked against content-length before the body is
read", "resource binding is the fifth check" — and each has to be located somewhere in
the tree and judged true or false.

Under load, reviewers skip this. That is how a pull request whose description says it
validates the payload gets merged without validating the payload.

## The solution

Claim Check reads a pull request the way a careful reviewer does, and parallelises the
part a human cannot.

It extracts every falsifiable behavioural claim from the description and the review
thread, discarding intent and opinion. It then runs one subagent per claim,
concurrently, each with full-repository context, each returning a verdict and a
`file:line` citation. The output is a table: claim, holds or does not hold or cannot
tell, evidence.

It does not approve, reject or grade. It tells the reviewer which claims are backed by
code, and which ones nobody has checked.

## Why this needs Bob 2.0 and not a prompt

The claims are in prose, so it needs document understanding. The evidence is spread
across files and survives a rebase, so it needs whole-repository context. The work is
N independent searches rather than one question, so it needs subagents running as
parallel tasks. Remove any one of the three and the tool either misses claims or takes
longer than just reading the diff.

## Impact, measured rather than extrapolated

We run it against the real pull request above and report four numbers: claims found,
claims verified with evidence, wall-clock time, and agreement with what the maintainer
concluded by hand across four rounds.

We also know its ceiling, and we found it on the same codebase. Two canonicalisation
functions disagree: the signer drops `undefined` keys, the reviewed verifier does not.
The bytes are identical today and silently incompatible the first time a field becomes
conditional. Four rounds of expert human review did not surface it, because it is
invisible in any single file. That is precisely the class of defect a per-claim search
with whole-repository context is built for, and sustained human reading is not.
