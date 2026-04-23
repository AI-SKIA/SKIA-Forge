import { SkiaBrainProbeRow } from "./skiaFullAdapter.js";
import { classifyProbeRow } from "./integrationReport.js";

export type ForgeModuleHealth = {
  module: "context" | "agent" | "sdlc" | "production" | "healing" | "architecture";
  state: "healthy" | "degraded" | "unavailable";
  reason: string;
};

export function buildForgeModuleHealth(rows: SkiaBrainProbeRow[]): ForgeModuleHealth[] {
  const byPath = new Map(rows.map((r) => [r.path, r]));
  const meta = byPath.get("/api/meta/route");
  const chat = byPath.get("/api/skia/chat");
  const routing = byPath.get("/api/routing/estimate");

  return [
    moduleFromProbe("context", meta, "Depends on reasoning router"),
    moduleFromProbe("architecture", meta, "Depends on reasoning router"),
    moduleFromProbe("healing", meta, "Depends on reasoning router"),
    moduleFromProbe("agent", chat, "Depends on chat intelligence"),
    moduleFromProbe("sdlc", chat, "Depends on chat intelligence"),
    moduleFromProbe("production", routing, "Depends on routing estimate")
  ];
}

function moduleFromProbe(
  module: ForgeModuleHealth["module"],
  row: SkiaBrainProbeRow | undefined,
  fallbackReason: string
): ForgeModuleHealth {
  if (!row) {
    return { module, state: "unavailable", reason: `${fallbackReason} (probe missing)` };
  }
  const category = classifyProbeRow(row);
  if (category === "ok") return { module, state: "healthy", reason: "Upstream contract healthy." };
  if (category === "auth" || category === "contract") {
    return { module, state: "degraded", reason: row.detail ?? `${category} issue` };
  }
  return { module, state: "unavailable", reason: row.detail ?? `${category} issue` };
}
