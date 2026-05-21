export type ForgeIdeAgentEventType =
    | "thought"
    | "tool_start"
    | "tool_end"
    | "search"
    | "file_read"
    | "diff"
    | "token"
    | "done"
    | "error";

export type ForgeIdeAgentStreamEvent = {
    type: ForgeIdeAgentEventType;
    payload: string;
    tool?: string;
    path?: string;
    status?: "ok" | "failed" | "pending";
    step?: number;
};

export type ForgeIdeAgentStreamDone = {
    type: "done";
    response: string;
};

export function parseForgeAgentSseLines(buffer: string): {
    events: ForgeIdeAgentStreamEvent[];
    remainder: string;
} {
    const events: ForgeIdeAgentStreamEvent[] = [];
    const parts = buffer.split("\n");
    const remainder = parts.pop() ?? "";
    for (const line of parts) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const json = trimmed.slice(5).trim();
        if (!json) continue;
        try {
            const parsed = JSON.parse(json) as ForgeIdeAgentStreamEvent;
            if (parsed?.type) events.push(parsed);
        } catch {
            /* ignore */
        }
    }
    return { events, remainder };
}

export async function consumeForgeAgentSseStream(
    body: ReadableStream<Uint8Array>,
    onEvent: (event: ForgeIdeAgentStreamEvent) => void
): Promise<ForgeIdeAgentStreamDone | null> {
    const reader = body.getReader();
    const decoder = new TextDecoder("utf8");
    let buffer = "";
    let donePayload: ForgeIdeAgentStreamDone | null = null;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { events, remainder } = parseForgeAgentSseLines(buffer);
        buffer = remainder;
        for (const ev of events) {
            onEvent(ev);
            if (ev.type === "done") {
                donePayload = { type: "done", response: ev.payload };
            }
        }
    }

    if (buffer.trim()) {
        const { events } = parseForgeAgentSseLines(`${buffer}\n`);
        for (const ev of events) {
            onEvent(ev);
            if (ev.type === "done") donePayload = { type: "done", response: ev.payload };
        }
    }

    return donePayload;
}

/** Apply a unified diff payload to text (best-effort). */
export function applyUnifiedDiffToText(before: string, diff: string): string | null {
    const lines = diff.split(/\r?\n/);
    const out: string[] = before.split(/\r?\n/);
    let outIdx = 0;
    let hunkStart = false;

    for (const line of lines) {
        if (line.startsWith("@@")) {
            hunkStart = true;
            const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
            if (match) outIdx = Math.max(0, Number(match[1]) - 1);
            continue;
        }
        if (!hunkStart) continue;
        if (line.startsWith("---") || line.startsWith("+++")) continue;
        if (line.startsWith("-")) {
            if (outIdx < out.length && out[outIdx] === line.slice(1)) {
                out.splice(outIdx, 1);
            }
            continue;
        }
        if (line.startsWith("+")) {
            out.splice(outIdx, 0, line.slice(1));
            outIdx += 1;
            continue;
        }
        if (line.startsWith(" ")) {
            outIdx += 1;
        }
    }

    return out.join("\n");
}

export function contentFromDiffPayload(diff: string): string {
    const added = diff
        .split(/\r?\n/)
        .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
        .map((l) => l.slice(1));
    return added.join("\n");
}
