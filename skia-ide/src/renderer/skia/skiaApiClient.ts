import { getAuthToken, getBackendUrl, getTimeout } from "./skiaConfig";

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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), getTimeout());
    try {
        return await skiaFetch(input, { ...init, signal: controller.signal });
    } catch (error) {
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
    } catch {
        throw new SkiaOfflineError();
    }
};

const fetchJsonWithRetry = async (path: string, init?: RequestInit): Promise<Json> => {
    const url = `${getBackendUrl()}${path}`;
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

export const healthCheck = async (): Promise<Json | null> => {
    try {
        return await fetchJsonWithRetry("/live", { method: "GET" });
    } catch (error) {
        if (error instanceof SkiaOfflineError) return null;
        throw error;
    }
};

export const getMode = async (): Promise<Json | null> => {
    try {
        return await fetchJsonWithRetry("/api/forge/mode", { method: "GET" });
    } catch (error) {
        if (error instanceof SkiaOfflineError) return null;
        throw error;
    }
};

export const getGovernance = async (): Promise<Json | null> => {
    try {
        return await fetchJsonWithRetry("/api/forge/governance", { method: "GET" });
    } catch (error) {
        if (error instanceof SkiaOfflineError) return null;
        throw error;
    }
};

export const getSovereignPosture = (): Promise<Json> =>
    fetchJsonWithRetry("/api/forge/sovereign-posture", { method: "GET" });

export const sendChat = (payload: Json): Promise<Json> =>
    fetchJsonWithRetry("/api/forge/agent", {
        method: "POST",
        body: JSON.stringify({ ...payload, approved: true })
    });

export const getContext = (payload: Json): Promise<Json> =>
    fetchJsonWithRetry("/api/forge/context", {
        method: "POST",
        body: JSON.stringify(payload)
    });

export const getModulesStatus = async (): Promise<Json | null> => {
    try {
        return await fetchJsonWithRetry("/api/forge/modules/status", { method: "GET" });
    } catch (error) {
        if (error instanceof SkiaOfflineError) return null;
        throw error;
    }
};

export const getArchitectureHealth = async (): Promise<Json | null> => {
    try {
        return await fetchJsonWithRetry("/api/forge/architecture/health", { method: "GET" });
    } catch (error) {
        if (error instanceof SkiaOfflineError) return null;
        throw error;
    }
};

export const runSkiaReview = (payload: { message: string }): Promise<Json> =>
    fetchJsonWithRetry("/api/forge/skia-review", {
        method: "POST",
        body: JSON.stringify(payload)
    });

const integrationChatResponseText = (json: Json): string => {
    if (typeof json.response === "string") return json.response;
    if (typeof json.content === "string") return json.content;
    if (typeof json.message === "string") return json.message;
    return JSON.stringify(json);
};

const DIRECT_SKIA_CHAT_URL = "https://api.skia.ca/api/skia/chat";

/** Forge proxy → `SkiaFullAdapter.intelligence()`; falls back to direct brain if the proxy fails. */
export const sendChatStream = async (
    payload: { message: string },
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
): Promise<void> => {
    const h = headers();
    const proxyUrl = `${getBackendUrl()}/integration/skia-full/chat`;
    const directBody = {
        messages: [{ role: "user" as const, content: payload.message }]
    };

    const parseOk = async (res: Response): Promise<string> => {
        const json = (await res.json()) as Json;
        return integrationChatResponseText(json);
    };

    let text: string | undefined;
    try {
        const res = await withTimeout(proxyUrl, {
            method: "POST",
            headers: h,
            body: JSON.stringify({ message: payload.message, mode: "general" }),
            signal
        });
        if (res.ok) {
            text = await parseOk(res);
        }
    } catch {
        // proxy unreachable — try direct
    }

    if (text === undefined) {
        const res = await withTimeout(DIRECT_SKIA_CHAT_URL, {
            method: "POST",
            headers: h,
            body: JSON.stringify(directBody),
            signal
        });
        if (!res.ok) {
            throw new Error(`SKIA backend error (${res.status})`);
        }
        text = await parseOk(res);
    }

    onChunk(text);
};

export const sendSseChatStream = async (
    payload: { message: string; qualityThreshold?: number; maxOutputTokens?: number },
    onFrame: (frame: string) => void,
    signal?: AbortSignal
): Promise<void> => {
    const url = `${getBackendUrl()}/api/chat/stream`;
    const res = await withTimeout(url, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
            prompt: payload.message,
            qualityThreshold: payload.qualityThreshold ?? 0.8,
            maxOutputTokens: payload.maxOutputTokens ?? 4096
        }),
        signal
    });
    if (!res.ok || !res.body) throw new Error(`SSE stream failed (${res.status})`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf8");
    let buffer = "";
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
            const line = part.split("\n").find((x) => x.startsWith("data: "));
            if (!line) continue;
            onFrame(line.slice("data: ".length));
        }
    }
};