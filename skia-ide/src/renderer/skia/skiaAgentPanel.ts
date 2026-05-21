import { getEditor } from "../editor/monacoSetup";
import { getAuthToken } from "./skiaAuthPanel";
import { getForgeAgentPipelineUrl } from "./skiaConfig";
import { applyIdeBrainToMessagesPayload } from "./skiaIdeBrainContext";
import { getWorkspacePath, setActiveFile } from "./skiaSessionStore";
import {
    applyUnifiedDiffToText,
    consumeForgeAgentSseStream,
    contentFromDiffPayload,
    type ForgeIdeAgentStreamEvent
} from "./skiaForgeAgentStream";

let activeAgentController: AbortController | null = null;

const resolveFilePath = (relPath: string): string => {
    const root = getWorkspacePath().trim().replace(/\\/g, "/").replace(/\/$/, "");
    const rel = relPath.replace(/\\/g, "/").replace(/^\//, "");
    if (!root || root === "browser-workspace") return relPath;
    if (/^[a-zA-Z]:\//.test(rel) || rel.startsWith("/")) return rel;
    return `${root}/${rel}`;
};

const appendLogRow = (logHost: HTMLElement, event: ForgeIdeAgentStreamEvent): void => {
    const row = document.createElement("div");
    row.className = `agent-log-row agent-log-${event.type}${event.type === "diff" ? " agent-log-diff" : ""}`;

    const head = document.createElement("div");
    head.className = "agent-log-head";
    const label = event.tool || event.type.replace(/_/g, " ");
    head.textContent = `[${event.step ?? "·"}] ${label.toUpperCase()}`;
    row.appendChild(head);

    const body = document.createElement("div");
    body.className = "agent-log-body";
    if (event.type === "diff" && event.path) {
        body.textContent = `${event.path}\n${event.payload.slice(0, 400)}${event.payload.length > 400 ? "…" : ""}`;
    } else {
        body.textContent = event.payload;
    }
    row.appendChild(body);

    if (event.type === "diff" && event.path) {
        const actions = document.createElement("div");
        actions.className = "agent-log-actions";
        const applyBtn = document.createElement("button");
        applyBtn.type = "button";
        applyBtn.textContent = "APPLY";
        applyBtn.addEventListener("click", () => {
            void applyAgentEdit(event.path!, event.payload);
        });
        const openBtn = document.createElement("button");
        openBtn.type = "button";
        openBtn.textContent = "OPEN";
        openBtn.addEventListener("click", () => {
            void openAgentFile(event.path!);
        });
        actions.append(applyBtn, openBtn);
        row.appendChild(actions);
    }

    logHost.appendChild(row);
    logHost.scrollTop = logHost.scrollHeight;
};

async function openAgentFile(relPath: string): Promise<void> {
    const abs = resolveFilePath(relPath);
    try {
        const text = await window.skiaElectron.readFileText(abs);
        const editor = getEditor() as { setValue?: (v: string) => void } | null;
        if (editor?.setValue) {
            editor.setValue(text);
            setActiveFile(abs);
        }
    } catch {
        /* file may not exist yet */
    }
}

async function applyAgentEdit(relPath: string, diffPayload: string): Promise<void> {
    const abs = resolveFilePath(relPath);
    let nextContent = contentFromDiffPayload(diffPayload);
    try {
        const existing = await window.skiaElectron.readFileText(abs);
        const merged = applyUnifiedDiffToText(existing, diffPayload);
        if (merged !== null) nextContent = merged;
    } catch {
        /* new file */
    }
    const ok = await window.skiaElectron.saveFile(abs, nextContent);
    if (ok) {
        const editor = getEditor() as { setValue?: (v: string) => void } | null;
        if (editor?.setValue) {
            editor.setValue(nextContent);
            setActiveFile(abs);
        }
    }
}

const runAgentTask = async (goal: string, logHost: HTMLElement, summaryEl: HTMLElement | null): Promise<void> => {
    const token = getAuthToken();
    if (!token) {
        appendLogRow(logHost, { type: "error", payload: "Sign in to run agent tasks." });
        return;
    }

    logHost.innerHTML = "";
    if (summaryEl) summaryEl.textContent = "";

    const messagesPayload = await applyIdeBrainToMessagesPayload([{ role: "user", content: goal }]);

    activeAgentController = new AbortController();

    const response = await fetch(getForgeAgentPipelineUrl(), {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            "x-skia-client": "forge-desktop"
        },
        body: JSON.stringify({
            goal,
            messages: messagesPayload,
            source: "skia-forge-ide",
            style: "Sovereign",
            includeReasoning: false,
            responseDepth: "Balanced",
            mode: "agent"
        }),
        signal: activeAgentController.signal
    });

    if (response.status === 401) {
        appendLogRow(logHost, { type: "error", payload: "Session expired — sign in again." });
        return;
    }
    if (!response.ok || !response.body) {
        let err = `Agent request failed (${response.status})`;
        try {
            const j = (await response.json()) as { error?: string };
            if (j.error) err = j.error;
        } catch {
            /* ignore */
        }
        appendLogRow(logHost, { type: "error", payload: err });
        return;
    }

    let answer = "";
    await consumeForgeAgentSseStream(response.body, (ev) => {
        if (ev.type === "token") {
            answer += ev.payload;
            if (summaryEl) summaryEl.textContent = answer;
            return;
        }
        if (ev.type === "done") {
            answer = ev.payload || answer;
            if (summaryEl) summaryEl.textContent = answer;
            appendLogRow(logHost, { type: "thought", payload: "Task complete.", status: "ok" });
            return;
        }
        appendLogRow(logHost, ev);
    });

    activeAgentController = null;
};

export const initializeAgentPanel = (): void => {
    const input = document.getElementById("agent-task-input") as HTMLInputElement | null;
    const runBtn = document.getElementById("agent-run-btn") as HTMLButtonElement | null;
    const cancelBtn = document.getElementById("agent-cancel-btn") as HTMLButtonElement | null;
    const logHost = document.getElementById("agent-log") as HTMLDivElement | null;
    const summaryHost = document.getElementById("agent-summary") as HTMLDivElement | null;

    if (!input || !runBtn || !logHost) {
        console.error("SKIA: Agent panel DOM not found");
        return;
    }

    const submit = (): void => {
        const goal = input.value.trim();
        if (!goal) return;
        runBtn.disabled = true;
        void runAgentTask(goal, logHost, summaryHost).finally(() => {
            runBtn.disabled = false;
        });
    };

    runBtn.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            submit();
        }
    });

    cancelBtn?.addEventListener("click", () => {
        activeAgentController?.abort();
        activeAgentController = null;
        appendLogRow(logHost, { type: "error", payload: "Task cancelled." });
    });
};

export const cancelAgentTask = (): void => {
    activeAgentController?.abort();
    activeAgentController = null;
};
