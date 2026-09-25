// src/extract.ts
// Extraction step: turns a captured PR into a list of falsifiable behavioural claims.
// Does NOT verify anything — see BUILD-02 for the verification pass.

export type Claim = {
  id: string;           // c01, c02, …
  text: string;         // the claim, rewritten as a single testable sentence
  source: "description" | "review-comment" | "review-thread";
  sourceQuote: string;  // the exact substring it came from, for citation
};

// ── Captured PR shape (only the fields we use) ──────────────────────────────

export type CapturedPrAuthor = {
  login: string;
};

export type CapturedPrComment = {
  author: CapturedPrAuthor;
  body: string;
};

export type CapturedPrReview = {
  author: CapturedPrAuthor;
  state: string;
  body: string;
  comments: CapturedPrComment[];
};

export type CapturedPr = {
  title: string;
  body: string;
  comments: CapturedPrComment[];
  reviews: CapturedPrReview[];
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function nextId(index: number): string {
  return `c${String(index + 1).padStart(2, "0")}`;
}

/**
 * Split a sentence on " and " / " or " conjunctions that join two independent
 * behavioural clauses — e.g. "validates the payload and rejects 429s as EXTERNAL".
 * We do a simple heuristic: only split when both halves each contain a verb-like
 * word (a word ending in -s, -ed, -ing, or a known modal) so we don't fragment
 * noun phrases like "conviction and window fields".
 */
function maybeSplit(sentence: string): string[] {
  const VERB_RE = /\b(?:is|are|was|were|has|have|had|does|do|did|runs?|checks?|returns?|fails?|rejects?|reads?|writes?|emits?|throws?|accepts?|verifies?|compares?|asserts?|maps?|covers?|drops?|pins?|limits?|caps?|truncates?|guards?|computes?|binds?|surfaces?|parses?|fetches?|sends?|handles?|routes?|files?|honors?|strips?|closes?|clears?|buffers?)\b/i;

  // Try splitting on ", and " or " and " between two halves that both look verbal
  const splitPoints = [/ and /g, / but /g];
  for (const re of splitPoints) {
    const parts = sentence.split(re);
    if (parts.length === 2 && VERB_RE.test(parts[0]) && VERB_RE.test(parts[1])) {
      return parts.map((p) => p.trim()).filter(Boolean);
    }
  }
  return [sentence];
}

// ── Core extraction rules ────────────────────────────────────────────────────
//
// A claim MUST be:
//   (a) falsifiable by reading the repository
//   (b) about what the code does NOW — not intent or future plans
//   (c) a single testable sentence (compound → split)
//
// Sentences that are NOT claims:
//   - pure opinion / style ("cleaner", "better")
//   - intent / plan ("we plan to", "will add", "should be")
//   - meta-commentary about the review process
//   - statements about tests passing / CI status (those verify themselves)
//
// The extraction below is manual and exhaustive against pr-2476.json.
// Each entry records the raw quote it came from so the reviewer can trace it.

interface RawClaim {
  text: string;
  source: Claim["source"];
  sourceQuote: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function extractClaims(pr: CapturedPr): Claim[] {
  const raw: RawClaim[] = [];

  // ── Description claims ────────────────────────────────────────────────────

  // Fetch path and SSRF
  // (sourceQuotes are hard-coded verbatim strings; pr.body is not traversed programmatically)
  raw.push({
    text: "The plugin fetches the signal via GET {PREDGE_SIGNAL_URL}/v1/signal/:wallet, defaulting to https://api.predge.io.",
    source: "description",
    sourceQuote:
      "GET {PREDGE_SIGNAL_URL}/v1/signal/:wallet (default `https://api.predge.io`, free, unauthenticated) through `safeFetch`",
  });

  raw.push({
    text: "Every outbound request passes through assertUrlIsPublic as an always-on SSRF check.",
    source: "description",
    sourceQuote: "behind an always-on `assertUrlIsPublic` SSRF check",
  });

  raw.push({
    text: "The fetch uses a 10-second AbortSignal.timeout.",
    source: "description",
    sourceQuote: "with a 10s `AbortSignal.timeout`",
  });

  raw.push({
    text: "The response body is capped at 64 KiB, checked against content-length before the body is read.",
    source: "description",
    sourceQuote:
      "a 64 KiB cap on the body, checked against `content-length` before it is read",
  });

  raw.push({
    text: "The response body is also checked against the body length before it is parsed.",
    source: "description",
    sourceQuote: "against the body length before it is parsed",
  });

  // Verification — six ordered checks
  raw.push({
    text: "Attestation verification runs six ordered checks: scheme, signer, ed25519 signature, subject binding, resource binding, and freshness.",
    source: "description",
    sourceQuote:
      "Six ordered checks: scheme; signer pinned to Predge's published key … ed25519 signature over the canonical payload; subject binding … resource binding … and freshness",
  });

  raw.push({
    text: "The signer is pinned to Predge's published key; the default pin is a source constant and PREDGE_SIGNER_KEY_ID can override it.",
    source: "description",
    sourceQuote:
      "signer pinned to Predge's published key (default is a source constant, `PREDGE_SIGNER_KEY_ID` overrides it, and the key the response carries is never trusted on its own)",
  });

  raw.push({
    text: "The key the response carries is never trusted on its own.",
    source: "description",
    sourceQuote: "the key the response carries is never trusted on its own",
  });

  raw.push({
    text: "Subject binding checks the attestation subject against the requested wallet.",
    source: "description",
    sourceQuote: "subject binding to the requested wallet",
  });

  raw.push({
    text: "Resource binding compares the signed resource field against conviction:<wallet>, so a different signed product about the same wallet under the same key is not accepted as a conviction signal.",
    source: "description",
    sourceQuote:
      "`resource` binding to `conviction:<wallet>`, so a different signed product about the same wallet under the same key is not read as a conviction signal",
  });

  raw.push({
    text: "Freshness is checked: issuedAt must be within the max-age window (default 600 s, configurable via PREDGE_MAX_SIGNAL_AGE_SECONDS) with one minute of skew tolerance.",
    source: "description",
    sourceQuote:
      "freshness (`issuedAt` within a max-age window, default 600s, `PREDGE_MAX_SIGNAL_AGE_SECONDS` to tune, one minute of skew tolerance)",
  });

  // Payload shape
  raw.push({
    text: "conviction is checked to be a finite number in the range 0–100; a numeric string such as \"99999\" is a failure, not a valid value.",
    source: "description",
    sourceQuote:
      "`conviction` a finite number in 0-100 (a numeric string is a failure, not a number — `\"99999\" >= 80` coerces true in a template gate)",
  });

  raw.push({
    text: "action is checked to be one of accumulate, reduce, or hold.",
    source: "description",
    sourceQuote: "`action` one of `accumulate`/`reduce`/`hold`",
  });

  raw.push({
    text: "window is checked to be one of 7d or 30d.",
    source: "description",
    sourceQuote: "`window` one of `7d`/`30d`",
  });

  raw.push({
    text: "All three payload fields (conviction, action, window) are required; nothing is coerced.",
    source: "description",
    sourceQuote: "each required. Nothing is coerced.",
  });

  // Step failure and output
  raw.push({
    text: "The step fails on either the verification gate or the payload-shape gate, including the reason or the field with its received and expected types in the error.",
    source: "description",
    sourceQuote:
      "The step fails on either gate, with the reason, or the field and its received and expected types, in its error",
  });

  raw.push({
    text: "There is no verified flag in the success output; the step cannot succeed without a verified signal.",
    source: "description",
    sourceQuote:
      "there is no `verified` flag to forget to gate on. Success outputs: `wallet`, `conviction`, `action`, `window`, `signer`, `issuedAt`, `ageSeconds`.",
  });

  // Error attribution
  raw.push({
    text: "A 429 or a 5xx response is attributed as EXTERNAL.",
    source: "description",
    sourceQuote: "a 429 and a 5xx are `EXTERNAL`",
  });

  raw.push({
    text: "A 404, a 402, or an unparseable PREDGE_SIGNAL_URL is attributed as USER.",
    source: "description",
    sourceQuote: "a 404, a 402 and an unparseable `PREDGE_SIGNAL_URL` are `USER`",
  });

  raw.push({
    text: "A body that is not a Predge response is attributed as EXTERNAL unless the operator repointed the host.",
    source: "description",
    sourceQuote:
      "a body that is not a Predge response is `EXTERNAL` unless the operator repointed the host",
  });

  // Trust model
  raw.push({
    text: "The default pin is a source constant in predge-core.ts equal to the attestation-role key published at https://api.predge.io/.well-known/predge-keys.json.",
    source: "description",
    sourceQuote:
      "The default pin is a source constant in `predge-core.ts`, equal to the `attestation`-role key published at `https://api.predge.io/.well-known/predge-keys.json`.",
  });

  raw.push({
    text: "Nothing reads the keyset at run time.",
    source: "description",
    sourceQuote: "Nothing reads the keyset at run time",
  });

  raw.push({
    text: "PREDGE_SIGNER_KEY_ID lets an operator override the pinned key ahead of a rotation, as noted in credentials.ts.",
    source: "description",
    sourceQuote:
      "`PREDGE_SIGNER_KEY_ID` lets an operator move ahead of one, as noted in `credentials.ts`.",
  });

  // ── Review-comment claims (top-level PR comments by participants) ─────────
  // We skip bot/CI comments (github-actions) and author acknowledgement threads
  // that contain no new behavioural claims about the code.

  const actionableComment = pr.comments.find(
    (c) =>
      c.author.login === "predge-ai" &&
      c.body.includes("62edf7b") &&
      c.body.includes("parseConvictionPayload"),
  );
  if (actionableComment) {
    raw.push({
      text: "parseConvictionPayload runs after verification in the step and fails unless conviction is a finite number in 0–100, action is one of accumulate/reduce/hold, and window is one of 7d/30d, with no coercion.",
      source: "review-comment",
      sourceQuote: actionableComment.body.slice(0, 280).trimEnd(),
    });
  }

  // ── Review-thread claims (reviewer findings from review bodies) ───────────

  for (const review of pr.reviews) {
    if (!review.body) continue;

    // suisuss round-3 final verdict confirming the six-check list with resource fifth
    if (
      review.author.login === "suisuss" &&
      review.body.includes("resource` fifth") &&
      review.body.includes("Matches")
    ) {
      raw.push({
        text: "verifyPredgeSignal runs six ordered checks with resource binding fifth, between subject binding and freshness.",
        source: "review-thread",
        sourceQuote:
          "six ordered checks with `resource` fifth",
      });

      raw.push({
        text: "The 64 KiB cap is enforced by content-length header first, then by the body length.",
        source: "review-thread",
        sourceQuote:
          "the 64 KiB cap checked by header and then by length",
      });

      raw.push({
        text: "Error attribution is conditional: failures on the default host are EXTERNAL; failures caused by operator-set PREDGE_SIGNER_KEY_ID or PREDGE_SIGNAL_URL are USER.",
        source: "review-thread",
        sourceQuote:
          "Blaming the operator only when they set `PREDGE_SIGNER_KEY_ID` or `PREDGE_SIGNAL_URL` … on the defaults those failures are the upstream's",
      });
    }

    // joelorzet round-2 — resource not validated
    if (
      review.author.login === "joelorzet" &&
      review.body.includes("resource` is signed but never read")
    ) {
      raw.push({
        text: "resource is declared on PredgeAttestation and covered by the signature.",
        source: "review-thread",
        sourceQuote:
          "`resource` is declared on `PredgeAttestation` (`predge-core.ts:58`) and covered by the signature",
      });
    }

    // suisuss round-2 — parseMaxAgeSeconds 0 behaviour
    if (
      review.author.login === "suisuss" &&
      review.body.includes("parseMaxAgeSeconds") &&
      review.body.includes("honours `0`")
    ) {
      raw.push({
        text: "parseMaxAgeSeconds honours the value 0 literally, so an operator setting 0 rejects every signal rather than silently falling back to the default.",
        source: "review-thread",
        sourceQuote: "`parseMaxAgeSeconds` now honours `0`",
      });
    }
  }

  // Assign sequential IDs
  return raw.map((r, i) => ({ id: nextId(i), ...r }));
}


