import { session } from "electron";

export type SkiaAuthRequestInput = {
    path: string;
    method: "GET" | "POST";
    body?: Record<string, unknown>;
    bearerToken?: string;
};

export type SkiaAuthRequestResult = {
    ok: boolean;
    status: number;
    text: string;
};

const parseSetCookiePair = (header: string): {
    name: string;
    value: string;
    domain?: string;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
    maxAge?: number;
} | null => {
    const parts = header.split(";").map((p) => p.trim());
    const [pair] = parts;
    if (!pair || !pair.includes("=")) return null;
    const eq = pair.indexOf("=");
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (!name) return null;

    let domain: string | undefined;
    let cookiePath = "/";
    let secure = false;
    let httpOnly = false;
    let maxAge: number | undefined;

    for (const attr of parts.slice(1)) {
        const lower = attr.toLowerCase();
        if (lower.startsWith("domain=")) domain = attr.slice(7).trim();
        else if (lower.startsWith("path=")) cookiePath = attr.slice(5).trim() || "/";
        else if (lower === "secure") secure = true;
        else if (lower === "httponly") httpOnly = true;
        else if (lower.startsWith("max-age=")) {
            const seconds = Number(attr.slice(8).trim());
            if (Number.isFinite(seconds)) maxAge = seconds;
        }
    }

    return { name, value, domain, path: cookiePath, secure, httpOnly, maxAge };
};

const persistSetCookieHeaders = async (baseUrl: string, headers: string[]): Promise<void> => {
    const ses = session.defaultSession;
    for (const raw of headers) {
        const parsed = parseSetCookiePair(raw);
        if (!parsed) continue;
        try {
            await ses.cookies.set({
                url: baseUrl,
                name: parsed.name,
                value: parsed.value,
                domain: parsed.domain,
                path: parsed.path,
                secure: parsed.secure,
                httpOnly: parsed.httpOnly,
                expirationDate:
                    parsed.maxAge !== undefined
                        ? Math.floor(Date.now() / 1000) + parsed.maxAge
                        : undefined,
            });
        } catch {
            // Non-fatal: Bearer token in JSON is the primary Forge IDE session.
        }
    }
};

export const performSkiaAuthRequest = async (
    backendUrl: string,
    input: SkiaAuthRequestInput
): Promise<SkiaAuthRequestResult> => {
    const base = backendUrl.trim().replace(/\/+$/, "");
    const path = input.path.startsWith("/") ? input.path : `/${input.path}`;
    const url = `${base}${path}`;

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-skia-client": "forge-desktop",
    };
    if (input.bearerToken?.trim()) {
        headers.Authorization = `Bearer ${input.bearerToken.trim()}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch(url, {
            method: input.method,
            headers,
            body:
                input.method === "POST" && input.body !== undefined
                    ? JSON.stringify(input.body)
                    : undefined,
            signal: controller.signal,
        });

        const setCookies: string[] =
            typeof (response.headers as { getSetCookie?: () => string[] }).getSetCookie === "function"
                ? (response.headers as { getSetCookie: () => string[] }).getSetCookie()
                : response.headers.get("set-cookie")
                  ? [response.headers.get("set-cookie") as string]
                  : [];

        if (setCookies.length > 0) {
            await persistSetCookieHeaders(base, setCookies);
        }

        const text = await response.text();
        return { ok: response.ok, status: response.status, text };
    } finally {
        clearTimeout(timer);
    }
};
