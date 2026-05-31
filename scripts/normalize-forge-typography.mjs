/**
 * SKIA-Forge typography audit: single text color (#d4af37), Agency FB + Centaur only, no bold.
 * Run: node scripts/normalize-forge-typography.mjs
 */
import fs from 'fs';
import path from 'path';

const FONT_BODY = '"Centaur", "Centaur MT", serif';
const FONT_HEADING = '"Agency FB", "AgencyFB", sans-serif';
const TEXT_COLOR = '#d4af37';

const ROOTS = [
  path.join(process.cwd(), 'skia-ide', 'src', 'renderer'),
  path.join(process.cwd(), 'public'),
  path.join(process.cwd(), 'src'),
];

const SKIP_DIRS = new Set(['node_modules', 'dist', 'types', 'skia-reference']);
const SKIP_FILE_PATTERNS = [/\.test\./i, /monacoSetup/i];
const EXTS = new Set(['.css', '.tsx', '.ts', '.jsx', '.js', '.html']);

const FONT_STACK_RE =
  /(?:system-ui|Segoe UI|Roboto|Helvetica|Inter|SF Pro|Space Grotesk|Sora|Orbitron|BlinkMacSystemFont|Arial|sans-serif|monospace|Cascadia|Fira Code|Consolas|JetBrains|Helvetica Neue)[^;}\n]*/gi;

const FORGE_FONT_SANS_RE =
  /--forge-font-sans:\s*[^;]+;/g;
const FORGE_FONT_HEADING_RE =
  /--forge-font-heading:\s*[^;]+;/g;

const TEXT_COLOR_VARS = [
  ['--text:', `${TEXT_COLOR}`],
  ['--muted:', `${TEXT_COLOR}`],
  ['--text-soft:', `${TEXT_COLOR}`],
  ['--text-dim:', `${TEXT_COLOR}`],
  ['--gold-muted:', `${TEXT_COLOR}`],
  ['--skia-text:', `${TEXT_COLOR}`],
  ['--skia-text-secondary:', `${TEXT_COLOR}`],
  ['--skia-text-muted:', `${TEXT_COLOR}`],
  ['--skia-muted-gold:', `${TEXT_COLOR}`],
];

function shouldSkipFile(rel) {
  const norm = rel.split(path.sep).join('/');
  if (norm.includes('types/skia-reference')) return true;
  return SKIP_FILE_PATTERNS.some((p) => p.test(norm));
}

