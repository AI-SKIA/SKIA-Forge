import path from "node:path";

const FORBIDDEN_BASENAMES = new Set([".env", ".env.local", ".env.production", ".env.development"]);

export function assertSafeRelativeProjectPath(
  projectRoot: string,
  relPath: string
):
  | { ok: true; absPath: string; relPosix: string }
  | { ok: false; error: string } {
  if (!relPath || relPath.length > 4096) {
    return { ok: false, error: "Invalid path." };
  }
  if (/[\0\n\r]/.test(relPath)) {
    return { ok: false, error: "Invalid path." };
  }
  const normalized = relPath.replace(/\\/g, "/");
  if (path.isAbsolute(relPath) || normalized.includes("..")) {
    return { ok: false, error: "Path must be relative and stay under the project." };
  }
  const base = path.resolve(projectRoot);
  const abs = path.resolve(base, relPath);
  const relFromBase = path.relative(base, abs);
  if (relFromBase.startsWith("..") || path.isAbsolute(relFromBase)) {
    return { ok: false, error: "Path must stay within project root." };
  }
  const name = path.basename(abs);
  if (FORBIDDEN_BASENAMES.has(name) || name.startsWith(".env")) {
    return { ok: false, error: "Refusing to read environment file paths for safety." };
  }
  return { ok: true, absPath: abs, relPosix: toPosix(relFromBase) };
}

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}
