import fs from 'node:fs';
import path from 'node:path';

const PUBLIC = path.join(process.cwd(), 'public');
const files = [];

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name.endsWith('.html')) files.push(p);
  }
}

walk(PUBLIC);

const offenders = [];
for (const file of files) {
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<style[\s\S]*?<\/style>/gi, '');
  const bodyM = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!bodyM) continue;
  const body = bodyM[1];
  const textRe = />([^<>]+)</g;
  let m;
  while ((m = textRe.exec(body)) !== null) {
    const text = m[1].replace(/\s+/g, ' ').trim();
    if (!text || text.length < 2) continue;
    if (/^[\d\s|←?]+$/.test(text)) continue;
    if (/^support_forge@|^cx_forge@/.test(text)) continue;
    const before = body.slice(Math.max(0, m.index - 200), m.index);
    if (before.includes('data-i18n')) continue;
    if (before.includes('data-i18n-html')) continue;
    if (before.includes('data-i18n-placeholder')) continue;
    offenders.push({ file: path.relative(PUBLIC, file), text: text.slice(0, 80) });
  }
}

if (offenders.length) {
  console.error('Hardcoded text without nearby data-i18n:', offenders.slice(0, 30));
  process.exit(1);
}
console.log(`OK: ${files.length} HTML files have no obvious hardcoded visible text.`);
