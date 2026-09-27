export type DownloadPlatformId = "windows" | "mac-intel" | "mac-arm" | "linux-appimage";

export type ForgeReleaseAsset = { name: string; url: string; sha512?: string };

export type ElectronManifestFile = { url: string; sha512: string };

export type ElectronLatestManifest = {
  version: string;
  path: string;
  sha512: string | null;
  files: ElectronManifestFile[];
};

export type ForgeReleaseCatalog = {
  latestVersion: string | null;
  latestTag: string | null;
  files: string[];
  assets: ForgeReleaseAsset[];
  source: "github-api" | "github-releases-list" | "electron-latest-yml" | "env" | "none";
};

export type ForgeReleaseConfig = {
  repo: string;
  releaseTagFallback: string;
  latestVersionEnv?: string;
  githubToken?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
};

const CACHE_TTL_MS = 300_000;

type CatalogCache = {
  atMs: number;
  catalog: ForgeReleaseCatalog;
};

let catalogCache: CatalogCache | null = null;

export function normalizeSemver(version: string): string {
  return version.trim().replace(/^v/i, "");
}

export function compareSemver(aRaw: string, bRaw: string): number {
  const a = normalizeSemver(aRaw).split(".").map((part) => Number(part.replace(/\D.*/, "")) || 0);
  const b = normalizeSemver(bRaw).split(".").map((part) => Number(part.replace(/\D.*/, "")) || 0);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

export function toReleaseTag(version: string): string {
  const trimmed = version.trim();
  return trimmed.startsWith("v") ? trimmed : `v${normalizeSemver(trimmed)}`;
}

export function githubApiHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "skia-forge-release-assets"
  };
  const trimmed = (token ?? "").trim();
  if (trimmed) {
    headers.Authorization = `Bearer ${trimmed}`;
  }
  return headers;
}

const UPDATE_MANIFEST_NAMES = ["latest.yml", "latest-mac.yml", "latest-linux.yml"] as const;

