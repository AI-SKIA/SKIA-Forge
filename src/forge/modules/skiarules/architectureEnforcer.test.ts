import assert from "node:assert/strict";
import test from "node:test";
import { checkArchitectureImports } from "./architectureEnforcer.js";
import { extractImportSpecifiers } from "./importExtract.js";
import type { SkiarulesConfig } from "./skiarulesTypes.js";

test("import extract: from and side-effect", () => {
  const s = "import a from 'lodash';\nimport 'track'\nimport { x } from 'fs'";
  const im = extractImportSpecifiers(s);
  assert.ok(im.includes("lodash") && im.includes("track") && im.includes("fs"));
});

test("forbidden import produces violation", async () => {
  const cfg: SkiarulesConfig = {
    architecture: {
      boundaries: [
        { pathPattern: "src", cannotImportFrom: ["lodash", "forbidden-pkg"] }
      ]
    }
  } as SkiarulesConfig;
  const v = await checkArchitectureImports(
    process.cwd(),
    "src/hi.ts",
    ["lodash", "react", "./local"],
    cfg
  );
  const hit = v.some((x) => x.importPath === "lodash");
  assert.equal(hit, true);
});

test("canImportFrom whitelist: disallowed", async () => {
  const cfg: SkiarulesConfig = {
    architecture: { boundaries: [{ pathPattern: "a.ts", canImportFrom: ["react", "./a"] }] }
  } as SkiarulesConfig;
  const v = await checkArchitectureImports(
    process.cwd(),
    "a.ts",
    ["nope", "react"],
    cfg
  );
  const bad = v.find((x) => x.importPath === "nope");
  assert.ok(bad);
  assert.ok(v.every((x) => x.importPath !== "react"));
});
