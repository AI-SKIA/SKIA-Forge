type DownloadPlatform = {
  name: string;
  detail: string;
  file: string;
  badge: string;
};

const PLATFORMS: DownloadPlatform[] = [
  { name: "Windows", detail: "Windows 10/11 x64", file: "SKIA-Desktop-windows-x64.exe", badge: ".exe" },
  { name: "macOS (Intel)", detail: "macOS 11+ x64", file: "SKIA-Desktop-mac-x64.dmg", badge: ".dmg" },
  { name: "macOS (Apple Silicon)", detail: "macOS 11+ arm64", file: "SKIA-Desktop-mac-arm64.dmg", badge: ".dmg" },
  { name: "Linux (AppImage)", detail: "Ubuntu/Fedora/Arch", file: "SKIA-Desktop-linux-x64.AppImage", badge: ".AppImage" },
  { name: "Linux (Debian)", detail: "Debian/Ubuntu", file: "SKIA-Desktop-linux-x64.deb", badge: ".deb" },
  { name: "Linux (RPM)", detail: "RHEL/Fedora", file: "SKIA-Desktop-linux-x64.rpm", badge: ".rpm" }
];

export function renderDownloadHtml(releaseBase: string): string {
  const cards = PLATFORMS.map(
    (p) => `
      <a class="card" href="${releaseBase}/${p.file}">
        <div class="card-top">
          <div class="platform">${p.name}</div>
          <span class="badge">${p.badge}</span>
        </div>
        <div class="detail">${p.detail}</div>
        <div class="action">Download ${p.file}</div>
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
  <title>SKIA Forge | The Sovereign AI Coding Platform</title>
  <meta
    name="description"
    content="SKIA Forge is the sovereign AI development platform: one intelligence across desktop, web, mobile, and voice with governed orchestration, structured outputs, and enterprise-ready controls."
  />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="SKIA Forge" />
  <meta property="og:title" content="SKIA Forge | The Sovereign AI Coding Platform" />
  <meta
    property="og:description"
    content="SKIA Forge is the sovereign AI development platform: one intelligence across desktop, web, mobile, and voice with governed orchestration, structured outputs, and enterprise-ready controls."
  />
  <meta property="og:url" content="https://skia.ca/download" />
  <meta property="og:image" content="https://skia.ca/og/skia-forge-preview.svg" />
  <meta property="og:image:secure_url" content="https://skia.ca/og/skia-forge-preview.svg" />
  <meta property="og:image:type" content="image/svg+xml" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="SKIA Forge - The Sovereign AI Coding Platform" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="SKIA Forge | The Sovereign AI Coding Platform" />
  <meta
    name="twitter:description"
    content="SKIA Forge is the sovereign AI development platform: one intelligence across desktop, web, mobile, and voice with governed orchestration, structured outputs, and enterprise-ready controls."
  />
  <meta name="twitter:image" content="https://skia.ca/og/skia-forge-preview.svg" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800&display=swap');
    @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600&display=swap');

    :root {
      --skia-bg-primary: #0a0a0a;
      --skia-bg-card: #111111;
      --skia-gold: #d4af37;
      --skia-gold-muted: #a8892a;
      --skia-line: rgba(212, 175, 55, 0.28);
      --skia-text-soft: rgba(248, 239, 211, 0.86);
      --skia-shadow-gold: 0 0 16px rgba(212, 175, 55, 0.14);
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      background:
        radial-gradient(circle at 50% 8%, rgba(212, 175, 55, 0.2), rgba(10, 10, 10, 0) 36%),
        radial-gradient(circle at 20% 72%, rgba(212, 175, 55, 0.08), rgba(10, 10, 10, 0) 34%),
        var(--skia-bg-primary);
      color: var(--skia-gold);
      font-family: Orbitron, Segoe UI, Arial, sans-serif;
      min-height: 100vh;
    }

    .wrap { max-width: 1120px; margin: 0 auto; padding: 28px 20px 58px; }
    .top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--skia-line);
    }
    .brand {
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #f7e7b3;
      text-shadow: var(--skia-shadow-gold);
    }
    .nav-left, .nav-right { display: flex; gap: 8px; flex-wrap: wrap; }
    .nav-left a, .nav-right a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 36px;
      padding: 9px 20px;
      font-family: 'Orbitron', sans-serif;
      font-size: 11px;
      font-weight: 400;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: rgba(212,175,55,0.75);
      text-decoration: none;
      border: 1px solid transparent;
      border-radius: 6px;
      background: transparent;
      transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .nav-left a:hover, .nav-right a:hover {
      color: #d4af37;
      background: rgba(212,175,55,0.07);
      border-color: rgba(212,175,55,0.18);
      box-shadow: 0 0 16px rgba(212,175,55,0.08);
    }

    .hero {
      background:
        linear-gradient(180deg, rgba(20, 15, 5, 0.92), rgba(8, 8, 8, 0.94));
      border: 1px solid var(--skia-line);
      box-shadow: var(--skia-shadow-gold);
      padding: 30px;
      position: relative;
      overflow: hidden;
    }
    .hero::before {
      content: "";
      position: absolute;
      top: 72px;
      left: 0;
      width: 100%;
      height: 1px;
      background: linear-gradient(90deg, rgba(212,175,55,0), rgba(212,175,55,0.6), rgba(212,175,55,0));
      pointer-events: none;
    }
    .hero::after {
      content: "";
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      top: 132px;
      width: 70%;
      height: 1px;
      background: linear-gradient(90deg, rgba(212,175,55,0), rgba(212,175,55,0.42), rgba(212,175,55,0));
      pointer-events: none;
    }

    .brand-stage {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-bottom: 18px;
      padding-bottom: 16px;
      border-bottom: 1px solid rgba(212, 175, 55, 0.18);
    }
    .brand-stage img {
      width: 112px;
      height: auto;
      filter: drop-shadow(0 0 8px rgba(212, 175, 55, 0.35));
    }
    .brand-stage .sig {
      color: #f2dc9a;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-size: 12px;
      text-shadow: var(--skia-shadow-gold);
    }

    h1 {
      margin: 0 0 10px;
      font-size: 38px;
      line-height: 1.16;
      color: #fff2c8;
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }
    p {
      margin: 0;
      color: var(--skia-text-soft);
      line-height: 1.7;
      font-size: 14px;
      font-family: Nunito, Segoe UI, Arial, sans-serif;
    }
    .cta-row { margin-top: 18px; display: flex; gap: 10px; flex-wrap: wrap; }
    .btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #d4af37;
      color: #d4af37;
      background: linear-gradient(180deg, rgba(26, 15, 0, 0.88) 0%, rgba(13, 9, 0, 0.96) 100%);
      padding: 12px 24px;
      min-height: 50px;
      text-decoration: none;
      border-radius: 14px;
      text-transform: uppercase;
      letter-spacing: 2px;
      font-size: 16px;
      font-family: 'Orbitron', sans-serif;
      transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
    }
    .btn:hover {
      background: linear-gradient(180deg, rgba(42, 24, 0, 0.94) 0%, rgba(18, 12, 0, 0.98) 100%);
      border-color: #d4af37;
      box-shadow: 0 0 18px rgba(212,175,55,0.18), inset 0 0 0 1px rgba(212,175,55,0.12);
      transform: translateY(-1px);
    }
    .btn.primary {
      background: rgba(212,175,55,0.1);
      border-color: rgba(212,175,55,0.55);
      box-shadow: 0 0 20px rgba(212,175,55,0.1), inset 0 0 12px rgba(212,175,55,0.04);
    }

    .links { margin-top: 14px; }
    .links a {
      color: var(--skia-gold);
      text-decoration: none;
      margin-right: 14px;
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .links a:hover { color: #f7e7b3; }

    .grid {
      margin-top: 22px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
      gap: 14px;
    }
    .card {
      display: block;
      text-decoration: none;
      color: inherit;
      background: linear-gradient(180deg, rgba(18, 14, 6, 0.86), rgba(10, 10, 10, 0.92));
      border: 1px solid var(--skia-line);
      border-radius: 0;
      padding: 14px;
      transition: border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease;
    }
    .card:hover {
      border-color: rgba(212, 175, 55, 0.72);
      box-shadow: var(--skia-shadow-gold);
      transform: translateY(-1px);
    }
    .card-top { display: flex; justify-content: space-between; align-items: center; }
    .platform {
      font-weight: 600;
      color: #f7e7b3;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-size: 14px;
    }
    .badge {
      font-size: 10px;
      color: var(--skia-gold);
      border: 1px solid var(--skia-line);
      border-radius: 0;
      padding: 3px 8px;
      letter-spacing: 0.1em;
    }
    .detail {
      margin-top: 8px;
      color: var(--skia-text-soft);
      font-size: 13px;
      font-family: Nunito, Segoe UI, Arial, sans-serif;
    }
    .action {
      margin-top: 12px;
      color: var(--skia-gold);
      font-size: 12px;
      word-break: break-all;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .note {
      margin-top: 16px;
      font-size: 12px;
      color: var(--skia-gold-muted);
      letter-spacing: 0.07em;
      text-transform: uppercase;
    }
    .nav-shell { display: flex; align-items: center; gap: 18px; }
    .hero-shot {
      margin-top: 18px;
      border: 1px solid var(--skia-line);
      border-radius: 0;
      overflow: hidden;
      background: rgba(15, 13, 0, 0.46);
      color: var(--skia-text-soft);
      padding: 14px;
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .footer-mark {
      margin-top: 22px;
      text-align: center;
      color: #d4af37;
      letter-spacing: 0.08em;
      font-size: 13px;
    }
    .footer-copy {
      margin-top: 4px;
      text-align: center;
      color: #ffffff;
      font-size: 12px;
      letter-spacing: 0.03em;
      opacity: 0.72;
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
    .pc-sidebar-tab-icon { font-size: 20px; color: #d4af37; line-height: 1; }
    .pc-sidebar-tab-text { display: none; }
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
      font-family: 'Orbitron', sans-serif;
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
      font-family: 'Orbitron', sans-serif;
      font-size: 11px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: rgba(212,175,55,0.75);
      text-decoration: none;
      border: 1px solid transparent;
      border-radius: 6px;
      transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
    }
    .pc-sidebar-btn:hover {
      color: #d4af37;
      background: rgba(212,175,55,0.07);
      border-color: rgba(212,175,55,0.18);
      transform: translateX(3px);
      box-shadow: 0 0 16px rgba(212,175,55,0.08);
    }

    @media (max-width: 860px) {
      .top, .nav-shell { flex-direction: column; align-items: flex-start; gap: 10px; }
      h1 { font-size: 28px; }
      .pc-sidebar, .pc-sidebar-tab, .pc-sidebar-backdrop { display: none !important; }
    }
  </style>
</head>
<body>
  <div id="pcSidebarBackdrop" class="pc-sidebar-backdrop"></div>
  <button id="pcSidebarTab" class="pc-sidebar-tab" aria-label="Open navigation">
    <span class="pc-sidebar-tab-icon">☰</span>
    <span class="pc-sidebar-tab-text">MENU</span>
  </button>
  <aside id="pcSidebar" class="pc-sidebar" aria-label="SKIA navigation">
    <div class="pc-sidebar-logo">
      <img src="https://skia.ca/sidebar-logo.png" alt="SKIA" class="pc-sidebar-logo-img" />
      <span class="pc-sidebar-logo-tagline">She Knows It All</span>
    </div>
    <div class="pc-sidebar-divider"></div>
    <nav class="pc-sidebar-nav">
      <a class="pc-sidebar-btn" href="/">Home</a>
      <a class="pc-sidebar-btn" href="/forge/platform">Dashboard</a>
      <a class="pc-sidebar-btn" href="https://skia.ca/chat">Chat</a>
      <a class="pc-sidebar-btn" href="https://skia.ca/image">Image</a>
      <a class="pc-sidebar-btn" href="https://skia.ca/video">Video</a>
      <a class="pc-sidebar-btn" href="https://skia.ca/settings">Settings</a>
      <div class="pc-sidebar-divider"></div>
      <a class="pc-sidebar-btn" href="https://skia.ca/login">Login</a>
      <a class="pc-sidebar-btn" href="https://skia.ca/register">Register</a>
    </nav>
  </aside>
  <div class="wrap">
    <div class="top">
      <div class="brand">SKIA</div>
      <div class="nav-shell">
        <div class="nav-left">
          <a href="/forge/platform">Product</a>
          <a href="/docs/ENTERPRISE_READINESS_CHECKLIST.md">Enterprise</a>
          <a href="/docs/PRICING_AND_PACKAGES.md">Pricing</a>
          <a href="/docs/README.md">Resources</a>
        </div>
        <div class="nav-right">
          <a href="https://skia.ca/login">Sign in</a>
          <a href="https://skia.ca/register">Register</a>
          <a href="/download">Download</a>
        </div>
      </div>
    </div>
    <section class="hero">
      <div class="brand-stage">
        <img src="https://skia.ca/sidebar-logo.png" alt="SKIA logo" />
        <div class="sig">She Knows It All</div>
      </div>
      <h1>SKIA Forge: one sovereign intelligence for governed AI development.</h1>
      <p>From desktop to web, SKIA delivers structured, production-grade output with orchestration, policy controls, and enterprise-ready reliability.</p>
      <div class="cta-row">
        <a class="btn primary" href="https://skia.ca/register">Get Started</a>
        <a class="btn" href="https://skia.ca/login">Sign In</a>
        <a class="btn" href="/download">Download IDE</a>
      </div>
      <div class="links">
        <a href="${releaseBase}/SHA256SUMS.txt">SHA256 checksums</a>
        <a href="https://github.com/AI-SKIA/skia/releases/latest">Release notes</a>
      </div>
      <div class="hero-shot">SKIA Forge control-plane demo: governance modes, orchestration decisions, and integration probes available at <strong>/forge/platform</strong>.</div>
      <div class="grid">${cards}</div>
      <div class="note">Tip: verify installer hashes before distribution in enterprise environments.</div>
      <div class="footer-mark">One ecosystem. One universe. All SKIA.</div>
      <div class="footer-copy">© 2026 SKIA Singularity Continuum. The future is an understatement.</div>
    </section>
  </div>
  <script>
    (function() {
      const sidebar = document.getElementById('pcSidebar');
      const tab = document.getElementById('pcSidebarTab');
      const backdrop = document.getElementById('pcSidebarBackdrop');
      if (!sidebar || !tab || !backdrop) return;
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
    })();
  </script>
</body>
</html>`;
}
