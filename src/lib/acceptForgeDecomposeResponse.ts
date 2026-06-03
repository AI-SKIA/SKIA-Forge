/** Shared contract: Forge decompose HTTP status + body → IDE executor steps. */

export type AcceptDecomposePlanV1 = {
  title: string;
  goalRestatement?: string;
  version?: "1";
  steps: Array<{ id: string; title: string; detail?: string }>;
};

export type AcceptDecomposeStep = {
  stepId: string;
  tool: string;
  input: unknown;
};

export type AcceptDecomposeBody = {
  steps?: AcceptDecomposeStep[];
  plan?: AcceptDecomposePlanV1;
  error?: string;
};

export type AcceptDecomposeResult = {
  ok: boolean;
  steps: AcceptDecomposeStep[];
  plan: AcceptDecomposePlanV1;
  error?: string;
  usedFallback?: boolean;
};

/**
 * Server returns 422 with `steps` when model JSON fails but fallback steps are provided.
 * IDE must accept both 200 and 422 when steps are non-empty.
 */
export function acceptForgeDecomposeResponse(
  status: number,
  data: AcceptDecomposeBody,
  fallbackPlan: AcceptDecomposePlanV1
): AcceptDecomposeResult {
  const steps = Array.isArray(data.steps) ? data.steps : [];
  const outPlan = data.plan ?? fallbackPlan;
  if (steps.length > 0 && (status === 200 || status === 422)) {
    return {
      ok: true,
      steps,
      plan: outPlan,
      usedFallback: status === 422,
      error: status === 422 ? data.error : undefined
    };
  }
  return {
    ok: false,
    steps,
    plan: outPlan,
    error: data.error || `Decompose failed (${status})`
  };
}
