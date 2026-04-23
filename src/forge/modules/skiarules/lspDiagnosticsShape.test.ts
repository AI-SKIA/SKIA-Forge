import test from "node:test";
import assert from "node:assert/strict";
import { buildLspSkiarulesDiagnosticsBundleV1, toLspSkiarulesFileDiagnosticsV1, FORGE_LSP_SKIARULES_DIAG_V } from "./lspDiagnosticsShape.js";

test("LSP bundle: file + project", () => {
  const d = {
    path: "a.ts",
    architecture: [],
    naming: [],
    antiPatterns: []
  };
  const b = buildLspSkiarulesDiagnosticsBundleV1(d, { violationCount: 0, sample: [] });
  assert.equal(b.schema, FORGE_LSP_SKIARULES_DIAG_V);
  assert.equal(b.path, "a.ts");
  assert.ok(b.projectArchitecture);
  assert.equal(b.projectArchitecture?.violationCount, 0);
  const f = toLspSkiarulesFileDiagnosticsV1(d);
  assert.equal(f.kind, "file");
});
