/**
 * SKIA-Forge typography audit (gold-only color fix):
 * - Headings font: Agency FB
 * - Body font: Centaur
 * - No bold anywhere (font-weight > 400 forced to 400; strong/b forced to 400)
 * - Gold/yellow font colors only -> #d4af37
 *
 * Gold rule is applied only to text color declarations (`color:` / JS `color:` / svg `fill=` for gold-ish tones),
 * not to background/border/outline.
 */
import fs from 'fs';
import path from 'path';

const FONT_BODY = '"Centaur", "Centaur MT", serif';
const FONT_HEADING = '"Agency FB", "AgencyFB", sans-serif';
const GOLD = '#d4af37';

const ROOTS = [
  path.join(process.cwd(), 'skia-ide', 'src', 'renderer'),
  path.join(process.cwd(), 'skia-ide', 'src', 'main'),
  path.join(process.cwd(), 'public'),
  path.join(process.cwd(), 'src'),
];

const SKIP_DIRS = new Set(['node_modules', 'dist', 'types', 'skia-reference']);
const SKIP_FILE_PATTERNS = [/\.test\./i];
const EXTS = new Set(['.css', '.tsx', '.ts', '.jsx', '.js', '.html']);

const FORGE_FONT_SANS_RE = /--forge-font-sans:\s*[^;]+;/g;
const FORGE_FONT_HEADING_RE = /--forge-font-heading:\s*[^;]+;/g;

const GOLDISH_TEXT_HEX = new Set([
  '#c9b37a',
  '#f7e0a1',
  '#f1d27a',
  '#c8aa5a',
  '#fbbf24',
  '#f2c94c',
]);

function shouldSkipFile(rel) {
  const norm = rel.split(path.sep).join('/');
  if (norm.includes('types/skia-reference')) return true;
  return SKIP_FILE_PATTERNS.some((p) => p.test(norm));
}

