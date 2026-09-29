/**
 * ForgeRoundtripSandboxClient — SKIA-Forge
 *
 * HTTP client for skia-sandbox POST /run (same contract as Skia-FULL SandboxClient).
 */

export const FORGE_SANDBOX_NOT_PROVISIONED_MSG =
  "SKIA_SANDBOX_NOT_PROVISIONED — cannot run untrusted code on host. Deploy skia-sandbox first.";

export type ForgeSandboxExecResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  truncated: boolean;
};

export function isForgeSandboxProvisioned(env: NodeJS.ProcessEnv = process.env): boolean {
  const url = (env.SKIA_SANDBOX_URL || "").trim();
  const token = (env.SKIA_SANDBOX_TOKEN || "").trim();
  return Boolean(url && token);
}

export function assertForgeSandboxProvisioned(env: NodeJS.ProcessEnv = process.env): void {
  if (!isForgeSandboxProvisioned(env)) {
    throw new Error(FORGE_SANDBOX_NOT_PROVISIONED_MSG);
  }
}

export class ForgeRoundtripSandboxClient {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  async runIsolated(
    command: string,
    stdin?: string,
    timeoutMs = 120_000
  ): Promise<ForgeSandboxExecResult> {
    assertForgeSandboxProvisioned(this.env);
    const base = (this.env.SKIA_SANDBOX_URL || "").trim().replace(/\/$/, "");
    const token = (this.env.SKIA_SANDBOX_TOKEN || "").trim();
    if (!token) {
      throw new Error(FORGE_SANDBOX_NOT_PROVISIONED_MSG);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs + 5_000);
    try {
      const res = await fetch(`${base}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ command, stdin: stdin ?? null, timeoutMs }),
        signal: controller.signal
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        const message =
          typeof body.message === "string"
            ? body.message
            : typeof body.error === "string"
              ? body.error
              : `skia-sandbox HTTP ${res.status}`;
        throw new Error(message);
      }
      return {
        stdout: typeof body.stdout === "string" ? body.stdout : "",
        stderr: typeof body.stderr === "string" ? body.stderr : "",
        exitCode: Number(body.exitCode ?? body.code ?? 1),
        truncated: Boolean(body.truncated)
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

export const forgeRoundtripSandboxClient = new ForgeRoundtripSandboxClient();
