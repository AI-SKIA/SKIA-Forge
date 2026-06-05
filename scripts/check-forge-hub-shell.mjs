#!/usr/bin/env node
/**
 * Verify Context A hub shell + 170px hero logos on all public HTML pages.
 * Exempt: skia-ide/, /forge/platform (forgePlatformUi.ts), Context B shells.
 * Run: node scripts/check-forge-hub-shell.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");
const hubCssPath = path.join(publicDir, "forge-hub-design.css");
const premiumCssPath = path.join(publicDir, "forge-premium-ui.css");

function collectHtmlFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectHtmlFiles(full, acc);
    else if (entry.name.endsWith(".html")) acc.push(full);
  }
  return acc;
}

const errors = [];

function requirePattern(label, content, pattern) {
  if (!pattern.test(content)) errors.push(`${label}: missing ${pattern}`);
}

const hubCss = fs.readFileSync(hubCssPath, "utf8");
const premiumCss = fs.readFileSync(premiumCssPath, "utf8");

requirePattern("forge-hub-design.css", hubCss, /background-color:\s*#120c08/);
requirePattern("forge-hub-design.css", hubCss, /body\.forge-context-a::before/);
requirePattern(
  "forge-hub-design.css",
  hubCss,
  /\.wrap[\s\S]*?linear-gradient\(180deg,\s*#040302/,
);
requirePattern("forge-hub-design.css", hubCss, /\.skia-forge-hub__logo[\s\S]*?width:\s*170px/);
requirePattern("forge-premium-ui.css", premiumCss, /\.pc-sidebar-logo-img[\s\S]*?width:\s*120px/);
requirePattern("forge-premium-ui.css", premiumCss, /\.page-logo[\s\S]*?width:\s*170px/);

if (/@media\s*\(\s*max-width:\s*680px\s*\)[\s\S]*#0a0a0a/.test(hubCss)) {
  errors.push("forge-hub-design.css: mobile hub flatten must not exist (desktop-only Forge Web)");
}

const htmlFiles = collectHtmlFiles(publicDir);
for (const filePath of htmlFiles) {
  const rel = path.relative(root, filePath);
  const html = fs.readFileSync(filePath, "utf8");

  if (!html.includes('class="forge-context-a"') && !html.includes("forge-context-a ")) {
    errors.push(`${rel}: missing body.forge-context-a`);
  }
  if (!html.includes("/forge-hub-design.css")) {
    errors.push(`${rel}: missing forge-hub-design.css link`);
  }
  if (!html.includes('class="skia-forge-hub__logo"')) {
    errors.push(`${rel}: missing .skia-forge-hub__logo hero`);
  }
  if (!html.includes('class="skia-forge-hub"')) {
    errors.push(`${rel}: missing .skia-forge-hub wrapper`);
  }
  if (!html.includes("padding:40px;max-width:800px;margin:0 auto;box-sizing:border-box;width:100%")) {
    errors.push(`${rel}: missing §6.1 inline shell on .wrap`);
  }
}

const platformUi = fs.readFileSync(path.join(root, "src", "forgePlatformUi.ts"), "utf8");
if (platformUi.includes("/forge-hub-design.css")) {
  errors.push("forgePlatformUi.ts: must not link forge-hub-design.css (Context B exempt)");
}
if (!platformUi.includes("forge-context-b")) {
  errors.push("forgePlatformUi.ts: must stay forge-context-b");
}

const ideIndex = path.join(root, "skia-ide", "src", "renderer", "index.html");
if (fs.existsSync(ideIndex)) {
  const ideHtml = fs.readFileSync(ideIndex, "utf8");
  if (ideHtml.includes("forge-hub-design.css") || ideHtml.includes("forge-context-a")) {
    errors.push("skia-ide renderer: must not use Context A hub shell");
  }
}

if (errors.length) {
  console.error("[check-forge-hub-shell] FAILED:");
  for (const err of errors) console.error("  ", err);
  process.exit(1);
}

console.log(
  `[check-forge-hub-shell] OK — ${htmlFiles.length} Context A page(s), CSS two-layer + 170px hero`,
);
