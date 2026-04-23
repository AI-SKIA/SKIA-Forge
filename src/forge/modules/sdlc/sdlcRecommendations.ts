import type { SdlcTimelineV1 } from "./sdlcTimeline.js";
import type { SdlcInsightsV1 } from "./sdlcHeuristics.js";
import type { SdlcPatternsV1 } from "./sdlcPatterns.js";

export type SdlcRecommendationsInputV1 = {
  timeline: SdlcTimelineV1;
  heuristics: SdlcInsightsV1;
  patterns: SdlcPatternsV1;
};

export type SdlcRecommendationsV1 = {
  refactorFiles: string[];
  stabilizeTests: string[];
  enforceLintRules: string[];
  agentGuardrails: string[];
  chunkingOrEmbeddingRefresh: string[];
  dependencyCleanup: string[];
};

export function buildSdlcRecommendations(
  input: SdlcRecommendationsInputV1
): SdlcRecommendationsV1 {
  const hotPaths = input.heuristics.hotspotFiles.slice(0, 5).map((x) => x.path);
  const flakyPaths = input.heuristics.flakyFiles.slice(0, 5).map((x) => x.path);
  const testKeys = input.patterns.recurringFailures
    .filter((x) => x.kind === "test_repeated_failure")
    .slice(0, 5)
    .map((x) => x.key);
  const lintKeys = input.patterns.recurringFailures
    .filter((x) => x.kind === "lint_rule_repeated")
    .slice(0, 5)
    .map((x) => x.key);

  const guardrails: string[] = [];
  if (input.patterns.agent.rollbackCycles > 1) {
    guardrails.push("Require preview confirmation for high-diff write sequences.");
  }
  if (input.patterns.agent.selfCorrectionLoops > 2) {
    guardrails.push("Tighten self-correction max retries and enforce smaller repair plans.");
  }
  if (input.patterns.agent.plannerParseErrors > 0) {
    guardrails.push("Use stricter planner JSON-only prompt and schema echo validation.");
  }

  const chunking: string[] = [];
  if (input.heuristics.riskScore >= 50) {
    chunking.push("Trigger embedding refresh for hotspot files and surrounding dependency graph.");
  }
  if (input.timeline.metrics.failureStreak >= 3) {
    chunking.push("Re-run structural chunking for recently failing modules.");
  }

  const deps: string[] = [];
  if (input.timeline.metrics.averageValidationTimeMs > 120_000) {
    deps.push("Audit heavy dependencies affecting validation/build latency.");
  }
  if (lintKeys.some((k) => /import|unused|dependency/i.test(k))) {
    deps.push("Review unused/transitive dependencies related to repeated lint issues.");
  }

  return {
    refactorFiles: [...new Set([...hotPaths, ...flakyPaths])].slice(0, 8),
    stabilizeTests: testKeys,
    enforceLintRules: lintKeys,
    agentGuardrails: guardrails,
    chunkingOrEmbeddingRefresh: chunking,
    dependencyCleanup: deps
  };
}
