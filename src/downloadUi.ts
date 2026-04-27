type DownloadPlatform = {
    id: string;
    name: string;
    version: string;
    icon: string;
    hint: string;
    file: string;
};

type ValueCard = {
    title: string;
    body: string;
};

const PLATFORMS: DownloadPlatform[] = [
    {
        id: "windows",
        name: "Windows",
        version: "Windows 10/11",
        icon: "windows",
        hint: "64-bit installer (.exe)",
        file: "Skia-Forge-Setup-1.0.0-win-x64.exe"
    },
    {
        id: "mac-intel",
        name: "macOS (Intel)",
        version: "macOS 11+",
        icon: "apple",
        hint: "Intel x64",
        file: "Skia-Forge-1.0.0-mac-x64.dmg"
    },
    {
        id: "mac-arm",
        name: "macOS (Apple Silicon)",
        version: "macOS 11+ M1/M2/M3",
        icon: "apple",
        hint: "Apple Silicon (M1/M2/M3)",
        file: "Skia-Forge-1.0.0-mac-arm64.dmg"
    },
    {
        id: "linux-appimage",
        name: "Linux",
        version: "Ubuntu, Fedora, Arch",
        icon: "linux",
        hint: "AppImage (any distro)",
        file: "Skia-Forge-1.0.0-linux-x64.AppImage"
    }
];

const VALUE_CARDS: ValueCard[] = [
    {
        title: "Frontier-Ready Intelligence Layer",
        body: "SKIA Forge is built on a hardened intelligence stack validated across coding, tool use, reasoning, long context, vision, and multimodal workflows."
    },
    {
        title: "Eval-Gated Reliability",
        body: "Regression-sensitive CI gates and full test coverage protect quality, so intelligence regressions are blocked before release."
    },
    {
        title: "Production-Grade Operations",
        body: "Forge ships with health checks, governance telemetry, status surfaces, and deterministic routing controls designed for operational trust."
    },
    {
        title: "One Intelligence Across Surfaces",
        body: "Use Forge on web for API-powered execution, or install desktop for full local filesystem and terminal workflows."
    }
];

