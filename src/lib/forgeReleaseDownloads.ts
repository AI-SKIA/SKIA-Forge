export type DownloadPlatformId = "windows" | "mac-intel" | "mac-arm" | "linux-appimage";

export type ForgeReleaseAsset = { name: string; url: string };

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

/** Parse electron-builder `latest.yml` (Windows update manifest published on each release). */
export function parseElectronLatestYml(text: string): { version: string; path: string } | null {
  const versionMatch = text.match(/^version:\s*([^\s#]+)/m);
  const pathMatch = text.match(/^path:\s*([^\s#]+)/m);
  const version = versionMatch?.[1]?.trim() ?? "";
  const assetPath = pathMatch?.[1]?.trim() ?? "";
  if (!version || !assetPath) {
    return null;
  }
  return { version, path: assetPath };
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

export function resolvePlatformDownloadUrl(
  catalog: ForgeReleaseCatalog,
  platform: DownloadPlatformId,
  repo: string
): string | null {
  const fromAssets = pickReleaseAssetUrlForPlatform(platform, catalog.assets);
  if (fromAssets) {
    return fromAssets;
  }

  const version = catalog.latestVersion;
  if (!version) {
    return null;
  }

  const fileName = artifactFileNameForPlatform(platform, version);
  const published =
    catalog.files.includes(fileName) || catalog.assets.some((asset) => asset.name === fileName);
  if (!published) {
    return null;
  }

  if (platform === "windows") {
    return buildGithubLatestDownloadUrl(repo, fileName);
  }

  const tag = catalog.latestTag ?? toReleaseTag(version);
  return buildGithubTaggedDownloadUrl(repo, tag, fileName);
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
    assets: [{ name: parsed.path, url }],
    source: "electron-latest-yml"
  };
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
    assetByName.set(asset.name, asset);
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
    catalogCache = { atMs: now, catalog };
    return catalog;
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

  catalogCache = { atMs: now, catalog };
  return catalog;
}

export async function fetchLatestForgeReleaseTag(config: ForgeReleaseConfig): Promise<string | null> {
  const catalog = await resolveForgeReleaseCatalog(config);
  return catalog.latestTag;
}
