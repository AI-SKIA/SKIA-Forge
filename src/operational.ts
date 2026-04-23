import type { SkiaStatus } from "./types.js";

export type RuntimeState = {
  startedAt: number;
  ready: boolean;
  shuttingDown: boolean;
  skiaStatus: SkiaStatus;
};

export function buildLiveness(state: RuntimeState) {
  return {
    status: "ok",
    uptimeMs: Date.now() - state.startedAt,
    shuttingDown: state.shuttingDown
  };
}

export function buildReadiness(state: RuntimeState) {
  return {
    ready: state.ready && !state.shuttingDown,
    skiaStatus: state.skiaStatus,
    startedAt: new Date(state.startedAt).toISOString()
  };
}
