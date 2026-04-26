export function renderOgImageSvg(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0a0a0a"/>
      <stop offset="1" stop-color="#030303"/>
    </linearGradient>
    <radialGradient id="halo" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(600 210) rotate(90) scale(220 520)">
      <stop offset="0" stop-color="#d4af37" stop-opacity="0.32"/>
      <stop offset="1" stop-color="#d4af37" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="line" x1="0" y1="0" x2="1200" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#d4af37" stop-opacity="0"/>
      <stop offset="0.5" stop-color="#d4af37" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#d4af37" stop-opacity="0"/>
    </linearGradient>
    <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="56" y="56" width="1088" height="518" rx="0" stroke="#4a3a14" stroke-width="1.5"/>
  <rect x="68" y="68" width="1064" height="494" rx="0" stroke="#2f250c" stroke-width="1"/>

  <rect width="1200" height="630" fill="url(#halo)"/>
  <rect x="0" y="152" width="1200" height="2" fill="url(#line)"/>
  <rect x="0" y="282" width="1200" height="1.5" fill="url(#line)"/>

  <text x="600" y="208" text-anchor="middle" fill="#f7e0a1" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="76" font-weight="700" letter-spacing="8">SKIA FORGE</text>
  <text x="600" y="256" text-anchor="middle" fill="#d4af37" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="36" font-style="italic" filter="url(#softGlow)">She Knows It All</text>

  <text x="600" y="352" text-anchor="middle" fill="#f1d27a" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="34" font-weight="600" letter-spacing="1.2">
    The Sovereign AI Coding Platform
  </text>
  <text x="600" y="400" text-anchor="middle" fill="#c8aa5a" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="24">
    One intelligence across desktop, web, mobile, and voice
  </text>
  <text x="600" y="438" text-anchor="middle" fill="#c8aa5a" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="22">
    Governed orchestration • Structured output • Enterprise controls
  </text>

  <rect x="300" y="478" width="600" height="54" rx="0" fill="#15110a" stroke="#6b5420" stroke-width="1.5"/>
  <text x="600" y="513" text-anchor="middle" fill="#d4af37" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="24" font-weight="600" letter-spacing="1.1">
    DOWNLOAD THE IDE • SKIA.CA/DOWNLOAD
  </text>
</svg>`;
}
