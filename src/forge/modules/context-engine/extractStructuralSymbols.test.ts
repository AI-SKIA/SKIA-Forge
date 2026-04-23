import assert from "node:assert/strict";
import test from "node:test";
import { extractStructuralSymbols } from "./extractStructuralSymbols.js";

test("structural: typescript extracts function and class", () => {
  const content = `export class Foo {
    bar(): void { }
  }
  export function x() { }
  `;
  const { symbols, engine } = extractStructuralSymbols("sample.ts", content);
  assert.equal(engine, "typescript");
  const names = new Set(symbols.map((s) => `${s.kind}:${s.name}`));
  assert.ok(names.has("class:Foo"));
  assert.ok([...names].some((k) => k === "function:x" || k.startsWith("method:bar")));
});

test("structural: javascript via tree-sitter", () => {
  const content = `import x from "y";
  export function one() { }
  class C { m() { } }
  `;
  const { symbols, engine } = extractStructuralSymbols("a.js", content);
  assert.equal(engine, "tree_sitter_javascript");
  const kinds = new Set(symbols.map((s) => s.name));
  assert.ok(kinds.size >= 1);
});

test("structural: javascript const arrow and class field arrow", () => {
  const content = `const useX = () => 1;
  class C { f = () => 2; }
  `;
  const { engine, symbols } = extractStructuralSymbols("b.js", content);
  assert.equal(engine, "tree_sitter_javascript");
  const names = symbols.map((s) => `${s.kind}:${s.name}`);
  assert.ok(names.includes("function:useX"));
  assert.ok(symbols.some((s) => s.name === "f" && s.kind === "method"));
});

test("structural: python is unsupported in stage 1", () => {
  const { engine, symbols } = extractStructuralSymbols("main.py", "def a():\n  pass\n");
  assert.equal(engine, "unsupported");
  assert.equal(symbols.length, 0);
});

test("structural: typescript const arrow and type alias", () => {
  const content = `
  export type Row = { id: string };
  export const useX = () => 1;
  class C { field = () => 2; }
  `;
  const { engine, symbols } = extractStructuralSymbols("sample.ts", content);
  assert.equal(engine, "typescript");
  const byKind = (k: string) => symbols.filter((s) => s.kind === k).map((s) => s.name);
  assert.ok(byKind("type").includes("Row"));
  assert.ok(byKind("function").includes("useX"));
  assert.ok(symbols.some((s) => s.name === "field" && s.kind === "method"));
});
