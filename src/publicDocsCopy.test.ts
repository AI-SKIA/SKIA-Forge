import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INTERNAL_MARKERS = [/Skia-FULL/, /GOOGLE_AI_API_KEY/, /GOOGLE_API_KEY/, /skia-ide\/dist/, /northflank/i];

function publicDocFiles(): string[] {
  const md = fs
    .readdirSync(path.join(root, "docs"), { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => path.join(root, "docs", e.name));
  const html = fs
    .readdirSync(path.join(root, "public", "docs"))
    .filter((n) => n.endsWith(".html"))
    .map((n) => path.join(root, "public", "docs", n));
  const localeDocs = fs
    .readdirSync(path.join(root, "public", "locales"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(root, "public", "locales", e.name, "docs.json"))
    .filter((p) => fs.existsSync(p));
  return [...md, ...html, ...localeDocs];
}

test("customer docs served at /docs carry no internal repo, provider-key or build-path references", () => {
  const leaks: string[] = [];
  for (const file of publicDocFiles()) {
    const text = fs.readFileSync(file, "utf8");
    for (const marker of INTERNAL_MARKERS) {
      if (marker.test(text)) leaks.push(`${path.relative(root, file)}: ${marker}`);
    }
  }
  assert.deepEqual(leaks, []);
});

test("/docs refuses internal contracts and architecture folders", () => {
  const server = fs.readFileSync(path.join(root, "src", "server.ts"), "utf8");
  const guard = server.slice(server.indexOf('app.use("/docs", (req, res, next)'), server.indexOf('app.use("/docs", express.static'));
  const pattern = guard.match(/if \((\/.+\/)\.test\(p\)\)/);
  assert.ok(pattern, "docs guard must use a path regex");
  const re = new Function(`return ${pattern![1]};`)() as RegExp;
  for (const blocked of ["/contracts/capability-parity.json", "/architecture/SOVEREIGN_PLATFORM.md", "/architecture"]) {
    assert.equal(re.test(blocked), true, blocked);
  }
  assert.equal(re.test("/README.md"), false);
});
