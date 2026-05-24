#!/usr/bin/env node
/**
 * Verifies docs/*.md slugs have matching keys in public/locales/en/docs.json.
 * Run from SKIA-Forge repo root: node scripts/verify-md-locale-parity.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsDir = path.join(root, 'docs');
const localePath = path.join(root, 'public', 'locales', 'en', 'docs.json');

const SLUG_MAP = {
  README: 'readme',
  QUICKSTART: 'quickstart',
  USER_GUIDE: 'user-guide',
  DEVELOPER_GUIDE: 'developer-guide',
  API_REFERENCE: 'api-reference',
  OPERATOR_MANUAL: 'operator-manual',
  PRODUCT_MANUAL: 'product-manual',
  SECURITY_GUIDE: 'security-guide',
  TROUBLESHOOTING: 'troubleshooting',
  CHANGELOG: 'changelog',
  SUPPORT: 'support',
  PRICING_AND_PACKAGES: 'pricing-and-packages',
  ENTERPRISE_READINESS_CHECKLIST: 'enterprise-readiness-checklist',
};

const locale = JSON.parse(fs.readFileSync(localePath, 'utf8'));
const missing = [];

for (const [file, slug] of Object.entries(SLUG_MAP)) {
  const mdPath = path.join(docsDir, `${file}.md`);
  if (!fs.existsSync(mdPath)) continue;
  if (!locale[slug] && !locale.pages?.[slug]) {
    missing.push({ file: `${file}.md`, slug });
  }
}

if (missing.length) {
  console.error('Missing locale keys for MD docs:');
  for (const m of missing) console.error(`  - ${m.file} → ${m.slug}`);
  process.exit(1);
}

console.log('MD ↔ en/docs.json parity OK for', Object.keys(SLUG_MAP).length, 'guides');
