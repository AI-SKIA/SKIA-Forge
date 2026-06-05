#!/usr/bin/env node
/**
 * Verify Forge Web bullets use SKIA Crest (not legacy gold dots).
 * Run: node scripts/check-forge-crest-bullets.mjs [--check]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const checkOnly = !process.argv.includes("--fix");

const FORBIDDEN = [
  { file: "public/forge-hub-design.css", pattern: /border-radius:\s*50%[\s\S]{0,80}(item-dot|kc-bullet|triage-dot)/ },
  { file: "public/forge-hub-design.css", pattern: /(item-dot|kc-bullet|triage-dot)[\s\S]{0,80}border-radius:\s*50%/ },
  { file: "public/forge-hub-design.css", pattern: /(item-dot|kc-bullet|triage-dot)[\s\S]{0,120}background:\s*var\(--skia-gold-full\)/ },
];

const REQUIRED = [
  "public/forge-crest-bullet.css",
  "public/icons/skia-crest-bullet.svg",
];

let failed = false;

for (const rel of REQUIRED) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    console.error(`[check-forge-crest-bullets] missing required file: ${rel}`);
    failed = true;
  }
}

for (const { file, pattern } of FORBIDDEN) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) continue;
  const text = fs.readFileSync(full, "utf8");
  if (pattern.test(text)) {
    console.error(`[check-forge-crest-bullets] legacy gold-dot bullet styling in ${file}`);
    failed = true;
  }
}

const crestCss = path.join(root, "public/forge-crest-bullet.css");
if (fs.existsSync(crestCss)) {
  const text = fs.readFileSync(crestCss, "utf8");
  if (!text.includes("SkiaCrestBulletIcon") || !text.includes("--skia-crest-bullet-svg")) {
    console.error("[check-forge-crest-bullets] forge-crest-bullet.css missing crest SVG reference");
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log("[check-forge-crest-bullets] OK — Forge Web bullets use SKIA Crest SVG");
process.exit(0);
