/** Main-site chat SSE (`token` / `done`) — side panel only; no agent work events. */

export type SkiaChatStreamDone = {
    type: "done";
    response: string;
    riskBand?: string;
    governanceProfile?: string;
};

export type SkiaChatStreamEvent =
    | { type: "token"; text: string }
    | SkiaChatStreamDone;

export function parseSkiaChatSseLines(buffer: string): {
    events: SkiaChatStreamEvent[];
    remainder: string;
} {
    const events: SkiaChatStreamEvent[] = [];
    const parts = buffer.split("\n");
    const remainder = parts.pop() ?? "";
    for (const line of parts) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const json = trimmed.slice(5).trim();
        if (!json) continue;
        try {
            const parsed = JSON.parse(json) as { type?: string; text?: string; response?: string };
            if (parsed?.type === "token" && typeof parsed.text === "string") {
                events.push({ type: "token", text: parsed.text });
            } else if (parsed?.type === "done" && typeof parsed.response === "string") {
                events.push({
                    type: "done",
                    response: parsed.response,
                    riskBand: typeof (parsed as { riskBand?: string }).riskBand === "string"
                        ? (parsed as { riskBand?: string }).riskBand
                        : undefined,
                    governanceProfile:
                        typeof (parsed as { governanceProfile?: string }).governanceProfile === "string"
                            ? (parsed as { governanceProfile?: string }).governanceProfile
                            : undefined
                });
            }
        } catch {
            /* ignore */
        }
    }
    return { events, remainder };
}

export async function consumeSkiaChatSseStream(
    body: ReadableStream<Uint8Array>,
    onToken: (text: string) => void
): Promise<SkiaChatStreamDone | null> {
    const reader = body.getReader();
    const decoder = new TextDecoder("utf8");
    let buffer = "";
    let donePayload: SkiaChatStreamDone | null = null;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { events, remainder } = parseSkiaChatSseLines(buffer);
        buffer = remainder;
        for (const ev of events) {
            if (ev.type === "token") onToken(ev.text);
            else if (ev.type === "done") donePayload = ev;
        }
    }

    if (buffer.trim()) {
        const { events } = parseSkiaChatSseLines(`${buffer}\n`);
        for (const ev of events) {
            if (ev.type === "token") onToken(ev.text);
            else if (ev.type === "done") donePayload = ev;
        }
    }

    return donePayload;
}
