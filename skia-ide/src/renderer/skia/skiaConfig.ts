type RuntimeConfig = {
  backendUrl: string;
  authToken: string;
  timeout: number;
};

let cache: RuntimeConfig | null = null;

const defaults: RuntimeConfig = {
  backendUrl: "https://api.skia.ca",
  authToken: "",
  timeout: 10000
};

const normalizeBackendUrl = (rawUrl: string | undefined): string => {
  const candidate = (rawUrl || "").trim();
  if (!candidate) {
    return defaults.backendUrl;
  }

  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    const disallowedHosts = new Set(["127.0.0.1", "localhost", "0.0.0.0"]);
    if (parsed.protocol === "file:" || disallowedHosts.has(host)) {
      return defaults.backendUrl;
    }
    return parsed.origin;
  } catch {
    return defaults.backendUrl;
  }
};

export const loadConfig = async (): Promise<RuntimeConfig> => {
  if (cache) {
    return cache;
  }

  try {
    const config = await window.skiaElectron.getConfig();
    cache = {
      backendUrl: normalizeBackendUrl(config.backendUrl),
      authToken: config.authToken || defaults.authToken,
      timeout: Number(config.timeout || defaults.timeout)
    };
  } catch {
    cache = defaults;
  }

  return cache;
};

export const getBackendUrl = (): string => cache?.backendUrl ?? defaults.backendUrl;

export const getAuthToken = (): string => cache?.authToken ?? defaults.authToken;

export const getTimeout = (): number => cache?.timeout ?? defaults.timeout;
