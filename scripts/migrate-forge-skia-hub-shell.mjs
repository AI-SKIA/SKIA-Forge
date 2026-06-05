#!/usr/bin/env node
/**
 * Migrate Forge hub/doc HTML to skia.ca skia-forge-hub class structure (Skia-FULL §14).
 * Run: node scripts/migrate-forge-skia-hub-shell.mjs [--check]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");
const checkOnly = process.argv.includes("--check");

const CLASS_REPLACEMENTS = [
  [/\bclass="page-logo"/g, 'class="skia-forge-hub__logo"'],
  [/\bclass="doc-header"/g, 'class="skia-forge-hub__header"'],
  [/\bclass="hub-header"/g, 'class="skia-forge-hub__header"'],
  [/\bclass="page-title"/g, 'class="skia-forge-hub__title"'],
  [/\bclass="doc-title"/g, 'class="skia-forge-hub__title"'],
  [/\bclass="page-subtitle"/g, 'class="skia-forge-hub__subtitle"'],
  [/\bclass="doc-desc"/g, 'class="skia-forge-hub__subtitle"'],
  [/\bclass="quick-links"/g, 'class="skia-forge-hub__quick-links"'],
  [/\bclass="feature-tab feature-tab--active"/g, 'class="skia-forge-hub__ql"'],
  [/\bclass="feature-tab"/g, 'class="skia-forge-hub__ql"'],
  [/\bclass="ql"/g, 'class="skia-forge-hub__ql"'],
  [/\bclass="section-label"/g, 'class="skia-forge-hub__section-label"'],
  [/\bclass="doc-grid"/g, 'class="skia-forge-hub__doc-grid"'],
  [/\bclass="doc-card doc-card--panel"/g, 'class="skia-forge-hub__doc-card skia-forge-hub__doc-card--panel"'],
  [/\bclass="doc-card"/g, 'class="skia-forge-hub__doc-card"'],
  [/\bclass="doc-card-title"/g, 'class="skia-forge-hub__doc-title"'],
  [/\bclass="doc-card-desc"/g, 'class="skia-forge-hub__doc-desc"'],
  [/\bclass="doc-card-tag"/g, 'class="skia-forge-hub__doc-tag"'],
];

function collectHtmlFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectHtmlFiles(full, acc);
    else if (entry.name.endsWith(".html")) acc.push(full);
  }
  return acc;
}

function wrapSkiaForgeHub(html) {
  if (html.includes('class="skia-forge-hub"')) return html;
  return html.replace(
    /(<div class="wrap[^"]*"[^>]*>\s*<button[^>]*class="back-btn"[^>]*>[\s\S]*?<\/button>\s*)/i,
    "$1<div class=\"skia-forge-hub\">\n",
  ).replace(
    /(\s*<\/footer>\s*)(<\/div>\s*(?:<script|$))/i,
    "$1</div>\n$2",
  ).replace(
    /(\s*<div class="doc-footer">[\s\S]*?<\/div>\s*)(<\/div>\s*(?:<script|$))/i,
    "$1</div>\n$2",
  );
}

function fixSpacedSectionLabel(html) {
  return html.replace(
    /class="skia-forge-hub__section-label" style="margin-top:32px;"/g,
    'class="skia-forge-hub__section-label skia-forge-hub__section-label--spaced"',
  );
}

function migrateFile(filePath) {
  const original = fs.readFileSync(filePath, "utf8");
  let html = original;
  let changed = false;

  for (const [re, repl] of CLASS_REPLACEMENTS) {
    const next = html.replace(re, repl);
    if (next !== html) {
      html = next;
      changed = true;
    }
  }

  const wrapped = wrapSkiaForgeHub(html);
  if (wrapped !== html) {
    html = wrapped;
    changed = true;
  }

  const spaced = fixSpacedSectionLabel(html);
  if (spaced !== html) {
    html = spaced;
    changed = true;
  }

  if (!changed) return { filePath, changed: false };
  if (!checkOnly) fs.writeFileSync(filePath, html, "utf8");
  return { filePath, changed: true };
}

const files = collectHtmlFiles(publicDir);
const results = files.map(migrateFile);
const changed = results.filter((r) => r.changed);

if (checkOnly) {
  if (changed.length) {
    console.error(`[migrate-forge-skia-hub-shell] ${changed.length} file(s) need migration:`);
    for (const r of changed) console.error("  ", path.relative(root, r.filePath));
    process.exit(1);
  }
  console.log(`[migrate-forge-skia-hub-shell] OK — ${files.length} HTML file(s)`);
  process.exit(0);
}

console.log(`[migrate-forge-skia-hub-shell] migrated ${changed.length} file(s)`);
for (const r of changed) console.log("  ", path.relative(root, r.filePath));
