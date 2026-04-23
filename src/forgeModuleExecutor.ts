import { SkiaFullAdapter } from "./skiaFullAdapter.js";

export type ForgeModuleName =
  | "context"
  | "agent"
  | "sdlc"
  | "production"
  | "healing"
  | "architecture";

export async function runForgeModule(
  adapter: SkiaFullAdapter,
  module: ForgeModuleName,
  payload: Record<string, unknown>,
  headers?: Record<string, string>
): Promise<Record<string, unknown>> {
  const text = String(payload.query ?? payload.prompt ?? payload.intent ?? payload.instruction ?? "");
  switch (module) {
    case "context":
      return adapter.routeReasoning(text, "context", headers);
    case "agent":
      return adapter.intelligence(text, "agent", headers);
    case "sdlc":
      return adapter.intelligence(text, "sdlc", headers);
    case "production":
      return adapter.routingEstimate(payload, headers);
    case "healing":
      return adapter.routeReasoning(text, "healing", headers);
    case "architecture":
      return adapter.routeReasoning(text, "architecture", headers);
    default:
      throw new Error("Unsupported forge module");
  }
}

export function isForgeModuleName(value: string): value is ForgeModuleName {
  return (
    value === "context" ||
    value === "agent" ||
    value === "sdlc" ||
    value === "production" ||
    value === "healing" ||
    value === "architecture"
  );
}
