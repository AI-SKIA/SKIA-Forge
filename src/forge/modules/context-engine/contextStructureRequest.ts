import { assertSafeRelativeProjectPath } from "./safeProjectPath.js";
import { extractStructuralSymbols } from "./extractStructuralSymbols.js";
import {
  forgeContextStructureOkBodySchema,
  forgeContextStructureUnsupportedBodySchema
} from "../../../contracts.js";

/**
 * D1-01: HTTP mapping for `GET /api/forge/context/structure`.
 * Kept separate from the Express route so the contract and branching are unit-tested.
 */
export async function runForgeContextStructure(
  projectRoot: string,
  pathQuery: string,
  readTextFile: (absPath: string) => Promise<string>
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
    const body = {
      error: "No structural parser for this file type in v1 (D1-01).",
      path: check.relPosix,
      engine: "unsupported" as const
    };
    forgeContextStructureUnsupportedBodySchema.parse(body);
    return { status: 422, body };
  }

  const body = {
    path: check.relPosix,
    engine,
    count: symbols.length,
    symbols
  };
  forgeContextStructureOkBodySchema.parse(body);
  return { status: 200, body };
}
