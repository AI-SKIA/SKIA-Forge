/**
 * SKIA-Forge font size enforcement — Forge Web only (design_bible.md §2.0).
 * 15px floor / 38px ceiling on user-facing copy; Forge IDE (skia-ide/) is exempt.
 *
 * Run: node scripts/normalize-forge-font-sizes.mjs
 * Check: node scripts/normalize-forge-font-sizes.mjs --check
 */
import fs from 'fs';
import path from 'path';

const CHECK = process.argv.includes('--check');
const FLOOR_PX = 15;
const CEILING_PX = 38;

const ROOTS = [
  path.join(process.cwd(), 'public'),
  path.join(process.cwd(), 'src'),
];

const SKIP_DIRS = new Set(['node_modules', 'dist', 'types', 'docs', 'skia-reference']);
const SKIP_FILE_PATTERNS = [/monacoSetup/i, /TerminalPanel/i, /ogImage/i, /\.test\./i, /local-dev/];
/** Canonical design-bible stylesheets — tokens live here; do not auto-normalize. */
const DESIGN_CSS_FILES = new Set([
  'public/forge-premium-ui.css',
  'public/forge-hub-design.css',
  'public/forge-platform-console.css',
  'public/forge-sidebar-locale.css',
  'public/forge-lucide-icons.css',
  'public/forge-crest-bullet.css',
]);
const EXTS = new Set(['.css', '.tsx', '.ts', '.jsx', '.js', '.html', '.json']);
const LOCALE_JSON_RE = /^public\/locales\/[^/]+\/docs\.json$/;

const SIZE_RE = /font-size:\s*(\d+(?:\.\d+)?)px/g;
const ICON_CONTEXT_RE = /globe-svg|skia-crest|item-dot|triage-dot|kc-bullet|check-box|pc-sidebar-tab-icon|skia-li|caret|opacity:\s*0\./i;

function shouldSkipFile(rel) {
  const norm = rel.split(path.sep).join('/');
  if (norm.includes('types/skia-reference')) return true;
  if (norm.includes('skia-ide/')) return true;
  if (DESIGN_CSS_FILES.has(norm)) return true;
  if (norm.endsWith('.json') && !LOCALE_JSON_RE.test(norm)) return true;
  return SKIP_FILE_PATTERNS.some((p) => p.test(norm));
}

function clampSize(px, line) {
  if (ICON_CONTEXT_RE.test(line) && px < FLOOR_PX) return px;
  if (px < FLOOR_PX) return FLOOR_PX;
  if (px > CEILING_PX) return CEILING_PX;
  return px;
}

function normalizeLine(line) {
  if (!SIZE_RE.test(line)) return line;
  SIZE_RE.lastIndex = 0;
  return line.replace(SIZE_RE, (match, num) => {
    const px = parseFloat(num);
    const next = clampSize(px, line);
    return next === px ? match : `font-size: ${next}px`;
  });
}

function normalizeContent(content) {
  return content.split('\n').map(normalizeLine).join('\n');
}

function walk(dir, changed = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    const rel = path.relative(process.cwd(), p);
    if (e.isDirectory()) walk(p, changed);
    else if (EXTS.has(path.extname(e.name)) && !shouldSkipFile(rel)) {
      const before = fs.readFileSync(p, 'utf8');
      const after = normalizeContent(before);
      if (after !== before) {
        if (!CHECK) fs.writeFileSync(p, after, 'utf8');
        changed.push(rel.split(path.sep).join('/'));
      }
    }
  }
  return changed;
}

const changed = [];
for (const root of ROOTS) {
  if (fs.existsSync(root)) walk(root, changed);
}

if (CHECK) {
  if (changed.length > 0) {
    console.error(`SKIA Forge font size check: ${changed.length} file(s) below ${FLOOR_PX}px floor or above ${CEILING_PX}px ceiling:`);
    changed.forEach((f) => console.error(`  - ${f}`));
    console.error('');
    console.error(`Fix locally: node scripts/normalize-forge-font-sizes.mjs`);
    console.error(`Locale JSON HTML: node scripts/fix-forge-locale-font-sizes.mjs`);
    process.exit(1);
  }
  process.exit(0);
}

console.log(`Updated ${changed.length} files:`);
changed.forEach((f) => console.log(' ', f));
