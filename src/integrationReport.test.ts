import assert from "node:assert/strict";
import test from "node:test";
import { buildProbeReport, classifyProbeRow } from "./integrationReport.js";

test("classifyProbeRow maps auth statuses", () => {
  const category = classifyProbeRow({
    name: "a",
    method: "POST",
    path: "/x",
    status: 401,
    ok: false,
    reachable: true
  });
  assert.equal(category, "auth");
});

test("buildProbeReport aggregates categories", () => {
  const report = buildProbeReport([
    { name: "ok", method: "GET", path: "/ok", status: 200, ok: true, reachable: true },
    { name: "c", method: "POST", path: "/c", status: 404, ok: false, reachable: true },
    { name: "u", method: "GET", path: "/u", status: 0, ok: false, reachable: false }
  ]);
  assert.equal(report.summary.ok, 1);
  assert.equal(report.summary.contract, 1);
  assert.equal(report.summary.unreachable, 1);
});