function normalizeFontFamilies(content) {
  let out = content;

  // Variable-based shells (Forge marketing pages)
  out = out.replace(FORGE_FONT_SANS_RE, `--forge-font-sans: ${FONT_BODY};`);
  out = out.replace(FORGE_FONT_HEADING_RE, `--forge-font-heading: ${FONT_HEADING};`);

  // Variable-based shells (IDE/TS string styles)
  out = out.replace(/--font-body:\s*[^;]+;/g, `--font-body: ${FONT_BODY};`);
  out = out.replace(/--font-heading:\s*[^;]+;/g, `--font-heading: ${FONT_HEADING};`);

  // var() usage
  out = out.replace(/font-family:\s*var\(--forge-font-sans\)/g, `font-family: ${FONT_BODY}`);
  out = out.replace(/font-family:\s*var\(--forge-font-heading\)/g, `font-family: ${FONT_HEADING}`);
  out = out.replace(/font-family:\s*var\(--font-body\)/g, `font-family: ${FONT_BODY}`);
  out = out.replace(/font-family:\s*var\(--font-heading\)/g, `font-family: ${FONT_HEADING}`);

  // CSS explicit font-family
  out = out.replace(/font-family:\s*['"]?Orbitron['"]?[^;]*/gi, `font-family: ${FONT_HEADING}`);
  out = out.replace(/font-family:\s*['"]?(Space Grotesk|Sora)['"]?[^;]*/gi, `font-family: ${FONT_HEADING}`);
  out = out.replace(/font-family:\s*Inter[^;]*/gi, `font-family: ${FONT_BODY}`);
  out = out.replace(/font-family:\s*['"]?Segoe UI['"]?[^;]*/gi, `font-family: ${FONT_BODY}`);
  out = out.replace(/font-family:\s*Arial[^;]*/gi, `font-family: ${FONT_BODY}`);
  out = out.replace(/font-family:\s*system-ui[^;]*/gi, `font-family: ${FONT_BODY}`);
  out = out.replace(/font-family:\s*['"]?Cascadia[^;]*/gi, `font-family: ${FONT_BODY}`);
  out = out.replace(/font-family:\s*monospace[^;]*/gi, `font-family: ${FONT_BODY}`);

  // JS/TS style objects: fontFamily: "..."
  out = out.replace(/fontFamily:\s*["'][^"']+["']/g, (m) => {
    if (/Orbitron|Space Grotesk|Sora/i.test(m)) return `fontFamily: ${FONT_HEADING}`;
    return `fontFamily: ${FONT_BODY}`;
  });

  // SVG attribute strings in TS template strings
  out = out.replace(/font-family="[^"]+"/g, (m) => {
    if (/Orbitron|Space Grotesk|Sora/i.test(m)) return `font-family="${FONT_HEADING}"`;
    if (/Inter|Segoe UI|system-ui|Arial/i.test(m)) return `font-family="${FONT_BODY}"`;
    // Default to heading for unknown svg fonts.
    return `font-family="${FONT_HEADING}"`;
  });

  out = out.replace(/font-family:\s*inherit/g, 'font-family: inherit');

  return out;
}

function normalizeFontWeight(content) {
  let out = content;

  // CSS and HTML attributes
  out = out.replace(/font-weight:\s*bold\b/gi, 'font-weight: 400');
  out = out.replace(/font-weight:\s*(500|600|700|800|900)\b/g, 'font-weight: 400');

  // JS style objects
  out = out.replace(/fontWeight:\s*["']?bold["']?/gi, 'fontWeight: 400');
  out = out.replace(/fontWeight:\s*(500|600|700|800|900)\b/g, 'fontWeight: 400');

  // !important variants
  out = out.replace(/font-weight:\s*600\s*!important/g, 'font-weight: 400 !important');
  out = out.replace(/font-weight:\s*700\s*!important/g, 'font-weight: 400 !important');
  out = out.replace(/font-weight:\s*800\s*!important/g, 'font-weight: 400 !important');

  // Non-boolean quoted font-weight variants (rare)
  out = out.replace(/font-weight="\s*(500|600|700|800|900)\s*"/g, 'font-weight="400"');

  return out;
}

function ensureNoBoldGlobal(content, ext) {
  if (!(ext === '.html' || ext === '.css')) return content;
  if (content.includes('strong, b { font-weight: 400; }')) return content;

  const rule = 'strong, b { font-weight: 400; }';
  if (content.includes('<style>')) return content.replace('<style>', `<style>${rule}\n`);
  if (content.includes(':root {')) return content.replace(':root {', `:root {${rule}\n`);
  return `${rule}\n${content}`;
}

function normalizeGoldTextColors(content) {
  let out = content;

  // `color: var(--gold*)` / `color: var(--skia-gold*)`
  out = out.replace(/color:\s*var\(--(gold|skia-gold)[^)]+\)/gi, `color: ${GOLD}`);

  // Skia warning variable (yellow)
  out = out.replace(/color:\s*var\(--skia-warning\)/gi, `color: ${GOLD}`);

  // Direct gold-ish hex colors
  for (const hex of GOLDISH_TEXT_HEX) {
    const re = new RegExp(`color:\\s*${hex.replace('#', '\\#')}\\b`, 'gi');
    out = out.replace(re, `color: ${GOLD}`);
  }

  // Gold-ish rgba(212,175,55,...) for text
  out = out.replace(
    /color:\s*rgba\(\s*212\s*,\s*175\s*,\s*55\s*,\s*(0?\.[0-9]+|1(\.0+)?)\s*\)/gi,
    `color: ${GOLD}`,
  );

  // JS style objects: color: "#c9b37a"
  out = out.replace(/color\s*:\s*["'](#c9b37a|#f7e0a1|#f1d27a|#c8aa5a|#fbbf24|#f2c94c)["']/gi, `color: "${GOLD}"`);

  // SVG text fill: only swap known gold-ish fills
  for (const hex of GOLDISH_TEXT_HEX) {
    const escaped = hex.replace('#', '\\#');
    out = out.replace(new RegExp(`fill="(${escaped})"`, 'gi'), `fill="${GOLD}"`);
  }

  return out;
}

function processFile(content, ext) {
  let out = content;
  out = out.replace(/<link[^>]*fonts\.googleapis\.com[^>]*Orbitron[^>]*>\s*/gi, '');
  out = normalizeFontFamilies(out);
  out = normalizeGoldTextColors(out);
  out = normalizeFontWeight(out);
  out = ensureNoBoldGlobal(out, ext);
  return out;
}

function walk(dir, changed = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    const rel = path.relative(process.cwd(), p);
    if (e.isDirectory()) walk(p, changed);
    else {
      const ext = path.extname(e.name);
      if (!EXTS.has(ext)) continue;
      if (shouldSkipFile(rel)) continue;
      const before = fs.readFileSync(p, 'utf8');
      const after = processFile(before, ext);
      if (after !== before) {
        fs.writeFileSync(p, after, 'utf8');
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

console.log(`Gold-only typography normalization: updated ${changed.length} file(s)`);
changed.forEach((f) => console.log(' ', f));

