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

// The maintainer's final review (suisuss, review[6]) says under "Does it match the
// description": "six ordered checks with resource fifth, the shape gate with no
// coercion, the 64 KiB cap checked by header and then by length, and the error
// attribution as listed". That is FOUR written conclusions, not twelve. Each one
// covers one or more of our claims; the mapping is explicit so the figure can be
// audited rather than taken on trust. (An earlier version hard-coded "12/12",
// which was neither the number of conclusions nor the number of claims covered.)
const MAINTAINER_CONCLUSIONS: Record<string, string[]> = {
  "six ordered checks with resource fifth": ["c06", "c27"],
  "the shape gate with no coercion": ["c12", "c13", "c14", "c15", "c24"],
  "the 64 KiB cap checked by header and then by length": ["c04", "c05", "c28"],
  "the error attribution as listed": ["c18", "c19", "c20", "c29"],
};

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
  mode: string = "replay (stored verdicts)",
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
    `**Wall-clock:** ${mode.startsWith("replay") ? "not measured in replay" : wallClockSeconds.toFixed(1) + " s"}`,
  );
  parts.push("");
  {
    const byId = new Map(results.map((r) => [r.id, r.verdict.verdict]));
    const covered = [...new Set(Object.values(MAINTAINER_CONCLUSIONS).flat())];
    const agree = covered.filter((id) => byId.get(id) === "holds").length;
    const uncovered = results.filter((r) => !covered.includes(r.id));
    const failingUncovered = uncovered.filter((r) => r.verdict.verdict === "does-not-hold").length;
    parts.push(
      `**Against the maintainer:** his final review names ${Object.keys(MAINTAINER_CONCLUSIONS).length} ` +
      `conclusions, covering ${covered.length} of ${total} claims; the tool agrees on ${agree}/${covered.length}. ` +
      `He did not address the other ${uncovered.length} individually` +
      (failingUncovered ? `, and the ${failingUncovered === 1 ? "one failing claim is" : failingUncovered + " failing claims are"} among them.` : "."),
    );
  }
  parts.push("");
  parts.push(`**Verification mode:** ${mode}`);
  parts.push("");
  parts.push(
    "_A `holds` verdict means evidence was found in the diff, not that the code is correct._",
  );

  return parts.join("\n");
}
