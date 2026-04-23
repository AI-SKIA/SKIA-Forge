import path from "node:path";
import { extractJavaScriptSymbols } from "./extractJavaScriptTreeSitter.js";
import { extractTypeScriptCompilerSymbols, isTypeScriptExtension } from "./extractTypeScriptCompiler.js";
import type { StructureExtractionResult } from "./structuralTypes.js";

const JS_LIKE = new Set([".js", ".cjs", ".mjs", ".jsx"]);

/**
 * D1-01: structural symbol extraction. JavaScript/JSX via Tree-sitter; TypeScript via compiler API.
 * Other languages: reserved for follow-on grammars (no redundant duplicate of chunking).
 */
export function extractStructuralSymbols(filePath: string, content: string): StructureExtractionResult {
  if (!content.length) {
    return { symbols: [], engine: "empty" };
  }
  const ext = path.extname(filePath).toLowerCase();
  if (isTypeScriptExtension(filePath)) {
    return {
      symbols: extractTypeScriptCompilerSymbols(content, filePath),
      engine: "typescript"
    };
  }
  if (JS_LIKE.has(ext)) {
    return {
      symbols: extractJavaScriptSymbols(content, filePath),
      engine: "tree_sitter_javascript"
    };
  }
  return { symbols: [], engine: "unsupported" };
}
