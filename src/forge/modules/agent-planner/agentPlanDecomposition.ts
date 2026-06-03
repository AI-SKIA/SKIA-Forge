import { z } from "zod";
import type { SkiaFullAdapter } from "../../../skiaFullAdapter.js";
import {
  agentTaskPlanV1Schema,
  extractJsonObjectString,
  extractTextFromSkiaChatResponse,
  type AgentTaskPlanV1
} from "./agentPlannerRequest.js";
import { createDefaultToolRegistry } from "../tools/index.js";
import { validateExecutorGovernance, governanceLimitsV1 } from "../governance/agentGovernance.js";

const decomposeBundleSchema = z.object({
  plan: agentTaskPlanV1Schema,
  steps: z
    .array(
      z.object({
        stepId: z.string().min(1),
        tool: z.string().min(1),
        input: z.unknown()
      })
    )
    .min(1)
});

export type AgentDecomposeRequestBody = {
  goal: string;
  path: string;
  plan: AgentTaskPlanV1;
};

export type AgentDecomposeStep = {
  stepId: string;
  tool: string;
  input: unknown;
};

/**
 * Map a v1 plan to executable tool steps via SKIA chat (mode agent).
 * Used by IDE and `/api/forge/agent/decompose` before preview/apply execute.
 */
export async function runAgentDecomposeRequest(
  body: AgentDecomposeRequestBody,
  skia: SkiaFullAdapter,
  passthroughHeaders?: Record<string, string>
): Promise<{ status: number; body: unknown }> {
  const goal = String(body.goal ?? "").trim();
  const relPath = String(body.path ?? "").trim();
  const planParse = agentTaskPlanV1Schema.safeParse(body.plan);
  if (!goal) {
    return { status: 400, body: { error: "goal is required." } };
  }
  if (!relPath) {
    return { status: 400, body: { error: "path is required." } };
  }
  if (!planParse.success) {
    return { status: 400, body: { error: planParse.error.message } };
  }
  const plan = { ...planParse.data, version: "1" as const };
  const toolNames = createDefaultToolRegistry().listNames().join(", ");

  const message = [
    "You are SKIA-Forge agent decomposition. Convert the plan into executable tool steps.",
    `Workspace relative path anchor: ${relPath}`,
    `Goal: ${goal}`,
    `Plan JSON: ${JSON.stringify(plan)}`,
    `Allowed tools only: ${toolNames}.`,
    "Return a single JSON object (no markdown) with keys:",
    '"plan" (same v1 plan object) and "steps" (array of { "stepId", "tool", "input" }).',
    "Prefer: search_codebase or search_text → read_file → edit_file or write_file.",
    "stepId must match plan step ids when possible.",
    "Do not include run_terminal unless the goal explicitly requires shell commands."
  ].join("\n");

  let upstream: Record<string, unknown>;
  try {
    upstream = await skia.intelligence(message, "agent", passthroughHeaders);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Decompose chat call failed";
    return { status: 502, body: { error: msg, plan, steps: [] } };
  }

  const raw = extractTextFromSkiaChatResponse(upstream);
  const jsonSlice = extractJsonObjectString(raw);
  if (!jsonSlice) {
    return {
      status: 422,
      body: {
        error: "Model response did not contain a JSON object.",
        plan,
        steps: fallbackStepsFromPlan(plan, relPath, goal)
      }
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonSlice);
  } catch (e) {
    return {
      status: 422,
      body: {
        error: e instanceof Error ? e.message : "json parse",
        plan,
        steps: fallbackStepsFromPlan(plan, relPath, goal)
      }
    };
  }

  const v = decomposeBundleSchema.safeParse(parsed);
  if (!v.success) {
    return {
      status: 422,
      body: {
        error: v.error.message,
        plan,
        steps: fallbackStepsFromPlan(plan, relPath, goal)
      }
    };
  }

  const nextPlan = { ...v.data.plan, version: "1" as const };
  const actions = v.data.steps.map((s) => ({
    stepId: s.stepId,
    tool: s.tool,
    input: s.input
  }));
  const gCheck = validateExecutorGovernance(nextPlan, actions, governanceLimitsV1());
  if (!gCheck.ok) {
    return {
      status: 422,
      body: {
        error: `${gCheck.code}: ${gCheck.reason}`,
        plan: nextPlan,
        steps: fallbackStepsFromPlan(nextPlan, relPath, goal)
      }
    };
  }

  return {
    status: 200,
    body: {
      version: "agent-decompose-v1" as const,
      goal,
      path: relPath,
      plan: nextPlan,
      steps: v.data.steps
    }
  };
}

/** Deterministic fallback when model JSON is missing or invalid. */
export function fallbackStepsFromPlan(
  plan: AgentTaskPlanV1,
  relPath: string,
  goal: string
): AgentDecomposeStep[] {
  const query = goal.slice(0, 500) || plan.title;
  return plan.steps.map((s) => ({
    stepId: s.id,
    tool: "search_codebase",
    input: { query: s.title || query, path: relPath, maxResults: 8 }
  }));
}
