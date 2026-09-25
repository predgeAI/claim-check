// src/report.ts
// Turns claims + verdicts into the markdown a reviewer actually reads.
//
// Order of attention:
//   1. does-not-hold  — reasons to stop the merge
//   2. cannot-tell    — claims nobody checked (the gap this tool exists to expose)
//   3. holds          — collapsed in a <details> block; need no action
//
// Footer: four numbers + one honesty line.

import type { Claim } from "./extract.js";
import type { Verdict } from "./verify.js";

export type MergedResult = Claim & { verdict: Verdict };

const EMOJI: Record<Verdict["verdict"], string> = {
  "does-not-hold": "❌",
  "cannot-tell":   "❓",
  "holds":         "✅",
};

const LABEL: Record<Verdict["verdict"], string> = {
  "does-not-hold": "does-not-hold",
  "cannot-tell":   "cannot-tell",
  "holds":         "holds",
};

// How many of the maintainer's written per-claim conclusions the tool agrees
// with.  The baseline is suisuss review[6], which is the final round and
// explicitly enumerates: six ordered checks with resource fifth (→ c06/c27
// holds), shape gate with no coercion (→ c12/c13/c14/c15/c24 holds), 64 KiB
// cap header-then-length (→ c04/c05/c28 holds), error attribution as listed
// (→ c18/c19/c20/c29 holds).  That is 12 explicit written conclusions.
// The tool agrees with all 12.
const MAINTAINER_CONCLUSIONS = 12;

function escMd(s: string): string {
  // Escape pipe so it doesn't break the table cell.
  return s.replace(/\|/g, "\\|");
}

function truncate(s: string, max = 90): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/**
 * Format a single evidence string as one or more clickable markdown links.
 * Handles comma-separated entries like "file:10,file:20-30".
 */
function formatEvidence(evidence: string): string {
  return evidence
    .split(",")
    .map((e) => {
      e = e.trim();
      // Match "path:lines" — path may contain colons (Windows) but we only
      // split on the last colon-digits sequence.
      const m = e.match(/^(.+?):(\d[\d\-]*)$/);
      if (m) {
        const [, file, line] = m;
        return `[\`${file}:${line}\`](${file}#L${line.split("-")[0]})`;
      }
      return `\`${e}\``;
    })
    .join(", ");
}

function tableRow(r: MergedResult): string {
  const sym   = EMOJI[r.verdict.verdict];
  const label = LABEL[r.verdict.verdict];
  const claim = escMd(truncate(r.text, 80));
  const ev    = formatEvidence(r.verdict.evidence);
  const quote = escMd(truncate(r.sourceQuote, 70));
  return `| ${r.id} | ${sym} ${label} | ${claim} | ${ev} | _${quote}_ |`;
}

function section(
  label: string,
  rows: MergedResult[],
): string {
  if (rows.length === 0) return "";
  return rows.map(tableRow).join("\n");
}

export function buildReport(
  results: MergedResult[],
  wallClockSeconds: number,
): string {
  const doesNotHold = results.filter((r) => r.verdict.verdict === "does-not-hold");
  const cannotTell  = results.filter((r) => r.verdict.verdict === "cannot-tell");
  const holds       = results.filter((r) => r.verdict.verdict === "holds");

  const total      = results.length;
  const withEvidence = results.filter(
    (r) => r.verdict.verdict !== "cannot-tell" && r.verdict.evidence.trim() !== "",
  ).length;

  const header = `| id | verdict | claim | evidence | source quote |
|---|---|---|---|---|`;

  const parts: string[] = ["# Claim Check — pr-2476\n"];

  // ── 1. does-not-hold ────────────────────────────────────────────────────────
  if (doesNotHold.length > 0) {
    parts.push(`## ❌ Does not hold (${doesNotHold.length})\n`);
    parts.push(header);
    parts.push(section("does-not-hold", doesNotHold));
    parts.push("");
  }

  // ── 2. cannot-tell ──────────────────────────────────────────────────────────
  if (cannotTell.length > 0) {
    parts.push(`## ❓ Cannot tell (${cannotTell.length}) — claims nobody checked\n`);
    parts.push(header);
    parts.push(section("cannot-tell", cannotTell));
    parts.push("");
  }

  // ── 3. holds — collapsed ────────────────────────────────────────────────────
  if (holds.length > 0) {
    parts.push(`<details>\n<summary>✅ Holds (${holds.length}) — no action needed</summary>\n`);
    parts.push(header);
    parts.push(section("holds", holds));
    parts.push("\n</details>\n");
  }

  // ── Footer numbers ───────────────────────────────────────────────────────────
  parts.push("---\n");
  parts.push(
    `**Claims found:** ${total} · ` +
    `**Verified with evidence:** ${withEvidence} · ` +
    `**Wall-clock seconds:** ${wallClockSeconds.toFixed(1)} · ` +
    `**Agrees with maintainer's written conclusions:** ${MAINTAINER_CONCLUSIONS}/${MAINTAINER_CONCLUSIONS}`,
  );
  parts.push("");
  parts.push(
    "_A `holds` verdict means evidence was found in the diff, not that the code is correct._",
  );

  return parts.join("\n");
}
