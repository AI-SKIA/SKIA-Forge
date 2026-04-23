import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import { assertSafeFilePath } from "./toolPath.js";

const DEFAULT_IGNORE = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/.vs/**"
];

const MAX_FILE_BYTES = 500_000;
const MAX_FILES = 2_000;

export type SearchHit = { file: string; line: number; preview: string };

/**
 * List candidate text files (bounded) for search tools.
 */
export async function gatherSearchFiles(
  projectRoot: string,
  glob: string,
  maxFiles: number
): Promise<string[]> {
  const out = await fg(glob, {
    cwd: projectRoot,
    ignore: DEFAULT_IGNORE,
    onlyFiles: true,
    dot: true,
    absolute: false
  });
  return out.sort().slice(0, Math.min(maxFiles, MAX_FILES, out.length));
}

function lineFromOffset(content: string, pos: number): number {
  return (content.slice(0, pos).match(/\n/g) ?? []).length + 1;
}

export function searchInContentRegex(
  content: string,
  re: RegExp,
  fileRel: string,
  maxResults: number,
  out: SearchHit[]
): void {
  if (out.length >= maxResults) {
    return;
  }
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) != null) {
    const line = lineFromOffset(content, m.index);
    const start = m.index;
    const end = Math.min(content.length, m.index + Math.max(1, m[0]?.length ?? 1));
    const clipStart = content.lastIndexOf("\n", start) + 1;
    const clipEnd = (() => {
      const next = content.indexOf("\n", end);
      return next < 0 ? content.length : next;
    })();
    const lineText = content.slice(clipStart, clipEnd);
    out.push({ file: fileRel, line, preview: lineText.length > 400 ? lineText.slice(0, 400) + "…" : lineText });
    if (out.length >= maxResults) {
      break;
    }
    if (m.index === re.lastIndex) {
      re.lastIndex++;
    }
  }
}

export function searchInContentLiteral(
  content: string,
  q: string,
  fileRel: string,
  caseSensitive: boolean,
  maxResults: number,
  out: SearchHit[]
): void {
  if (out.length >= maxResults || !q.length) {
    return;
  }
  const hay = caseSensitive ? content : content.toLowerCase();
  const needle = caseSensitive ? q : q.toLowerCase();
  let from = 0;
  while (from < content.length) {
    const j = hay.indexOf(needle, from);
    if (j < 0) {
      return;
    }
    const line = lineFromOffset(content, j);
    const clipStart = content.lastIndexOf("\n", j) + 1;
    const clipEnd = (() => {
      const next = content.indexOf("\n", j + q.length);
      return next < 0 ? content.length : next;
    })();
    const lineText = content.slice(clipStart, clipEnd);
    out.push({ file: fileRel, line, preview: lineText.length > 400 ? lineText.slice(0, 400) + "…" : lineText });
    if (out.length >= maxResults) {
      return;
    }
    from = j + Math.max(1, q.length);
  }
}

export async function readFileCapped(
  projectRoot: string,
  fileRel: string
): Promise<string | null> {
  const c = assertSafeFilePath(projectRoot, fileRel);
  if (!c.ok) {
    return null;
  }
  const buf = await fs.readFile(c.absPath);
  if (buf.length > MAX_FILE_BYTES) {
    return null;
  }
  return buf.toString("utf8");
}

export function toPosixRel(f: string): string {
  return f.split(path.sep).join("/");
}

export { DEFAULT_IGNORE };
