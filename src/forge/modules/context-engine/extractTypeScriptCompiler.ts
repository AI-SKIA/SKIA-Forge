import path from "node:path";
import ts from "typescript";
import type { StructuralKind, StructuralSymbol } from "./structuralTypes.js";

/**
 * D1-01: TypeScript / TSX structural symbols via the TypeScript compiler API.
 * (Full Tree-sitter TSX grammar is optional; compiler API is authoritative for .ts / .tsx.)
 */
export function extractTypeScriptCompilerSymbols(
  content: string,
  filePath: string
): StructuralSymbol[] {
  const ext = path.extname(filePath).toLowerCase();
  const scriptKind =
    ext === ".tsx"
      ? ts.ScriptKind.TSX
      : ext === ".jsx"
        ? ts.ScriptKind.JSX
        : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, scriptKind);
  const out: StructuralSymbol[] = [];
  const classStack: string[] = [];

  const add = (
    kind: StructuralKind,
    name: string,
    node: ts.Node,
    parentName: string | undefined
  ): void => {
    const start = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    const end = sf.getLineAndCharacterOfPosition(node.getEnd());
    out.push({
      name,
      kind,
      startLine: start.line + 1,
      endLine: end.line + 1,
      parentName,
      filePath
    });
  };

  const visit = (n: ts.Node): void => {
    if (ts.isImportDeclaration(n)) {
      const mod = ts.isStringLiteral(n.moduleSpecifier) ? n.moduleSpecifier.text : "?";
      add("import", `import:${mod}`, n, undefined);
    } else if (ts.isExportDeclaration(n) || ts.isExportAssignment(n)) {
      add("export", "export", n, undefined);
    } else if (ts.isInterfaceDeclaration(n)) {
      add("interface", n.name.text, n, undefined);
    } else if (ts.isEnumDeclaration(n)) {
      add("enum", n.name.text, n, undefined);
    } else if (ts.isModuleDeclaration(n) && ts.isIdentifier(n.name)) {
      add("namespace", n.name.text, n, undefined);
    } else if (ts.isClassDeclaration(n) && n.name) {
      const name = n.name.text;
      add("class", name, n, classStack.length ? classStack[classStack.length - 1] : undefined);
      classStack.push(name);
      ts.forEachChild(n, (c) => visit(c));
      classStack.pop();
    } else if (ts.isFunctionDeclaration(n) && n.name) {
      add(
        "function",
        n.name.text,
        n,
        classStack.length ? classStack[classStack.length - 1] : undefined
      );
    } else if (ts.isMethodDeclaration(n) && n.name) {
      const name = n.name.getText();
      add(
        "method",
        name,
        n,
        classStack.length ? classStack[classStack.length - 1] : undefined
      );
    } else if (ts.isTypeAliasDeclaration(n)) {
      add("type", n.name.text, n, undefined);
    } else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) {
      const init = n.initializer;
      if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
        add(
          "function",
          n.name.text,
          n,
          classStack.length ? classStack[classStack.length - 1] : undefined
        );
      }
      ts.forEachChild(n, (c) => visit(c));
    } else if (ts.isPropertyDeclaration(n) && n.name && ts.isIdentifier(n.name)) {
      const init = n.initializer;
      if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
        add(
          "method",
          n.name.text,
          n,
          classStack.length ? classStack[classStack.length - 1] : undefined
        );
      }
      ts.forEachChild(n, (c) => visit(c));
    } else {
      ts.forEachChild(n, (c) => visit(c));
    }
  };
  visit(sf);
  return out;
}

export function isTypeScriptExtension(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ext === ".ts" || ext === ".tsx" || ext === ".mts" || ext === ".cts";
}
