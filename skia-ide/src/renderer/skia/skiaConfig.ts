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

export const loadConfig = async (): Promise<RuntimeConfig> => {
  if (cache) {
    return cache;
  }

  try {
    const config = await window.skiaElectron.getConfig();
    cache = {
      backendUrl: config.backendUrl || defaults.backendUrl,
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
