/**
 * Canonical SKIA Crest bullet inline SVG — Skia-FULL SkiaCrestBulletIcon.tsx / fix-doc-crest-bullets.mjs
 */
export const CREST_SVG_PATHS =
  '<path d="M6 0.5 L10.5 2.5 V6.5 L6 11.5 L1.5 6.5 V2.5 Z" stroke="#d4af37" stroke-width="1" vector-effect="non-scaling-stroke"/><path d="M6 2.5 V9" stroke="#d4af37" stroke-width="1" vector-effect="non-scaling-stroke"/><rect x="5" y="5" width="2" height="2" fill="#d4af37"/>';

export function crestMarkup(size = 18, className = "item-crest item-crest--body") {
  return `<span class="${className}" aria-hidden="true"><svg width="${size}" height="${size}" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">${CREST_SVG_PATHS}</svg></span>`;
}

/** Tier 2 card-body row (.item, doc lists) — 18×18 */
export const CREST_MARKUP_ITEM = crestMarkup(18, "item-crest item-crest--body");
/** Compact inline prose — 12×12 (avoid in Tier 2 rows) */
export const CREST_MARKUP_12 = crestMarkup(12, "item-crest");
export const CREST_MARKUP_18 = crestMarkup(18, "item-crest item-crest--body");
