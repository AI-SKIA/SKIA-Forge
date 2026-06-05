#!/usr/bin/env node
/**
 * Wrap doc hero (logo, badge, title, desc, divider) in .doc-header for centered shell.
 * Run: node scripts/migrate-forge-doc-header.mjs [--check]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.join(__dirname, "..", "public", "docs");
const checkOnly = process.argv.includes("--check");

const DOC_HEADER_RE =
  /(<div class="wrap">\s*<button[^>]*class="back-btn"[^>]*><\/button>\s*)(<img[^>]*class="page-logo"[^>]*>\s*<div class="doc-badge"[\s\S]*?<div class="doc-divider"><\/div>)/;

function migrate(html) {
  if (html.includes('class="doc-header"')) return html;
  if (!DOC_HEADER_RE.test(html)) return html;
  DOC_HEADER_RE.lastIndex = 0;
  return html.replace(
    DOC_HEADER_RE,
    '$1<header class="doc-header">\n  $2\n  </header>',
  );
}

const changed = [];
for (const name of fs.readdirSync(docsDir)) {
  if (!name.endsWith(".html")) continue;
  const file = path.join(docsDir, name);
  const before = fs.readFileSync(file, "utf8");
  const after = migrate(before);
  if (after !== before) {
    if (!checkOnly) fs.writeFileSync(file, after, "utf8");
    changed.push(name);
  }
}

if (checkOnly) {
  if (changed.length) {
    console.error(`[migrate-forge-doc-header] ${changed.length} doc(s) need header wrap:`);
    changed.forEach((f) => console.error(`  ${f}`));
    process.exit(1);
  }
  console.log("[migrate-forge-doc-header] OK — all doc pages use .doc-header");
  process.exit(0);
}

console.log(`[migrate-forge-doc-header] migrated ${changed.length} doc(s)`);
changed.forEach((f) => console.log(`  ${f}`));
