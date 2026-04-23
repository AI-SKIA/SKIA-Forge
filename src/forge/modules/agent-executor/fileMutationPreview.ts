import fs from "node:fs/promises";
import { z } from "zod";
import { assertSafeFilePath } from "../tools/toolPath.js";
import { formatLineDiff } from "./lineDiff.js";

const writeSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  createDirectories: z.boolean().optional()
});

const editSchema = z.object({
  path: z.string().min(1),
  oldText: z.string().min(1),
  newText: z.string().max(2_000_000),
  replaceAll: z.boolean().optional()
});

function applyEdit(
  before: string,
  oldText: string,
  newText: string,
  replaceAll?: boolean
): { ok: true; after: string } | { ok: false; error: string } {
  if (replaceAll) {
    const parts = before.split(oldText);
    const n = parts.length - 1;
    if (n === 0) {
      return { ok: false, error: "oldText not found in file." };
    }
    return { ok: true, after: parts.join(newText) };
  }
  const i = before.indexOf(oldText);
  if (i < 0) {
    return { ok: false, error: "oldText not found in file." };
  }
  return {
    ok: true,
    after: before.slice(0, i) + newText + before.slice(i + oldText.length)
  };
}

/**
 * Produces a unified diff and does not write. Used for preview + audit.
 */
export async function computeFileMutationDiffPreview(
  projectRoot: string,
  tool: string,
  input: unknown
): Promise<
  { ok: true; path: string; diff: string; before: string | null; after: string } | { ok: false; error: string }
> {
  if (tool !== "write_file" && tool !== "edit_file") {
    return { ok: false, error: "Expected write_file or edit_file for file mutation preview." };
  }
  if (tool === "write_file") {
    const v = writeSchema.safeParse(input);
    if (!v.success) {
      return { ok: false, error: v.error.message };
    }
    const check = assertSafeFilePath(projectRoot, v.data.path);
    if (!check.ok) {
      return { ok: false, error: check.error };
    }
    let before: string | null = null;
    try {
      before = await fs.readFile(check.absPath, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
        return { ok: false, error: (e as Error).message };
      }
    }
    const after = v.data.content;
    return {
      ok: true,
      path: check.relPosix,
      before,
      after,
      diff: formatLineDiff(check.relPosix, before, after)
    };
  }
  const v = editSchema.safeParse(input);
  if (!v.success) {
    return { ok: false, error: v.error.message };
  }
  const check = assertSafeFilePath(projectRoot, v.data.path);
  if (!check.ok) {
    return { ok: false, error: check.error };
  }
  let before: string;
  try {
    before = await fs.readFile(check.absPath, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      return { ok: false, error: "File not found for edit." };
    }
    return { ok: false, error: (e as Error).message };
  }
  const { oldText, newText, replaceAll } = v.data;
  const r = applyEdit(before, oldText, newText, replaceAll);
  if (!r.ok) {
    return { ok: false, error: r.error };
  }
  return {
    ok: true,
    path: check.relPosix,
    before,
    after: r.after,
    diff: formatLineDiff(check.relPosix, before, r.after)
  };
}
