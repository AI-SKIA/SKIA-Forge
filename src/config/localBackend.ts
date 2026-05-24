import fs from "node:fs";
import path from "node:path";

/** Production defaults — unchanged when local mode is off. */
export const PRODUCTION_SKIA_BACKEND_URL = "https://api.skia.ca";
export const PRODUCTION_SKIA_FULL_API_URL = "https://api.skia.ca";
export const PRODUCTION_CHAT_PIPELINE_URL = "https://skia.ca/api/skia/chat";
export const PRODUCTION_FORGE_AGENT_PIPELINE_URL = "https://skia.ca/api/skia/forge-agent";

export type LocalEngineConfig = {
  skiaBackendUrl: string;
  skiaServeUrl: string;
  embeddingEngineUrl: string;
  vectorDbUrl: string;
  videoServiceUrl: string;
  comfyuiUrl: string | null;
  sdWebuiUrl: string | null;
  chatPipelineUrl: string;
  forgeAgentPipelineUrl: string;
  forgeUrl: string;
};

type ForgeLocalConfigFile = Partial<{
  LOCAL_SKIA_BACKEND_URL: string;
  LOCAL_SKIA_SERVE_URL: string;
  LOCAL_EMBEDDING_ENGINE_URL: string;
  LOCAL_VECTOR_DB_URL: string;
  LOCAL_VIDEO_SERVICE_URL: string;
  LOCAL_COMFYUI_URL: string;
  LOCAL_SD_WEBUI_URL: string;
  LOCAL_FORGE_URL: string;
  LOCAL_CHAT_PIPELINE_URL: string;
  LOCAL_FORGE_AGENT_PIPELINE_URL: string;
  SKIA_OWNER_EMAIL: string;
  LOCAL_FOUNDER_OVERRIDE: boolean | string;
  LOCAL_FORGE_SOVEREIGN_MODE: string;
}>;

type ForgeLocalConfigStringKey = Exclude<
  keyof ForgeLocalConfigFile,
  "LOCAL_FOUNDER_OVERRIDE" | "SKIA_OWNER_EMAIL"
>;

let cachedFileConfig: ForgeLocalConfigFile | null | undefined;

function trimUrl(value: string | undefined): string | null {
  const trimmed = (value || "").trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : null;
}

function readForgeLocalConfigFile(): ForgeLocalConfigFile | null {
  if (cachedFileConfig !== undefined) {
    return cachedFileConfig;
  }
  const candidates = [
    path.resolve(process.cwd(), "local-dev/forge.local.config.json"),
    path.resolve(process.cwd(), "forge.local.config.json"),
  ];
  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as ForgeLocalConfigFile;
        cachedFileConfig = parsed;
        return parsed;
      }
    } catch {
      /* try next */
    }
  }
  cachedFileConfig = null;
  return null;
}

function envOrFile(key: ForgeLocalConfigStringKey): string | null {
  const fromEnv = trimUrl(process.env[key]);
  if (fromEnv) return fromEnv;
  const file = readForgeLocalConfigFile();
  return file ? trimUrl(file[key]) : null;
}

/** True when LOCAL_SKIA_BACKEND_URL is set (env or local-dev config file). */
export function isLocalBackendMode(): boolean {
  return Boolean(envOrFile("LOCAL_SKIA_BACKEND_URL"));
}

/**
 * SKIA API base URL for Forge auth proxy and SkiaFullAdapter.
 * Local when LOCAL_SKIA_BACKEND_URL is set; otherwise production default.
 */
export function resolveSkiaBackendUrl(): string {
  return envOrFile("LOCAL_SKIA_BACKEND_URL") ?? PRODUCTION_SKIA_BACKEND_URL;
}

/** Same resolution as backend URL for upstream SKIA-FULL calls. */
export function resolveSkiaFullApiUrl(): string {
  const explicitFull = trimUrl(process.env.SKIA_FULL_API_URL);
  if (explicitFull && !isLocalBackendMode()) {
    return explicitFull;
  }
  if (isLocalBackendMode()) {
    return resolveSkiaBackendUrl();
  }
  return explicitFull ?? PRODUCTION_SKIA_FULL_API_URL;
}

