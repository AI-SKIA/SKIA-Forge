/**
 * SKIA-Forge font size / weight normalization (no font families, no sidebar).
 * Run: node scripts/normalize-forge-font-sizes.mjs
 * Check: node scripts/normalize-forge-font-sizes.mjs --check
 */
import fs from 'fs';
import path from 'path';

const CHECK = process.argv.includes('--check');

const ROOTS = [
  path.join(process.cwd(), 'skia-ide', 'src', 'renderer'),
  path.join(process.cwd(), 'public'),
  path.join(process.cwd(), 'src'),
];

const SKIP_DIRS = new Set(['node_modules', 'dist', 'types', 'docs', 'skia-reference']);
const SKIP_FILE_PATTERNS = [/sidebar/i, /incident/i, /api-keys/i, /status/i, /monacoSetup/i, /TerminalPanel/i, /\.test\./i, /ogImage/i];
const EXTS = new Set(['.css', '.tsx', '.ts', '.jsx', '.js']);

const SIDEBAR_CSS_MARKERS = [
  '#sidebar',
  '#skia-nav',
  '#explorer-tree',
  '.explorer-',
  '.pc-sidebar',
  'forge-sidebar',
];

function shouldSkipFile(rel) {
  const norm = rel.split(path.sep).join('/');
  if (norm.includes('types/skia-reference')) return true;
  return SKIP_FILE_PATTERNS.some((p) => p.test(norm));
}

function inSkippedCssBlock(lines, lineIndex) {
  let depth = 0;
  for (let i = lineIndex; i >= 0; i--) {
    const line = lines[i];
    depth += (line.match(/\}/g) || []).length;
    depth -= (line.match(/\{/g) || []).length;
    if (depth < 0) {
      const sel = lines.slice(Math.max(0, i - 8), i + 1).join(' ');
      if (SIDEBAR_CSS_MARKERS.some((s) => sel.includes(s))) return true;
      break;
    }
  }
  return false;
}

function normalizeCss(content) {
  const lines = content.split('\n');
  return lines
    .map((line, i) => {
      if (inSkippedCssBlock(lines, i)) return line;
      let l = line;

      // Hero / page titles
      l = l.replace(/font-size:\s*20px/g, 'font-size: 28px');
      l = l.replace(/font-size:\s*22px/g, 'font-size: 28px');
      l = l.replace(/font-size:\s*30px/g, 'font-size: 28px');
      l = l.replace(/font-size:\s*31px/g, 'font-size: 28px');
      l = l.replace(/font-size:\s*29px/g, 'font-size: 28px');

      // H3 in-page titles (auth headings at 16px → 26px when bold)
      const ctx = lines.slice(Math.max(0, i - 2), i + 3).join(' ');
      if (/h1|h2|h3|\.brand|feature-page-title|view-header|forge-hub__title/.test(ctx) && /font-size:\s*16px/.test(l) && /font-weight:\s*700|font-weight:\s*600/.test(ctx)) {
        l = l.replace(/font-size:\s*16px/g, 'font-size: 26px');
      } else {
        l = l.replace(/font-size:\s*16px/g, 'font-size: 12px');
      }

      l = l.replace(/font-size:\s*15px/g, 'font-size: 14px');
      l = l.replace(/font-size:\s*17px/g, 'font-size: 14px');
      l = l.replace(/font-size:\s*13px/g, 'font-size: 14px');
      l = l.replace(/font-size:\s*9px/g, 'font-size: 10px');
      l = l.replace(/font-size:\s*8px/g, 'font-size: 10px');

      // Card titles / section labels
      if (/\.dashboard-card-title|\.card-title|\.settings-label|\.forge-label|\.view-header/.test(ctx)) {
        l = l.replace(/font-size:\s*14px/g, 'font-size: 13px');
        l = l.replace(/font-weight:\s*700/g, 'font-weight: 600');
        l = l.replace(/font-weight:\s*400/g, 'font-weight: 600');
      }
      if (/\.settings-label|\.forge-label|\.view-header|section-label|workspace-label/.test(ctx)) {
        l = l.replace(/font-size:\s*11px/g, 'font-size: 10px');
      }

      // Dropdown title / category rows
      if (/\.search-result-filename|dropdown-title|settings-value/.test(ctx)) {
        l = l.replace(/font-size:\s*10px/g, 'font-size: 11px');
      }

      // Search input
      if (/\.search-input|settings-input|center-view input/.test(ctx)) {
        l = l.replace(/font-size:\s*14px/g, 'font-size: 10px');
        l = l.replace(/font-size:\s*11px/g, 'font-size: 10px');
      }

      // Weights
      l = l.replace(/font-weight:\s*800/g, 'font-weight: 700');
      l = l.replace(/font-weight:\s*500/g, 'font-weight: 400');

      return l;
    })
    .join('\n');
}

function normalizeTs(content) {
  let out = content;

  const sizeMap = { '15': '14', '16': '12', '20': '28', '22': '28', '9': '10', '11.5': '11' };
  for (const [from, to] of Object.entries(sizeMap)) {
    out = out.replace(new RegExp(`fontSize:\\s*${from.replace('.', '\\.')}\\b`, 'g'), `fontSize: ${to}`);
  }

  // Monaco editor fontSize — keep as-is (monospace/code)
  out = out.replace(/fontSize:\s*13\b/g, (match, offset) => {
    const ctx = out.slice(Math.max(0, offset - 100), offset + 60);
    if (/minimap|getRawOptions|updateOptions|loadEditorSettings|saved\.fontSize|opts\.fontSize|\?\?\s*13/.test(ctx)) {
      return match;
    }
    return 'fontSize: 14';
  });

  out = out.replace(/font-size:\s*16px/g, 'font-size: 12px');
  out = out.replace(/font-size:\s*15px/g, 'font-size: 14px');
  out = out.replace(/font-size:\s*13px/g, 'font-size: 14px');
  out = out.replace(/font-size:\s*20px/g, 'font-size: 28px');
  out = out.replace(/font-size:\s*9px/g, 'font-size: 10px');

  out = out.replace(/fontWeight:\s*800/g, 'fontWeight: 700');
  out = out.replace(/fontWeight:\s*500/g, 'fontWeight: 400');

  // Auth headings in template strings: 16px/700 → 26px
  out = out.replace(/font-size:16px;\s*font-weight:700/g, 'font-size:26px; font-weight:700');
  out = out.replace(/font-size:16px;font-weight:600/g, 'font-size:26px;font-weight:600');

  return out;
}

function walk(dir, changed = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    const rel = path.relative(process.cwd(), p);
    if (e.isDirectory()) walk(p, changed);
    else if (EXTS.has(path.extname(e.name)) && !shouldSkipFile(rel)) {
      const before = fs.readFileSync(p, 'utf8');
      const after = rel.endsWith('.css') ? normalizeCss(before) : normalizeTs(before);
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
    console.error(`SKIA Forge font normalization: ${changed.length} file(s) have non-canonical font sizes/weights:`);
    changed.forEach((f) => console.error(`  - ${f}`));
    console.error('');
    console.error('Fix locally: node scripts/normalize-forge-font-sizes.mjs');
    process.exit(1);
  }
  process.exit(0);
}

console.log(`Updated ${changed.length} files:`);
changed.forEach((f) => console.log(' ', f));
