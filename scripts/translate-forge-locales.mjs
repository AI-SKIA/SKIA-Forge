/**
 * Translate public/locales/{locale}/*.json from en/ using google-translate-api-x.
 * Preserves product names, technical acronyms, HTML structure, and JSON keys.
 *
 * Usage: node scripts/translate-forge-locales.mjs [locale...]
 * Default: all non-en locales in LOCALE_CODES.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { translate } from 'google-translate-api-x';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EN_DIR = path.join(ROOT, 'public', 'locales', 'en');
const NAMESPACES = [
  'common.json',
  'platform-downloads.json',
  'resources.json',
  'security.json',
  'contact.json',
  'docs.json',
  'forge-platform.json',
];

const LOCALE_CODES = ['fr', 'es', 'ar', 'zh', 'pt', 'de', 'ja', 'ko', 'hi', 'tr', 'ru'];

/** google-translate-api-x language codes */
const TO_LANG = {
  fr: 'fr',
  es: 'es',
  ar: 'ar',
  zh: 'zh-CN',
  pt: 'pt',
  de: 'de',
  ja: 'ja',
  ko: 'ko',
  hi: 'hi',
  tr: 'tr',
  ru: 'ru',
};

const PROTECTED = [
  ['Forge Home', '\uE000FORGE_HOME\uE001'],
  ['SKIA E.C.H.O.', '\uE000ECHO\uE001'],
  ['Skia-Serve', '\uE000SKIA_SERVE\uE001'],
  ['Skia-Hub', '\uE000SKIA_HUB\uE001'],
  ['SKIA Forge IDE', '\uE000SKIA_FORGE_IDE\uE001'],
  ['SKIA Forge', '\uE000SKIA_FORGE\uE001'],
  ['SKIA FORGE', '\uE000SKIA_FORGE_CAPS\uE001'],
  ['SKIA', '\uE000SKIA\uE001'],
  ['Sovereign Intelligence', '\uE000SOVEREIGN\uE001'],
  ['EPAAS', '\uE000EPAAS\uE001'],
  ['JWT_SECRET', '\uE000JWT_SECRET\uE001'],
  ['SKIA_BACKEND_URL', '\uE000SKIA_BACKEND_URL\uE001'],
  ['forge.skia.ca', '\uE000FORGE_HOST\uE001'],
  ['api.skia.ca', '\uE000API_HOST\uE001'],
];

const ACRONYM_RE =
  /\b(API|HTTP|HTTPS|IDE|URL|JSON|LLM|JWT|CVE|SDLC|TTS|PC|CPU|GPU|UI|UX|SLA|IT|npm|Node\.js|Windows|macOS|Linux|Ubuntu|Fedora|Arch|AppImage|Intel|Markdown|TypeScript|JavaScript|PowerShell|JWT_SECRET)\b/g;

function shield(text) {
  let out = text;
  for (const [term, token] of PROTECTED) {
    out = out.split(term).join(token);
  }
  out = out.replace(ACRONYM_RE, (m) => `\uE002${m}\uE003`);
  return out;
}

function unshield(text) {
  let out = text;
  out = out.replace(/\uE002([^\uE003]+)\uE003/g, '$1');
  for (const [term, token] of PROTECTED) {
    out = out.split(token).join(term);
  }
  return out;
}

function collectStrings(node, out = []) {
  if (typeof node === 'string') {
    out.push(node);
    return out;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectStrings(item, out);
    return out;
  }
  if (node && typeof node === 'object') {
    for (const value of Object.values(node)) collectStrings(value, out);
  }
  return out;
}

function applyStrings(node, strings, index = { i: 0 }) {
  if (typeof node === 'string') {
    const v = strings[index.i++];
    return v;
  }
  if (Array.isArray(node)) {
    return node.map((item) => applyStrings(item, strings, index));
  }
  if (node && typeof node === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(node)) {
      out[key] = applyStrings(value, strings, index);
    }
    return out;
  }
  return node;
}

const cache = new Map();

async function translateText(text, locale) {
  const trimmed = text.trim();
  if (!trimmed) return text;
  if (/^[\d\s←©|.:;,\-–—/\\()[\]{}#+*_=%<>]+$/.test(trimmed)) return text;
  if (/^https?:\/\//.test(trimmed)) return text;
  if (/^[A-Z0-9_]+\.(html|md|json|tsx?|jsx?)$/.test(trimmed)) return text;

  const key = `${locale}\0${text}`;
  if (cache.has(key)) return cache.get(key);

  const leading = text.match(/^\s*/)?.[0] ?? '';
  const trailing = text.match(/\s*$/)?.[0] ?? '';
  const core = text.slice(leading.length, text.length - trailing.length);
  if (!core.trim()) return text;

  const shielded = shield(core);
  const hasHtml = /<[a-z][\s\S]*>/i.test(shielded);

  let translated;
  try {
    const res = await translate(shielded, {
      from: 'en',
      to: TO_LANG[locale] ?? locale,
      forceBatch: false,
      rejectOnPartialFail: false,
    });
    translated = typeof res === 'string' ? res : res.text;
  } catch (err) {
    console.warn(`translate fail (${locale}): ${err.message?.slice(0, 80)} — keeping EN`);
    translated = core;
  }

  const restored = unshield(translated);
  const final = leading + restored + trailing;
  cache.set(key, final);
  await sleep(120);
  return final;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function translateJsonFile(enPath, outPath, locale) {
  const data = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  const strings = collectStrings(data);
  const translated = [];
  let n = 0;
  for (const s of strings) {
    n++;
    if (n % 20 === 0) {
      process.stdout.write(`  ${path.basename(outPath)}: ${n}/${strings.length}\r`);
    }
    translated.push(await translateText(s, locale));
  }
  const out = applyStrings(data, translated);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  console.log(`  wrote ${outPath} (${strings.length} strings)`);
}

async function main() {
  const targets = process.argv.slice(2).length ? process.argv.slice(2) : LOCALE_CODES;
  for (const locale of targets) {
    if (locale === 'en') continue;
    console.log(`\n=== ${locale} ===`);
    for (const file of NAMESPACES) {
      const enPath = path.join(EN_DIR, file);
      const outPath = path.join(ROOT, 'public', 'locales', locale, file);
      await translateJsonFile(enPath, outPath, locale);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
