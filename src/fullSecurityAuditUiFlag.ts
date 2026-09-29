/**
 * D2 dark flag — Full Security Audit IDE menu.
 * Server env only (FORGE_FULL_SECURITY_AUDIT_UI). Default false.
 * Exposed to the IDE via GET /api/forge/modules/status → fullSecurityAuditUi.
 * Never read from localStorage / import.meta on the client.
 */
export function isFullSecurityAuditUiEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  return env.FORGE_FULL_SECURITY_AUDIT_UI === "true";
}
