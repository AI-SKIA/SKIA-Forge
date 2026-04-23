export interface KernelPermission {
  subject: string;
  action: string;
  resource: string;
}

/**
 * Conservative default policy: only narrowly-scoped actions on explicit resources.
 */
export function enforcePermissions(request: KernelPermission): boolean {
  const { subject, action, resource } = request;
  if (!subject?.trim() || !action?.trim() || !resource?.trim()) return false;
  const res = resource.toLowerCase();
  if (res.includes("..") || res.includes("://") || res.includes("\0")) return false;

  if (subject === "kernel" && action === "exec" && res.startsWith("sandbox:")) return true;
  if (subject === "user" && action === "read" && res.startsWith("public:")) return true;
  if (subject === "system" && action === "observe" && res.startsWith("telemetry:")) return true;
  return false;
}

export function isolateProcess(processId: string): boolean {
  return /^[a-z0-9._-]{1,128}$/i.test(processId);
}

export function sandboxExecution(processId: string): boolean {
  return isolateProcess(processId);
}