/** Resolved local engine URLs for health probes and operator docs. */
export function resolveLocalEngineConfig(): LocalEngineConfig {
  const file = readForgeLocalConfigFile();
  const backend = resolveSkiaBackendUrl();
  return {
    skiaBackendUrl: backend,
    skiaServeUrl:
      envOrFile("LOCAL_SKIA_SERVE_URL") ??
      trimUrl(file?.LOCAL_SKIA_SERVE_URL) ??
      "http://localhost:11500",
    embeddingEngineUrl:
      envOrFile("LOCAL_EMBEDDING_ENGINE_URL") ??
      trimUrl(file?.LOCAL_EMBEDDING_ENGINE_URL) ??
      "http://localhost:5003",
    vectorDbUrl:
      envOrFile("LOCAL_VECTOR_DB_URL") ??
      trimUrl(file?.LOCAL_VECTOR_DB_URL) ??
      "http://localhost:5004",
    videoServiceUrl:
      envOrFile("LOCAL_VIDEO_SERVICE_URL") ??
      trimUrl(file?.LOCAL_VIDEO_SERVICE_URL) ??
      "http://localhost:5007",
    comfyuiUrl: envOrFile("LOCAL_COMFYUI_URL"),
    sdWebuiUrl: envOrFile("LOCAL_SD_WEBUI_URL"),
    chatPipelineUrl:
      envOrFile("LOCAL_CHAT_PIPELINE_URL") ??
      trimUrl(file?.LOCAL_CHAT_PIPELINE_URL) ??
      `${backend.replace(/\/+$/, "")}/api/skia/chat`,
    forgeAgentPipelineUrl:
      envOrFile("LOCAL_FORGE_AGENT_PIPELINE_URL") ??
      trimUrl(file?.LOCAL_FORGE_AGENT_PIPELINE_URL) ??
      `${backend.replace(/\/+$/, "")}/api/skia/forge-agent`,
    forgeUrl:
      envOrFile("LOCAL_FORGE_URL") ??
      trimUrl(file?.LOCAL_FORGE_URL) ??
      trimUrl(process.env.SKIA_FORGE_URL) ??
      "http://localhost:4173",
  };
}

/** Allow localhost origins in IDE when local backend mode is active. */
export function isAllowedLocalHost(hostname: string): boolean {
  if (!isLocalBackendMode()) return false;
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
}

/** Founder email — must match SKIA backend SKIA_OWNER_EMAIL for Founder Override on API calls. */
export function resolveFounderEmail(): string {
  const fromEnv = (process.env.SKIA_OWNER_EMAIL || "").trim().toLowerCase();
  if (fromEnv) return fromEnv;
  const file = readForgeLocalConfigFile();
  const fromFile = (file?.SKIA_OWNER_EMAIL || "").trim().toLowerCase();
  return fromFile || "dany.francis@consultant.com";
}

function parseTruthy(value: string | boolean | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (typeof value === "boolean") return value;
  const v = value.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

/**
 * Local Founder Override — Forge governance runs in autonomous mode (no approval gates).
 * Only active when LOCAL_SKIA_BACKEND_URL is set. Does not change production Forge.
 */
export function isLocalFounderOverrideEnabled(): boolean {
  if (!isLocalBackendMode()) return false;
  const fromEnv = process.env.LOCAL_FOUNDER_OVERRIDE;
  if (fromEnv !== undefined && fromEnv !== "") {
    return parseTruthy(fromEnv, true);
  }
  const file = readForgeLocalConfigFile();
  return parseTruthy(file?.LOCAL_FOUNDER_OVERRIDE, true);
}

/** Sovereign execution mode for local founder sessions (strict | adaptive | autonomous). */
export function resolveLocalForgeSovereignMode(): "strict" | "adaptive" | "autonomous" {
  if (!isLocalFounderOverrideEnabled()) return "adaptive";
  const raw =
    (process.env.LOCAL_FORGE_SOVEREIGN_MODE || "").trim() ||
    String(readForgeLocalConfigFile()?.LOCAL_FORGE_SOVEREIGN_MODE || "").trim() ||
    "autonomous";
  if (raw === "strict" || raw === "adaptive" || raw === "autonomous") return raw;
  return "autonomous";
}
