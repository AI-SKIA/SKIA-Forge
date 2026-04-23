import { querySdlcEvents, type SdlcEventV1 } from "./sdlcEventModel.js";
import { getSelfHeuristicOverridesV1 } from "../self/selfHeuristics.js";

export type SdlcInsightsV1 = {
  recentFailures: Array<{ type: SdlcEventV1["type"]; timestamp: string; path?: string; details?: string }>;
  hotspotFiles: Array<{ path: string; score: number; edits: number; failures: number }>;
  riskScore: number;
  stabilityScore: number;
  flakyFiles: Array<{ path: string; score: number; failures: number }>;
};

function recencyWeight(ts: string, nowMs: number): number {
  const ageH = Math.max(0, (nowMs - Date.parse(ts)) / 3_600_000);
  return Math.exp(-ageH / 72);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export async function computeSdlcHeuristics(
  projectRoot: string,
  scopePath?: string
): Promise<SdlcInsightsV1> {
  const ov = getSelfHeuristicOverridesV1();
  const events = await querySdlcEvents(projectRoot, { path: scopePath, limit: 1200 });
  const nowMs = Date.now();
  const recentFailures = events
    .filter((e) => e.status === "failure")
    .slice(-10)
    .reverse()
    .map((e) => ({ type: e.type, timestamp: e.timestamp, ...(e.path ? { path: e.path } : {}), details: e.details }));

  const byPath = new Map<string, { edits: number; failures: number; weightedFailures: number }>();
  for (const e of events) {
    const p = e.path?.trim();
    if (!p) {
      continue;
    }
    const row = byPath.get(p) ?? { edits: 0, failures: 0, weightedFailures: 0 };
    if (e.type === "commit" || e.type === "agent_run") {
      row.edits += 1;
    }
    if (e.status === "failure") {
      row.failures += 1;
      row.weightedFailures += recencyWeight(e.timestamp, nowMs);
    }
    byPath.set(p, row);
  }

  const hotspotFiles = [...byPath.entries()]
    .map(([path, x]) => ({
      path,
      edits: x.edits,
      failures: x.failures,
      score: Number(
        (
          x.edits * (ov?.weights.hotspots ?? 0.55) +
          x.failures * (ov?.weights.risk ? ov.weights.risk * 3 : 1.4) +
          x.weightedFailures
        ).toFixed(4)
      )
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const flakyFiles = [...byPath.entries()]
    .map(([path, x]) => ({
      path,
      failures: x.failures,
      score: Number((x.failures + x.weightedFailures * 0.7).toFixed(4))
    }))
    .filter((x) => x.failures > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const validation = events.filter(
    (e) => e.type === "test_run" || e.type === "lint_run" || e.type === "typecheck_run" || e.type === "build_run"
  );
  const passRate = validation.length
    ? validation.filter((e) => e.status === "success").length / validation.length
    : 1;
  const stabilityScore = Number((passRate * 100).toFixed(2));

  const weightedFailures = events
    .filter((e) => e.status === "failure")
    .reduce((sum, e) => sum + recencyWeight(e.timestamp, nowMs), 0);
  const riskMultiplier = ov?.weights.risk ? 8 + ov.weights.risk * 6 : 10;
  const riskScore = Number((clamp(weightedFailures * riskMultiplier, 0, 100)).toFixed(2));

  return {
    recentFailures,
    hotspotFiles,
    riskScore,
    stabilityScore,
    flakyFiles
  };
}
