import { z } from "zod";
import type { ForgeTool, ToolContext, ToolExecuteResult } from "./types.js";
import {
  gatherSearchFiles,
  readFileCapped,
  searchInContentLiteral,
  toPosixRel,
  type SearchHit
} from "./searchShared.js";

const schema = z.object({
  query: z.string().min(1).max(1_000),
  /** Single file (relative) if set; else search across fileGlob. */
  path: z.string().min(1).max(4_096).optional(),
  fileGlob: z.string().min(1).max(200).optional(),
  caseSensitive: z.boolean().optional(),
  maxFiles: z.number().int().min(1).max(2_000).optional(),
  maxResults: z.number().int().min(1).max(1_000).optional()
});

export const searchTextTool: ForgeTool = {
  name: "search_text",
  description: "Literal substring search in one file or many files (bounded, ignores node_modules and .git).",
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
  ): Promise<ToolExecuteResult<{ query: string; hits: SearchHit[]; truncated: boolean }>> {
    const v = schema.safeParse(input);
    if (!v.success) {
      return { success: false, error: v.error.message, code: "VALIDATION" };
    }
    const {
      query: q,
      path: single,
      fileGlob = "**/*.{ts,tsx,js,jsx,mjs,cjs,json,md,html,css,yml,yaml}",
      caseSensitive = false,
      maxFiles = 400,
      maxResults = 100
    } = v.data;
    const files = single
      ? [toPosixRel(single)]
      : await gatherSearchFiles(ctx.projectRoot, fileGlob, maxFiles);
    const hits: SearchHit[] = [];
    let truncated = false;
    for (const f of files) {
      if (hits.length >= maxResults) {
        truncated = true;
        break;
      }
      const content = await readFileCapped(ctx.projectRoot, f);
      if (content == null) {
        if (single) {
          return { success: false, error: "File not found or too large to search.", code: "PATH_OR_SIZE" };
        }
        continue;
      }
      searchInContentLiteral(content, q, f, caseSensitive, maxResults, hits);
    }
    if (hits.length >= maxResults) {
      truncated = true;
    }
    return {
      success: true,
      data: { query: q, hits: hits.slice(0, maxResults), truncated }
    };
  },
  async rollback() {
    return { success: true, data: undefined };
  }
};
