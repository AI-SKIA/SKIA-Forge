#!/usr/bin/env node
/**
 * Sync updated English locale JSON to all 11 other locales with Anthropic translations.
 *
 * Usage:
 *   node scripts/sync-translations.mjs common
 *   node scripts/sync-translations.mjs forge-platform
 *   node scripts/sync-translations.mjs --all
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');
const LOCALES_ROOT = path.join(REPO_ROOT, 'public', 'locales');
const EN_DIR = path.join(LOCALES_ROOT, 'en');

/** Load ANTHROPIC_API_KEY (and other vars) from repo .env files if not already set. */
function loadDotEnv() {
  for (const rel of ['.env', '.env.local']) {
    const filePath = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(filePath)) continue;
    for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (process.env[key] !== undefined) continue;
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

loadDotEnv();

const LOCALES = ['fr', 'ar', 'zh', 'es', 'pt', 'de', 'ja', 'ko', 'hi', 'tr', 'ru'];

const LOCALE_NAMES = {
  fr: 'French',
  ar: 'Arabic',
  zh: 'Chinese (Simplified)',
  es: 'Spanish',
  pt: 'Portuguese',
  de: 'German',
  ja: 'Japanese',
  ko: 'Korean',
  hi: 'Hindi',
  tr: 'Turkish',
  ru: 'Russian',
};

const PROTECTED_TERMS = [
  'SKIA Forge IDE',
  'SKIA FORGE',
  'SKIA E.C.H.O.',
  'SKIA Forge',
  'Skia-Serve',
  'Skia-Hub',
  'Forge Home',
  'forge.skia.ca',
  'api.skia.ca',
  'SKIA',
  'EPAAS',
  'API',
  'LLM',
  'SSO',
  'RAG',
];

const PLACEHOLDER_RE = /\{(\w+)\}/g;
const BATCH_SIZE = 20;
const MODEL = 'claude-sonnet-4-20250514';

/** Paths where English branding is intentionally identical across locales. */
const IDENTICAL_OK_PATHS = new Set(['meta.documentTitle', 'hero.title']);

const PH_TOKEN = (i) => `⟦PH${i}⟧`;
const GLOSS_TOKEN = (i) => `⟦GL${i}⟧`;

function protectPlaceholders(text) {
  const names = [];
  const masked = text.replace(PLACEHOLDER_RE, (_, name) => {
    names.push(name);
    return PH_TOKEN(names.length - 1);
  });
  return { masked, names };
}

function restorePlaceholders(text, names) {
  let out = text;
  names.forEach((name, i) => {
    out = out.split(PH_TOKEN(i)).join(`{${name}}`);
  });
  return out;
}

function protectTerms(text) {
  const found = [];
  let out = text;
  const sorted = [...PROTECTED_TERMS].sort((a, b) => b.length - a.length);
  for (const term of sorted) {
    if (out.includes(term)) {
      const idx = found.length;
      found.push(term);
      out = out.split(term).join(GLOSS_TOKEN(idx));
    }
  }
  return { masked: out, terms: found };
}

function restoreTerms(text, terms) {
  let out = text;
  terms.forEach((term, i) => {
    out = out.split(GLOSS_TOKEN(i)).join(term);
  });
  return out;
}

function maskForApi(text) {
  const { masked: afterPh, names } = protectPlaceholders(text);
  const { masked, terms } = protectTerms(afterPh);
  return { masked, names, terms };
}

function unmaskFromApi(text, meta) {
  return restoreTerms(restorePlaceholders(text, meta.names), meta.terms);
}

/** Skip API when the English leaf is only protected product terms (e.g. "SKIA Forge"). */
function isBrandOnlyString(text) {
  let work = text;
  const sorted = [...PROTECTED_TERMS].sort((a, b) => b.length - a.length);
  for (const term of sorted) {
    work = work.split(term).join('');
  }
  work = work.replace(PLACEHOLDER_RE, '').replace(/[\s·|—–\-.,:;!?'"()←→]/g, '');
  return work.length === 0;
}

/** Collect leaf paths that need translation (missing or still English). */
function collectNeedsTranslation(enNode, locNode, pathPrefix, out) {
  if (typeof enNode === 'string') {
    const locStr = typeof locNode === 'string' ? locNode : undefined;
    if (locStr !== undefined && locStr !== enNode) return;
    if (IDENTICAL_OK_PATHS.has(pathPrefix) && locStr === enNode) return;
    if (isBrandOnlyString(enNode)) return;
    out.push({ path: pathPrefix, value: enNode });
    return;
  }

  if (Array.isArray(enNode)) {
    const locArr = Array.isArray(locNode) ? locNode : [];
    enNode.forEach((item, i) => {
      collectNeedsTranslation(item, locArr[i], `${pathPrefix}.${i}`, out);
    });
    return;
  }

  if (enNode && typeof enNode === 'object') {
    const locObj =
      locNode && typeof locNode === 'object' && !Array.isArray(locNode) ? locNode : {};
    for (const [key, val] of Object.entries(enNode)) {
      const nextPath = pathPrefix ? `${pathPrefix}.${key}` : key;
      collectNeedsTranslation(val, locObj[key], nextPath, out);
    }
  }
}

/** Rebuild locale tree from English structure, keeping good translations. */
function buildMergedTree(enNode, locNode, translatedByPath, pathPrefix) {
  if (typeof enNode === 'string') {
    const locStr = typeof locNode === 'string' ? locNode : undefined;
    if (locStr !== undefined && locStr !== enNode) return locStr;
    if (translatedByPath.has(pathPrefix)) return translatedByPath.get(pathPrefix);
    return enNode;
  }

  if (Array.isArray(enNode)) {
    const locArr = Array.isArray(locNode) ? locNode : [];
    return enNode.map((item, i) =>
      buildMergedTree(item, locArr[i], translatedByPath, `${pathPrefix}.${i}`),
    );
  }

  if (enNode && typeof enNode === 'object') {
    const locObj =
      locNode && typeof locNode === 'object' && !Array.isArray(locNode) ? locNode : {};
    const result = {};
    for (const [key, val] of Object.entries(enNode)) {
      const nextPath = pathPrefix ? `${pathPrefix}.${key}` : key;
      result[key] = buildMergedTree(val, locObj[key], translatedByPath, nextPath);
    }
    return result;
  }

  return enNode;
}

function extractJsonObject(text) {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`No JSON object in model response: ${text.slice(0, 200)}`);
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

async function callAnthropic(systemPrompt, userPrompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set in the environment');
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${errBody.slice(0, 500)}`);
  }

  const data = await res.json();
  const block = data.content?.find((b) => b.type === 'text');
  if (!block?.text) {
    throw new Error('Anthropic API returned no text content');
  }
  return block.text;
}

async function translateBatch(batch, locale, languageName) {
  const payload = {};
  const metaByPath = {};

  for (const { path: keyPath, value } of batch) {
    const meta = maskForApi(value);
    metaByPath[keyPath] = meta;
    payload[keyPath] = meta.masked;
  }

  const systemPrompt = `You are a professional UI translator for the SKIA Forge product website (forge.skia.ca).
Translate ONLY the string values from English into ${languageName} (locale code: ${locale}).
Return valid JSON only — a single object mapping each input key to its translated string.
Rules:
- Translate natural language; preserve tone suitable for a professional AI developer platform.
- Do NOT translate these product/technical terms (keep exactly as in the source tokens): SKIA, SKIA E.C.H.O., SKIA Forge, SKIA FORGE, Skia-Serve, Skia-Hub, Forge Home, EPAAS, API, LLM, SSO, RAG, forge.skia.ca, api.skia.ca.
- Tokens like ⟦PH0⟧, ⟦GL0⟧ are protected placeholders/terms — keep them exactly unchanged in the output.
- After translation, the ⟦PH*⟧ tokens will be restored to {curly-brace} placeholders — do not add or remove them.
- Preserve HTML tags and attributes if present in a value — translate only human-readable text inside tags.
- For Arabic: translate text only (RTL layout is handled separately).
- Do not add keys. Do not omit keys. Return exactly the same keys as provided.`;

  const userPrompt = `Translate these JSON string values to ${languageName}:\n${JSON.stringify(payload, null, 2)}`;

  const raw = await callAnthropic(systemPrompt, userPrompt);
  const parsed = extractJsonObject(raw);

  const translatedByPath = new Map();
  for (const { path: keyPath } of batch) {
    const rawValue = parsed[keyPath];
    if (typeof rawValue !== 'string') {
      throw new Error(`Missing or invalid translation for key "${keyPath}" in batch response`);
    }
    translatedByPath.set(keyPath, unmaskFromApi(rawValue, metaByPath[keyPath]));
  }
  return translatedByPath;
}

async function syncNamespace(namespace, locale) {
  const enPath = path.join(EN_DIR, `${namespace}.json`);
  const locPath = path.join(LOCALES_ROOT, locale, `${namespace}.json`);

  if (!fs.existsSync(enPath)) {
    throw new Error(`Missing English source: ${enPath}`);
  }

  const enTree = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  let locTree = {};
  if (fs.existsSync(locPath)) {
    locTree = JSON.parse(fs.readFileSync(locPath, 'utf8'));
  }

  const needed = [];
  collectNeedsTranslation(enTree, locTree, '', needed);

  if (needed.length === 0) {
    console.log(`  [${locale}] ${namespace}: up to date (${Object.keys(enTree).length} top-level keys)`);
    return { translated: 0, kept: countLeaves(enTree) };
  }

  console.log(`  [${locale}] ${namespace}: translating ${needed.length} key(s)...`);

  const translatedByPath = new Map();
  for (let i = 0; i < needed.length; i += BATCH_SIZE) {
    const batch = needed.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = writeBatchCount(needed.length);
    console.log(`    batch ${batchNum}/${totalBatches} (${batch.length} strings)`);
    const batchResult = await translateBatch(batch, locale, LOCALE_NAMES[locale]);
    for (const [k, v] of batchResult) translatedByPath.set(k, v);
  }

  const merged = buildMergedTree(enTree, locTree, translatedByPath, '');
  fs.mkdirSync(path.dirname(locPath), { recursive: true });
  fs.writeFileSync(locPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');

  return { translated: needed.length, kept: countLeaves(enTree) - needed.length };
}

function writeBatchCount(total) {
  return Math.ceil(total / BATCH_SIZE) || 1;
}

function countLeaves(node) {
  if (typeof node === 'string') return 1;
  if (Array.isArray(node)) return node.reduce((n, item) => n + countLeaves(item), 0);
  if (node && typeof node === 'object') {
    return Object.values(node).reduce((n, val) => n + countLeaves(val), 0);
  }
  return 0;
}

function listNamespaces() {
  return fs
    .readdirSync(EN_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort();
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node scripts/sync-translations.mjs <namespace|--all>');
    console.error('Namespaces:', listNamespaces().join(', '));
    process.exit(1);
  }

  const namespaces = arg === '--all' ? listNamespaces() : [arg.replace(/\.json$/, '')];

  for (const ns of namespaces) {
    const enFile = path.join(EN_DIR, `${ns}.json`);
    if (!fs.existsSync(enFile)) {
      console.error(`Namespace not found: ${ns} (expected ${enFile})`);
      process.exit(1);
    }
  }

  console.log(`Syncing ${namespaces.length} namespace(s): ${namespaces.join(', ')}`);

  let totalTranslated = 0;
  for (const ns of namespaces) {
    console.log(`\n=== ${ns} ===`);
    for (const locale of LOCALES) {
      const { translated } = await syncNamespace(ns, locale);
      totalTranslated += translated;
    }
  }

  console.log(`\nDone. Translated ${totalTranslated} string(s) across ${LOCALES.length} locales.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
