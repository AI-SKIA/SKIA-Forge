import { createRequire } from "node:module";
import Parser from "tree-sitter";
import type { StructuralSymbol } from "./structuralTypes.js";

const require = createRequire(import.meta.url);
const JavaScript: Parser.Language = require("tree-sitter-javascript");

let sharedParser: Parser | null = null;

function getParser(): Parser {
  if (!sharedParser) {
    sharedParser = new Parser();
    sharedParser.setLanguage(JavaScript);
  }
  return sharedParser;
}

function line1(node: { startPosition: { row: number } }): number {
  return node.startPosition.row + 1;
}

function lineEnd(node: { endPosition: { row: number } }): number {
  return node.endPosition.row + 1;
}

function nameFromField(node: Parser.SyntaxNode, field: string): string | null {
  const n = node.childForFieldName(field);
  return n?.text ?? null;
}

const FUNCTION_LIKE_VALUE = new Set([
  "arrow_function",
  "function",
  "function_expression",
  "generator_function"
]);

/**
 * D1-01: Tree-sitter (JavaScript grammar) structural extraction.
 * Used for .js, .cjs, .mjs, .jsx.
 */
export function extractJavaScriptSymbols(source: string, filePath: string): StructuralSymbol[] {
  const parser = getParser();
  const tree = parser.parse(source);
  const out: StructuralSymbol[] = [];
  const classStack: string[] = [];
  const walk = (node: Parser.SyntaxNode): void => {
    const t = node.type;
    if (t === "class_declaration") {
      const cname = nameFromField(node, "name");
      if (cname) {
        out.push({
          name: cname,
          kind: "class",
          startLine: line1(node),
          endLine: lineEnd(node),
          parentName: classStack.length ? classStack[classStack.length - 1] : undefined,
          filePath
        });
        classStack.push(cname);
        for (const c of node.namedChildren) {
          walk(c);
        }
        classStack.pop();
        return;
      }
    }
    if (t === "method_definition") {
      const m = nameFromField(node, "name");
      if (m) {
        out.push({
          name: m,
          kind: "method",
          startLine: line1(node),
          endLine: lineEnd(node),
          parentName: classStack.length ? classStack[classStack.length - 1] : undefined,
          filePath
        });
      }
    } else if (t === "function_declaration" || t === "generator_function_declaration") {
      const fn = nameFromField(node, "name");
      if (fn) {
        out.push({
          name: fn,
          kind: "function",
          startLine: line1(node),
          endLine: lineEnd(node),
          parentName: classStack.length ? classStack[classStack.length - 1] : undefined,
          filePath
        });
      }
    } else if (t === "import_statement") {
      const src = nameFromField(node, "source");
      out.push({
        name: `import${src ? `:${src.replace(/['"]/g, "")}` : ""}`,
        kind: "import",
        startLine: line1(node),
        endLine: lineEnd(node),
        filePath
      });
    } else if (t === "export_statement") {
      out.push({
        name: "export",
        kind: "export",
        startLine: line1(node),
        endLine: lineEnd(node),
        filePath
      });
    } else if (t === "variable_declarator") {
      const vname = nameFromField(node, "name");
      const value = node.childForFieldName("value");
      if (vname && value && FUNCTION_LIKE_VALUE.has(value.type)) {
        out.push({
          name: vname,
          kind: "function",
          startLine: line1(node),
          endLine: lineEnd(node),
          parentName: classStack.length ? classStack[classStack.length - 1] : undefined,
          filePath
        });
      }
    } else if (t === "field_definition") {
      const fname = nameFromField(node, "property");
      const value = node.namedChildren.find((c) => FUNCTION_LIKE_VALUE.has(c.type));
      if (fname && value) {
        out.push({
          name: fname,
          kind: "method",
          startLine: line1(node),
          endLine: lineEnd(node),
          parentName: classStack.length ? classStack[classStack.length - 1] : undefined,
          filePath
        });
      }
    }
    for (const c of node.namedChildren) {
      walk(c);
    }
  };
  walk(tree.rootNode);
  return out;
}

export function resetJavaScriptParserForTests(): void {
  if (!sharedParser) {
    return;
  }
  const maybeDisposable = sharedParser as unknown as { delete?: () => void };
  maybeDisposable.delete?.();
  sharedParser = null;
}
