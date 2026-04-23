import { querySdlcEvents, type SdlcEventV1 } from "./sdlcEventModel.js";

export type SdlcTimelineDayV1 = {
  day: string;
  events: SdlcEventV1[];
};

export type SdlcTimelineMetricsV1 = {
  failureStreak: number;
  testPassStreak: number;
  averageValidationTimeMs: number;
  agentSuccessRate: number;
};

export type SdlcTimelineV1 = {
  scopePath?: string;
  eventCount: number;
  days: SdlcTimelineDayV1[];
  metrics: SdlcTimelineMetricsV1;
};

function dayFromIso(t: string): string {
  return t.slice(0, 10);
}

function computeFailureStreak(sorted: SdlcEventV1[]): number {
  let streak = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i]!.status === "failure") {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

function computeTestPassStreak(sorted: SdlcEventV1[]): number {
  let streak = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const e = sorted[i]!;
    if (e.type !== "test_run") {
      continue;
    }
    if (e.status === "success") {
      streak += 1;
      continue;
    }
    break;
  }
  return streak;
}

function avgValidationTime(sorted: SdlcEventV1[]): number {
  const vals = sorted.filter(
    (e) =>
      (e.type === "test_run" || e.type === "lint_run" || e.type === "typecheck_run" || e.type === "build_run") &&
      typeof e.durationMs === "number"
  );
  if (!vals.length) {
    return 0;
  }
  const total = vals.reduce((sum, e) => sum + (e.durationMs ?? 0), 0);
  return Math.round(total / vals.length);
}

function agentSuccessRate(sorted: SdlcEventV1[]): number {
  const runs = sorted.filter((e) => e.type === "agent_run");
  if (!runs.length) {
    return 0;
  }
  const ok = runs.filter((e) => e.status === "success").length;
  return Number((ok / runs.length).toFixed(4));
}

export async function buildSdlcTimeline(
  projectRoot: string,
  scopePath?: string
): Promise<SdlcTimelineV1> {
  const events = await querySdlcEvents(projectRoot, { path: scopePath });
  const byDay = new Map<string, SdlcEventV1[]>();
  for (const e of events) {
    const day = dayFromIso(e.timestamp);
    const arr = byDay.get(day) ?? [];
    arr.push(e);
    byDay.set(day, arr);
  }
  const days = [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([day, rows]) => ({ day, events: rows.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)) }));
  return {
    ...(scopePath ? { scopePath } : {}),
    eventCount: events.length,
    days,
    metrics: {
      failureStreak: computeFailureStreak(events),
      testPassStreak: computeTestPassStreak(events),
      averageValidationTimeMs: avgValidationTime(events),
      agentSuccessRate: agentSuccessRate(events)
    }
  };
}
