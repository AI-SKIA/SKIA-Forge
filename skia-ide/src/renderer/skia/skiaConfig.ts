type RuntimeConfig = {
  backendUrl: string;
  authToken: string;
  timeout: number;
  /** Full URL to Next `/api/skia/chat` (document extraction + live search + upstream). */
  chatPipelineUrl: string;
  /** Side Chat SSE — `/api/skia/forge-agent` (conversational stream; not Agent plan/decompose/execute). */
  forgeAgentPipelineUrl: string;
  localBackendMode: boolean;
  localSkiaServeUrl: string;
  localEmbeddingEngineUrl: string;
  localVectorDbUrl: string;
  localVideoServiceUrl: string;
  localComfyuiUrl: string | null;
  localSdWebuiUrl: string | null;
  localFounderOverride: boolean;
  skiaOwnerEmail: string;
};

let cache: RuntimeConfig | null = null;
export let forgeUrl = "https://forge.skia.ca";

const defaults: RuntimeConfig = {
  backendUrl: "https://api.skia.ca",
  authToken: "",
  timeout: 10000,
  chatPipelineUrl: "https://skia.ca/api/skia/chat",
  forgeAgentPipelineUrl: "https://skia.ca/api/skia/forge-agent",
  localBackendMode: false,
  localSkiaServeUrl: "http://localhost:11500",
  localEmbeddingEngineUrl: "http://localhost:5003",
  localVectorDbUrl: "http://localhost:5004",
  localVideoServiceUrl: "http://localhost:5007",
  localComfyuiUrl: null,
  localSdWebuiUrl: null,
  localFounderOverride: false,
  skiaOwnerEmail: "dany.francis@consultant.com",
};

const normalizeUrl = (rawUrl: string | undefined, fallback: string, allowLocal = false): string => {
  const candidate = (rawUrl || "").trim();
  if (!candidate) {
    return fallback;
  }

  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    const disallowedHosts = new Set(["127.0.0.1", "localhost", "0.0.0.0"]);
    if (parsed.protocol === "file:" || (disallowedHosts.has(host) && !allowLocal)) {
      return fallback;
    }
    return parsed.origin;
  } catch {
    return fallback;
  }
};

const normalizeBackendUrl = (rawUrl: string | undefined, allowLocal: boolean): string =>
  normalizeUrl(rawUrl, defaults.backendUrl, allowLocal);

