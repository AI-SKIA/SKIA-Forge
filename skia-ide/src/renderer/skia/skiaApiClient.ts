import { getAuthToken, getBackendUrl, getTimeout } from "./skiaConfig";

type Json = Record<string, unknown>;

const requestId = (): string =>
  `skia-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const headers = (): HeadersInit => {
  const token = getAuthToken();
  return {
    "content-type": "application/json",
    "x-request-id": requestId(),
    ...(token ? { authorization: `Bearer ${token}` } : {})
  };
};

const withTimeout = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeout());
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const fetchJsonWithRetry = async (path: string, init?: RequestInit): Promise<Json> => {
  const url = `${getBackendUrl()}${path}`;
  let tries = 0;
  while (tries < 3) {
    tries += 1;
    const res = await withTimeout(url, { ...init, headers: { ...headers(), ...(init?.headers || {}) } });
    if (res.ok) {
      return (await res.json()) as Json;
    }
    if (res.status < 500 || tries >= 3) {
      throw new Error(`Request failed (${res.status}) ${path}`);
    }
    await delay(200 * tries);
  }
  throw new Error(`Request failed after retries: ${path}`);
};

export const healthCheck = (): Promise<Json> => fetchJsonWithRetry("/live", { method: "GET" });
export const getMode = (): Promise<Json> => fetchJsonWithRetry("/api/forge/mode", { method: "GET" });
export const getGovernance = (): Promise<Json> =>
  fetchJsonWithRetry("/api/forge/governance", { method: "GET" });
export const getSovereignPosture = (): Promise<Json> =>
  fetchJsonWithRetry("/api/forge/sovereign-posture", { method: "GET" });
export const sendChat = (payload: Json): Promise<Json> =>
  fetchJsonWithRetry("/api/forge/agent", { method: "POST", body: JSON.stringify(payload) });
export const getContext = (payload: Json): Promise<Json> =>
  fetchJsonWithRetry("/api/forge/context", { method: "POST", body: JSON.stringify(payload) });
export const getModulesStatus = (): Promise<Json> =>
  fetchJsonWithRetry("/api/forge/modules/status", { method: "GET" });

export const sendChatStream = async (
  payload: Json,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<void> => {
  const res = await fetch(`${getBackendUrl()}/stream/chat`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
    signal
  });

  if (!res.ok || !res.body) {
    throw new Error(`Streaming chat failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    const chunk = decoder.decode(value, { stream: true });
    if (chunk) {
      onChunk(chunk);
    }
  }
};
