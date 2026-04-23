import { SovereignExecutionMode } from "./forgeGovernance.js";

export function resolveModeAndApproval(
  body: unknown,
  fallbackMode: SovereignExecutionMode
): { mode: SovereignExecutionMode; approved: boolean; approvalToken?: string } {
  const payload = typeof body === "object" && body ? (body as Record<string, unknown>) : {};
  const modeCandidate = typeof payload.mode === "string" ? payload.mode : fallbackMode;
  const mode: SovereignExecutionMode =
    modeCandidate === "strict" || modeCandidate === "adaptive" || modeCandidate === "autonomous"
      ? modeCandidate
      : fallbackMode;
  return {
    mode,
    approved: payload.approved === true,
    approvalToken: typeof payload.approvalToken === "string" ? payload.approvalToken : undefined
  };
}
