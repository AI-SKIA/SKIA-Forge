#!/usr/bin/env node
/**
 * Maintainer helper: apply hand-authored translations to public/locales JSON.
 * Per FORGE_RULES.md — edits locale files directly (no APIs, no browser translate).
 * Edit PHRASES below, then run: node scripts/apply-maintainer-translations.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localesDir = path.join(root, 'public', 'locales');
const LANGS = ['fr', 'ar', 'zh', 'es', 'pt', 'de', 'ja', 'ko', 'hi', 'tr', 'ru'];

/** English source string → per-locale translation (omit = leave unchanged) */
const PHRASES = {
  'SKIA FORGE': {
    fr: 'SKIA FORGE',
    de: 'SKIA FORGE',
    es: 'SKIA FORGE',
    pt: 'SKIA FORGE',
    ja: 'SKIA FORGE',
    ko: 'SKIA FORGE',
    zh: 'SKIA FORGE',
    ar: 'SKIA FORGE',
    hi: 'SKIA FORGE',
    tr: 'SKIA FORGE',
    ru: 'SKIA FORGE',
  },
  'Forge Home': {
    fr: 'Accueil Forge',
    de: 'Forge-Startseite',
    es: 'Inicio de Forge',
    pt: 'Início Forge',
    ja: 'Forge ホーム',
    ko: 'Forge 홈',
    zh: 'Forge 首页',
    ar: 'Forge الرئيسية',
    hi: 'Forge होम',
    tr: 'Forge Ana Sayfa',
    ru: 'Главная Forge',
  },
};

function walkReplace(node, counts) {
  if (typeof node === 'string') {
    const map = PHRASES[node];
    if (!map) return node;
    return node;
  }
  if (Array.isArray(node)) return node.map((item) => walkReplace(item, counts));
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === 'string' && PHRASES[v]) {
        out[k] = v;
      } else {
        out[k] = walkReplace(v, counts);
      }
    }
    return out;
  }
  return node;
}

function applyToLocaleTree(tree, lang) {
  function walk(node) {
    if (typeof node === 'string') {
      const en = Object.keys(PHRASES).find((key) => key === node);
      if (en && PHRASES[en][lang]) return PHRASES[en][lang];
      return node;
    }
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(node)) out[k] = walk(v);
      return out;
    }
    return node;
  }
  return walk(tree);
}

let updated = 0;
const files = fs.readdirSync(path.join(localesDir, 'en')).filter((f) => f.endsWith('.json'));

for (const file of files) {
  const enTree = JSON.parse(fs.readFileSync(path.join(localesDir, 'en', file), 'utf8'));
  for (const lang of LANGS) {
    const dest = path.join(localesDir, lang, file);
    if (!fs.existsSync(dest)) continue;
    const before = fs.readFileSync(dest, 'utf8');
    const locTree = JSON.parse(before);
    const merged = applyToLocaleTree(locTree, lang);
    const after = `${JSON.stringify(merged, null, 2)}\n`;
    if (after !== before) {
      fs.writeFileSync(dest, after);
      updated++;
    }
  }
}

console.log(`Applied maintainer phrases (${updated} file updates).`);
