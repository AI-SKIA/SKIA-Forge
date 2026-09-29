import assert from "node:assert/strict";
import test from "node:test";
import {
  buildForgeSemgrepCommand,
  resolveForgeSemgrepRulesPath
} from "./runSemgrepTool.js";

test("buildForgeSemgrepCommand uses local rules + metrics=off and forbids auto", () => {
  const cmd = buildForgeSemgrepCommand("/app/config/semgrep/skia-rules.yaml");
  assert.match(cmd, /semgrep --config "\/app\/config\/semgrep\/skia-rules\.yaml"/);
  assert.match(cmd, /--metrics=off/);
  assert.match(cmd, /--json \./);
  assert.equal(cmd.includes("--config=auto"), false);
  assert.throws(() => buildForgeSemgrepCommand("auto"), /SEMGREP_SOVEREIGNTY/);
  assert.throws(() => buildForgeSemgrepCommand(""), /SEMGREP_SOVEREIGNTY/);
});

test("resolveForgeSemgrepRulesPath points at config/semgrep/skia-rules.yaml", () => {
  const p = resolveForgeSemgrepRulesPath({}, process.cwd()).replace(/\\/g, "/");
  assert.match(p, /config\/semgrep\/skia-rules\.yaml$/);
});
