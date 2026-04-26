type DownloadPlatform = {
  id: string;
  name: string;
  version: string;
  icon: string;
  hint: string;
  file: string;
};

const PLATFORMS: DownloadPlatform[] = [
  {
    id: "windows",
    name: "Windows",
    version: "Windows 10/11",
    icon: "windows",
    hint: "64-bit installer (.exe)",
    file: "SKIA-Desktop-windows-x64.exe"
  },
  {
    id: "mac-intel",
    name: "macOS (Intel)",
    version: "macOS 11+",
    icon: "apple",
    hint: "Intel x64",
    file: "SKIA-Desktop-mac-x64.dmg"
  },
  {
    id: "mac-arm",
    name: "macOS (Apple Silicon)",
    version: "macOS 11+ M1/M2/M3",
    icon: "apple",
    hint: "Apple Silicon (M1/M2/M3)",
    file: "SKIA-Desktop-mac-arm64.dmg"
  },
  {
    id: "linux-appimage",
    name: "Linux",
    version: "Ubuntu, Fedora, Arch",
    icon: "linux",
    hint: "AppImage (any distro)",
    file: "SKIA-Desktop-linux-x64.AppImage"
  },
  {
    id: "linux-deb",
    name: "Linux (.deb)",
    version: "Ubuntu / Debian",
    icon: "linux",
    hint: "Deb package",
    file: "SKIA-Desktop-linux-x64.deb"
  },
  {
    id: "linux-rpm",
    name: "Linux (.rpm)",
    version: "Fedora / RHEL",
    icon: "linux",
    hint: "RPM package",
    file: "SKIA-Desktop-linux-x64.rpm"
  }
];

