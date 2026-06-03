#!/usr/bin/env node
/** Exit 1 if any non-en locale is missing keys present in en (per namespace file). */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localesDir = path.join(root, 'public', 'locales');
const LANGS = fs
  .readdirSync(localesDir)
  .filter((d) => /^[a-z]{2}$/.test(d) && fs.statSync(path.join(localesDir, d)).isDirectory());

function leafPaths(obj, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) out.push(...leafPaths(v, p));
    else out.push(p);
  }
  return out;
}

let missingTotal = 0;
const enDir = path.join(localesDir, 'en');
const files = fs.readdirSync(enDir).filter((f) => f.endsWith('.json'));

for (const file of files) {
  const en = JSON.parse(fs.readFileSync(path.join(enDir, file), 'utf8'));
  const enLeaves = new Set(leafPaths(en));
  for (const lang of LANGS) {
    if (lang === 'en') continue;
    const p = path.join(localesDir, lang, file);
    if (!fs.existsSync(p)) {
      console.error(`MISSING FILE ${lang}/${file}`);
      missingTotal += enLeaves.size;
      continue;
    }
    const target = JSON.parse(fs.readFileSync(p, 'utf8'));
    const targetLeaves = new Set(leafPaths(target));
    const missing = [...enLeaves].filter((k) => !targetLeaves.has(k));
    if (missing.length) {
      console.error(`${lang}/${file}: ${missing.length} missing keys`);
      if (missing.length <= 5) console.error('  ', missing.join(', '));
      missingTotal += missing.length;
    }
  }
}

if (missingTotal) {
  console.error(`\nTotal missing leaf keys: ${missingTotal}`);
  process.exit(1);
}
console.log(`Locale parity OK (${files.length} namespaces × ${LANGS.length - 1} langs).`);
