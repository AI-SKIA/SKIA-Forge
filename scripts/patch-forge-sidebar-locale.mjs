import fs from 'node:fs';
import path from 'node:path';

const publicRoot = path.join(process.cwd(), 'public');
const files = [];

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name.endsWith('.html')) files.push(p);
  }
}

walk(publicRoot);

const docScript = '  <script src="/forge-document-locale.js"></script>\n';
const cssLink = '  <link rel="stylesheet" href="/forge-sidebar-locale.css" />\n';
const sidebarScript = '  <script src="/forge-sidebar-locale.js" defer></script>\n';

let updated = 0;

for (const filePath of files) {
  let html = fs.readFileSync(filePath, 'utf8');
  if (!html.includes('pc-sidebar') && !html.includes('id="pcSidebar"')) continue;

  let changed = false;

  if (!html.includes('forge-document-locale.js')) {
    if (/<meta name="viewport"/i.test(html)) {
      html = html.replace(/(<meta name="viewport"[^>]*>)/i, `$1\n${docScript}`);
      changed = true;
    } else if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head[^>]*>/i, (m) => `${m}\n${docScript}`);
      changed = true;
    }
  }

  if (!html.includes('forge-sidebar-locale.css') && html.includes('</head>')) {
    html = html.replace('</head>', `${cssLink}</head>`);
    changed = true;
  }

  if (!html.includes('forge-sidebar-locale.js') && html.includes('</body>')) {
    html = html.replace('</body>', `${sidebarScript}</body>`);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, html);
    updated += 1;
  }
}

console.log(`Updated ${updated} Forge sidebar HTML file(s).`);