export function renderDownloadHtml(releaseBase: string): string {
  const cards = PLATFORMS.map(
    (p) => `
      <a id="${p.id}" class="download-card" data-file="${p.file}" href="${releaseBase}/${p.file}">
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
  <meta property="og:url" content="https://skia.ca/forge" />
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
      width: 280px;
      height: 100dvh;
      z-index: 200;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: linear-gradient(160deg, rgba(8, 4, 0, 0.97) 0%, rgba(15, 8, 0, 0.98) 40%, rgba(10, 5, 0, 0.97) 100%);
      border-right: 1px solid rgba(212,175,55,0.2);
      box-shadow: 8px 0 48px rgba(0, 0, 0, 0.7), 2px 0 0 rgba(212,175,55,0.06);
      transform: translateX(-100%);
      transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .pc-sidebar--open { transform: translateX(0); }
    .pc-sidebar-logo {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px 24px 24px 24px;
      gap: 10px;
    }
    .pc-sidebar-logo-img { width: 90px; filter: drop-shadow(0 0 12px rgba(212,175,55,0.3)); }
    .pc-sidebar-logo-tagline {
      font-family: Orbitron, sans-serif;
      font-size: 9px;
      letter-spacing: 3px;
      color: rgba(212,175,55,0.5);
      text-transform: uppercase;
    }
    .pc-sidebar-divider {
      height: 1px;
      margin: 4px 24px 12px 24px;
      background: linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.25) 30%, rgba(212,175,55,0.25) 70%, transparent 100%);
      flex-shrink: 0;
    }
    .pc-sidebar-nav {
      display: flex;
      flex-direction: column;
      padding: 8px 20px;
      gap: 4px;
      flex: 1;
    }
    .pc-sidebar-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 9px 20px;
      font-family: Orbitron, sans-serif;
      font-size: 11px;
      font-weight: 400;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: rgba(212,175,55,0.75);
      text-decoration: none;
      border: 1px solid transparent;
      border-radius: 6px;
      background: transparent;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
    }
    .pc-sidebar-btn::before {
      content: '';
      position: absolute;
      left: 0;
      top: 20%;
      height: 60%;
      width: 2px;
      background: rgba(212,175,55,0);
      border-radius: 2px;
      transition: background 0.2s ease;
    }
    .pc-sidebar-btn:hover {
      color: var(--skia-gold);
      background: rgba(212,175,55,0.07);
      border-color: rgba(212,175,55,0.18);
      transform: translateX(3px);
      box-shadow: 0 0 16px rgba(212,175,55,0.08);
    }
    .pc-sidebar-btn:hover::before { background: rgba(212,175,55,0.7); }

    .wrap {
      width: 100%;
      max-width: 760px;
      margin: 0 auto;
      padding: 48px 24px 64px;
    }
    .feature-page-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .feature-page-logo {
      width: 160px;
      height: auto;
      object-fit: contain;
      filter: drop-shadow(0 0 24px rgba(212,175,55,0.4)) drop-shadow(0 0 48px rgba(212,175,55,0.15));
    }
    .feature-page-header { text-align: center; }
    .feature-page-title {
      margin: 0 0 6px;
      font-size: 28px;
      font-weight: 400;
      color: var(--skia-gold);
      letter-spacing: 3px;
      text-transform: uppercase;
      text-shadow: 0 0 24px rgba(212,175,55,0.25);
    }
    .feature-page-subtitle {
      margin: 0;
      font-family: Nunito, Arial, sans-serif;
      font-size: 14px;
      color: rgba(255,255,255,0.55);
      letter-spacing: 1px;
    }
    .hero-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: center;
      margin-top: 12px;
    }

    .download-grid {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 16px;
      margin-top: 8px;
    }
    .download-card {
      padding: 18px;
      border-radius: 10px;
      background: var(--skia-card-bg);
      border: 1px solid var(--skia-border);
      text-decoration: none;
      color: inherit;
      transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .download-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 32px rgba(212,175,55,0.15);
      border-color: rgba(212,175,55,0.55);
    }
    .download-card--hidden { display: none; }
    .download-card-icon {
      width: 28px;
      height: 28px;
      border: 1px solid rgba(212,175,55,0.35);
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 4px;
      background: rgba(212,175,55,0.08);
    }
    .download-card-icon.windows::before { content: "W"; font-size: 12px; color: var(--skia-gold); }
    .download-card-icon.apple::before { content: "A"; font-size: 12px; color: var(--skia-gold); }
    .download-card-icon.linux::before { content: "L"; font-size: 12px; color: var(--skia-gold); }
    .download-card-name {
      font-size: 14px;
      color: var(--skia-gold);
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .download-card-version {
      font-family: Nunito, Arial, sans-serif;
      font-size: 12px;
      color: rgba(212,175,55,0.65);
    }
    .download-card-hint {
      font-family: Nunito, Arial, sans-serif;
      font-size: 12px;
      color: var(--skia-text-soft);
    }
    .download-card-btn {
      margin-top: 8px;
      font-size: 11px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--skia-gold);
    }

    .download-actions {
      width: 100%;
      display: flex;
      justify-content: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 8px;
    }
    .feature-tab {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 8px 18px;
      border-radius: 6px;
      border: 1px solid rgba(212,175,55,0.2);
      background: transparent;
      color: rgba(212,175,55,0.8);
      text-decoration: none;
      font-size: 10px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      transition: all 0.2s ease;
    }
    .feature-tab:hover {
      border-color: rgba(212,175,55,0.45);
      color: var(--skia-gold);
      background: rgba(212,175,55,0.08);
    }

    .download-instructions {
      width: 100%;
      margin-top: 6px;
      border: 1px solid rgba(212,175,55,0.2);
      border-radius: 10px;
      background: rgba(0,0,0,0.45);
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .download-instruction-row {
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: Nunito, Arial, sans-serif;
      color: var(--skia-text-soft);
      font-size: 13px;
      line-height: 1.4;
    }
    .download-step {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      border: 1px solid rgba(212,175,55,0.35);
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--skia-gold);
      font-size: 11px;
      font-family: Orbitron, sans-serif;
    }

    .update-banner {
      width: 100%;
      margin-top: 4px;
      border: 1px solid rgba(212,175,55,0.35);
      background: rgba(212,175,55,0.08);
      color: #f7e7b3;
      padding: 10px 12px;
      font-size: 11px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      display: none;
    }
    .update-banner strong { color: var(--skia-gold); }
    .availability-banner {
      width: 100%;
      border: 1px solid rgba(212,175,55,0.35);
      background: rgba(212,175,55,0.08);
      color: #f7e7b3;
      padding: 10px 12px;
      font-size: 11px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
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
      <a class="pc-sidebar-btn" href="/docs/README.md">Resources</a>
      <div class="pc-sidebar-divider"></div>
      <a class="pc-sidebar-btn" href="/forge/app">Sign In</a>
      <a class="pc-sidebar-btn" href="/forge/app">Register</a>
      <a class="pc-sidebar-btn" href="/forge#windows">Download IDE</a>
    </nav>
  </aside>

  <div class="wrap">
    <section class="feature-page-content">
      <img src="https://skia.ca/sidebar-logo.png" alt="SKIA" class="feature-page-logo" />
      <div class="feature-page-header">
        <h1 class="feature-page-title">Download SKIA Forge</h1>
        <p class="feature-page-subtitle">She Knows It All - available on every platform</p>
        <div class="hero-actions">
          <a class="feature-tab" href="/forge/app">Sign In</a>
          <a class="feature-tab" href="/forge/app">Register</a>
          <a class="feature-tab" href="/forge#windows">Download App</a>
        </div>
      </div>
      <div id="updateBanner" class="update-banner"></div>
      <div id="availabilityBanner" class="availability-banner"></div>
      <div class="download-grid">${cards}</div>
      <div class="download-actions">
        <a class="feature-tab" href="${releaseBase}/SHA256SUMS.txt">Download SHA256 checksums</a>
        <a class="feature-tab" href="https://github.com/AI-SKIA/skia/releases/latest" target="_blank" rel="noreferrer">View release notes and assets</a>
      </div>
      <div class="download-instructions">
        <div class="download-instruction-row"><span class="download-step">1</span><span>Download the installer for your platform above.</span></div>
        <div class="download-instruction-row"><span class="download-step">2</span><span>Run the installer and follow the setup flow.</span></div>
        <div class="download-instruction-row"><span class="download-step">3</span><span>Open SKIA Forge and sign in with your account.</span></div>
        <div class="download-instruction-row"><span class="download-step">4</span><span>Desktop clients check for updates automatically.</span></div>
        <div class="download-instruction-row"><span class="download-step">5</span><span>Verify installer hash from SHA256SUMS before install.</span></div>
      </div>

      <div class="footer-mark">One ecosystem. One universe. All SKIA.</div>
      <div class="footer-copy">© 2026 SKIA Singularity Continuum. The future is an understatement.</div>
      <div class="footer-links">
        <a href="/docs/README.md">Resources</a>
        <span class="sep">|</span>
        <a href="/docs/SECURITY_GUIDE.md">Security</a>
        <span class="sep">|</span>
        <a href="/docs/SUPPORT.md">Contact & Support</a>
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
          const files = new Set(Array.isArray(payload.files) ? payload.files : []);
          let visible = 0;
          cards.forEach((card) => {
            const file = card.getAttribute('data-file') || '';
            const supported = files.has(file);
            card.classList.toggle('download-card--hidden', !supported);
            if (supported) visible += 1;
          });
          if (!availabilityBanner) return;
          if (visible === 0) {
            availabilityBanner.textContent = 'No installer assets are published yet. Publish a release first.';
            availabilityBanner.style.display = 'block';
            return;
          }
          availabilityBanner.textContent =
            'Only currently published installers are shown (' + String(visible) + ' available).';
          availabilityBanner.style.display = 'block';
        })
        .catch(() => {
          cards.forEach((card) => card.classList.add('download-card--hidden'));
          if (!availabilityBanner) return;
          availabilityBanner.textContent = 'Installer availability check failed. No unverified downloads shown.';
          availabilityBanner.style.display = 'block';
        });
    })();
  </script>
</body>
</html>`;
}