export function renderDownloadHtml(releaseBase: string): string {
    const valueCards = VALUE_CARDS.map(
        (card) => `
      <article class="value-card">
        <h3 class="value-card-title">${card.title}</h3>
        <p class="value-card-body">${card.body}</p>
      </article>
    `
    ).join("");

    const cards = PLATFORMS.map(
        (p) => `
      <a id="${p.id}" class="download-card" data-file="${p.file}" href="https://github.com/AI-SKIA/skia/releases/latest" target="_blank" rel="noreferrer">
        <div class="download-card-icon ${p.icon}"></div>
        <div class="download-card-name">${p.name}</div>
        <div class="download-card-version">${p.version}</div>
        <div class="download-card-hint">${p.hint}</div>
        <div class="download-card-btn">Download</div>
      </a>
    `
    ).join("");

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="icon" type="image/png" href="/favicon.png" />
  <link rel="apple-touch-icon" href="/favicon.png" />
  <title>SKIA Forge | Download</title>
  <meta
    name="description"
    content="Download SKIA Forge for Windows, macOS, and Linux. One sovereign intelligence across desktop, web, mobile, and voice."
  />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="SKIA Forge" />
  <meta property="og:title" content="SKIA Forge | Download" />
  <meta
    property="og:description"
    content="Download SKIA Forge for Windows, macOS, and Linux. One sovereign intelligence across desktop, web, mobile, and voice."
  />
  <meta property="og:url" content="https://forge.skia.ca/forge" />
  <meta property="og:image" content="https://skia.ca/og/skia-forge-preview.svg" />
  <meta property="og:image:secure_url" content="https://skia.ca/og/skia-forge-preview.svg" />
  <meta property="og:image:type" content="image/svg+xml" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="SKIA Forge Download" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="SKIA Forge | Download" />
  <meta
    name="twitter:description"
    content="Download SKIA Forge for Windows, macOS, and Linux."
  />
  <meta name="twitter:image" content="https://skia.ca/og/skia-forge-preview.svg" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800&display=swap');
    @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600&display=swap');

    :root {
      --skia-gold: #d4af37;
      --skia-gold-muted: rgba(212,175,55,0.62);
      --skia-bg: #080400;
      --skia-card-bg: linear-gradient(135deg, rgba(15,8,0,0.95) 0%, rgba(25,14,0,0.95) 100%);
      --skia-border: rgba(212,175,55,0.3);
      --skia-text-soft: rgba(255,255,255,0.68);
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,180,0,0.06) 0%, transparent 70%), var(--skia-bg);
      color: var(--skia-gold);
      font-family: Orbitron, sans-serif;
      min-height: 100vh;
    }

    .pc-sidebar-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(2px);
      z-index: 199;
      cursor: pointer;
      display: none;
    }
    .pc-sidebar-tab {
      position: fixed;
      top: 50%;
      left: 0;
      transform: translateY(-50%);
      z-index: 200;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 72px;
      padding: 0;
      background: linear-gradient(180deg, rgba(20, 10, 0, 0.95) 0%, rgba(40, 20, 0, 0.98) 50%, rgba(20, 10, 0, 0.95) 100%);
      border: 1px solid rgba(212,175,55,0.4);
      border-left: none;
      border-radius: 0 10px 10px 0;
      cursor: pointer;
      box-shadow: 4px 0 20px rgba(212,175,55,0.15), inset -1px 0 0 rgba(212,175,55,0.08);
    }
    .pc-sidebar-tab-icon { font-size: 20px; color: var(--skia-gold); line-height: 1; }
    .pc-sidebar {
      position: fixed;
      top: 0;
      left: 0;
      width: 260px;
      height: 100vh;
      background: linear-gradient(180deg, rgba(12,6,0,0.98) 0%, rgba(20,10,0,0.99) 100%);
      border-right: 1px solid rgba(212,175,55,0.25);
      z-index: 201;
      transform: translateX(-100%);
      transition: transform 0.25s ease;
      display: flex;
      flex-direction: column;
      padding: 24px 0 32px;
    }
    .pc-sidebar--open { transform: translateX(0); }
    .pc-sidebar-logo {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0 20px 20px;
    }
    .pc-sidebar-logo-img { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; }
    .pc-sidebar-logo-tagline {
      font-size: 10px;
      color: rgba(212,175,55,0.55);
      letter-spacing: 0.12em;
      margin-top: 8px;
      text-transform: uppercase;
    }
    .pc-sidebar-divider {
      height: 1px;
      background: rgba(212,175,55,0.18);
      margin: 8px 16px;
    }
    .pc-sidebar-nav {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px 12px;
    }
    .pc-sidebar-btn {
      display: block;
      padding: 10px 14px;
      border-radius: 6px;
      color: rgba(212,175,55,0.85);
      text-decoration: none;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      transition: background 0.15s, color 0.15s;
    }
    .pc-sidebar-btn:hover {
      background: rgba(212,175,55,0.1);
      color: #d4af37;
    }

    .wrap {
      max-width: 900px;
      margin: 0 auto;
      padding: 48px 24px 72px;
    }

    .feature-page-content {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .feature-page-logo {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      object-fit: cover;
      margin-bottom: 20px;
    }

    .feature-page-header {
      text-align: center;
      margin-bottom: 32px;
    }

    .feature-page-title {
      font-size: 32px;
      font-weight: 700;
      letter-spacing: 0.18em;
      color: var(--skia-gold);
      margin: 0 0 10px;
      text-transform: uppercase;
    }

    .feature-page-subtitle {
      font-size: 13px;
      color: var(--skia-text-soft);
      letter-spacing: 0.05em;
      margin: 0 0 24px;
      font-family: Nunito, sans-serif;
    }

    .hero-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }

    .feature-tab {
      display: inline-block;
      padding: 10px 22px;
      border: 1px solid rgba(212,175,55,0.5);
      border-radius: 6px;
      color: var(--skia-gold);
      text-decoration: none;
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      background: rgba(212,175,55,0.06);
      transition: background 0.15s, border-color 0.15s;
    }
    .feature-tab:hover {
      background: rgba(212,175,55,0.14);
      border-color: rgba(212,175,55,0.8);
    }
    .feature-tab--primary {
      background: rgba(212,175,55,0.18);
      border-color: rgba(212,175,55,0.7);
      font-weight: 600;
    }

    .value-section {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
      width: 100%;
      margin: 32px 0;
    }

    .value-card {
      background: var(--skia-card-bg);
      border: 1px solid var(--skia-border);
      border-radius: 10px;
      padding: 20px 18px;
    }

    .value-card-title {
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--skia-gold);
      margin: 0 0 10px;
    }

    .value-card-body {
      font-size: 12px;
      color: var(--skia-text-soft);
      font-family: Nunito, sans-serif;
      line-height: 1.6;
      margin: 0;
    }

    .journey {
      width: 100%;
      margin: 24px 0;
    }

    .journey-title {
      font-size: 13px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--skia-gold);
      margin: 0 0 14px;
    }

    .journey-row {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      margin-bottom: 10px;
      font-size: 12px;
      color: var(--skia-text-soft);
      font-family: Nunito, sans-serif;
      line-height: 1.5;
    }

    .journey-step {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 26px;
      height: 26px;
      border-radius: 50%;
      border: 1px solid rgba(212,175,55,0.5);
      font-size: 11px;
      color: var(--skia-gold);
      font-family: Orbitron, sans-serif;
      flex-shrink: 0;
    }

    .download-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 14px;
      width: 100%;
      margin: 24px 0 16px;
    }

    .download-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      background: var(--skia-card-bg);
      border: 1px solid var(--skia-border);
      border-radius: 10px;
      padding: 20px 14px 16px;
      text-decoration: none;
      color: var(--skia-gold);
      transition: border-color 0.15s, background 0.15s;
      text-align: center;
    }
    .download-card:hover {
      border-color: rgba(212,175,55,0.7);
      background: linear-gradient(135deg, rgba(20,10,0,0.98) 0%, rgba(35,18,0,0.98) 100%);
    }
    .download-card--hidden { display: none; }

    .download-card-icon {
      width: 32px;
      height: 32px;
      margin-bottom: 10px;
      background: rgba(212,175,55,0.15);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
    }
    .download-card-icon::before { content: "⬢"; color: var(--skia-gold); }

    .download-card-name {
      font-size: 11px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin-bottom: 4px;
      font-weight: 600;
    }

    .download-card-version {
      font-size: 10px;
      color: var(--skia-gold-muted);
      margin-bottom: 4px;
      font-family: Nunito, sans-serif;
    }

    .download-card-hint {
      font-size: 10px;
      color: rgba(255,255,255,0.45);
      margin-bottom: 12px;
      font-family: Nunito, sans-serif;
    }

    .download-card-btn {
      padding: 6px 16px;
      border: 1px solid rgba(212,175,55,0.45);
      border-radius: 4px;
      font-size: 10px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--skia-gold);
      background: rgba(212,175,55,0.07);
    }

    .download-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: center;
      margin: 8px 0 24px;
    }

    .download-instructions {
      width: 100%;
      background: var(--skia-card-bg);
      border: 1px solid var(--skia-border);
      border-radius: 10px;
      padding: 20px 18px;
      margin-bottom: 24px;
    }

    .download-instruction-row {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      margin-bottom: 10px;
      font-size: 12px;
      color: var(--skia-text-soft);
      font-family: Nunito, sans-serif;
      line-height: 1.5;
    }
    .download-instruction-row:last-child { margin-bottom: 0; }

    .download-step {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 1px solid rgba(212,175,55,0.4);
      font-size: 10px;
      color: var(--skia-gold);
      font-family: Orbitron, sans-serif;
      flex-shrink: 0;
    }

    .update-banner {
      width: 100%;
      border: 1px solid rgba(212,175,55,0.5);
      background: rgba(212,175,55,0.1);
      color: var(--skia-gold);
      padding: 10px 14px;
      border-radius: 6px;
      font-size: 12px;
      letter-spacing: 0.04em;
      margin-bottom: 16px;
      font-family: Nunito, sans-serif;
      display: none;
    }

    .availability-banner {
      width: 100%;
      border: 1px solid rgba(212,175,55,0.35);
      background: rgba(212,175,55,0.08);
      color: #f7e7b3;
      padding: 10px 12px;
      font-size: 11px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      border-radius: 6px;
      margin-bottom: 8px;
      font-family: Nunito, sans-serif;
      display: none;
    }

    .footer-mark {
      margin-top: 38px;
      text-align: center;
      font-family: Orbitron, sans-serif;
      color: rgba(212,175,55,1);
      letter-spacing: 0.08em;
      font-size: 13px;
      line-height: 1.8;
    }
    .footer-copy {
      text-align: center;
      font-family: Orbitron, sans-serif;
      color: rgba(212,175,55,0.75);
      font-size: 12px;
      line-height: 1.8;
      margin-bottom: 12px;
    }
    .footer-links {
      display: flex;
      justify-content: center;
      gap: 14px;
      flex-wrap: wrap;
      margin-top: 2px;
      font-size: 12px;
    }
    .footer-links a { color: var(--skia-gold); text-decoration: none; }
    .footer-links .sep { color: rgba(212,175,55,0.4); }

    @media (max-width: 860px) {
      .wrap { padding: 24px 16px 48px; }
      .feature-page-title { font-size: 24px; }
      .pc-sidebar, .pc-sidebar-tab, .pc-sidebar-backdrop { display: none !important; }
    }
  </style>
