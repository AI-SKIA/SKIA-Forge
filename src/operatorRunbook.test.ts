import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function skiaStateEntriesInSource(): Set<string> {
  const names = new Set<string>();
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (p.endsWith(".ts") && !p.endsWith(".test.ts")) {
        const src = fs.readFileSync(p, "utf8");
        for (const m of src.matchAll(/["']\.skia["']\s*,\s*["']([^"']+)["']/g)) names.add(m[1]);
        for (const m of src.matchAll(/\.skia\/([A-Za-z0-9_.-]+)/g)) names.add(m[1]);
        const stateFile = src.match(/const STATE_DIR = "\.skia";[\s\S]{0,80}?const STATE_FILE = "([^"]+)"/);
        if (stateFile) names.add(stateFile[1]);
        const auditFile = src.match(/const AUDIT_DIR = "\.skia";[\s\S]{0,80}?const AUDIT_FILE = "([^"]+)"/);
        if (auditFile) names.add(auditFile[1]);
      }
    }
  };
  walk(path.join(root, "src"));
  return names;
}

test("operator manual runbook covers backup, upgrade, rollback and restore, and lists every .skia state entry", () => {
  const manual = fs.readFileSync(path.join(root, "docs/OPERATOR_MANUAL.md"), "utf8");
  for (const heading of ["## Upgrade, rollback, and backup", "### Back up", "### Upgrade", "### Roll back", "### Restore"]) {
    assert.ok(manual.includes(heading), heading);
  }
  const entries = skiaStateEntriesInSource();
  assert.ok(entries.has("runtime-state.json") && entries.has("agent-log.json"));
  const undocumented = [...entries].filter((name) => !manual.includes("`" + name));
  assert.deepEqual(undocumented, []);
});

test("the HTML operator manual renders the runbook section in every locale", () => {
  const html = fs.readFileSync(path.join(root, "public/docs/OPERATOR_MANUAL.html"), "utf8");
  assert.match(html, /sections\.upgrade-rollback-backup\.title/);
  const localesDir = path.join(root, "public/locales");
  for (const locale of fs.readdirSync(localesDir)) {
    const docs = JSON.parse(fs.readFileSync(path.join(localesDir, locale, "docs.json"), "utf8"));
    const section = docs.pages["operator-manual"].sections["upgrade-rollback-backup"];
    assert.ok(section?.title && section?.html.includes(".skia/"), locale);
  }
});
