import {
  forgeSemanticChunksBodySchema
} from "../../../contracts.js";
import { extractStructuralSymbols } from "./extractStructuralSymbols.js";
import { buildSemanticChunksFromStructure } from "./semanticChunking.js";
import { assertSafeRelativeProjectPath } from "./safeProjectPath.js";
import type { SkiaFullAdapter } from "../../../skiaFullAdapter.js";

const EMBED_MAX_CHARS = 8_000;

/**
 * D1-02: semantic chunks for a file (from D1-01 structure) + optional one-chunk embed probe via SKIA-FULL.
 */
export async function runForgeContextSemanticChunks(
  projectRoot: string,
  pathQuery: string,
  readTextFile: (abs: string) => Promise<string>,
  skia: SkiaFullAdapter,
  tryEmbed: boolean
): Promise<{ status: number; body: unknown }> {
  const rel = String(pathQuery ?? "").trim();
  if (!rel) {
    return { status: 400, body: { error: "Missing path query (relative project file)." } };
  }
  const check = assertSafeRelativeProjectPath(projectRoot, rel);
  if (!check.ok) {
    return { status: 400, body: { error: check.error } };
  }
  let content: string;
  try {
    content = await readTextFile(check.absPath);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return { status: 404, body: { error: "File not found." } };
    }
    if (code === "EISDIR") {
      return { status: 400, body: { error: "Path is a directory, not a file." } };
    }
    return { status: 500, body: { error: "Failed to read file." } };
  }
  const { symbols, engine } = extractStructuralSymbols(check.relPosix, content);
  if (engine === "unsupported") {
    return {
      status: 422,
      body: {
        error: "No structural parser for this file type; semantic chunks require D1-01 support.",
        path: check.relPosix,
        engine: "unsupported" as const
      }
    };
  }
  const chunks = buildSemanticChunksFromStructure(check.relPosix, content, symbols);
  let embed: unknown = null;
  if (tryEmbed && chunks.length > 0) {
    const text = chunks[0].content.slice(0, EMBED_MAX_CHARS);
    const r = await skia.tryEmbedding(text);
    embed = r.ok
      ? {
          chunkIndex: 0,
          charLength: text.length,
          ok: true,
          dimensions: r.vector.length,
          model: r.model,
          vectorHead: r.vector.slice(0, 4)
        }
      : { chunkIndex: 0, charLength: text.length, ok: false, reason: r.reason };
  }
  const body = {
    path: check.relPosix,
    engine,
    symbolCount: symbols.length,
    chunkCount: chunks.length,
    chunks,
    embed: tryEmbed ? embed : null
  };
  forgeSemanticChunksBodySchema.parse(body);
  return { status: 200, body };
}
