export interface RemoteExecutionRequest {
  target: string;
  action: string;
  payload: string;
}

const MAX_PAYLOAD_BYTES = 16_384;
const ALLOWED_ACTIONS = new Set(["echo", "describe", "health"]);

export function evaluateRemotePermission(request: RemoteExecutionRequest): boolean {
  if (!ALLOWED_ACTIONS.has(request.action)) return false;
  if (typeof request.payload !== "string" || request.payload.length > MAX_PAYLOAD_BYTES) return false;
  if (!/^[a-z0-9._-]{1,128}$/i.test(request.target)) return false;
  return true;
}

export function sandboxRemoteExecution(request: RemoteExecutionRequest): boolean {
  return evaluateRemotePermission(request);
}

/**
 * Executes a tiny, in-process simulation of a remote tool call (no shell, no network).
 * Real deployments should delegate to a hardened worker with OS-level sandboxing.
 */
export function executeRemotely(request: RemoteExecutionRequest): string {
  const started = Date.now();
  if (!sandboxRemoteExecution(request)) {
    return JSON.stringify({ ok: false, error: "permission_denied" });
  }
  if (request.action === "echo") {
    return JSON.stringify({
      ok: true,
      action: "echo",
      bytes: Math.min(request.payload.length, 256),
      sample: request.payload.slice(0, 256),
      elapsedMs: Date.now() - started,
    });
  }
  if (request.action === "describe") {
    return JSON.stringify({
      ok: true,
      action: "describe",
      target: request.target,
      elapsedMs: Date.now() - started,
    });
  }
  return JSON.stringify({
    ok: true,
    action: "health",
    target: request.target,
    elapsedMs: Date.now() - started,
  });
}
