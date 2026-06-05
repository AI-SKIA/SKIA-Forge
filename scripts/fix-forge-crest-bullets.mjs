#!/usr/bin/env node
/**
 * Replace empty bullet placeholders with inline SKIA Crest SVG (Skia-FULL fix-doc-crest-bullets.mjs parity).
 * Run: node scripts/fix-forge-crest-bullets.mjs [--check]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CREST_MARKUP_ITEM, CREST_MARKUP_18 } from "./forge-crest-bullet-markup.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");
const checkOnly = process.argv.includes("--check");

const REPLACEMENTS = [
  { from: '<div class="item-dot"></div>', to: CREST_MARKUP_ITEM },
  { from: '<span class="item-dot"></span>', to: CREST_MARKUP_ITEM },
  { from: '<div class="check-box"></div>', to: CREST_MARKUP_18 },
  { from: '<div class="triage-dot"></div>', to: CREST_MARKUP_18 },
  { from: "<div class='item-dot'></div>", to: CREST_MARKUP_ITEM },
  { from: "<div class='check-box'></div>", to: CREST_MARKUP_18 },
  { from: "<div class='triage-dot'></div>", to: CREST_MARKUP_18 },
  { from: "<div class='kc-bullet'></div>", to: CREST_MARKUP_18 },
];

const REPLACEMENT_REGEX = [
  { re: /<div\s+class\s*=\s*"item-dot"\s*>\s*<\/div>/g, to: CREST_MARKUP_ITEM },
  { re: /<div\s+class\s*=\s*'item-dot'\s*>\s*<\/div>/g, to: CREST_MARKUP_ITEM },
  { re: /<div\s+class\s*=\s*"check-box"\s*>\s*<\/div>/g, to: CREST_MARKUP_18 },
  { re: /<div\s+class\s*=\s*'check-box'\s*>\s*<\/div>/g, to: CREST_MARKUP_18 },
  { re: /<div\s+class\s*=\s*"triage-dot"\s*>\s*<\/div>/g, to: CREST_MARKUP_18 },
  { re: /<div\s+class\s*=\s*'triage-dot'\s*>\s*<\/div>/g, to: CREST_MARKUP_18 },
  { re: /<div\s+class\s*=\s*"kc-bullet"\s*>\s*<\/div>/g, to: CREST_MARKUP_18 },
  { re: /<div\s+class\s*=\s*'kc-bullet'\s*>\s*<\/div>/g, to: CREST_MARKUP_18 },
];

/** Security checklist — Lucide shield → SKIA Crest (design_bible.md §4) */
const CHECK_ITEM_LUCIDE_RE =
  /<div class="check-icon skia-li skia-li--check" aria-hidden="true"><svg[\s\S]*?<\/svg><\/div>/g;

/** Upgrade legacy 12×12 .item-crest in Tier 2 rows → 18×18 card-body markup */
const UPGRADE_ITEM_CREST_RES = [
  {
    re: /<span class="item-crest" aria-hidden="true"><svg width="12" height="12"/g,
    to: '<span class="item-crest item-crest--body" aria-hidden="true"><svg width="18" height="18"',
  },
  {
    re: /<span class='item-crest' aria-hidden='true'><svg width='12' height='12'/g,
    to: "<span class='item-crest item-crest--body' aria-hidden='true'><svg width='18' height='18'",
  },
  {
    re: /<span class=\\"item-crest\\" aria-hidden=\\"true\\"><svg width=\\"12\\" height=\\"12\\"/g,
    to: '<span class=\\"item-crest item-crest--body\\" aria-hidden=\\"true\\"><svg width=\\"18\\" height=\\"18\\"',
  },
];

function collectLocaleDocsJson() {
  const localesDir = path.join(publicDir, "locales");
  const out = [];
  for (const locale of fs.readdirSync(localesDir)) {
    const file = path.join(localesDir, locale, "docs.json");
    if (fs.existsSync(file)) out.push(file);
  }
  return out;
}

function patchText(text) {
  let out = text;
  let count = 0;
  for (const { from, to } of REPLACEMENTS) {
    const parts = out.split(from);
    if (parts.length > 1) {
      count += parts.length - 1;
      out = parts.join(to);
    }
    const escapedFrom = from.replace(/"/g, '\\"');
    const escapedParts = out.split(escapedFrom);
    if (escapedParts.length > 1) {
      count += escapedParts.length - 1;
      out = escapedParts.join(to.replace(/"/g, '\\"'));
    }
  }
  for (const { re, to } of REPLACEMENT_REGEX) {
    const matches = out.match(re);
    if (matches) {
      count += matches.length;
      out = out.replace(re, to);
    }
  }
  for (const { re, to } of UPGRADE_ITEM_CREST_RES) {
    const matches = out.match(re);
    if (matches) {
      count += matches.length;
      out = out.replace(re, to);
    }
  }
  const lucideMatches = out.match(CHECK_ITEM_LUCIDE_RE);
  if (lucideMatches) {
    count += lucideMatches.length;
    out = out.replace(CHECK_ITEM_LUCIDE_RE, CREST_MARKUP_18);
  }
  return { text: out, count };
}

function walkReplaceStrings(value) {
  if (typeof value === "string") {
    const { text, count } = patchText(value);
    return { value: text, count };
  }
  if (Array.isArray(value)) {
    let count = 0;
    const next = value.map((item) => {
      const r = walkReplaceStrings(item);
      count += r.count;
      return r.value;
    });
    return { value: next, count };
  }
  if (value && typeof value === "object") {
    let count = 0;
    const next = {};
    for (const [key, item] of Object.entries(value)) {
      const r = walkReplaceStrings(item);
      count += r.count;
      next[key] = r.value;
    }
    return { value: next, count };
  }
  return { value, count: 0 };
}

function patchJsonFile(filePath) {
  const original = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(original);
  const { value, count } = walkReplaceStrings(data);
  if (count === 0) return { filePath, changed: false, count: 0 };
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (!checkOnly) fs.writeFileSync(filePath, text, "utf8");
  return { filePath, changed: true, count };
}

function patchHtmlFile(filePath) {
  const original = fs.readFileSync(filePath, "utf8");
  const { text, count } = patchText(original);
  if (text === original) return { filePath, changed: false, count: 0 };
  if (!checkOnly) fs.writeFileSync(filePath, text, "utf8");
  return { filePath, changed: true, count };
}

function patchFile(filePath) {
  if (filePath.endsWith(".json")) return patchJsonFile(filePath);
  return patchHtmlFile(filePath);
}

const targets = [
  ...collectLocaleDocsJson(),
  path.join(publicDir, "contact.html"),
  path.join(publicDir, "security.html"),
];

const results = targets.map(patchFile);
const changed = results.filter((r) => r.changed);
const totalBullets = results.reduce((n, r) => n + r.count, 0);

if (checkOnly) {
  if (changed.length) {
    console.error(`[fix-forge-crest-bullets] ${changed.length} file(s) still have empty bullet placeholders:`);
    for (const r of changed) console.error("  ", path.relative(root, r.filePath), `(${r.count} bullets)`);
    process.exit(1);
  }
  console.log("[fix-forge-crest-bullets] OK — all crest bullets are inline SVG");
  process.exit(0);
}

console.log(`[fix-forge-crest-bullets] patched ${changed.length} file(s), ${totalBullets} crest bullets`);
for (const r of changed) console.log("  ", path.relative(root, r.filePath), `(${r.count})`);
