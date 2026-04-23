import fs from "node:fs/promises";
import path from "node:path";

/**
 * Lightweight import extraction for JS/TS (D1-12 enforcer; not a full parser).
 * Captures: `from 'x'`, `from "x"`, `import "x"`.
 */
export const IMPORT_RE =
  /(?:\bimport\s+[^'";]*?from\s+['"]([^'"]+)['"])|(?:\bimport\s*['"]([^'"]+)['"])/g;

export function extractImportSpecifiers(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(IMPORT_RE)) {
    const s = m[1] || m[2];
    if (s) {
      out.push(s);
    }
  }
  return out;
}

export async function readImportsFromFile(
  projectRoot: string,
  relPathPosix: string
): Promise<string[]> {
  const abs = path.join(projectRoot, relPathPosix.split("/").join(path.sep));
  let raw: string;
  try {
    raw = await fs.readFile(abs, "utf8");
  } catch {
    return [];
  }
  return extractImportSpecifiers(raw);
}
