/**
 * Enforce self-hosted brand font names only — "Agency FB" and "Centaur".
 * No OS/browser fallback stacks (Centaur MT, serif, sans-serif, Google Fonts, etc.).
 *
 * Run: node scripts/normalize-forge-font-families.mjs
 * Check: node scripts/normalize-forge-font-families.mjs --check
 */
import fs from 'fs';
import path from 'path';

const CHECK = process.argv.includes('--check');

/** Forge Web + server only — Forge IDE (skia-ide/) is exempt per design_bible.md §7. */
const ROOTS = [
  path.join(process.cwd(), 'public'),
  path.join(process.cwd(), 'src'),
];

const SKIP_DIRS = new Set(['node_modules', 'dist', 'types', 'skia-reference', 'vs']);
const SKIP_FILE_PATTERNS = [/monacoSetup/i, /TerminalPanel/i, /ogImage/i, /\.test\./i, /local-dev/];
const EXTS = new Set(['.css', '.tsx', '.ts', '.jsx', '.js', '.html']);

const REPLACEMENTS = [
  [/font-family:\s*"Centaur",\s*"Centaur MT",\s*serif/g, 'font-family: "Centaur"'],
  [/font-family:\s*'Centaur',\s*'Centaur MT',\s*serif/g, "font-family: 'Centaur'"],
  [/font-family:\s*"Agency FB",\s*"AgencyFB",\s*sans-serif/g, 'font-family: "Agency FB"'],
  [/font-family:\s*'Agency FB',\s*'AgencyFB',\s*sans-serif/g, "font-family: 'Agency FB'"],
  [/--forge-font-sans:\s*"Centaur",\s*"Centaur MT",\s*serif/g, '--forge-font-sans: "Centaur"'],
  [/--forge-font-heading:\s*"Agency FB",\s*"AgencyFB",\s*sans-serif/g, '--forge-font-heading: "Agency FB"'],
  [/--font-body:\s*"Centaur",\s*"Centaur MT",\s*serif/g, '--font-body: "Centaur"'],
  [/--font-heading:\s*"Agency FB",\s*"AgencyFB",\s*sans-serif/g, '--font-heading: "Agency FB"'],
];

const FORBIDDEN = [
  /fonts\.googleapis\.com/i,
  /fonts\.gstatic\.com/i,
  /font-family:[^;]*\bCentaur MT\b/i,
  /font-family:[^;]*\bAgencyFB\b/i,
  /font-family:[^;]*\b(?:Arial|Times New Roman|system-ui|Inter)\b/i,
  /font-family:[^;]*,\s*serif\b/i,
  /font-family:[^;]*,\s*sans-serif\b/i,
];

/** Monaco + terminal monospace stacks are allowed */
function isMonospaceException(line) {
  return /Consolas|JetBrains Mono|Cascadia|monospace|xterm|\.agent-log-body|#terminal-panel|terminal-xterm|monaco/i.test(line);
}

function shouldSkipFile(rel) {
  const norm = rel.split(path.sep).join('/');
  if (norm.includes('types/skia-reference')) return true;
  if (norm.includes('local-dev/')) return true;
  return SKIP_FILE_PATTERNS.some((p) => p.test(norm));
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (EXTS.has(path.extname(ent.name))) files.push(p);
  }
  return files;
}

function normalizeContent(text) {
  let out = text;
  for (const [re, rep] of REPLACEMENTS) {
    out = out.replace(re, rep);
  }
  // Remove Google Fonts preconnect/link lines
  out = out.replace(/^\s*<link rel="preconnect" href="https:\/\/fonts\.(?:googleapis|gstatic)\.com"[^>]*>\s*\n/gm, '');
  return out;
}

function findViolations(text, rel) {
  const hits = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/font-family|fonts\.google|Centaur MT|AgencyFB|,\s*serif|,\s*sans-serif/i.test(line)) continue;
    if (isMonospaceException(line)) continue;
    if (FORBIDDEN.some((re) => re.test(line))) {
      hits.push({ rel, line: i + 1, text: line.trim() });
    }
  }
  return hits;
}

let changedFiles = 0;
const violations = [];

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const rel = path.relative(process.cwd(), file);
    if (shouldSkipFile(rel)) continue;
    const before = fs.readFileSync(file, 'utf8');
    const after = normalizeContent(before);
    violations.push(...findViolations(after, rel));
    if (after !== before) {
      if (!CHECK) fs.writeFileSync(file, after);
      changedFiles++;
      console.log(`${CHECK ? 'would fix' : 'fixed'}: ${rel}`);
    }
  }
}

if (violations.length) {
  console.error('\nFont family violations (forbidden fallback / external fonts):');
  for (const v of violations) {
    console.error(`  ${v.rel}:${v.line}  ${v.text}`);
  }
  process.exit(1);
}

console.log(CHECK ? `OK — ${changedFiles} file(s) would change` : `Done — ${changedFiles} file(s) updated`);
