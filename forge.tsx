"use client";

import { useEffect, useMemo, useState } from "react";
import BackButton from "../components/BackButton";
import PCSidebar from "../components/PCSidebar";
import Copyright from "../components/Copyright";

const RELEASE_PAGE = "https://github.com/AI-SKIA/skia/releases/latest";

const PLATFORMS = [
  { id: "windows", name: "Windows", version: "Windows 10/11", hint: "64-bit installer (.exe)" },
  { id: "mac-intel", name: "macOS (Intel)", version: "macOS 11+", hint: "Intel x64" },
  { id: "mac-arm", name: "macOS (Apple Silicon)", version: "macOS 11+ M1/M2/M3", hint: "Apple Silicon (M1/M2/M3)" },
  { id: "linux-appimage", name: "Linux", version: "Ubuntu, Fedora, Arch", hint: "AppImage (any distro)" },
];

type ReleaseAsset = {
  name: string;
  url: string;
};

type ReleaseAssetsApiResponse = {
  releasePage?: unknown;
  assets?: unknown;
};

function pickPlatformAsset(platformId: string, assets: ReleaseAsset[]): ReleaseAsset | null {
  const exe = assets.find((asset) => /\.exe$/i.test(asset.name));
  const dmgs = assets.filter((asset) => /\.dmg$/i.test(asset.name));
  const appImage = assets.find((asset) => /\.appimage$/i.test(asset.name));

  if (platformId === "windows") return exe ?? null;
  if (platformId === "mac-intel") {
    return (
      dmgs.find((asset) => /(x64|intel)/i.test(asset.name)) ||
      dmgs.find((asset) => !/(arm64|aarch64|apple)/i.test(asset.name)) ||
      null
    );
  }
  if (platformId === "mac-arm") {
    return dmgs.find((asset) => /(arm64|aarch64|apple)/i.test(asset.name)) || null;
  }
  if (platformId === "linux-appimage") return appImage ?? null;
  return null;
}

export default function ForgeHomePage() {
  const [assets, setAssets] = useState<ReleaseAsset[]>([]);
  const [releasePage, setReleasePage] = useState(RELEASE_PAGE);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/forge/release-assets", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: ReleaseAssetsApiResponse | null) => {
        if (cancelled || !payload) return;
        if (typeof payload.releasePage === "string" && payload.releasePage) setReleasePage(payload.releasePage);
        if (Array.isArray(payload.assets)) {
          const parsed = payload.assets
            .filter(
              (asset): asset is ReleaseAsset =>
                Boolean(asset) &&
                typeof (asset as ReleaseAsset).name === "string" &&
                typeof (asset as ReleaseAsset).url === "string"
            )
            .map((asset) => ({ name: asset.name, url: asset.url }));
          setAssets(parsed);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const platformLinks = useMemo(() => {
    const links: Record<string, string> = {};
    for (const platform of PLATFORMS) {
      links[platform.id] = pickPlatformAsset(platform.id, assets)?.url || releasePage;
    }
    return links;
  }, [assets, releasePage]);

  const checksumUrl =
    assets.find((asset) => /^SHA256SUMS\.txt$/i.test(asset.name))?.url || releasePage;

  return (
    <main className="skia-page">
      <div className="fixed top-6 left-6 z-50"><BackButton /></div>
      <PCSidebar />

      <section className="dashboard-content">
        <section className="feature-page-content" style={{ maxWidth: 840, width: "100%" }}>
          <img src="/sidebar-logo.png" alt="SKIA" className="feature-page-logo" />
          <div className="feature-page-header">
            <h1 className="feature-page-title">SKIA Forge</h1>
            <p className="feature-page-subtitle">She Knows It All - frontier-grade, eval-gated intelligence for real software delivery</p>
          </div>

          <div className="download-web-option">
            <a href="/login?returnTo=/forge/app" className="feature-tab feature-tab--active">Sign In</a>
            <a href="/register?returnTo=/forge/app" className="feature-tab feature-tab--active">Register</a>
            <a href={platformLinks.windows || releasePage} className="feature-tab feature-tab--active" target="_blank" rel="noreferrer">Download App</a>
          </div>

          <div className="download-grid">
            {PLATFORMS.map((p) => (
              <a key={p.id} href={platformLinks[p.id] || releasePage} className="download-card" target="_blank" rel="noreferrer">
                <div className="download-card-icon">⬢</div>
                <div className="download-card-name">{p.name}</div>
                <div className="download-card-version">{p.version}</div>
                <div className="download-card-hint">{p.hint}</div>
                <div className="download-card-btn">Download</div>
              </a>
            ))}
          </div>

          <div className="download-instructions">
            <div className="download-instruction-row"><span className="download-step">1</span><span>Download the installer for your platform.</span></div>
            <div className="download-instruction-row"><span className="download-step">2</span><span>Run the installer and follow setup.</span></div>
            <div className="download-instruction-row"><span className="download-step">3</span><span>Sign in and use Forge on desktop or web.</span></div>
          </div>

          <div className="download-web-option">
            <a href={checksumUrl} className="feature-tab feature-tab--active" target="_blank" rel="noreferrer">Download SHA256 checksums</a>
            <a href={releasePage} className="feature-tab feature-tab--active" target="_blank" rel="noreferrer">View release notes and assets</a>
          </div>

          {/* Footer */}
          <div style={{ marginTop: "60px", textAlign: "center", fontFamily: "Orbitron, sans-serif", color: "rgba(212,175,55,0.85)", fontSize: "12px", lineHeight: "1.8" }}>
            <div style={{ marginBottom: "6px", fontSize: "13px", color: "rgba(212,175,55,1)" }}>
              One ecosystem. One universe. All SKIA.
            </div>
            <div style={{ marginBottom: "12px", color: "rgba(212,175,55,0.75)" }}>
              © 2026 SKIA Singularity Continuum. The future is an understatement.
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: "14px", flexWrap: "wrap" }}>
              <a href="https://forge.skia.ca/resources" style={{ color: "#d4af37", textDecoration: "none" }}>Resources</a>
              <span style={{ color: "rgba(212,175,55,0.4)" }}>|</span>
              <a href="https://forge.skia.ca/security" style={{ color: "#d4af37", textDecoration: "none" }}>Security</a>
              <span style={{ color: "rgba(212,175,55,0.4)" }}>|</span>
              <a href="https://forge.skia.ca/contact" style={{ color: "#d4af37", textDecoration: "none" }}>Contact & Support</a>
            </div>
          </div>
        </section>
      </section>

      <Copyright />
    </main>
  );
}
