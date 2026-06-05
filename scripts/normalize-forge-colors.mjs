/**
 * SKIA-Forge color normalization (no page/body/shell backgrounds).
 * Run: node scripts/normalize-forge-colors.mjs
 * Check: node scripts/normalize-forge-colors.mjs --check
 */
import fs from 'fs';
import path from 'path';

const CHECK = process.argv.includes('--check');

/** Forge Web + server only — Forge IDE (skia-ide/) is exempt per design_bible.md §7. */
const ROOTS = [
  path.join(process.cwd(), 'public'),
  path.join(process.cwd(), 'src'),
];

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'types',
  'docs',
  'skia-reference',
]);

const SKIP_FILE_PATTERNS = [
  /sidebar/i,
  /incident/i,
  /api-keys/i,
  /status/i,
  /monacoSetup/i,
  /\.test\./i,
  /ogImage/i,
];

const EXTS = new Set(['.css', '.tsx', '.ts', '.jsx', '.js']);

const CARD_INPUT_BG = /^#(?:0[d-e]0[d-e]0[d-e]|0[fF]0[fF]0[fF]|10(?:10)?10|11(?:11)?11|12(?:12)?12|13(?:13)?13)$/i;

const SHELL_BG_MARKERS =
  /(?:^body\b|#app-shell|#sidebar\b|#chat-panel|--skia-bg|--skia-sidebar|--skia-panel|--bg:|editor\.background|inset:\s*0|--skia-button-bg|var\(--skia-bg|var\(--skia-sidebar|var\(--skia-panel|var\(--bg\)|100vh|100dvh|100svh|#050500|#0[aA]0[aA]0[aA]|#080400|radial-gradient.*var\(--bg)/;

const CARD_INPUT_MARKERS =
  /(?:^input\b|^textarea\b|\.settings-input|\.auth-card|\.skia-auth-card|\.msg\b|^pre\b|\.card\b|\.panel\b|\.dropdown|textarea,|input,|background:#111\b|\.token-box)/i;

function shouldSkipFile(rel) {
  const norm = rel.split(path.sep).join('/');
  if (norm.includes('types/skia-reference')) return true;
  return SKIP_FILE_PATTERNS.some((p) => p.test(norm));
}

function isBackgroundLine(line) {
  return /(?:^|\s|["'])background(?:-color)?\s*[:=]/i.test(line);
}

function isShellBackgroundLine(line) {
  return isBackgroundLine(line) && SHELL_BG_MARKERS.test(line);
}

function isCardInputBackgroundLine(line) {
  if (!isBackgroundLine(line)) return false;
  if (SHELL_BG_MARKERS.test(line)) return false;
  return CARD_INPUT_MARKERS.test(line) || /max-width:\s*420|auth-card|\.msg|textarea|input\s*\{/.test(line);
}

function replaceCardInputBgHex(line) {
  return line.replace(/#(?:0[dDeE]0[dDeE]0[dDeE]|0[fF]0[fF]0[fF]|10(?:10)?10|11(?!1)|12(?:12)?12|13(?:13)?13)\b/g, (m) =>
    CARD_INPUT_BG.test(m) ? '#111111' : m,
  );
}

function replaceNonBackgroundColors(line) {
  if (isBackgroundLine(line) && !isCardInputBackgroundLine(line)) return line;

  let out = line;

  if (isCardInputBackgroundLine(line)) {
    out = replaceCardInputBgHex(out);
  }

  // Warning semantic
  out = out.replace(
    /(severity|sev|status|priority|impact)\s*===?\s*["']warning["']\s*\?\s*["']#(?:FFD700|ffd700)["']/g,
    '$1 === "warning" ? "#f2c94c"',
  );

  // Gold hex (canonical list + Forge accent #c9922a on color/border only)
  out = out.replace(/\#(?:ffd700|e6c96f|daa520|e8c85c|e8c84a|f0d78c|ff9900|c9922a)\b/gi, '#d4af37');
  out = out.replace(/\#FFD700\b/g, '#d4af37');

  // Gold progress gradients (accent)
  out = out.replace(/linear-gradient\s*\(\s*90deg\s*,\s*#d4af37\s*,\s*#d4af37\s*\)/gi, 'linear-gradient(90deg, #d4af37, #d4af37)');
  out = out.replace(
    /linear-gradient\s*\(\s*90deg\s*,\s*#(?:FFD700|ffd700|d4af37)\s*,\s*#ff9900\s*\)/gi,
    'linear-gradient(90deg, #d4af37, #d4af37)',
  );

  // rgba(255,215,0 → gold tint (not already 212,175,55)
  if (!/212\s*,\s*175\s*,\s*55/.test(out)) {
    out = out.replace(/rgba\s*\(\s*255\s*,\s*215\s*,\s*0\s*,/gi, 'rgba(212,175,55,');
  }

  // Error / success (color properties; skip if line is shell bg only)
  if (!isBackgroundLine(line) || isCardInputBackgroundLine(line)) {
    // errors on color lines only below
  }
  if (!isBackgroundLine(line)) {
    out = out.replace(/\#(?:ff6b6b|ff4444|fb7185|ff9a9a|ff9f9f|f08f8f|e8a0a0)\b/gi, '#ff5c5c');
    out = out.replace(/\#(?:34d399|2ce08d|86efac|8ddf8d)\b/gi, '#4ade80');
    out = out.replace(/\#fbbf24\b/gi, '#f2c94c');
  }

  // Card/input backgrounds on eligible lines
  if (isCardInputBackgroundLine(line)) {
    out = out.replace(/\#(?:0[dDeE]0[dDeE]0[dDeE]|0[fF]0[fF]0[fF]|10(?:10)?10|11(?!1)|12(?:12)?12|13(?:13)?13)\b/gi, '#111111');
    out = out.replace(/\#111\b(?!1)/g, '#111111');
  }

  return out;
}

function normalizeContent(content) {
  return content
    .split('\n')
    .map((line) => {
      if (isShellBackgroundLine(line)) return line;
      return replaceNonBackgroundColors(line);
    })
    .join('\n');
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
        if (!CHECK) {
          fs.writeFileSync(p, after, 'utf8');
        }
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
    console.error(`SKIA Forge color normalization: ${changed.length} file(s) have non-canonical colors:`);
    changed.forEach((f) => console.error(`  - ${f}`));
    console.error('');
    console.error('Fix locally: node scripts/normalize-forge-colors.mjs');
    process.exit(1);
  }
  process.exit(0);
}

console.log(`Updated ${changed.length} files:`);
changed.forEach((f) => console.log(' ', f));