function unquoteYamlScalar(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

/** Parse electron-builder `latest.yml` / `latest-mac.yml` / `latest-linux.yml`, including per-file sha512. */
export function parseElectronLatestYml(text: string): ElectronLatestManifest | null {
  const versionMatch = text.match(/^version:\s*([^\s#]+)/m);
  const pathMatch = text.match(/^path:\s*([^\s#]+)/m);
  const version = versionMatch?.[1]?.trim() ?? "";
  const assetPath = unquoteYamlScalar(pathMatch?.[1] ?? "");
  if (!version || !assetPath) {
    return null;
  }

  const files: ElectronManifestFile[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const urlMatch = lines[i].match(/^\s+-\s+url:\s*(\S+)/);
    if (!urlMatch) continue;
    let sha512 = "";
    for (let j = i + 1; j < Math.min(i + 8, lines.length); j += 1) {
      if (/^\s+-\s+url:/.test(lines[j]) || /^[A-Za-z]/.test(lines[j])) break;
      const shaMatch = lines[j].match(/^\s+sha512:\s*(\S+)/);
      if (shaMatch) {
        sha512 = unquoteYamlScalar(shaMatch[1]);
        break;
      }
    }
    const url = unquoteYamlScalar(urlMatch[1]);
    if (url && sha512) files.push({ url, sha512 });
  }

  const topLevelSha = text.match(/^sha512:\s*(\S+)/m)?.[1] ?? "";
  const pathSha =
    files.find((file) => file.url === assetPath || file.url.endsWith(`/${assetPath}`))?.sha512 ??
    (topLevelSha ? unquoteYamlScalar(topLevelSha) : "");

  return {
    version,
    path: assetPath,
    sha512: pathSha || null,
    files
  };
}

export function buildGithubLatestDownloadUrl(repo: string, fileName: string): string {
  return `https://github.com/${repo}/releases/latest/download/${encodeURIComponent(fileName)}`;
}

export function buildGithubTaggedDownloadUrl(repo: string, tag: string, fileName: string): string {
  const normalizedTag = toReleaseTag(tag);
  return `https://github.com/${repo}/releases/download/${encodeURIComponent(normalizedTag)}/${encodeURIComponent(fileName)}`;
}

/** Canonical installer filenames (must match skia-ide/package.json electron-builder artifactName). */
export function artifactFileNameForPlatform(platform: DownloadPlatformId, version: string): string {
  const ver = normalizeSemver(version);
  const names: Record<DownloadPlatformId, string> = {
    windows: `SKIA-FORGE-Setup-${ver}-win-x64.exe`,
    "mac-intel": `SKIA-FORGE-${ver}-mac-x64.dmg`,
    "mac-arm": `SKIA-FORGE-${ver}-mac-arm64.dmg`,
    "linux-appimage": `SKIA-FORGE-${ver}-linux-x64.AppImage`
  };
  return names[platform];
}

export function pickReleaseAssetUrlForPlatform(
  platform: DownloadPlatformId,
  assets: ForgeReleaseAsset[]
): string | null {
  const isArmMac = (name: string) => /(arm64|aarch64|apple[-_. ]?silicon|m1|m2|m3)/i.test(name);
  const byName = (predicate: (name: string) => boolean): string | null => {
    const hit = assets.find((asset) => predicate(asset.name));
    return hit?.url ?? null;
  };

  if (platform === "windows") {
    const setupExe = assets.find(
      (a) => /\.exe$/i.test(a.name) && /(setup|nsis|installer|forge)/i.test(a.name)
    );
    if (setupExe) {
      return setupExe.url;
    }
    const exeHit = byName((name) => /\.exe$/i.test(name));
    if (exeHit) {
      return exeHit;
    }
    const msiHit = byName((name) => /\.msi$/i.test(name));
    if (msiHit) {
      return msiHit;
    }
    const anyInstaller = assets.find((a) => /\.(exe|msi)$/i.test(a.name));
    if (anyInstaller) {
      return anyInstaller.url;
    }
    const loose = assets.find(
      (a) =>
        /(win|windows|nsis|setup|x64|amd64)/i.test(a.name) && !/\.(dmg|appimage|zip|tar)/i.test(a.name)
    );
    return loose?.url ?? null;
  }
  if (platform === "mac-arm") {
    return byName((name) => /\.dmg$/i.test(name) && isArmMac(name));
  }
  if (platform === "mac-intel") {
    return (
      byName((name) => /\.dmg$/i.test(name) && /(intel|x64|amd64)/i.test(name)) ??
      byName((name) => /\.dmg$/i.test(name) && !isArmMac(name))
    );
  }
  if (platform === "linux-appimage") {
    return byName((name) => /\.appimage$/i.test(name));
  }
  return null;
}

function assetHasSha512(asset: ForgeReleaseAsset | undefined): asset is ForgeReleaseAsset & { sha512: string } {
  return Boolean(asset?.sha512?.trim());
}

export function resolvePlatformDownloadUrl(
  catalog: ForgeReleaseCatalog,
  platform: DownloadPlatformId,
  repo: string
): string | null {
  const fromAssets = pickReleaseAssetUrlForPlatform(platform, catalog.assets);
  if (fromAssets) {
    const asset = catalog.assets.find((item) => item.url === fromAssets);
    return assetHasSha512(asset) ? fromAssets : null;
  }

  const version = catalog.latestVersion;
  if (!version) {
    return null;
  }

  const fileName = artifactFileNameForPlatform(platform, version);
  const asset = catalog.assets.find((item) => item.name === fileName);
  if (!assetHasSha512(asset)) {
    return null;
  }

  if (platform === "windows") {
    return buildGithubLatestDownloadUrl(repo, fileName);
  }

  const tag = catalog.latestTag ?? toReleaseTag(version);
  return buildGithubTaggedDownloadUrl(repo, tag, fileName);
}

export type VerifiedInstaller = {
  platform: DownloadPlatformId;
  fileName: string;
  sha512: string;
  downloadPath: string;
};

export function listVerifiedInstallers(catalog: ForgeReleaseCatalog, repo: string): VerifiedInstaller[] {
  const platforms: DownloadPlatformId[] = ["windows", "mac-intel", "mac-arm", "linux-appimage"];
  const listed: VerifiedInstaller[] = [];
  for (const platform of platforms) {
    const url = resolvePlatformDownloadUrl(catalog, platform, repo);
    if (!url) continue;
    const asset =
      catalog.assets.find((item) => item.url === url && item.sha512) ??
      catalog.assets.find((item) => item.sha512 && url.includes(encodeURIComponent(item.name)));
    if (!asset?.sha512) continue;
    listed.push({
      platform,
      fileName: asset.name,
      sha512: asset.sha512,
      downloadPath: `/api/app/download/${platform}`
    });
  }
  return listed;
}

async function fetchText(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  fetchFn: typeof fetch
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      return null;
    }
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchElectronLatestYmlCatalog(
  repo: string,
  timeoutMs: number,
  fetchFn: typeof fetch
): Promise<ForgeReleaseCatalog | null> {
  const ymlUrl = buildGithubLatestDownloadUrl(repo, "latest.yml");
  const text = await fetchText(
    ymlUrl,
    { headers: { "User-Agent": "skia-forge-release-assets" } },
    timeoutMs,
    fetchFn
  );
  if (!text) {
    return null;
  }
  const parsed = parseElectronLatestYml(text);
  if (!parsed) {
    return null;
  }
  const tag = toReleaseTag(parsed.version);
  const url = buildGithubLatestDownloadUrl(repo, parsed.path);
  return {
    latestVersion: parsed.version,
    latestTag: tag,
    files: [parsed.path],
    assets: [{ name: parsed.path, url, ...(parsed.sha512 ? { sha512: parsed.sha512 } : {}) }],
    source: "electron-latest-yml"
  };
}

function manifestFileName(url: string): string {
  const leaf = url.split("/").pop() ?? url;
  try {
    return decodeURIComponent(leaf);
  } catch {
    return leaf;
  }
}

export function applyManifestHashes(
  catalog: ForgeReleaseCatalog,
  manifests: Array<ElectronLatestManifest | null>,
  repo: string
): ForgeReleaseCatalog {
  const byName = new Map<string, string>();
  for (const manifest of manifests) {
    if (!manifest) continue;
    if (manifest.path && manifest.sha512) byName.set(manifest.path, manifest.sha512);
    for (const file of manifest.files) {
      const name = manifestFileName(file.url);
      if (name && file.sha512) byName.set(name, file.sha512);
    }
  }

  const assets: ForgeReleaseAsset[] = catalog.assets.map((asset) => {
    const sha512 = asset.sha512 || byName.get(asset.name);
    return sha512 ? { ...asset, sha512 } : asset;
  });
  for (const [name, sha512] of byName) {
    if (!assets.some((asset) => asset.name === name)) {
      assets.push({ name, url: buildGithubLatestDownloadUrl(repo, name), sha512 });
    }
  }
  return {
    ...catalog,
    files: assets.map((asset) => asset.name),
    assets
  };
}

async function fetchUpdateManifests(
  repo: string,
  timeoutMs: number,
  fetchFn: typeof fetch
): Promise<ElectronLatestManifest[]> {
  const manifests = await Promise.all(
    UPDATE_MANIFEST_NAMES.map(async (fileName) => {
      const text = await fetchText(
        buildGithubLatestDownloadUrl(repo, fileName),
        { headers: { "User-Agent": "skia-forge-release-assets" } },
        timeoutMs,
        fetchFn
      );
      if (!text) return null;
      return parseElectronLatestYml(text);
    })
  );
  return manifests.filter((manifest): manifest is ElectronLatestManifest => manifest !== null);
}

async function fetchGithubApiLatestCatalog(
  repo: string,
  headers: Record<string, string>,
  timeoutMs: number,
  fetchFn: typeof fetch
): Promise<ForgeReleaseCatalog | null> {
  const text = await fetchText(
    `https://api.github.com/repos/${repo}/releases/latest`,
    { headers },
    timeoutMs,
    fetchFn
  );
  if (!text) {
    return null;
  }
  let payload: {
    tag_name?: unknown;
    assets?: Array<{ name?: unknown; browser_download_url?: unknown }>;
  };
  try {
    payload = JSON.parse(text) as typeof payload;
  } catch {
    return null;
  }
  const latestTag =
    typeof payload.tag_name === "string" && payload.tag_name.trim() ? payload.tag_name.trim() : null;
  const latestVersion = latestTag ? normalizeSemver(latestTag) : null;
  const assets = Array.isArray(payload.assets)
    ? payload.assets
        .map((asset) => ({
          name: typeof asset.name === "string" ? asset.name.trim() : "",
          url:
            typeof asset.browser_download_url === "string" ? asset.browser_download_url.trim() : ""
        }))
        .filter((asset) => Boolean(asset.name) && Boolean(asset.url))
    : [];
  if (!latestTag && assets.length === 0) {
    return null;
  }
  return {
    latestVersion,
    latestTag,
    files: assets.map((a) => a.name),
    assets,
    source: "github-api"
  };
}

async function fetchGithubApiRecentCatalog(
  repo: string,
  headers: Record<string, string>,
  timeoutMs: number,
  fetchFn: typeof fetch
): Promise<ForgeReleaseCatalog | null> {
  const text = await fetchText(
    `https://api.github.com/repos/${repo}/releases?per_page=25`,
    { headers },
    timeoutMs,
    fetchFn
  );
  if (!text) {
    return null;
  }
  let list: Array<{
    tag_name?: unknown;
    assets?: Array<{ name?: unknown; browser_download_url?: unknown }>;
  }>;
  try {
    list = JSON.parse(text) as typeof list;
  } catch {
    return null;
  }
  const merged: ForgeReleaseAsset[] = [];
  const seen = new Set<string>();
  let latestTag: string | null = null;
  for (const rel of Array.isArray(list) ? list : []) {
    if (!latestTag && typeof rel.tag_name === "string" && rel.tag_name.trim()) {
      latestTag = rel.tag_name.trim();
    }
    const rowAssets = Array.isArray(rel.assets) ? rel.assets : [];
    for (const asset of rowAssets) {
      const name = typeof asset.name === "string" ? asset.name.trim() : "";
      const url =
        typeof asset.browser_download_url === "string" ? asset.browser_download_url.trim() : "";
      if (name && url && !seen.has(name)) {
        seen.add(name);
        merged.push({ name, url });
      }
    }
  }
  if (merged.length === 0) {
    return null;
  }
  return {
    latestVersion: latestTag ? normalizeSemver(latestTag) : null,
    latestTag,
    files: merged.map((a) => a.name),
    assets: merged,
    source: "github-releases-list"
  };
}

function mergeCatalogs(primary: ForgeReleaseCatalog, secondary: ForgeReleaseCatalog | null): ForgeReleaseCatalog {
  if (!secondary) {
    return primary;
  }
  const assetByName = new Map<string, ForgeReleaseAsset>();
  for (const asset of [...primary.assets, ...secondary.assets]) {
    const existing = assetByName.get(asset.name);
    assetByName.set(asset.name, {
      name: asset.name,
      url: asset.url || existing?.url || "",
      ...(asset.sha512 || existing?.sha512 ? { sha512: asset.sha512 || existing?.sha512 } : {})
    });
  }
  const assets = [...assetByName.values()];
  return {
    latestVersion: primary.latestVersion ?? secondary.latestVersion,
    latestTag: primary.latestTag ?? secondary.latestTag,
    files: assets.map((a) => a.name),
    assets,
    source: primary.source === "none" ? secondary.source : primary.source
  };
}

export function clearForgeReleaseCatalogCache(): void {
  catalogCache = null;
}

export async function resolveForgeReleaseCatalog(config: ForgeReleaseConfig): Promise<ForgeReleaseCatalog> {
  const now = Date.now();
  if (catalogCache && now - catalogCache.atMs < CACHE_TTL_MS) {
    return catalogCache.catalog;
  }

  const repo = config.repo.trim();
  const fetchFn = config.fetchFn ?? fetch;
  const timeoutMs = config.timeoutMs ?? 4000;
  const headers = githubApiHeaders(config.githubToken);

  const envVersion = (config.latestVersionEnv ?? "").trim();
  if (envVersion) {
    const tag = toReleaseTag(envVersion);
    const assets: ForgeReleaseAsset[] = (["windows", "mac-intel", "mac-arm", "linux-appimage"] as const).map(
      (platform) => {
        const name = artifactFileNameForPlatform(platform, envVersion);
        return {
          name,
          url: buildGithubTaggedDownloadUrl(repo, tag, name)
        };
      }
    );
    const catalog: ForgeReleaseCatalog = {
      latestVersion: normalizeSemver(envVersion),
      latestTag: tag,
      files: assets.map((a) => a.name),
      assets,
      source: "env"
    };
    const stamped = applyManifestHashes(catalog, await fetchUpdateManifests(repo, timeoutMs, fetchFn), repo);
    catalogCache = { atMs: now, catalog: stamped };
    return stamped;
  }

  const ymlCatalog = await fetchElectronLatestYmlCatalog(repo, timeoutMs, fetchFn);
  const apiLatest = await fetchGithubApiLatestCatalog(repo, headers, timeoutMs, fetchFn);
  const apiRecent =
    apiLatest && apiLatest.assets.length > 0
      ? null
      : await fetchGithubApiRecentCatalog(repo, headers, timeoutMs, fetchFn);

  let catalog: ForgeReleaseCatalog = ymlCatalog ?? {
    latestVersion: null,
    latestTag: null,
    files: [],
    assets: [],
    source: "none"
  };

  if (apiLatest) {
    catalog = mergeCatalogs(apiLatest, catalog);
  } else if (apiRecent) {
    catalog = mergeCatalogs(apiRecent, catalog);
  }

  if (catalog.assets.length === 0 && ymlCatalog) {
    catalog = ymlCatalog;
  }

  catalog = applyManifestHashes(catalog, await fetchUpdateManifests(repo, timeoutMs, fetchFn), repo);
  catalogCache = { atMs: now, catalog };
  return catalog;
}

export async function fetchLatestForgeReleaseTag(config: ForgeReleaseConfig): Promise<string | null> {
  const catalog = await resolveForgeReleaseCatalog(config);
  return catalog.latestTag;
}