const normalizeChatPipelineUrl = (rawUrl: string | undefined, allowLocal: boolean): string => {
  const candidate = (rawUrl || "").trim();
  const fallback = defaults.chatPipelineUrl;
  if (!candidate) {
    return fallback;
  }
  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    const disallowedHosts = new Set(["127.0.0.1", "localhost", "0.0.0.0"]);
    if (parsed.protocol === "file:" || (disallowedHosts.has(host) && !allowLocal)) {
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

const normalizeForgeAgentPipelineUrl = (
  rawUrl: string | undefined,
  chatPipelineUrl: string,
  allowLocal: boolean
): string => {
  const candidate = (rawUrl || "").trim();
  if (candidate) {
    try {
      const parsed = new URL(candidate);
      const host = parsed.hostname.toLowerCase();
      const disallowedHosts = new Set(["127.0.0.1", "localhost", "0.0.0.0"]);
      if (parsed.protocol !== "file:" && (allowLocal || !disallowedHosts.has(host))) {
        if (host === "api.skia.ca") {
          return defaults.forgeAgentPipelineUrl;
        }
        return parsed.toString().replace(/\/+$/, "");
      }
    } catch {
      /* fall through */
    }
  }
  try {
    const chat = new URL(chatPipelineUrl);
    return `${chat.origin}/api/skia/forge-agent`.replace(/\/+$/, "");
  } catch {
    return defaults.forgeAgentPipelineUrl;
  }
};

/**
 * Read the live session token from localStorage (written by skiaAuthPanel after login).
 * SKIA_AUTH_TOKEN env var is almost never set in production Northflank, so without this
 * skiaApiClient would send all requests without a Bearer token.
 */
const getStoredSessionToken = (): string => {
  try {
    return localStorage.getItem("skia_session_token") ?? "";
  } catch {
    return "";
  }
};

export const loadConfig = async (): Promise<RuntimeConfig> => {
  if (cache) {
    return cache;
  }

  try {
    const config = await window.skiaElectron.getConfig();
    const configWithForge = config as typeof config & {
      forgeUrl?: string;
      forgeAgentPipelineUrl?: string;
      localBackendMode?: boolean;
      localSkiaServeUrl?: string;
      localEmbeddingEngineUrl?: string;
      localVectorDbUrl?: string;
      localVideoServiceUrl?: string;
      localComfyuiUrl?: string;
      localSdWebuiUrl?: string;
      localFounderOverride?: boolean;
      skiaOwnerEmail?: string;
    };
    const allowLocal = Boolean(configWithForge.localBackendMode);
    const chatPipelineUrl = normalizeChatPipelineUrl(config.chatPipelineUrl, allowLocal);
    cache = {
      backendUrl: normalizeBackendUrl(config.backendUrl, allowLocal),
      authToken: config.authToken || defaults.authToken,
      timeout: Number(config.timeout || defaults.timeout),
      chatPipelineUrl,
      forgeAgentPipelineUrl: normalizeForgeAgentPipelineUrl(
        configWithForge.forgeAgentPipelineUrl,
        chatPipelineUrl,
        allowLocal,
      ),
      localBackendMode: allowLocal,
      localSkiaServeUrl: configWithForge.localSkiaServeUrl || defaults.localSkiaServeUrl,
      localEmbeddingEngineUrl: configWithForge.localEmbeddingEngineUrl || defaults.localEmbeddingEngineUrl,
      localVectorDbUrl: configWithForge.localVectorDbUrl || defaults.localVectorDbUrl,
      localVideoServiceUrl: configWithForge.localVideoServiceUrl || defaults.localVideoServiceUrl,
      localComfyuiUrl: configWithForge.localComfyuiUrl || null,
      localSdWebuiUrl: configWithForge.localSdWebuiUrl || null,
      localFounderOverride: configWithForge.localFounderOverride ?? false,
      skiaOwnerEmail: (configWithForge.skiaOwnerEmail || "dany.francis@consultant.com").toLowerCase(),
    };
    if (configWithForge.forgeUrl) forgeUrl = normalizeUrl(configWithForge.forgeUrl, forgeUrl, allowLocal);
  } catch {
    cache = defaults;
  }

  return cache;
};

export const getBackendUrl = (): string => cache?.backendUrl ?? defaults.backendUrl;

/**
 * Always prefer the live token from localStorage (set by skiaAuthPanel after login)
 * over the IPC config value, which is only populated when SKIA_AUTH_TOKEN env is set.
 * This ensures every API call carries a valid Bearer token after the user logs in.
 */
export const getAuthToken = (): string =>
  getStoredSessionToken() || cache?.authToken || defaults.authToken;

export const getTimeout = (): number => cache?.timeout ?? defaults.timeout;

export const getChatPipelineUrl = (): string => cache?.chatPipelineUrl ?? defaults.chatPipelineUrl;

export const getForgeAgentPipelineUrl = (): string =>
  cache?.forgeAgentPipelineUrl ?? defaults.forgeAgentPipelineUrl;

export const getLocalBackendMode = (): boolean => cache?.localBackendMode ?? false;

export const getLocalEngineConfig = () => ({
  skiaServeUrl: cache?.localSkiaServeUrl ?? defaults.localSkiaServeUrl,
  embeddingEngineUrl: cache?.localEmbeddingEngineUrl ?? defaults.localEmbeddingEngineUrl,
  vectorDbUrl: cache?.localVectorDbUrl ?? defaults.localVectorDbUrl,
  videoServiceUrl: cache?.localVideoServiceUrl ?? defaults.localVideoServiceUrl,
  comfyuiUrl: cache?.localComfyuiUrl ?? null,
  sdWebuiUrl: cache?.localSdWebuiUrl ?? null,
});

export const getLocalFounderOverride = (): boolean => cache?.localFounderOverride ?? false;

export const getSkiaOwnerEmail = (): string => cache?.skiaOwnerEmail ?? "dany.francis@consultant.com";
