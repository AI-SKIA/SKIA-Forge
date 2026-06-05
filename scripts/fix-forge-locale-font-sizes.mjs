#!/usr/bin/env node
/**
 * Replace sub-15px inline font sizes in locale JSON HTML with design-bible CSS classes.
 * Also fixes common i18n HTML corruption (broken border/text-decoration in inline styles).
 *
 * Run: node scripts/fix-forge-locale-font-sizes.mjs
 * Check: node scripts/fix-forge-locale-font-sizes.mjs --check
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const localesDir = path.join(root, "public", "locales");
const checkOnly = process.argv.includes("--check");
const FLOOR_PX = 15;

const HTML_REPLACEMENTS = [
  {
    re: /<p style="margin-top:12px;font-size:12px;color:var\(--gold-muted\)">/g,
    to: '<p class="doc-note doc-note--muted">',
  },
  {
    re: /<p style="margin-top:12px;font-size:13px;color:var\(--text-soft\)">/g,
    to: '<p class="doc-note">',
  },
  {
    re: /<p style="margin-bottom:14px;font-size:13px;color:var\(--text-soft\)">/g,
    to: '<p class="doc-note doc-note--lead">',
  },
  {
    re: /<p style="margin-top:14px;font-size:13px;color:var\(--text-soft\)">/g,
    to: '<p class="doc-note doc-note--after">',
  },
  {
    re: /<p style="margin-top:12px;font-size:13px;color:var\(-text-soft\)">/g,
    to: '<p class="doc-note">',
  },
  {
    re: /<p style='margin-top:12px;font-size:13px;color:var\(--text-soft\)'>/g,
    to: '<p class="doc-note">',
  },
  {
    re: /<p style="margin-bottom:14px;font-size:13px;color:var\(-text-soft\)">/g,
    to: '<p class="doc-note doc-note--lead">',
  },
  {
    re: /<div style="text-align:center;padding:20px;"><a href="\/contact" style="[^"]*">([\s\S]*?)<\/a><\/div>/g,
    to: '<div class="doc-cta-wrap"><a href="/contact" class="report-btn">$1</a></div></div>',
  },
  {
    re: /<div class="card-body" style="color:var\(--gold-muted\);font-size:11px;letter-spacing:0\.05em">[^<]*<\/div>/g,
    to: "",
  },
];

function fixCorruptedContactCta(html) {
  if (!/font-size:11px/i.test(html)) return html;
  if (!/contact|संपर्क|اتصل|formulario|formulaire|formulário|formular|formu|destek|поддерж|支持|サポート|양식|فتح|खोल/i.test(html)) {
    return html;
  }
  const labelMatch = html.match(/>([^<]+)<\/a>/);
  const label = labelMatch ? labelMatch[1].trim() : "Contact";
  return `<div class="doc-cta-wrap"><a href="/contact" class="report-btn">${label}</a></div></div>`;
}

function patchHtml(html) {
  let out = html;
  let count = 0;

  out = out.replace(/text-꾸밈/g, () => {
    count += 1;
    return "text-decoration";
  });

  for (const { re, to } of HTML_REPLACEMENTS) {
    const matches = out.match(re);
    if (matches) {
      count += matches.length;
      out = out.replace(re, to);
    }
  }

  for (const re of [
    /<p style="[^"]*font-size:1[0-4]px[^"]*">/g,
    /<p style='[^']*font-size:1[0-4]px[^']*'>/g,
  ]) {
    const matches = out.match(re);
    if (matches) {
      count += matches.length;
      out = out.replace(re, '<p class="doc-note">');
    }
  }

  const ctaFixed = fixCorruptedContactCta(out);
  if (ctaFixed !== out) {
    count += 1;
    out = ctaFixed;
  }

  return { text: out, count };
}

function walk(value) {
  if (typeof value === "string") {
    const { text, count } = patchHtml(value);
    return { value: text, count };
  }
  if (Array.isArray(value)) {
    let count = 0;
    const next = value.map((item) => {
      const r = walk(item);
      count += r.count;
      return r.value;
    });
    return { value: next, count };
  }
  if (value && typeof value === "object") {
    let count = 0;
    const next = {};
    for (const [key, item] of Object.entries(value)) {
      const r = walk(item);
      count += r.count;
      next[key] = r.value;
    }
    return { value: next, count };
  }
  return { value, count: 0 };
}

function findSubFloorViolations(text, filePath) {
  const hits = [];
  for (const match of text.matchAll(/font-size:(\d+)px/g)) {
    const px = parseInt(match[1], 10);
    if (px < FLOOR_PX) hits.push({ filePath, size: match[0] });
  }
  return hits;
}

let totalPatches = 0;
const changed = [];

for (const locale of fs.readdirSync(localesDir)) {
  const docsPath = path.join(localesDir, locale, "docs.json");
  if (!fs.existsSync(docsPath)) continue;

  const original = fs.readFileSync(docsPath, "utf8");
  const data = JSON.parse(original);
  const { value, count } = walk(data);

  if (count > 0) {
    totalPatches += count;
    changed.push(`${locale}/docs.json (${count})`);
    if (!checkOnly) {
      fs.writeFileSync(docsPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    }
  }
}

if (checkOnly) {
  const violations = [];
  for (const locale of fs.readdirSync(localesDir)) {
    const docsPath = path.join(localesDir, locale, "docs.json");
    if (!fs.existsSync(docsPath)) continue;
    violations.push(...findSubFloorViolations(fs.readFileSync(docsPath, "utf8"), `${locale}/docs.json`));
  }
  if (violations.length) {
    console.error(`[fix-forge-locale-font-sizes] ${violations.length} sub-${FLOOR_PX}px font-size in locale JSON:`);
    for (const v of violations.slice(0, 20)) console.error(`  ${v.filePath}: ${v.size}`);
    if (violations.length > 20) console.error(`  ... and ${violations.length - 20} more`);
    process.exit(1);
  }
  console.log("[fix-forge-locale-font-sizes] OK — locale JSON HTML meets 15px floor");
  process.exit(0);
}

console.log(`[fix-forge-locale-font-sizes] patched ${totalPatches} inline style(s) in ${changed.length} file(s)`);
for (const line of changed) console.log(" ", line);
