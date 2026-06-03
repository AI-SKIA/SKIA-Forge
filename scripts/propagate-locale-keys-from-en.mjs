#!/usr/bin/env node
/**
 * Copy missing keys from public/locales/en/*.json into every other locale file.
 * Existing translations are preserved; only missing keys get English fallback.
 * Same workflow as Skia-FULL scripts/propagate-locale-keys-from-en.mjs.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'hi', 'ja', 'ko', 'pt', 'ru', 'tr', 'zh'];
const EN_DIR = path.join(root, 'public', 'locales', 'en');

function deepMergeMissing(target, source) {
  let added = 0;
  for (const [key, value] of Object.entries(source)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      if (target[key] === undefined || typeof target[key] !== 'object' || Array.isArray(target[key])) {
        target[key] = {};
      }
      added += deepMergeMissing(target[key], value);
    } else if (target[key] === undefined) {
      target[key] = value;
      added++;
    }
  }
  return added;
}

let totalAdded = 0;
const files = fs.readdirSync(EN_DIR).filter((f) => f.endsWith('.json'));

for (const file of files) {
  const en = JSON.parse(fs.readFileSync(path.join(EN_DIR, file), 'utf8'));
  for (const lang of LOCALES) {
    if (lang === 'en') continue;
    const destPath = path.join(root, 'public', 'locales', lang, file);
    if (!fs.existsSync(destPath)) {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, `${JSON.stringify(en, null, 2)}\n`, 'utf8');
      totalAdded += 1;
      continue;
    }
    const target = JSON.parse(fs.readFileSync(destPath, 'utf8'));
    totalAdded += deepMergeMissing(target, en);
    fs.writeFileSync(destPath, `${JSON.stringify(target, null, 2)}\n`, 'utf8');
  }
}

console.log(`Propagated missing keys (${totalAdded} leaf additions / new files).`);
