# Claim Check — findings on KeeperHub PR #2476

This document answers the three questions BUILD-04 asks, then addresses the
canonicalisation divergence from `docs/CONCEPT.md`.

---

## 1. Where the tool agrees with the maintainer

The final maintainer verdict on the last reviewed commit (`62edf7b`) was from
suisuss in review[6]:

> "Matches. Every behavioural claim in the body holds at `62edf7b`: six ordered
> checks with `resource` fifth, the shape gate with no coercion, the 64 KiB cap
> checked by header and then by length, and the error attribution as listed."

That sentence names four clusters. The tool agrees with all four, and with every
explicit per-claim conclusion the maintainer wrote across four rounds:

| maintainer conclusion | claims | tool verdict |
|---|---|---|
| Six ordered checks with `resource` fifth | c06, c27 | holds |
| Shape gate: conviction finite number 0-100, numeric string fails | c12, c15, c24 | holds |
| Shape gate: action one of accumulate/reduce/hold | c13 | holds |
| Shape gate: window one of 7d/30d | c14 | holds |
| No coercion anywhere in shape gate | c15 | holds |
| 64 KiB cap checked by header then by body length | c04, c05, c28 | holds |
| 429 → EXTERNAL | c18 | holds |
| 404, 402, unparseable URL → USER | c19 | holds |
| Body attribution conditional on operator host | c20, c29 | holds |
| Signer pinned by source constant, key-in-response never trusted | c07, c08 | holds |
| Failed verification fails the step (no `success: true` on bad verify) | c16, c17 | holds |
| `parseMaxAgeSeconds` honours `0` literally | c25 | holds |

The maintainer independently verified `DEFAULT_PINNED_SIGNER` against the live
published keyset. The tool marks c21 `holds` on the same grounds, citing the
reviewer's written confirmation as corroborating evidence alongside the source
constant in the diff.

**Agreement score: 12/12 on the maintainer's explicitly written conclusions.**

---

## 2. Where the tool disagrees with the maintainer — and who is right

### c02 — `assertUrlIsPublic` as an "always-on" SSRF check

**Tool verdict: does-not-hold.**  
**Maintainer verdict (joelorzet, review[0]):** "The egress side is right:
`assertUrlIsPublic` runs before anything leaves, both paths go through
`safeFetch`."

The tool and the maintainer reach opposite conclusions on this claim.

**Who is right: the tool is correct, the maintainer's framing is too narrow.**

The PR description says "through `safeFetch` behind an **always-on**
`assertUrlIsPublic` SSRF check." The word "always-on" makes this a universal
claim. The maintainer's review assessed the step execution path only — the
signal-fetching path in `predge-core.ts`, where `assertUrlIsPublic` does run
before every outbound call. That path is fully guarded.

But `testPredge` in `plugins/predge/test.ts` (diff line 1031) calls raw
`fetch()` directly to `${baseUrl}/.well-known/predge-keys.json` without going
through `assertUrlIsPublic`. This is an outbound HTTP request from the plugin.
The connection-test function is invoked when an operator tests their connection
configuration — it is not a unit test, it is a live network call that runs in
the product's server process.

The maintainer's review did not examine `test.ts` in the context of this claim.
The claim is therefore false as written: "every outbound request" is not every
outbound request.

**Significance:** The connection-test path accepts `PREDGE_SIGNAL_URL` from
operator credentials and fetches from it without the SSRF guard. An operator
who points `PREDGE_SIGNAL_URL` at an internal address and then clicks "Test
Connection" triggers an unguarded SSRF.

**What this illustrates about the tool:** The tool caught a disagreement between
the PR description's scope ("always-on", "every outbound request") and the code
by reading across files. The maintainer's review did the same across-file reading
but applied it only to the production execution path. Scope of the word "always"
is exactly the kind of ambiguity that falls through human review under load.

---

## 3. `cannot-tell` claims — would a human have caught them?

**There were zero `cannot-tell` verdicts across all 29 claims.**

Every claim the extractor produced was checkable from the diff, and a verdict
with evidence was returned for each. The absence of `cannot-tell` is itself a
result worth naming: the PR description was specific and falsifiable enough that
nothing needed to be treated as unverifiable.

What would produce `cannot-tell` on this PR:

- Claims about external behaviour that cannot be confirmed from the diff alone
  (e.g. "the published keyset is live and serves the attestation key" — the tool
  marks c21 `holds` only because a reviewer documented the live check; without
  that citation it would be `cannot-tell`).
- Claims about what the Predge signer does on its side, which is out-of-repo.
- Claims involving test coverage of production paths that require running the
  test suite rather than reading the code.

None of those appeared as extracted claims in this run because the description
was careful to make only claims about the repository's own code.

---

## 4. The canonicalisation divergence — does the tool surface it?

**No. This is a correct absence, not a miss.**

The divergence, described in `docs/CONCEPT.md`:

> The signer drops `undefined` keys, the verifier does not. Byte-identical
> today, silently incompatible the moment a field becomes conditional.

Concretely: the Predge signer is assumed to use `JSON.stringify` (which silently
omits keys whose value is `undefined`) to build the canonical bytes it signs.
The verifier in this PR uses a custom `canonicalize` function
(`predge-core.ts:404-416`) that calls `JSON.stringify(value)` on each leaf but
iterates all `Object.keys(obj)` including those with `undefined` values, which
`JSON.stringify(obj[k])` then encodes as the string `"undefined"` — not omitted,
not `null`. If any attestation field is ever `undefined` in a live signal, the
signer and verifier produce different byte sequences, the signature check fails,
and every default-configured workflow fails closed until the code is corrected.

