#!/usr/bin/env node
/**
 * Skia-FULL §6.1 shell inline on every Context A .wrap (matches resources.tsx main style).
 * Run: node scripts/migrate-forge-shell-inline.mjs [--check]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");
const checkOnly = process.argv.includes("--check");

/** Canonical — Skia-FULL design_bible.md §6.1 / DocEmbedShell.tsx */
export const FORGE_SHELL_INLINE =
  "padding: 0.75rem 40px 40px 40px;max-width:800px;margin:0 auto;box-sizing:border-box;width:100%;";

const WRAP_OPEN_RE = /<div class="wrap([^"]*)"([^>]*)>/gi;
const SHELL_STYLE_RE =
  /style="padding: 0\.75rem 40px 40px 40px;max-width:800px;margin:0 auto;box-sizing:border-box;width:100%;"/;

function collectHtmlFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectHtmlFiles(full, acc);
    else if (entry.name.endsWith(".html")) acc.push(full);
  }
  return acc;
}

function ensureShellInline(html) {
  let changed = false;
  const out = html.replace(WRAP_OPEN_RE, (match, extraClasses, rest) => {
    if (SHELL_STYLE_RE.test(match)) return match;
    changed = true;
    const attrs = rest.replace(/\sstyle="[^"]*"/i, "").trim();
    const spacer = attrs ? ` ${attrs}` : "";
    return `<div class="wrap${extraClasses}" style="${FORGE_SHELL_INLINE}"${spacer}>`;
  });
  return { html: out, changed };
}

function migrateFile(filePath) {
  const original = fs.readFileSync(filePath, "utf8");
  const { html, changed } = ensureShellInline(original);
  if (!changed) return { filePath, changed: false };
  if (!checkOnly) fs.writeFileSync(filePath, html, "utf8");
  return { filePath, changed: true };
}

const files = collectHtmlFiles(publicDir);
const results = files.map(migrateFile);
const changed = results.filter((r) => r.changed);

if (checkOnly) {
  if (changed.length) {
    console.error(`[migrate-forge-shell-inline] ${changed.length} file(s) missing §6.1 shell inline:`);
    for (const r of changed) console.error("  ", path.relative(root, r.filePath));
    process.exit(1);
  }
  console.log(`[migrate-forge-shell-inline] OK — ${files.length} HTML file(s)`);
  process.exit(0);
}

console.log(`[migrate-forge-shell-inline] updated ${changed.length} file(s)`);
for (const r of changed) console.log("  ", path.relative(root, r.filePath));
