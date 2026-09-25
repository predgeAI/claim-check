# Bob session 4 — try to break it, on camera

This session exists because a demo that only succeeds proves nothing.

---

Run Claim Check against `corpus/pr-2476.json` and compare its output with what the
maintainer concluded by hand across four review rounds, which is in the same file.

Then answer three questions in `docs/FINDINGS.md`:

1. Where does the tool agree with the maintainer? That is the part it reproduces.
2. Where does it disagree? For each disagreement, say who is right and why. If the tool
   is wrong, write that down. A disagreement where the tool is wrong is more useful in
   the write-up than a clean sweep.
3. Which claims came back `cannot-tell`, and would a human reviewer have caught them?

Finally, the known ceiling, which we found on this same codebase before the hackathon:
two canonicalisation functions disagree, because the signer drops `undefined` keys and
the verifier does not. The bytes are identical today and diverge the first time a field
becomes conditional. Four rounds of human review missed it because it is invisible in
any single file.

Check whether Claim Check surfaces it. If it does not, say so plainly in FINDINGS.md
and explain what it would take. Do not tune the tool until it finds it and then present
that as the result.
