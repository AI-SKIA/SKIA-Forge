import { getEditor } from "../editor/monacoSetup";
import { getAuthToken } from "./skiaAuthPanel";
import { setActiveFile } from "./skiaSessionStore";
import {
    runForgeAgentDecompose,
    runForgeAgentExecute,
    runForgeAgentPlan,
    type FileMutationPreview
} from "./skiaForgeAgentClient";
import {
    applyUnifiedDiffToText,
    contentFromDiffPayload,
    type ForgeIdeAgentStreamEvent
} from "./skiaForgeAgentStream";

let activeAgentController: AbortController | null = null;
const pendingPreviews = new Map<string, FileMutationPreview>();

const resolveFilePath = (relPath: string): string => {
    const root = (localStorage.getItem("skia_workspace_path") || "").trim().replace(/\\/g, "/").replace(/\/$/, "");
    const rel = relPath.replace(/\\/g, "/").replace(/^\//, "");
    if (!root || root === "browser-workspace") return relPath;
    if (/^[a-zA-Z]:\//.test(rel) || rel.startsWith("/")) return rel;
    return `${root}/${rel}`;
};

const appendLogRow = (
    logHost: HTMLElement,
    event: ForgeIdeAgentStreamEvent,
    onPreviewAction?: (preview: FileMutationPreview, action: "apply" | "reject") => void
): void => {
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

    if (event.type === "diff" && event.path && event.previewKey) {
        const preview = pendingPreviews.get(event.previewKey);
        const actions = document.createElement("div");
        actions.className = "agent-log-actions";
        const applyBtn = document.createElement("button");
        applyBtn.type = "button";
        applyBtn.textContent = "APPLY";
        applyBtn.addEventListener("click", () => {
            if (preview && onPreviewAction) onPreviewAction(preview, "apply");
            else void applyAgentEdit(event.path!, event.payload);
        });
        const rejectBtn = document.createElement("button");
        rejectBtn.type = "button";
        rejectBtn.textContent = "REJECT";
        rejectBtn.addEventListener("click", () => {
            if (preview && onPreviewAction) onPreviewAction(preview, "reject");
            row.classList.add("agent-log-rejected");
        });
        const openBtn = document.createElement("button");
        openBtn.type = "button";
        openBtn.textContent = "OPEN";
        openBtn.addEventListener("click", () => {
            void openAgentFile(event.path!);
        });
        actions.append(applyBtn, rejectBtn, openBtn);
        row.appendChild(actions);
    } else if (event.type === "diff" && event.path) {
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

async function applyAgentEdit(relPath: string, diffPayload: string, afterOverride?: string): Promise<void> {
    const abs = resolveFilePath(relPath);
    let nextContent = afterOverride ?? contentFromDiffPayload(diffPayload);
    try {
        const existing = await window.skiaElectron.readFileText(abs);
        const merged = applyUnifiedDiffToText(existing, diffPayload);
        if (merged !== null) nextContent = afterOverride ?? merged;
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
    pendingPreviews.clear();
    if (summaryEl) summaryEl.textContent = "";

    activeAgentController = new AbortController();
    const signal = activeAgentController.signal;

    appendLogRow(logHost, { type: "thought", payload: "Planning with Forge agent (context + tools)…" });
    if (signal.aborted) return;

    const planned = await runForgeAgentPlan(goal);
    if (!planned.ok || !planned.plan) {
        appendLogRow(logHost, { type: "error", payload: planned.error ?? "Plan failed." });
        activeAgentController = null;
        return;
    }

    if (summaryEl) {
        summaryEl.textContent = `${planned.plan.title}\n${planned.plan.goalRestatement ?? ""}`.trim();
    }
    appendLogRow(logHost, {
        type: "thought",
        payload: `Plan: ${planned.plan.steps.map((s) => s.title).join(" → ")}`
    });

    if (signal.aborted) return;
    appendLogRow(logHost, { type: "thought", payload: "Decomposing plan into tool steps…" });
    const decomposed = await runForgeAgentDecompose(goal, planned.path, planned.plan);
    if (!decomposed.ok) {
        appendLogRow(logHost, { type: "error", payload: decomposed.error ?? "Decompose failed." });
        activeAgentController = null;
        return;
    }
    if (decomposed.usedFallback) {
        appendLogRow(logHost, {
            type: "thought",
            payload: `Using server fallback tool steps${decomposed.error ? ` (${decomposed.error})` : ""}.`
        });
    }

    if (signal.aborted) return;
    appendLogRow(logHost, { type: "thought", payload: "Running executor preview (tool registry)…" });
    const preview = await runForgeAgentExecute({
        path: planned.path,
        plan: decomposed.plan,
        steps: decomposed.steps,
        mode: "preview"
    });

    if (!preview.ok && preview.result.error) {
        appendLogRow(logHost, { type: "error", payload: preview.result.error });
    }

    const sessionPath = planned.path;
    const sessionPlan = decomposed.plan;
    const sessionSteps = decomposed.steps;

    const handlePreviewAction = async (p: FileMutationPreview, action: "apply" | "reject"): Promise<void> => {
        if (action === "reject") {
            pendingPreviews.delete(`${p.stepId}:${p.path}`);
            appendLogRow(logHost, { type: "thought", payload: `Rejected ${p.path}` });
            return;
        }
        appendLogRow(logHost, { type: "tool_start", payload: `Applying ${p.path}…`, tool: "write_file" });
        const applied = await runForgeAgentExecute({
            path: sessionPath,
            plan: sessionPlan,
            steps: sessionSteps,
            mode: "apply",
            fileMutationApprovals: { [p.stepId]: true }
        });
        if (applied.ok) {
            await applyAgentEdit(p.path, p.diff, p.after);
            pendingPreviews.delete(`${p.stepId}:${p.path}`);
            appendLogRow(logHost, { type: "tool_end", payload: `Applied ${p.path}`, status: "ok" });
        } else {
            appendLogRow(logHost, {
                type: "error",
                payload: applied.result.error || applied.result.stopReason || "Apply failed."
            });
        }
    };

    for (const p of preview.previews) {
        const key = `${p.stepId}:${p.path}`;
        pendingPreviews.set(key, p);
        appendLogRow(
            logHost,
            {
                type: "diff",
                path: p.path,
                payload: p.diff,
                step: 0,
                previewKey: key
            },
            handlePreviewAction
        );
    }

    if (!preview.previews.length) {
        appendLogRow(logHost, {
            type: "thought",
            payload: preview.result.stopReason || "Preview complete (no file mutations)."
        });
    } else {
        appendLogRow(logHost, {
            type: "thought",
            payload: `${preview.previews.length} file(s) ready — APPLY or REJECT each diff.`
        });
    }

    appendLogRow(logHost, { type: "thought", payload: "Task complete.", status: "ok" });
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
        pendingPreviews.clear();
        appendLogRow(logHost, { type: "error", payload: "Task cancelled." });
    });
};

export const cancelAgentTask = (): void => {
    activeAgentController?.abort();
    activeAgentController = null;
    pendingPreviews.clear();
};
