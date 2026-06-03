#!/usr/bin/env node
/**
 * Strip duplicated inline <style> blocks from Context A HTML pages and link shared CSS.
 * Run: node scripts/apply-forge-hub-design.mjs [--check]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");
const checkOnly = process.argv.includes("--check");

const HUB_PAGES = new Set([
  "platform-downloads.html",
  "resources.html",
  "security.html",
  "contact.html",
]);

const WRAP_CLASS = {
  "platform-downloads.html": "wrap wrap--wide",
  "resources.html": "wrap wrap--medium",
  "security.html": "wrap wrap--medium",
  "contact.html": "wrap wrap--narrow",
};

const CSS_BLOCK = `  <link rel="stylesheet" href="/forge-premium-ui.css" />
  <link rel="stylesheet" href="/forge-hub-design.css" />`;

function collectHtmlFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectHtmlFiles(full, acc);
    else if (entry.name.endsWith(".html")) acc.push(full);
  }
  return acc;
}

function stripFirstStyleBlock(html) {
  return html.replace(/<style\b[^>]*>[\s\S]*?<\/style>\s*/i, "");
}

function ensureCssLinks(html) {
  let out = html;
  if (!out.includes("/forge-premium-ui.css")) {
    out = out.replace(/<\/head>/i, `${CSS_BLOCK}\n</head>`);
  } else if (!out.includes("/forge-hub-design.css")) {
    out = out.replace(
      /(<link rel="stylesheet" href="\/forge-premium-ui\.css" \/>)/,
      `$1\n  <link rel="stylesheet" href="/forge-hub-design.css" />`,
    );
  }
  return out;
}

function addBodyClass(html) {
  return html.replace(/<body(\s[^>]*)?>/i, (match, attrs = "") => {
    if (/class="[^"]*forge-context-a/.test(match)) return match;
    if (/class="/.test(match)) {
      return match.replace(/class="([^"]*)"/, 'class="forge-context-a $1"');
    }
    const trimmed = attrs.trim();
    return trimmed ? `<body class="forge-context-a" ${trimmed}>` : `<body class="forge-context-a">`;
  });
}

function setWrapClass(html, basename) {
  const wrapClasses = WRAP_CLASS[basename];
  if (!wrapClasses) return html;
  const from = 'class="wrap"';
  const to = `class="${wrapClasses}"`;
  if (html.includes(from)) return html.replace(from, to);
  return html.replace(/class="wrap(\s[^"]*)?"/, `class="${wrapClasses}$1"`);
}

function migrateFile(filePath) {
  const basename = path.basename(filePath);
  const original = fs.readFileSync(filePath, "utf8");
  if (!original.includes("<style")) {
    return { filePath, changed: false, reason: "no inline style" };
  }

  let html = stripFirstStyleBlock(original);
  html = ensureCssLinks(html);
  html = addBodyClass(html);
  html = setWrapClass(html, basename);

  if (html === original) {
    return { filePath, changed: false, reason: "unchanged" };
  }

  if (!checkOnly) {
    fs.writeFileSync(filePath, html, "utf8");
  }
  return { filePath, changed: true };
}

const files = collectHtmlFiles(publicDir);
const results = files.map(migrateFile);
const changed = results.filter((r) => r.changed);
const skipped = results.filter((r) => !r.changed);

if (checkOnly) {
  if (changed.length) {
    console.error(`[apply-forge-hub-design] ${changed.length} file(s) need migration:`);
    for (const r of changed) console.error("  ", path.relative(root, r.filePath));
    process.exit(1);
  }
  console.log(`[apply-forge-hub-design] OK — ${files.length} HTML file(s) aligned`);
  process.exit(0);
}

console.log(`[apply-forge-hub-design] migrated ${changed.length} file(s)`);
for (const r of changed) console.log("  ", path.relative(root, r.filePath));
if (skipped.length) {
  console.log(`[apply-forge-hub-design] skipped ${skipped.length} file(s)`);
}