function normalizeFontFamilies(content) {
  let out = content;
  out = out.replace(FORGE_FONT_SANS_RE, `--forge-font-sans: ${FONT_BODY};`);
  out = out.replace(FORGE_FONT_HEADING_RE, `--forge-font-heading: ${FONT_HEADING};`);
  out = out.replace(
    /--font-body:\s*[^;]+;/g,
    `--font-body: ${FONT_BODY};`,
  );
  out = out.replace(
    /--font-heading:\s*[^;]+;/g,
    `--font-heading: ${FONT_HEADING};`,
  );
  out = out.replace(/font-family:\s*var\(--forge-font-sans\)/g, `font-family: ${FONT_BODY}`);
  out = out.replace(/font-family:\s*var\(--forge-font-heading\)/g, `font-family: ${FONT_HEADING}`);
  out = out.replace(/font-family:\s*var\(--font-body\)/g, `font-family: ${FONT_BODY}`);
  out = out.replace(/font-family:\s*var\(--font-heading\)/g, `font-family: ${FONT_HEADING}`);
  out = out.replace(
    /font-family:\s*['"]?Orbitron['"]?[^;]*/gi,
    `font-family: ${FONT_HEADING}`,
  );
  out = out.replace(
    /font-family:\s*Inter[^;]*/gi,
    `font-family: ${FONT_BODY}`,
  );
  out = out.replace(
    /font-family:\s*["']?Space Grotesk["']?[^;]*/gi,
    `font-family: ${FONT_HEADING}`,
  );
  out = out.replace(
    /font-family:\s*["']?Segoe UI["']?[^;]*/gi,
    `font-family: ${FONT_BODY}`,
  );
  out = out.replace(
    /font-family:\s*system-ui[^;]*/gi,
    `font-family: ${FONT_BODY}`,
  );
  out = out.replace(
    /font-family:\s*['"]?Cascadia[^;]*/gi,
    `font-family: ${FONT_BODY}`,
  );
  out = out.replace(/font-family:\s*monospace[^;]*/gi, `font-family: ${FONT_BODY}`);
  out = out.replace(/fontFamily:\s*["'][^"']+["']/g, (m) => {
    if (/Cascadia|Consolas|JetBrains|monospace/i.test(m)) {
      return `fontFamily: ${FONT_BODY}`;
    }
    return m;
  });
  out = out.replace(/font-family:\s*inherit/g, 'font-family: inherit');
  return out;
}

function normalizeTextColorVars(content) {
  let out = content;
  for (const [key, val] of TEXT_COLOR_VARS) {
    const re = new RegExp(`(${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\s*[^;\\n]+`, 'g');
    out = out.replace(re, `$1 ${val}`);
  }
  return out;
}

/** Normalize color: / fill: used for text (not border/background/outline). */
function normalizeTextColors(content) {
  const lines = content.split('\n');
  return lines
    .map((line) => {
      let l = line;
      if (!/\b(color|fill)\s*:/.test(l) && !/color\s*=/.test(l)) return l;
      if (/\b(background|border|outline|box-shadow|scrollbar-color)\b/.test(l) && !/\bcolor\s*:/.test(l)) {
        return l;
      }

      l = l.replace(/color:\s*var\(--text\)/g, `color: ${TEXT_COLOR}`);
      l = l.replace(/color:\s*var\(--muted\)/g, `color: ${TEXT_COLOR}`);
      l = l.replace(/color:\s*var\(--text-soft\)/g, `color: ${TEXT_COLOR}`);
      l = l.replace(/color:\s*var\(--text-dim\)/g, `color: ${TEXT_COLOR}`);
      l = l.replace(/color:\s*var\(--gold-muted\)/g, `color: ${TEXT_COLOR}`);
      l = l.replace(/color:\s*var\(--skia-text\)/g, `color: ${TEXT_COLOR}`);
      l = l.replace(/color:\s*var\(--skia-text-secondary\)/g, `color: ${TEXT_COLOR}`);
      l = l.replace(/color:\s*var\(--skia-text-muted\)/g, `color: ${TEXT_COLOR}`);
      l = l.replace(/color:\s*var\(--skia-muted-gold\)/g, `color: ${TEXT_COLOR}`);
      l = l.replace(/color:\s*#ffffff\b/gi, `color: ${TEXT_COLOR}`);
      l = l.replace(/color:\s*#fff\b/gi, `color: ${TEXT_COLOR}`);
      l = l.replace(/color:\s*white\b/gi, `color: ${TEXT_COLOR}`);
      l = l.replace(/color:\s*#999999\b/gi, `color: ${TEXT_COLOR}`);
      l = l.replace(/color:\s*#999\b/gi, `color: ${TEXT_COLOR}`);
      l = l.replace(/color:\s*rgba\(255,\s*255,\s*255[^)]+\)/gi, `color: ${TEXT_COLOR}`);
      l = l.replace(/color:\s*rgba\(212,\s*175,\s*55,\s*0\.[0-9]+\)/gi, `color: ${TEXT_COLOR}`);
      l = l.replace(/color:\s*#f87171\b/gi, `color: ${TEXT_COLOR}`);
      l = l.replace(/color:\s*#fbbf24\b/gi, `color: ${TEXT_COLOR}`);
      l = l.replace(/color:\s*#4ade80\b/gi, `color: ${TEXT_COLOR}`);
      l = l.replace(/color:\s*#ff5c5c\b/gi, `color: ${TEXT_COLOR}`);
      l = l.replace(/color:\s*#f2c94c\b/gi, `color: ${TEXT_COLOR}`);
      l = l.replace(/color:\s*#f7e0a1\b/gi, `color: ${TEXT_COLOR}`);
      l = l.replace(/color:\s*#f1d27a\b/gi, `color: ${TEXT_COLOR}`);
      l = l.replace(/color:\s*#c8aa5a\b/gi, `color: ${TEXT_COLOR}`);
      l = l.replace(/fill:\s*#f7e0a1\b/gi, `fill: ${TEXT_COLOR}`);
      l = l.replace(/fill:\s*#f1d27a\b/gi, `fill: ${TEXT_COLOR}`);
      l = l.replace(/fill:\s*#c8aa5a\b/gi, `fill: ${TEXT_COLOR}`);

      l = l.replace(/color:\s*var\(--danger\)/g, `color: ${TEXT_COLOR}`);
      l = l.replace(/color:\s*var\(--text-soft\)/g, `color: ${TEXT_COLOR}`);
      l = l.replace(/color:\s*var\(--text-dim\)/g, `color: ${TEXT_COLOR}`);
      l = l.replace(/color:\s*var\(--gold-muted\)/g, `color: ${TEXT_COLOR}`);

      l = l.replace(/color:\s*#000000?\b/gi, `color: ${TEXT_COLOR}`);
      l = l.replace(/color:\s*#000\b/gi, `color: ${TEXT_COLOR}`);

      l = l.replace(/color:\s*"#ffffff"/gi, `color: "${TEXT_COLOR}"`);
      l = l.replace(/color:\s*"rgba\(255,\s*255,\s*255[^"]+\)"/gi, `color: "${TEXT_COLOR}"`);

      return l;
    })
    .join('\n');
}

function normalizeFontWeight(content) {
  let out = content;
  out = out.replace(/font-weight:\s*bold\b/gi, 'font-weight: 400');
  out = out.replace(/font-weight:\s*(500|600|700|800|900)\b/g, 'font-weight: 400');
  out = out.replace(/fontWeight:\s*["']?bold["']?/gi, 'fontWeight: 400');
  out = out.replace(/fontWeight:\s*(500|600|700|800|900)\b/g, 'fontWeight: 400');
  out = out.replace(/font-weight:\s*600\s*!important/g, 'font-weight: 400 !important');
  out = out.replace(/font-weight:\s*700\s*!important/g, 'font-weight: 400 !important');
  out = out.replace(/font-weight:\s*800\s*!important/g, 'font-weight: 400 !important');
  out = out.replace(/font-weight="\s*(500|600|700|800|900)\s*"/g, 'font-weight="400"');
  return out;
}

function normalizeSvgText(content) {
  let out = content;
  out = out.replace(/fill="(?!url)[^"]+"/g, `fill="${TEXT_COLOR}"`);
  out = out.replace(
    /font-family="[^"]+"/g,
    'font-family="Agency FB, AgencyFB, sans-serif"',
  );
  return out;
}

function stripOrbitronFontLinks(content) {
  return content.replace(
    /<link[^>]*fonts\.googleapis\.com[^>]*Orbitron[^>]*>\s*/gi,
    '',
  );
}

function ensureNoBoldGlobal(content, isCssOrHtml) {
  if (!isCssOrHtml) return content;
  const rule = '\nstrong, b { font-weight: 400; }\n';
  if (content.includes('strong, b { font-weight: 400')) return content;
  if (content.includes('<style>')) {
    return content.replace('<style>', `<style>${rule}`);
  }
  if (content.includes(':root {')) {
    return content.replace(':root {', `:root {${rule}`);
  }
  return content;
}

function processFile(content, ext) {
  let out = content;
  out = stripOrbitronFontLinks(out);
  out = normalizeFontFamilies(out);
  out = normalizeTextColorVars(out);
  out = normalizeTextColors(out);
  out = normalizeFontWeight(out);
  if (ext === '.ts' && out.includes('<svg')) {
    out = normalizeSvgText(out);
  }
  if (ext === '.html' || ext === '.css') {
    out = ensureNoBoldGlobal(out, true);
  }
  return out;
}

function walk(dir, changed = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    const rel = path.relative(process.cwd(), p);
    if (e.isDirectory()) walk(p, changed);
    else if (EXTS.has(path.extname(e.name)) && !shouldSkipFile(rel)) {
      const ext = path.extname(e.name);
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

console.log(`Typography normalization: updated ${changed.length} file(s)`);
changed.forEach((f) => console.log(' ', f));
