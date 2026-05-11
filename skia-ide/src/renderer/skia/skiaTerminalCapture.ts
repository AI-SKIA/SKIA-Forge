/**
 * Rolling transcript of integrated-terminal output for SKIA IDE brain context (bounded).
 */
const MAX_PER_TAB = 24_000;
const transcripts = new Map<string, string>();

export function recordTerminalOutput(tabId: string, chunk: string): void {
    if (!chunk) return;
    const prev = transcripts.get(tabId) ?? "";
    const next = (prev + chunk).slice(-MAX_PER_TAB);
    transcripts.set(tabId, next);
}

export function removeTerminalTranscript(tabId: string): void {
    transcripts.delete(tabId);
}

/** Plain-text block for `buildIdeBrainEnvelope` — no ANSI escape interpretation. */
export function getTerminalContextForSkia(): string {
    if (transcripts.size === 0) {
        return "";
    }
    const parts: string[] = [];
    for (const [id, text] of transcripts) {
        const stripped = text.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
        if (!stripped.trim()) continue;
        const slice = stripped.length > 12_000 ? `${stripped.slice(-12_000)}\n...[older terminal output truncated]` : stripped;
        parts.push(`--- terminal session ${id.slice(0, 8)}… ---\n${slice.trimEnd()}`);
    }
    if (!parts.length) return "";
    return (
        "### INTEGRATED_TERMINAL_TRANSCRIPT\n" +
        "Recent output from the user’s Forge IDE terminals (PowerShell on Windows). " +
        "Use this to diagnose build errors, paths, and command results the user ran.\n\n" +
        parts.join("\n\n") +
        "\n\n### END_INTEGRATED_TERMINAL_TRANSCRIPT\n\n"
    );
}