</head>
<body>
  <div id="pcSidebarBackdrop" class="pc-sidebar-backdrop"></div>
  <button id="pcSidebarTab" class="pc-sidebar-tab" aria-label="Open navigation">
    <span class="pc-sidebar-tab-icon">☰</span>
  </button>
  <aside id="pcSidebar" class="pc-sidebar" aria-label="SKIA Forge navigation">
    <div class="pc-sidebar-logo">
      <img src="https://skia.ca/sidebar-logo.png" alt="SKIA" class="pc-sidebar-logo-img" />
      <span class="pc-sidebar-logo-tagline">She Knows It All</span>
    </div>
    <div class="pc-sidebar-divider"></div>
    <nav class="pc-sidebar-nav">
      <a class="pc-sidebar-btn" href="/forge">Forge Home</a>
      <a class="pc-sidebar-btn" href="/forge/platform">Product</a>
      <a class="pc-sidebar-btn" href="/docs/ENTERPRISE_READINESS_CHECKLIST.md">Enterprise</a>
      <a class="pc-sidebar-btn" href="/docs/PRICING_AND_PACKAGES.md">Pricing</a>
      <a class="pc-sidebar-btn" href="/resources">Resources</a>
      <div class="pc-sidebar-divider"></div>
      <a class="pc-sidebar-btn" href="https://skia.ca/login?returnTo=/forge/app">Sign In</a>
      <a class="pc-sidebar-btn" href="https://skia.ca/register?returnTo=/forge/app">Register</a>
      <a class="pc-sidebar-btn" href="/forge#windows">Download IDE</a>
    </nav>
  </aside>

  <div class="wrap">
    <section class="feature-page-content">
      <img src="https://skia.ca/sidebar-logo.png" alt="SKIA" class="feature-page-logo" />
      <div class="feature-page-header">
        <h1 class="feature-page-title">SKIA Forge</h1>
        <p class="feature-page-subtitle">She Knows It All - frontier-grade, eval-gated intelligence for real software delivery</p>
        <div class="hero-actions">
          <a class="feature-tab feature-tab--primary" href="https://skia.ca/login?returnTo=/forge/app">Sign In</a>
          <a class="feature-tab" href="https://skia.ca/register?returnTo=/forge/app">Register</a>
          <a class="feature-tab" href="https://github.com/AI-SKIA/skia/releases/latest" target="_blank" rel="noreferrer">Download App</a>
        </div>
      </div>
      <section class="value-section">${valueCards}</section>
      <section class="journey">
        <h2 class="journey-title">How Forge + SKIA Works</h2>
        <div class="journey-row"><span class="journey-step">1</span><span>Sign in on web for immediate access, or install desktop for full local workflow control.</span></div>
        <div class="journey-row"><span class="journey-step">2</span><span>Choose the right execution path: context, agent, SDLC, production, healing, and architecture.</span></div>
        <div class="journey-row"><span class="journey-step">3</span><span>Get structured outputs designed for real use, not generic draft text.</span></div>
      </section>
      <section class="journey">
        <h2 class="journey-title">Why Teams Choose SKIA</h2>
        <div class="journey-row"><span class="journey-step">A</span><span>Benchmark-aligned quality on your critical dimensions: coding, tools, reasoning, long context, vision, and TTS.</span></div>
        <div class="journey-row"><span class="journey-step">B</span><span>System-level maturity beyond model output: observability, routing invariants, health checks, and integration governance.</span></div>
        <div class="journey-row"><span class="journey-step">C</span><span>Truth-based release distribution: only published installers are shown for download.</span></div>
      </section>
      <div id="updateBanner" class="update-banner"></div>
      <div id="availabilityBanner" class="availability-banner"></div>
      <div class="download-grid">${cards}</div>
      <div class="download-actions">
        <a class="feature-tab" href="https://github.com/AI-SKIA/skia/releases/latest" target="_blank" rel="noreferrer">View release notes and assets</a>
      </div>
      <div class="download-instructions">
        <div class="download-instruction-row"><span class="download-step">1</span><span>Download the installer for your platform above.</span></div>
        <div class="download-instruction-row"><span class="download-step">2</span><span>Run the installer and follow the setup flow.</span></div>
        <div class="download-instruction-row"><span class="download-step">3</span><span>Open SKIA Forge and sign in with your account.</span></div>
        <div class="download-instruction-row"><span class="download-step">4</span><span>Desktop clients check for updates automatically.</span></div>
      </div>

      <div class="footer-mark">One ecosystem. One universe. All SKIA.</div>
      <div class="footer-copy">© 2026 SKIA Singularity Continuum. The future is an understatement.</div>
      <div class="footer-links">
        <a href="/resources">Resources</a>
        <span class="sep">|</span>
        <a href="/security">Security</a>
        <span class="sep">|</span>
        <a href="/contact">Contact &amp; Support</a>
      </div>
    </section>
  </div>
  <script>
    (function() {
      const sidebar = document.getElementById('pcSidebar');
      const tab = document.getElementById('pcSidebarTab');
      const backdrop = document.getElementById('pcSidebarBackdrop');
      if (sidebar && tab && backdrop) {
        const openSidebar = () => {
          sidebar.classList.add('pc-sidebar--open');
          backdrop.style.display = 'block';
        };
        const closeSidebar = () => {
          sidebar.classList.remove('pc-sidebar--open');
          backdrop.style.display = 'none';
        };
        tab.addEventListener('click', openSidebar);
        backdrop.addEventListener('click', closeSidebar);
        sidebar.addEventListener('click', (e) => {
          const target = e.target;
          if (target && target.tagName === 'A') closeSidebar();
        });
      }

      const updateBanner = document.getElementById('updateBanner');
      const availabilityBanner = document.getElementById('availabilityBanner');
      fetch('/api/app/version-check', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((payload) => {
          if (!payload || !updateBanner) return;
          if (!payload.updateAvailable || !payload.latestVersion) return;
          updateBanner.innerHTML =
            '<strong>Update available:</strong> v' +
            String(payload.latestVersion).replace(/^v/i, '') +
            ' (current v' +
            String(payload.currentVersion).replace(/^v/i, '') +
            '). Download the latest SKIA Forge installer below.';
          updateBanner.style.display = 'block';
        })
        .catch(() => {});

      const cards = Array.from(document.querySelectorAll('.download-card'));
      fetch('/api/app/release-assets', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((payload) => {
          if (!payload) return;
          const assets = new Map(
            Array.isArray(payload.assets)
              ? payload.assets
                  .filter((asset) => asset && typeof asset.name === 'string' && typeof asset.url === 'string')
                  .map((asset) => [asset.name, asset.url])
              : []
          );
          const files = new Set(Array.isArray(payload.files) ? payload.files : []);
          let visible = 0;
          cards.forEach((card) => {
            const file = card.getAttribute('data-file') || '';
            const supported = files.has(file);
            card.classList.toggle('download-card--hidden', !supported);
            if (!supported) return;
            const url = assets.get(file);
            if (url) card.setAttribute('href', url);
            visible += 1;
          });
          if (visible === 0) {
            cards.forEach((card) => card.classList.remove('download-card--hidden'));
          }
          if (!availabilityBanner) return;
          if (visible > 0) {
            availabilityBanner.textContent =
              'Only currently published installers are shown (' + String(visible) + ' available).';
            availabilityBanner.style.display = 'block';
          }
        })
        .catch(() => {
          cards.forEach((card) => card.classList.remove('download-card--hidden'));
        });
    })();
  </script>
</body>
</html>`;
}