**Why the tool does not surface it:**

The tool extracts *claims from the PR text* and verifies each against the code.
No claim in the PR description, the review comments, or the review thread says
anything about what `canonicalize` does with `undefined` values, or how the
verifier's canonical encoding relates to the signer's. The closest claims are:

- c06 / c27: "six ordered checks" — verified against the `if`-chain in
  `verifyPredgeSignal`, not against the canonicalisation implementation.
- The description says "ed25519 signature over the canonical payload" — this is
  a claim about what is signed, not about whether signer and verifier agree on
  the encoding.

The divergence is invisible in any single file (as `CONCEPT.md` notes), and it
does not contradict any written claim — the PR does not claim that signer and
verifier use the same canonicalisation for undefined keys, because neither author
nor reviewer noticed the question. The tool has nothing to verify it against.

**What it would take:**

The tool would need a claim to check. That claim could come from two places:

1. **The PR description itself** — if the description said "the verifier's
   `canonicalize` produces identical bytes to the Predge signer for all inputs",
   a subagent could read both implementations and return `cannot-tell` (the
   signer's code is out-of-repo) or `does-not-hold` (if a Predge-side source or
   spec was available in the corpus).

2. **A corpus of known-good canonicalisation invariants** — a second extractor
   pass that generates claims not from the PR prose but from structural
   properties of the code (e.g. "for every function that computes bytes signed
   by an external signer, confirm the encoding is identical"). This is a
   different tool: a static-analysis pass over canonicalisation functions, not a
   claim checker.

The finding in `CONCEPT.md` was discovered by cross-reading `canonicalize` in
this file against Predge's signer code in a different repository, which is
outside the scope of a claim extractor that reads the PR text. A per-push claim
checker would not have caught it on this PR, and presenting it as a catch would
be false.

**What the tool *does* do that a human skipped:** The c02 finding above — the
SSRF check scope — was missed by the maintainer across four rounds and found by
the tool in one pass. That is the honest shape of what a claim checker is good
at: scope errors in universal claims, checked mechanically across all files.
The canonicalisation divergence requires knowing what the *other* system does,
which is a different class of work.

---

## 5. The live executor produced a false `holds` on the one claim that matters

*Added after session 5, from a hand-written diagnostic run. See `scripts/live-run.mjs`.*

Session 5 replaced the replayed verdicts with a real executor that spawns one Bob Shell
subagent per claim. On a three-claim smoke test it returned **`holds` for c02** — the
claim that every outbound request passes through the SSRF guard. The stored session-2
verdict for the same claim was `does-not-hold`, and the stored verdict is correct.

The live subagent found `assertUrlIsPublic` in `fetchSignedSignal`, which is true, and
stopped. It never reached `testPredge` in `test.ts`, where the guard is missing. The
executor had also been made cheaper by running subagents diff-only with
`--disable-subagents --disable-mcp`: cost fell from 0.153 to 0.068 per claim, and the
finding that this whole submission rests on fell with it. Had the live mode shipped as
the default, the tool would have said with confidence that the bug was not there.

**Why it happened.** "Every outbound request passes through the guard" is a claim about
*all* cases. A universal claim cannot be confirmed by one example; it can only be refuted
by a counterexample. A verifier that looks for supporting evidence will find it on the
happy path and report `holds`, which is exactly the mistake four rounds of human review
made on the same sentence.

**The fix is a principle, not a tuning.** Claims containing *every, always, never, all,
any, none, only* are detected and given a different instruction: search the entire diff
for an exception, including tests, connection checks and helpers; list every location
checked; report `holds` only if all were checked and none was an exception; report
`cannot-tell` if coverage cannot be established. 8 of the 29 claims are universal.

With that rule, the live run on c02 returned:

| | |
|---|---|
| verdict | `does-not-hold` |
| evidence | `plugins/predge/test.ts:31` |
| locations checked | 4 — `predge-core.ts:719` (guarded), `read-signal.ts` (delegates), `test.ts:31` (unguarded), the unit test (mocked, not a production path) |
| cost / time | 0.185 Bobcoins, 15.1 s |

The list of checked locations is what makes the verdict auditable: a reader can see that
the guarded path was examined and deliberately not taken as proof.

Two further changes from the diagnostic run belong in `src/execute.ts`: the verifier runs
in `--mode ask`, because a checker allowed to edit the code it is judging is a hole in
the idea, and stdin is closed on the child process, because otherwise `bob run` waits for
input that never arrives.

## 6. What the live run did not finish, and why

Live verdicts exist for five claims: c02 `does-not-hold`, and c01, c03, c05, c06 `holds`,
each matching the stored session-2 verdict. The full 29-claim live batch did not
complete. The hackathon allowance is 40 Bobcoins and it ran out mid-batch: 21 claims
failed with `Budget Exceeded`, two with `database is locked` because eight concurrent
`bob run` processes contend for the same local SQLite store.

Where the budget went is on record in Bob's local task database. 37.5 of the 41.4
Bobcoins spent went to a single IDE task: all five build sessions were run as one
continuous conversation, its context grew past 160k tokens, and every turn re-billed the
whole history. Starting each session as a fresh task would have cost a fraction of that.
That is our mistake in how we drove Bob, not a property of the tool.

The shipped demo therefore runs `--replay` against the stored session-2 verdicts, which
works offline and without a key. The live path is built, and proven on the five claims
above, including the one that decides whether the tool is worth anything.
