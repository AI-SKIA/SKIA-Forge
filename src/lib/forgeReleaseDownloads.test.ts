import assert from "node:assert/strict";
import test from "node:test";
import {
  artifactFileNameForPlatform,
  buildGithubLatestDownloadUrl,
  clearForgeReleaseCatalogCache,
  parseElectronLatestYml,
  pickReleaseAssetUrlForPlatform,
  resolveForgeReleaseCatalog,
  resolvePlatformDownloadUrl,
  type ForgeReleaseCatalog
} from "./forgeReleaseDownloads.js";

const SAMPLE_YML = `version: 1.0.49
files:
  - url: SKIA-FORGE-Setup-1.0.49-win-x64.exe
path: SKIA-FORGE-Setup-1.0.49-win-x64.exe
sha512: abc
`;

test("parseElectronLatestYml extracts version and installer path", () => {
  const parsed = parseElectronLatestYml(SAMPLE_YML);
  assert.deepEqual(parsed, {
    version: "1.0.49",
    path: "SKIA-FORGE-Setup-1.0.49-win-x64.exe"
  });
});

test("artifactFileNameForPlatform matches electron-builder artifactName templates", () => {
  assert.equal(artifactFileNameForPlatform("windows", "1.0.49"), "SKIA-FORGE-Setup-1.0.49-win-x64.exe");
  assert.equal(artifactFileNameForPlatform("mac-intel", "1.0.49"), "SKIA-FORGE-1.0.49-mac-x64.dmg");
  assert.equal(artifactFileNameForPlatform("mac-arm", "1.0.49"), "SKIA-FORGE-1.0.49-mac-arm64.dmg");
  assert.equal(artifactFileNameForPlatform("linux-appimage", "1.0.49"), "SKIA-FORGE-1.0.49-linux-x64.AppImage");
});

test("pickReleaseAssetUrlForPlatform prefers Windows setup exe", () => {
  const assets = [
    { name: "latest.yml", url: "https://example.com/latest.yml" },
    { name: "SKIA-FORGE-Setup-1.0.49-win-x64.exe", url: "https://example.com/setup.exe" }
  ];
  assert.equal(
    pickReleaseAssetUrlForPlatform("windows", assets),
    "https://example.com/setup.exe"
  );
});

test("resolvePlatformDownloadUrl uses releases/latest for published Windows installer", () => {
  const catalog: ForgeReleaseCatalog = {
    latestVersion: "1.0.49",
    latestTag: "v1.0.49",
    files: ["SKIA-FORGE-Setup-1.0.49-win-x64.exe"],
    assets: [
      {
        name: "SKIA-FORGE-Setup-1.0.49-win-x64.exe",
        url: "https://github.com/AI-SKIA/SKIA-Forge/releases/latest/download/SKIA-FORGE-Setup-1.0.49-win-x64.exe"
      }
    ],
    source: "electron-latest-yml"
  };
  assert.equal(
    resolvePlatformDownloadUrl(catalog, "windows", "AI-SKIA/SKIA-Forge"),
    buildGithubLatestDownloadUrl("AI-SKIA/SKIA-Forge", "SKIA-FORGE-Setup-1.0.49-win-x64.exe")
  );
});

test("resolveForgeReleaseCatalog uses latest.yml when GitHub API is unavailable", async () => {
  clearForgeReleaseCatalogCache();
  const fetchFn = async (url: string | URL) => {
    const href = String(url);
    if (href.includes("api.github.com")) {
      return new Response("rate limited", { status: 403 });
    }
    if (href.endsWith("/latest/download/latest.yml")) {
      return new Response(SAMPLE_YML, { status: 200 });
    }
    return new Response("not found", { status: 404 });
  };

  const catalog = await resolveForgeReleaseCatalog({
    repo: "AI-SKIA/SKIA-Forge",
    releaseTagFallback: "v1.0.0",
    fetchFn: fetchFn as typeof fetch
  });

  assert.equal(catalog.source, "electron-latest-yml");
  assert.equal(catalog.latestVersion, "1.0.49");
  assert.equal(
    resolvePlatformDownloadUrl(catalog, "windows", "AI-SKIA/SKIA-Forge"),
    buildGithubLatestDownloadUrl("AI-SKIA/SKIA-Forge", "SKIA-FORGE-Setup-1.0.49-win-x64.exe")
  );
  clearForgeReleaseCatalogCache();
});

test("resolvePlatformDownloadUrl returns null for mac when no dmg assets exist", () => {
  const catalog: ForgeReleaseCatalog = {
    latestVersion: "1.0.49",
    latestTag: "v1.0.49",
    files: ["SKIA-FORGE-Setup-1.0.49-win-x64.exe"],
    assets: [{ name: "SKIA-FORGE-Setup-1.0.49-win-x64.exe", url: "https://example.com/setup.exe" }],
    source: "electron-latest-yml"
  };
  assert.equal(resolvePlatformDownloadUrl(catalog, "mac-arm", "AI-SKIA/SKIA-Forge"), null);
});
