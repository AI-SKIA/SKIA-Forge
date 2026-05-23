/**
 * Verify platform-downloads layout across all Forge web locales (production).
 */
import { chromium } from 'playwright';

const LOCALES = ['en', 'fr', 'es', 'ar', 'zh', 'pt', 'de', 'ja', 'ko', 'hi', 'tr', 'ru'];
const BASE = 'https://forge.skia.ca';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 900 });

const enBaseline = null;
const results = [];

for (const locale of LOCALES) {
  const url = `${BASE}/${locale}/platform-downloads`;
  const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-i18n="platform-downloads.whyTeams.heading"]');
      return el && el.textContent && el.textContent.trim().length > 3;
    },
    { timeout: 15000 },
  );

  const data = await page.evaluate(() => {
    const heading = document.querySelector('[data-i18n="platform-downloads.whyTeams.heading"]');
    const wrap = document.querySelector('.wrap');
    const row = document.querySelector('[data-i18n="platform-downloads.whyTeams.a"]')?.closest('.download-instruction-row');
    const footer = document.querySelector('footer');
    const tagline = document.querySelector('.footer-tagline');
    const copy = document.querySelector('.footer-copy');
    const inWrap = (el) => !!el?.closest('.wrap');

    const hBox = heading?.getBoundingClientRect();
    const wBox = wrap?.getBoundingClientRect();
    const hCs = heading ? getComputedStyle(heading) : null;
    const tCs = tagline ? getComputedStyle(tagline) : null;
    const cCs = copy ? getComputedStyle(copy) : null;
    const rowCs = row ? getComputedStyle(row) : null;

    const wrapCenter = wBox ? wBox.left + wBox.width / 2 : 0;
    const headingCenter = hBox ? hBox.left + hBox.width / 2 : 0;

    return {
      status: document.readyState,
      headingText: heading?.textContent?.trim() ?? '',
      headingInWrap: inWrap(heading),
      rowInWrap: inWrap(row),
      footerInWrap: inWrap(footer),
      instructionsInWrap: inWrap(document.querySelector('.download-instructions')),
      headingTextAlign: hCs?.textAlign,
      headingCenterDelta: Math.abs(headingCenter - wrapCenter),
      rowMaxWidth: rowCs?.maxWidth,
      rowWidth: rowCs?.width,
      taglineFontSize: tCs?.fontSize,
      copyFontSize: cCs?.fontSize,
      footerFontSize: footer ? getComputedStyle(footer).fontSize : null,
    };
  });

  results.push({ locale, url, httpStatus: res?.status(), ...data });
}

await browser.close();

const en = results.find((r) => r.locale === 'en');
const failures = [];

for (const r of results) {
  const issues = [];
  if (r.httpStatus !== 200) issues.push(`HTTP ${r.httpStatus}`);
  if (!r.headingInWrap) issues.push('heading outside .wrap');
  if (!r.rowInWrap) issues.push('instruction row outside .wrap');
  if (!r.footerInWrap) issues.push('footer outside .wrap');
  if (!r.instructionsInWrap) issues.push('download-instructions outside .wrap');
  if (r.headingTextAlign !== 'center') issues.push(`heading text-align=${r.headingTextAlign}`);
  if (r.headingCenterDelta > 2) issues.push(`heading off-center by ${r.headingCenterDelta.toFixed(1)}px`);
  if (r.rowMaxWidth === 'none' || parseFloat(r.rowMaxWidth) > 1000) issues.push(`row max-width=${r.rowMaxWidth}`);
  if (en && r.taglineFontSize !== en.taglineFontSize) {
    issues.push(`tagline ${r.taglineFontSize} != en ${en.taglineFontSize}`);
  }
  if (en && r.copyFontSize !== en.copyFontSize) {
    issues.push(`copy ${r.copyFontSize} != en ${en.copyFontSize}`);
  }
  if (parseFloat(r.taglineFontSize) < 13) issues.push(`tagline too small: ${r.taglineFontSize}`);
  if (parseFloat(r.copyFontSize) < 12) issues.push(`copy too small: ${r.copyFontSize}`);

  r.ok = issues.length === 0;
  r.issues = issues;
  if (!r.ok) failures.push(r);
}

console.log('=== EN baseline ===');
console.log(JSON.stringify(en, null, 2));
console.log('\n=== All locales summary ===');
for (const r of results) {
  console.log(
    `${r.ok ? 'OK' : 'FAIL'} ${r.locale.padEnd(3)} headingΔ=${r.headingCenterDelta.toFixed(1)}px tagline=${r.taglineFontSize} copy=${r.copyFontSize} inWrap=h${r.headingInWrap ? 'Y' : 'N'}/r${r.rowInWrap ? 'Y' : 'N'}/f${r.footerInWrap ? 'Y' : 'N'}${r.issues.length ? ' | ' + r.issues.join('; ') : ''}`,
  );
}
console.log(`\n=== Result: ${failures.length === 0 ? 'ALL 12 PASS' : failures.length + ' FAIL'} ===`);
if (failures.length) process.exit(1);

// Mobile viewport — longer locale strings may wrap
console.log('\n=== Mobile viewport 390px ===');
const mobilePage = await (await chromium.launch()).newPage();
await mobilePage.setViewportSize({ width: 390, height: 844 });
let enMobile = null;
let mobileFails = 0;
for (const locale of LOCALES) {
  await mobilePage.goto(`${BASE}/${locale}/platform-downloads`, { waitUntil: 'networkidle' });
  await mobilePage.waitForFunction(() => {
    const el = document.querySelector('[data-i18n="platform-downloads.whyTeams.heading"]');
    return el && el.textContent && el.textContent.trim().length > 3;
  });
  const m = await mobilePage.evaluate(() => {
    const h = document.querySelector('[data-i18n="platform-downloads.whyTeams.heading"]');
    const w = document.querySelector('.wrap');
    const hb = h.getBoundingClientRect();
    const wb = w.getBoundingClientRect();
    return {
      delta: Math.abs(hb.left + hb.width / 2 - (wb.left + wb.width / 2)),
      textAlign: getComputedStyle(h).textAlign,
      inWrap: !!h.closest('.wrap'),
      tag: getComputedStyle(document.querySelector('.footer-tagline')).fontSize,
      copy: getComputedStyle(document.querySelector('.footer-copy')).fontSize,
      lines: h.getClientRects().length,
    };
  });
  if (locale === 'en') enMobile = m;
  const issues = [];
  if (m.delta > 2) issues.push(`delta=${m.delta.toFixed(1)}px`);
  if (m.textAlign !== 'center') issues.push(`text-align=${m.textAlign}`);
  if (!m.inWrap) issues.push('outside .wrap');
  if (m.tag !== enMobile.tag) issues.push(`tagline ${m.tag} != en ${enMobile.tag}`);
  if (m.copy !== enMobile.copy) issues.push(`copy ${m.copy} != en ${enMobile.copy}`);
  const ok = issues.length === 0;
  if (!ok) mobileFails++;
  console.log(`${ok ? 'OK' : 'FAIL'} ${locale} delta=${m.delta.toFixed(1)}px lines=${m.lines} tag=${m.tag} copy=${m.copy}${issues.length ? ' | ' + issues.join('; ') : ''}`);
}
await mobilePage.context().browser()?.close();
if (mobileFails) process.exit(1);
console.log('\n=== Mobile: ALL 12 PASS ===');
