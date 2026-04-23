/**
 * Summarize unified diff text for D1-10 preview aggregation.
 */
export type DiffStatSummary = {
  filesTouched: number;
  hunkCount: number;
  linesAdded: number;
  linesRemoved: number;
};

export function summarizeUnifiedDiffText(diff: string): DiffStatSummary {
  const lines = diff.split(/\r?\n/);
  let fileMarkers = 0;
  let hunkCount = 0;
  let linesAdded = 0;
  let linesRemoved = 0;
  for (const line of lines) {
    if (line.startsWith("--- a/") || line.startsWith("--- ")) {
      fileMarkers += 1;
    }
    if (line.startsWith("@@")) {
      hunkCount += 1;
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      linesAdded += 1;
    }
    if (line.startsWith("-") && !line.startsWith("---")) {
      linesRemoved += 1;
    }
  }
  const filesTouched = Math.max(1, Math.ceil(fileMarkers / 2)) || (diff.trim() ? 1 : 0);
  return { filesTouched, hunkCount, linesAdded, linesRemoved };
}

export function aggregatePreviewDiffStats(diffs: string[]): DiffStatSummary {
  const acc: DiffStatSummary = {
    filesTouched: 0,
    hunkCount: 0,
    linesAdded: 0,
    linesRemoved: 0
  };
  for (const d of diffs) {
    const s = summarizeUnifiedDiffText(d);
    acc.hunkCount += s.hunkCount;
    acc.linesAdded += s.linesAdded;
    acc.linesRemoved += s.linesRemoved;
    acc.filesTouched += s.filesTouched;
  }
  return acc;
}
