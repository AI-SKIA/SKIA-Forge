import { forgeUrl } from "../skia/skiaConfig";
import { getActiveFile } from "../skia/skiaSessionStore";

type InlineWsMessage =
    | { type: "completion"; text: string; provider: string }
    | { type: "error"; message: string }
    | { type: "status"; status: string };

let socket: WebSocket | null = null;
let socketReady: Promise<WebSocket> | null = null;

function inlineWsUrl(): string {
    const base = forgeUrl.replace(/\/+$/, "");
    const wsBase = base.startsWith("https://")
        ? `wss://${base.slice("https://".length)}`
        : base.startsWith("http://")
          ? `ws://${base.slice("http://".length)}`
          : `wss://${base}`;
    return `${wsBase}/inline-completion`;
}

function ensureSocket(): Promise<WebSocket> {
    if (socket && socket.readyState === WebSocket.OPEN) {
        return Promise.resolve(socket);
    }
    if (socketReady) return socketReady;
    socketReady = new Promise((resolve, reject) => {
        const ws = new WebSocket(inlineWsUrl());
        const timer = setTimeout(() => {
            ws.close();
            reject(new Error("Inline completion WebSocket timeout"));
        }, 8_000);
        ws.onopen = () => {
            clearTimeout(timer);
            socket = ws;
            resolve(ws);
        };
        ws.onerror = () => {
            clearTimeout(timer);
            reject(new Error("Inline completion WebSocket error"));
        };
        ws.onclose = () => {
            socket = null;
            socketReady = null;
        };
    });
    return socketReady;
}

export async function fetchInlineCompletion(prefix: string, language?: string): Promise<string> {
    const ws = await ensureSocket();
    const filePath = getActiveFile().trim().replace(/\\/g, "/");
    const rel =
        filePath && !filePath.includes("browser-workspace")
            ? filePath.split("/").slice(-4).join("/")
            : undefined;

    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("completion timeout")), 12_000);
        const onMessage = (ev: MessageEvent): void => {
            try {
                const msg = JSON.parse(String(ev.data)) as InlineWsMessage;
                if (msg.type === "completion") {
                    clearTimeout(timer);
                    ws.removeEventListener("message", onMessage);
                    resolve(msg.text);
                } else if (msg.type === "error") {
                    clearTimeout(timer);
                    ws.removeEventListener("message", onMessage);
                    reject(new Error(msg.message));
                }
            } catch {
                /* ignore */
            }
        };
        ws.addEventListener("message", onMessage);
        ws.send(
            JSON.stringify({
                prefix,
                language,
                filePath: rel
            })
        );
    });
}

type MonacoInlineProvider = {
    provideInlineCompletions: (
        model: { getValueInRange: (r: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }) => string },
        position: { lineNumber: number; column: number },
        context: unknown,
        token: { isCancellationRequested: boolean }
    ) => Promise<{ items: Array<{ insertText: string; range: unknown }> }>;
    dispose?: () => void;
};

export const registerSkiaInlineCompletions = (monaco: {
    languages: {
        registerInlineCompletionsProvider?: (
            languageId: string,
            provider: MonacoInlineProvider
        ) => { dispose: () => void };
    };
}): void => {
    const register = monaco.languages.registerInlineCompletionsProvider;
    if (!register) return;

    const languages = ["typescript", "javascript", "python", "json", "markdown", "html", "css"];
    for (const lang of languages) {
        register(lang, {
            provideInlineCompletions: async (model, position, _ctx, token) => {
                if (token.isCancellationRequested) return { items: [] };
                const prefix = model.getValueInRange({
                    startLineNumber: 1,
                    startColumn: 1,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column
                });
                if (!prefix.trim()) return { items: [] };
                try {
                    const text = await fetchInlineCompletion(prefix, lang);
                    if (!text || token.isCancellationRequested) return { items: [] };
                    return {
                        items: [
                            {
                                insertText: text,
                                range: {
                                    startLineNumber: position.lineNumber,
                                    startColumn: position.column,
                                    endLineNumber: position.lineNumber,
                                    endColumn: position.column
                                }
                            }
                        ]
                    };
                } catch {
                    return { items: [] };
                }
            }
        });
    }
};
