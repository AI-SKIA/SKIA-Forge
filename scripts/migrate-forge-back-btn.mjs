#!/usr/bin/env node
/**
 * Move .back-btn inside .wrap (design_bible.md §6.2 in-column back control).
 * Run: node scripts/migrate-forge-back-btn.mjs [--check]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");
const checkOnly = process.argv.includes("--check");

const BACK_RE = /<button\s+type="button"\s+class="back-btn"[^>]*><\/button>\s*/i;
const IN_WRAP_RE = /<div class="wrap[^"]*">\s*<button[^>]*class="back-btn"/i;

function collectHtmlFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectHtmlFiles(full, acc);
    else if (entry.name.endsWith(".html")) acc.push(full);
  }
  return acc;
}

function migrate(html) {
  if (!BACK_RE.test(html) || IN_WRAP_RE.test(html)) return html;
  const match = html.match(BACK_RE);
  if (!match) return html;
  const btn = match[0].trim();
  let out = html.replace(BACK_RE, "");
  out = out.replace(/(<div class="wrap[^"]*">)/i, (_, open) => `${open}\n        ${btn}`);
  return out;
}

const changed = [];
for (const file of collectHtmlFiles(publicDir)) {
  const before = fs.readFileSync(file, "utf8");
  const after = migrate(before);
  if (after !== before) {
    if (!checkOnly) fs.writeFileSync(file, after, "utf8");
    changed.push(path.relative(root, file));
  }
}

if (checkOnly) {
  if (changed.length) {
    console.error(`[migrate-forge-back-btn] ${changed.length} file(s) need migration:`);
    changed.forEach((f) => console.error(`  ${f}`));
    process.exit(1);
  }
  console.log("[migrate-forge-back-btn] OK — all HTML pages use in-column back control");
  process.exit(0);
}

console.log(`[migrate-forge-back-btn] migrated ${changed.length} file(s)`);
changed.forEach((f) => console.log(`  ${f}`));
