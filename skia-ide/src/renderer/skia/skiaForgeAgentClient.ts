import { acceptForgeDecomposeResponse } from "../../../../src/lib/acceptForgeDecomposeResponse";
import { getAuthToken } from "./skiaAuthPanel";
import { forgeUrl } from "./skiaConfig";
import { getActiveFile, getWorkspacePath } from "./skiaSessionStore";

export { acceptForgeDecomposeResponse } from "../../../../src/lib/acceptForgeDecomposeResponse";

export type AgentPlanV1 = {
    version?: "1";
    title: string;
    goalRestatement?: string;
    steps: Array<{ id: string; title: string; detail?: string }>;
};

export type AgentExecutorStep = {
    stepId: string;
    tool: string;
    input: unknown;
};

export type FileMutationPreview = {
    stepId: string;
    path: string;
    diff: string;
    before?: string;
    after?: string;
};

export type AgentExecuteResult = {
    version?: string;
    path?: string;
    mode?: string;
    planTitle?: string;
    stepResults?: Array<{
        stepId?: string;
        status?: string;
        fileMutation?: { path: string; diff: string; before?: string; after?: string };
    }>;
    error?: string;
    stopReason?: string;
};

const forgeHeaders = (): HeadersInit => {
    const token = getAuthToken();
    return {
        "Content-Type": "application/json",
        "x-skia-client": "forge-desktop",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
};

const resolveAgentPath = (): string => {
    const active = getActiveFile().trim().replace(/\\/g, "/");
    const root = getWorkspacePath().trim().replace(/\\/g, "/").replace(/\/$/, "");
    if (active && root && active !== "browser-workspace" && active.startsWith(root)) {
        return active.slice(root.length).replace(/^\//, "") || "src/index.ts";
    }
    if (active && !active.includes("browser-workspace")) {
        if (/^[a-zA-Z]:\//.test(active) || active.startsWith("/")) {
            const parts = active.split("/");
            return parts.slice(-3).join("/") || "src/index.ts";
        }
        return active.replace(/^\//, "");
    }
    return "src/index.ts";
};

async function postForgeJson<T>(route: string, body: unknown): Promise<{ status: number; data: T }> {
    const res = await fetch(`${forgeUrl}${route}`, {
        method: "POST",
        headers: forgeHeaders(),
        body: JSON.stringify(body)
    });
    let data: T;
    try {
        data = (await res.json()) as T;
    } catch {
        data = {} as T;
    }
    return { status: res.status, data };
}

export async function runForgeAgentPlan(goal: string): Promise<{
    ok: boolean;
    status: number;
    plan: AgentPlanV1 | null;
    path: string;
    error?: string;
}> {
    const relPath = resolveAgentPath();
    const { status, data } = await postForgeJson<{
        plan?: AgentPlanV1 | null;
        parseError?: string;
        error?: string;
    }>("/api/forge/agent/plan", {
        goal,
        path: relPath,
        resilientRetrieval: true
    });
    if (status === 401) {
        return { ok: false, status, plan: null, path: relPath, error: "Session expired — sign in again." };
    }
    if (status !== 200 || !data.plan?.steps?.length) {
        return {
            ok: false,
            status,
            plan: data.plan ?? null,
            path: relPath,
            error: data.error || data.parseError || `Planner failed (${status})`
        };
    }
    return { ok: true, status, plan: data.plan, path: relPath };
}

export type ForgeDecomposeResponseBody = {
    steps?: AgentExecutorStep[];
    plan?: AgentPlanV1;
    error?: string;
};

export async function runForgeAgentDecompose(
    goal: string,
    path: string,
    plan: AgentPlanV1
): Promise<{
    ok: boolean;
    steps: AgentExecutorStep[];
    plan: AgentPlanV1;
    error?: string;
    usedFallback?: boolean;
}> {
    const { status, data } = await postForgeJson<ForgeDecomposeResponseBody>(
        "/api/forge/agent/decompose",
        { goal, path, plan }
    );
    return acceptForgeDecomposeResponse(status, data, plan);
}

export async function runForgeAgentExecute(args: {
    path: string;
    plan: AgentPlanV1;
    steps: AgentExecutorStep[];
    mode: "preview" | "apply";
    fileMutationApprovals?: Record<string, true>;
}): Promise<{ ok: boolean; status: number; result: AgentExecuteResult; previews: FileMutationPreview[] }> {
    const { status, data } = await postForgeJson<AgentExecuteResult>("/api/forge/agent/execute", {
        path: args.path,
        plan: { ...args.plan, version: "1" },
        steps: args.steps,
        mode: args.mode,
        fileMutationApprovals: args.fileMutationApprovals ?? {},
        highRiskCommandApprovals: {}
    });
    const previews: FileMutationPreview[] = [];
    for (const step of data.stepResults ?? []) {
        if (step.fileMutation?.path && step.fileMutation.diff) {
            previews.push({
                stepId: step.stepId ?? "",
                path: step.fileMutation.path,
                diff: step.fileMutation.diff,
                before: step.fileMutation.before,
                after: step.fileMutation.after
            });
        }
    }
    const ok = status === 200 && !data.stopReason && !data.error;
    return { ok, status, result: data, previews };
}
