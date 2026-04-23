import type { SdlcEventV1 } from "./sdlcEventModel.js";

export type RecurringFailurePatternV1 = {
  kind: "file_repeated_failure" | "test_repeated_failure" | "lint_rule_repeated";
  key: string;
  count: number;
};

export type TemporalPatternV1 = {
  failureHourClusters: Array<{ hourUtc: number; count: number }>;
  fridayRegression: { failures: number; total: number; ratio: number };
};

export type AgentPatternV1 = {
  rollbackCycles: number;
  selfCorrectionLoops: number;
  plannerParseErrors: number;
};

export type SdlcPatternsV1 = {
  recurringFailures: RecurringFailurePatternV1[];
  temporal: TemporalPatternV1;
  agent: AgentPatternV1;
  severity: number;
};

function toObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

export function detectSdlcPatterns(events: SdlcEventV1[]): SdlcPatternsV1 {
  const fileFail = new Map<string, number>();
  const testFail = new Map<string, number>();
  const lintRuleFail = new Map<string, number>();
  const hourFails = new Map<number, number>();
  let fridayFail = 0;
  let totalFail = 0;
  let rollbackCycles = 0;
  let selfCorrectionLoops = 0;
  let plannerParseErrors = 0;

  for (const e of events) {
    if (e.status === "failure") {
      totalFail += 1;
      const d = new Date(e.timestamp);
      const h = d.getUTCHours();
      hourFails.set(h, (hourFails.get(h) ?? 0) + 1);
      if (d.getUTCDay() === 5) {
        fridayFail += 1;
      }
      if (e.path) {
        fileFail.set(e.path, (fileFail.get(e.path) ?? 0) + 1);
      }
      if (e.type === "test_run") {
        const m = toObj(e.meta);
        const t = String(m.name ?? m.command ?? "test_run");
        testFail.set(t, (testFail.get(t) ?? 0) + 1);
      }
      if (e.type === "lint_run") {
        const m = toObj(e.meta);
        const rule = String(m.ruleId ?? m.rule ?? "lint_rule");
        lintRuleFail.set(rule, (lintRuleFail.get(rule) ?? 0) + 1);
      }
      if (e.type === "planner_run" && (e.details ?? "").toLowerCase().includes("parse")) {
        plannerParseErrors += 1;
      }
    }
    if (e.type === "agent_run") {
      const m = toObj(e.meta);
      const phase = String(m.phase ?? "");
      if (phase === "self_correction_attempt") {
        selfCorrectionLoops += 1;
      }
      const details = (e.details ?? "").toLowerCase();
      if (details.includes("rollback")) {
        rollbackCycles += 1;
      }
    }
  }

  const recurringFailures: RecurringFailurePatternV1[] = [];
  for (const [k, c] of fileFail) {
    if (c > 1) recurringFailures.push({ kind: "file_repeated_failure", key: k, count: c });
  }
  for (const [k, c] of testFail) {
    if (c > 1) recurringFailures.push({ kind: "test_repeated_failure", key: k, count: c });
  }
  for (const [k, c] of lintRuleFail) {
    if (c > 1) recurringFailures.push({ kind: "lint_rule_repeated", key: k, count: c });
  }
  recurringFailures.sort((a, b) => b.count - a.count);

  const failureHourClusters = [...hourFails.entries()]
    .map(([hourUtc, count]) => ({ hourUtc, count }))
    .filter((x) => x.count > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const fridayRatio = totalFail > 0 ? fridayFail / totalFail : 0;
  const severityRaw =
    recurringFailures.reduce((s, x) => s + x.count, 0) * 0.4 +
    failureHourClusters.reduce((s, x) => s + x.count, 0) * 0.2 +
    rollbackCycles * 0.8 +
    selfCorrectionLoops * 0.5 +
    plannerParseErrors * 0.9 +
    fridayRatio * 10;
  const severity = Number(Math.min(100, Math.max(0, severityRaw)).toFixed(2));

  return {
    recurringFailures,
    temporal: {
      failureHourClusters,
      fridayRegression: {
        failures: fridayFail,
        total: totalFail,
        ratio: Number(fridayRatio.toFixed(4))
      }
    },
    agent: {
      rollbackCycles,
      selfCorrectionLoops,
      plannerParseErrors
    },
    severity
  };
}
