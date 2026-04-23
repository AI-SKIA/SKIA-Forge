/**
 * Minimal line-based diff for diff-preview (no extra deps). Truncated for very large text.
 */
const MAX_LINES = 400;
const MAX_SNIPPET = 6_000;

function truncate(s: string, max: number): string {
  if (s.length <= max) {
    return s;
  }
  return `${s.slice(0, max)}\n…[truncated ${s.length - max} chars]`;
}

/** Unified-style diff: --- a/path, +++ b/path, then line prefixes. */
export function formatLineDiff(
  relPath: string,
  before: string | null,
  after: string
): string {
  const a = before ?? "";
  if (a === after) {
    return `(no changes): ${relPath}\n`;
  }
  const aLines = a.split("\n");
  const bLines = after.split("\n");
  if (aLines.length > MAX_LINES || bLines.length > MAX_LINES) {
    return (
      `--- a/${relPath}\n` +
      `+++ b/${relPath}\n` +
      `@@ (large file; before ${aLines.length} lines, after ${bLines.length} lines) @@\n` +
      truncate(
        aLines
          .slice(0, 5)
          .map((l) => `- ${l}`)
          .join("\n") +
          "\n...\n" +
          bLines
            .slice(0, 5)
            .map((l) => `+ ${l}`)
            .join("\n"),
        MAX_SNIPPET
      ) +
      "\n"
    );
  }

  // LCS on lines, then backtrack to "- / + / context" (O(n^2) — fine for preview caps)
  const n = aLines.length;
  const m = bLines.length;
  const dp: number[][] = Array(n + 1)
    .fill(0)
    .map(() => Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i]![j] =
        aLines[i - 1] === bLines[j - 1]
          ? dp[i - 1]![j - 1]! + 1
          : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
    }
  }
  const out: string[] = [`--- a/${relPath}`, `+++ b/${relPath}`, `@@ ${relPath} @@`];
  let i = n;
  let j = m;
  const outLines: { pre: " " | "+" | "-"; t: string }[] = [];
  while (i > 0 && j > 0) {
    if (aLines[i - 1] === bLines[j - 1]) {
      outLines.push({ pre: " ", t: aLines[i - 1]! });
      i--;
      j--;
    } else if (dp[i - 1]![j]! > dp[i]![j - 1]!) {
      outLines.push({ pre: "-", t: aLines[i - 1]! });
      i--;
    } else {
      outLines.push({ pre: "+", t: bLines[j - 1]! });
      j--;
    }
  }
  while (i > 0) {
    outLines.push({ pre: "-", t: aLines[i - 1]! });
    i--;
  }
  while (j > 0) {
    outLines.push({ pre: "+", t: bLines[j - 1]! });
    j--;
  }
  outLines.reverse();
  for (const x of outLines) {
    out.push(x.pre + x.t);
  }
  return `${truncate(out.join("\n"), MAX_SNIPPET)}\n`;
}
