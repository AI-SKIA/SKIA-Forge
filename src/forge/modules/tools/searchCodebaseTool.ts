import { z } from "zod";
import type { ForgeTool, ToolContext, ToolExecuteResult } from "./types.js";
import {
  gatherSearchFiles,
  readFileCapped,
  searchInContentRegex,
  toPosixRel,
  type SearchHit
} from "./searchShared.js";

const schema = z.object({
  pattern: z.string().min(1).max(1_000),
  /** ECMAScript regex (no / delimiters in string). */
  isRegex: z.boolean().optional(),
  fileGlob: z.string().min(1).max(200).optional(),
  caseInsensitive: z.boolean().optional(),
  maxFiles: z.number().int().min(1).max(2_000).optional(),
  maxResults: z.number().int().min(1).max(1_000).optional()
});

export const searchCodebaseTool: ForgeTool = {
  name: "search_codebase",
  description: "Search project text files for a RegExp (default) or literal string pattern (set isRegex false).",
  inputSchema: schema,
  validate(raw) {
    const p = schema.safeParse(raw);
    if (!p.success) {
      return { ok: false, error: p.error.message };
    }
    return { ok: true, data: p.data };
  },
  async execute(
    ctx: ToolContext,
    input: unknown
  ): Promise<ToolExecuteResult<{ pattern: string; isRegex: boolean; hits: SearchHit[]; truncated: boolean }>> {
    const v = schema.safeParse(input);
    if (!v.success) {
      return { success: false, error: v.error.message, code: "VALIDATION" };
    }
    const {
      pattern: pat,
      isRegex = true,
      fileGlob = "**/*.{ts,tsx,js,jsx,mjs,cjs,json,md,html,css,yml,yaml}",
      caseInsensitive = true,
      maxFiles = 400,
      maxResults = 100
    } = v.data;
    let re: RegExp;
    if (isRegex) {
      try {
        re = new RegExp(pat, caseInsensitive ? "gi" : "g");
      } catch (e) {
        return { success: false, error: `Invalid regex: ${(e as Error).message}`, code: "REGEX" };
      }
    } else {
      re = new RegExp(pat.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&"), caseInsensitive ? "gi" : "g");
    }
    const files = await gatherSearchFiles(ctx.projectRoot, fileGlob, maxFiles);
    const hits: SearchHit[] = [];
    let truncated = false;
    for (const f of files) {
      re.lastIndex = 0;
      if (hits.length >= maxResults) {
        truncated = true;
        break;
      }
      const rel = toPosixRel(f);
      const content = await readFileCapped(ctx.projectRoot, rel);
      if (content == null) {
        continue;
      }
      searchInContentRegex(content, re, rel, maxResults, hits);
    }
    if (hits.length >= maxResults) {
      truncated = true;
    }
    return {
      success: true,
      data: { pattern: pat, isRegex, hits: hits.slice(0, maxResults), truncated }
    };
  },
  async rollback() {
    return { success: true, data: undefined };
  }
};
