import { forgeUrl, getAuthToken, getBackendUrl, getTimeout } from "./skiaConfig";

type Json = Record<string, unknown>;
export class SkiaOfflineError extends Error {
    constructor() {
        super("SKIA backend offline");
        this.name = "SkiaOfflineError";
    }
}

const requestId = (): string =>
    `skia-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

const headers = (): HeadersInit => {
    const token = getAuthToken();
    return {
        "content-type": "application/json",
        "x-request-id": requestId(),
        ...(token ? { authorization: `Bearer ${token}` } : {})
    };
};

const withTimeout = async (
    input: RequestInfo | URL,
    init: RequestInit = {}
): Promise<Response> => {
    const timeoutCtrl = new AbortController();
    const timeout = setTimeout(() => timeoutCtrl.abort(), getTimeout());
    const external = init.signal;
    const anyFn = (AbortSignal as typeof AbortSignal & { any?: (signals: AbortSignal[]) => AbortSignal }).any;
    const combined =
        external && typeof anyFn === "function"
            ? anyFn([external, timeoutCtrl.signal])
            : external ?? timeoutCtrl.signal;
    try {
        return await skiaFetch(input, { ...init, signal: combined });
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            throw error;
        }
        if (error instanceof SkiaOfflineError) {
            throw error;
        }
        throw new SkiaOfflineError();
    } finally {
        clearTimeout(timeout);
    }
};

const skiaFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
        return await fetch(input, init);
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            throw error;
        }
        throw new SkiaOfflineError();
    }
};

const fetchJsonWithRetry = async (path: string, init?: RequestInit): Promise<Json> => {
    const url = /^https?:\/\//i.test(path) ? path : `${getBackendUrl()}${path}`;
    let tries = 0;
    while (tries < 3) {
        tries += 1;
        let res: Response;
        try {
            res = await withTimeout(url, {
                ...init,
                headers: { ...headers(), ...(init?.headers ?? {}) }
            });
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
                throw error;
            }
            if (error instanceof SkiaOfflineError) {
                throw error;
            }
            throw new SkiaOfflineError();
        }
        if (res.ok) return (await res.json()) as Json;
        if (res.status < 500 || tries >= 3) {
            throw new Error(`Request failed (${res.status}) ${path}`);
        }
        await delay(200 * tries);
    }
    throw new Error(`Request failed after retries: ${path}`);
};

export const getMode = async (): Promise<Json | null> => {
    try {
        return await fetchJsonWithRetry(`${forgeUrl}/api/forge/mode`, { method: "GET" });
    } catch (error) {
        if (error instanceof SkiaOfflineError) return null;
        throw error;
    }
};

export const getGovernance = async (): Promise<Json | null> => {
    try {
        return await fetchJsonWithRetry(`${forgeUrl}/api/forge/governance`, { method: "GET" });
    } catch (error) {
        if (error instanceof SkiaOfflineError) return null;
        throw error;
    }
};

export const getContext = (payload: Json): Promise<Json> =>
    fetchJsonWithRetry("/api/forge/context", {
        method: "POST",
        body: JSON.stringify(payload)
    });

export const getModulesStatus = async (): Promise<Json | null> => {
    try {
        return await fetchJsonWithRetry(`${forgeUrl}/api/forge/modules/status`, { method: "GET" });
    } catch (error) {
        if (error instanceof SkiaOfflineError) return null;
        throw error;
    }
};

export const getArchitectureHealth = async (): Promise<Json | null> => {
    try {
        return await fetchJsonWithRetry(`${forgeUrl}/api/forge/architecture/health`, { method: "GET" });
    } catch (error) {
        if (error instanceof SkiaOfflineError) return null;
        throw error;
    }
};

export const runSkiaReview = (
    payload: { message: string },
    options?: { signal?: AbortSignal }
): Promise<Json> =>
    fetchJsonWithRetry("/api/forge/skia-review", {
        method: "POST",
        body: JSON.stringify({ message: payload.message }),
        signal: options?.signal
    });
