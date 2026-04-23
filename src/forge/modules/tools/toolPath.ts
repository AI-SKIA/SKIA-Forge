import { assertSafeRelativeProjectPath } from "../context-engine/safeProjectPath.js";

export { assertSafeRelativeProjectPath } from "../context-engine/safeProjectPath.js";

/** Reject .env* for mutating tools; same as safeProjectPath. */
export function assertSafeFilePath(
  projectRoot: string,
  rel: string
): { ok: true; absPath: string; relPosix: string } | { ok: false; error: string } {
  return assertSafeRelativeProjectPath(projectRoot, rel);
}
