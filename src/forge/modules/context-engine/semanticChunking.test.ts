import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSemanticChunksFromStructure,
  MAX_SEMANTIC_TOKENS
} from "./semanticChunking.js";
import type { StructuralSymbol } from "./structuralTypes.js";

test("semantic chunks: batches imports and maps symbols", () => {
  const content = `import a from "a";
import b from "b";
export const x = 1;
class C { m() {} }
`;
  const symbols: StructuralSymbol[] = [
    { name: "import:a", kind: "import", startLine: 1, endLine: 1, filePath: "f.ts" },
    { name: "import:b", kind: "import", startLine: 2, endLine: 2, filePath: "f.ts" },
    { name: "export", kind: "export", startLine: 3, endLine: 3, filePath: "f.ts" },
    { name: "C", kind: "class", startLine: 4, endLine: 4, filePath: "f.ts" },
    { name: "m", kind: "method", startLine: 4, endLine: 4, parentName: "C", filePath: "f.ts" }
  ];
  const chunks = buildSemanticChunksFromStructure("f.ts", content, symbols);
  assert.ok(chunks.length >= 3);
  const im = chunks.find((c) => c.name === "imports");
  assert.ok(im);
  assert.equal(im?.startLine, 1);
  assert.equal(im?.endLine, 2);
  assert.ok(chunks.some((c) => c.kind === "method" && c.name === "m"));
});

test("semantic chunks: class header separate when methods on later lines", () => {
  const content = `class D {
  a(): void {}
  b(): void {}
}
`;
  const symbols: StructuralSymbol[] = [
    { name: "D", kind: "class", startLine: 1, endLine: 4, filePath: "f.ts" },
    { name: "a", kind: "method", startLine: 2, endLine: 2, parentName: "D", filePath: "f.ts" },
    { name: "b", kind: "method", startLine: 3, endLine: 3, parentName: "D", filePath: "f.ts" }
  ];
  const chunks = buildSemanticChunksFromStructure("f.ts", content, symbols);
  const header = chunks.find((c) => c.name === "D" && c.kind === "class");
  assert.ok(header, "class header chunk");
  assert.ok(header!.endLine < 2);
  assert.ok(chunks.filter((c) => c.kind === "method").length >= 2);
});

test("semantic chunks: splits oversized symbol to stay within max token budget", () => {
  const long = "x".repeat(2500);
  const content = `function big() {
${long}
}
`;
  const symbols: StructuralSymbol[] = [
    { name: "big", kind: "function", startLine: 1, endLine: 3, filePath: "f.ts" }
  ];
  const chunks = buildSemanticChunksFromStructure("f.ts", content, symbols);
  const funcChunks = chunks.filter(
    (c) => c.kind === "function" && c.name.startsWith("big")
  );
  assert.ok(funcChunks.length >= 2, "expected multiple parts for oversized function");
  for (const c of funcChunks) {
    assert.ok(
      c.tokenEstimate <= MAX_SEMANTIC_TOKENS + 55,
      `chunk tokenEstimate ${c.tokenEstimate} exceeds post-overlap budget (~50 token overlap + body)`
    );
  }
  assert.ok(funcChunks.some((c) => c.name.includes("(1/")));
});
