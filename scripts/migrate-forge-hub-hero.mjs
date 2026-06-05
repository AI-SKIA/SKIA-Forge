#!/usr/bin/env node
/**
 * Wrap hub hero (logo + page-header) for centered shell parity with doc pages.
 * Run: node scripts/migrate-forge-hub-hero.mjs [--check]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const checkOnly = process.argv.includes("--check");

const HUB_FILES = [
  "resources.html",
  "security.html",
  "contact.html",
  "platform-downloads.html",
];

const HUB_HERO_RE =
  /(<div class="wrap[^"]*">\s*<button[^>]*class="back-btn"[^>]*><\/button>\s*)(<img[^>]*class="page-logo"[^>]*>\s*(?:<div class="(?:feature-page-header|page-header)"[\s\S]*?<\/(?:p|div)>\s*<\/div>))/;

function migrate(html) {
  if (html.includes('class="hub-header"')) return html;
  if (!HUB_HERO_RE.test(html)) return html;
  HUB_HERO_RE.lastIndex = 0;
  return html.replace(HUB_HERO_RE, '$1<header class="hub-header">\n  $2\n  </header>');
}

const changed = [];
for (const name of HUB_FILES) {
  const file = path.join(publicDir, name);
  if (!fs.existsSync(file)) continue;
  const before = fs.readFileSync(file, "utf8");
  const after = migrate(before);
  if (after !== before) {
    if (!checkOnly) fs.writeFileSync(file, after, "utf8");
    changed.push(name);
  }
}

if (checkOnly) {
  if (changed.length) {
    console.error(`[migrate-forge-hub-hero] ${changed.length} hub page(s) need hero wrap:`);
    changed.forEach((f) => console.error(`  ${f}`));
    process.exit(1);
  }
  console.log("[migrate-forge-hub-hero] OK — hub pages use .hub-header");
  process.exit(0);
}

console.log(`[migrate-forge-hub-hero] migrated ${changed.length} hub page(s)`);
changed.forEach((f) => console.log(`  ${f}`));
