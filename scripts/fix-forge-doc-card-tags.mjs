#!/usr/bin/env node
/**
 * Replace internal doc filenames on README card grids with customer-facing tags from resources.json.
 * Run: node scripts/fix-forge-doc-card-tags.mjs [--check]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const localesDir = path.join(root, "public", "locales");
const checkOnly = process.argv.includes("--check");

const DOC_SLUG_TO_CARD = {
  PRODUCT_MANUAL: "productManual",
  QUICKSTART: "quickstart",
  USER_GUIDE: "userGuide",
  DEVELOPER_GUIDE: "developerGuide",
  API_REFERENCE: "apiReference",
  TROUBLESHOOTING: "troubleshooting",
  CHANGELOG: "changelog",
  PRICING_AND_PACKAGES: "pricing",
  ENTERPRISE_READINESS_CHECKLIST: "enterprise",
  SECURITY_GUIDE: "securityGuide",
  SUPPORT: "support",
  OPERATOR_MANUAL: "operatorManual",
};

const FILENAME_BODY_RES = [
  /<div class=['"]card-body['"] style=['"]color:var\(--gold-muted\);font-size:11px;letter-spacing:0\.05em['"]>[A-Za-z_]+\.(?:html|md)<\/div>/gi,
  /<div class=['"]card-body['"] style=[\u201c\u201d"]color:var\(--gold-muted\);font-size:11px;letter-spacing:0\.05em[\u201c\u201d"]>[A-Za-z_]+\.(?:html|md)<\/div>/gi,
  /<div class=['"]card-body['"][^>]*>[A-Za-z_]+\.(?:html|md)<\/div>/gi,
];

function tagMarkup(tag) {
  return `<div class="skia-forge-hub__doc-tag">${tag}</div>`;
}

function patchReadmeHtml(html, cards) {
  let out = html;
  let count = 0;

  for (const re of FILENAME_BODY_RES) {
    out = out.replace(re, () => {
      count += 1;
      return "";
    });
  }

  for (const [slug, cardKey] of Object.entries(DOC_SLUG_TO_CARD)) {
    const tag = cards?.[cardKey]?.tag;
    if (!tag) continue;
    const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const hrefPatterns = [
      new RegExp(
        `(<a href=['"]/docs/${slug}\\.html['"][^>]*><div class=['"]card['"]><div class=['"]card-title['"]>[^<]*</div>)(?!\\s*<div class=['"]skia-forge-hub__doc-tag['"])`,
        "i",
      ),
      new RegExp(
        `(<a href=['"]/docs/${slug.toLowerCase()}\\.html['"][^>]*><div class=['"]card['"]><div class=['"]card-title['"]>[^<]*</div>)(?!\\s*<div class=['"]skia-forge-hub__doc-tag['"])`,
        "i",
      ),
    ];
    for (const re of hrefPatterns) {
      const next = out.replace(re, `$1${tagMarkup(tag)}`);
      if (next !== out) {
        out = next;
        count += 1;
        break;
      }
    }
    out = out.replace(
      new RegExp(
        `(<div class="skia-forge-hub__doc-tag">${escapedTag}</div>)\\s*<div class="skia-forge-hub__doc-tag">${escapedTag}</div>`,
        "g",
      ),
      "$1",
    );
  }

  return { text: out, count };
}

function walk(obj, fn) {
  if (typeof obj === "string") return fn(obj);
  if (Array.isArray(obj)) return obj.map((item) => walk(item, fn));
  if (obj && typeof obj === "object") {
    const next = {};
    for (const [k, v] of Object.entries(obj)) next[k] = walk(v, fn);
    return next;
  }
  return obj;
}

let failed = false;
let total = 0;

for (const locale of fs.readdirSync(localesDir)) {
  const resourcesPath = path.join(localesDir, locale, "resources.json");
  const docsPath = path.join(localesDir, locale, "docs.json");
  if (!fs.existsSync(resourcesPath) || !fs.existsSync(docsPath)) continue;

  const resources = JSON.parse(fs.readFileSync(resourcesPath, "utf8"));
  const cards = resources.cards ?? {};
  const missingTags = Object.values(DOC_SLUG_TO_CARD).filter((k) => !cards[k]?.tag);
  if (missingTags.length) {
    console.error(`[fix-forge-doc-card-tags] ${locale}/resources.json missing tag keys: ${missingTags.join(", ")}`);
    failed = true;
    continue;
  }

  const docs = JSON.parse(fs.readFileSync(docsPath, "utf8"));
  let localeCount = 0;
  const patched = walk(docs, (str) => {
    if (!str.includes("card-grid") || !/[A-Za-z_]+\.(html|md)/.test(str)) return str;
    const { text, count } = patchReadmeHtml(str, cards);
    localeCount += count;
    return text;
  });

  if (localeCount > 0) {
    total += localeCount;
    if (!checkOnly) {
      fs.writeFileSync(docsPath, `${JSON.stringify(patched, null, 2)}\n`, "utf8");
    }
    console.log(`  ${locale}/docs.json (${localeCount} patches)`);
  }
}

if (failed) process.exit(1);

if (checkOnly) {
  const leak = [];
  for (const locale of fs.readdirSync(localesDir)) {
    const docsPath = path.join(localesDir, locale, "docs.json");
    if (!fs.existsSync(docsPath)) continue;
    const text = fs.readFileSync(docsPath, "utf8");
    if (/card-body[^>]*>[A-Za-z_]+\.(html|md)</.test(text)) {
      leak.push(locale);
    }
  }
  if (leak.length) {
    console.error(`[fix-forge-doc-card-tags] internal filenames remain in: ${leak.join(", ")}`);
    process.exit(1);
  }
  console.log("[fix-forge-doc-card-tags] OK — no internal doc filenames on README cards");
  process.exit(0);
}

console.log(`[fix-forge-doc-card-tags] patched ${total} card tag(s) across locale docs.json`);
