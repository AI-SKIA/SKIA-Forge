/**
 * Restore product-name placeholders leaked by machine translation in locale JSON.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'public', 'locales');
const LOCALE_CODES = ['fr', 'es', 'ar', 'zh', 'pt', 'de', 'ja', 'ko', 'hi', 'tr', 'ru'];
const NAMESPACES = [
  'common.json',
  'platform-downloads.json',
  'resources.json',
  'security.json',
  'contact.json',
  'docs.json',
];

const TOKEN_TO_TERM = [
  ['\uE000FORGE_HOME\uE001', 'Forge Home'],
  ['\uE000ECHO\uE001', 'SKIA E.C.H.O.'],
  ['\uE000SKIA_SERVE\uE001', 'Skia-Serve'],
  ['\uE000SKIA_HUB\uE001', 'Skia-Hub'],
  ['\uE000SKIA_FORGE_IDE\uE001', 'SKIA Forge IDE'],
  ['\uE000SKIA_FORGE_CAPS\uE001', 'SKIA FORGE'],
  ['\uE000SKIA_FORGE\uE001', 'SKIA Forge'],
  ['\uE000SKIA\uE001', 'SKIA'],
  ['\uE000SOVEREIGN\uE001', 'Sovereign Intelligence'],
  ['\uE000EPAAS\uE001', 'EPAAS'],
  ['\uE000JWT_SECRET\uE001', 'JWT_SECRET'],
  ['\uE000SKIA_BACKEND_URL\uE001', 'SKIA_BACKEND_URL'],
  ['\uE000FORGE_HOST\uE001', 'forge.skia.ca'],
  ['\uE000API_HOST\uE001', 'api.skia.ca'],
];

const LEAKED = [
  ['SKIA_FORGE_IDE', 'SKIA Forge IDE'],
  ['SKIA_FORGE_CAPS', 'SKIA FORGE'],
  ['SKIA_FORGE', 'SKIA Forge'],
];

function restoreString(s) {
  let out = s;
  out = out.replace(/\uE002([^\uE003]+)\uE003/g, '$1');
  for (const [token, term] of TOKEN_TO_TERM) {
    out = out.split(token).join(term);
  }
  for (const [leaked, term] of LEAKED) {
    out = out.split(leaked).join(term);
  }
  return out;
}

function walk(node) {
  if (typeof node === 'string') return restoreString(node);
  if (Array.isArray(node)) return node.map(walk);
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = walk(v);
    return out;
  }
  return node;
}

let files = 0;
for (const locale of LOCALE_CODES) {
  for (const file of NAMESPACES) {
    const p = path.join(LOCALES_DIR, locale, file);
    if (!fs.existsSync(p)) continue;
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    const restored = walk(data);
    fs.writeFileSync(p, `${JSON.stringify(restored, null, 2)}\n`, 'utf8');
    files++;
  }
}
console.log(`Restored tokens in ${files} files`);
