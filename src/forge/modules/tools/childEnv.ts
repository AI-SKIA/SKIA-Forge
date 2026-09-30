/**
 * Environment for child processes started by Forge (terminal tool, validation, git).
 * Forge's own credentials must never reach commands run in a user project, so
 * secret-like variables are removed; ordinary shell variables are kept.
 */
const SECRET_NAME = /(SECRET|TOKEN|PASSWORD|PASSWD|API_?KEY|PRIVATE_?KEY|CREDENTIAL|DATABASE_URL|_DSN$|JWT|STRIPE|SESSION|COOKIE|AUTH)/i;

/** Needed by ordinary developer tooling even though the name looks sensitive. */
const KEEP = new Set(["SSH_AUTH_SOCK", "GIT_ASKPASS", "SSH_ASKPASS"]);

export function isSecretEnvName(name: string): boolean {
  return !KEEP.has(name.toUpperCase()) && SECRET_NAME.test(name);
}

export function scrubbedChildEnv(
  extra: Record<string, string> = {},
  base: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(base)) {
    if (v !== undefined && !isSecretEnvName(k)) out[k] = v;
  }
  return { ...out, ...extra };
}
