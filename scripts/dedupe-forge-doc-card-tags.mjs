#!/usr/bin/env node
/** Remove duplicate consecutive skia-forge-hub__doc-tag lines in locale docs.json */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const localesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "locales");
const DUP_RE = /(<div class="skia-forge-hub__doc-tag">[^<]+<\/div>)\s*\1/g;

function dedupe(str) {
  return str.replace(DUP_RE, "$1");
}

function walk(obj) {
  if (typeof obj === "string") return dedupe(obj);
  if (Array.isArray(obj)) return obj.map(walk);
  if (obj && typeof obj === "object") {
    const next = {};
    for (const [k, v] of Object.entries(obj)) next[k] = walk(v);
    return next;
  }
  return obj;
}

for (const locale of fs.readdirSync(localesDir)) {
  const docsPath = path.join(localesDir, locale, "docs.json");
  if (!fs.existsSync(docsPath)) continue;
  const data = JSON.parse(fs.readFileSync(docsPath, "utf8"));
  const original = JSON.stringify(data);
  const patched = walk(data);
  const next = JSON.stringify(patched);
  if (next !== original) {
    fs.writeFileSync(docsPath, `${JSON.stringify(patched, null, 2)}\n`, "utf8");
    console.log(`  deduped ${locale}/docs.json`);
  }
}
