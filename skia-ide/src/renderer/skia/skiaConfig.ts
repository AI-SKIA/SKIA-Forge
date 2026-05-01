type RuntimeConfig = {
  backendUrl: string;
  authToken: string;
  timeout: number;
  /** Full URL to Next `/api/skia/chat` (document extraction + live search + upstream). */
  chatPipelineUrl: string;
};

let cache: RuntimeConfig | null = null;

const defaults: RuntimeConfig = {
  backendUrl: "https://api.skia.ca",
  authToken: "",
  timeout: 10000,
  chatPipelineUrl: "https://skia.ca/api/skia/chat",
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

const normalizeChatPipelineUrl = (rawUrl: string | undefined): string => {
  const candidate = (rawUrl || "").trim();
  const fallback = defaults.chatPipelineUrl;
  if (!candidate) {
    return fallback;
  }
  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    const disallowedHosts = new Set(["127.0.0.1", "localhost", "0.0.0.0"]);
    if (parsed.protocol === "file:" || disallowedHosts.has(host)) {
      return fallback;
    }
    /**
     * Forge uses Bearer tokens from login; calling the login API host directly for `/api/skia/chat`
     * returns 401 and triggers logout loops. Chat must use the Next route (`skia.ca`) which forwards auth.
     */
    if (host === "api.skia.ca" && parsed.pathname.includes("/api/skia/chat")) {
      return fallback;
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return fallback;
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
      timeout: Number(config.timeout || defaults.timeout),
      chatPipelineUrl: normalizeChatPipelineUrl(config.chatPipelineUrl),
    };
  } catch {
    cache = defaults;
  }

  return cache;
};

export const getBackendUrl = (): string => cache?.backendUrl ?? defaults.backendUrl;

export const getAuthToken = (): string => cache?.authToken ?? defaults.authToken;

export const getTimeout = (): number => cache?.timeout ?? defaults.timeout;

export const getChatPipelineUrl = (): string => cache?.chatPipelineUrl ?? defaults.chatPipelineUrl;
