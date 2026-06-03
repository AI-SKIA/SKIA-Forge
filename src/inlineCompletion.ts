import fs from "node:fs/promises";
import path from "node:path";
import type { Server } from "node:http";
import { WebSocketServer } from "ws";
import { InlineCompletionMessage, SkiaStatus } from "./types.js";
import { ProviderRouter } from "./providerRouter.js";
import type { SkiaFullAdapter } from "./skiaFullAdapter.js";
import type { ContextEngine } from "./contextEngine.js";
import type { TelemetryStore } from "./telemetry.js";
import { extractTextFromSkiaChatResponse } from "./forge/modules/agent-planner/agentPlannerRequest.js";

export type InlineCompletionDeps = {
  providerRouter: ProviderRouter;
  getStatus: () => SkiaStatus;
  skia: SkiaFullAdapter;
  contextEngine: ContextEngine;
  projectRoot: string;
  telemetry?: TelemetryStore;
  pickHeaders?: () => Record<string, string>;
};

const MAX_PREFIX_CHARS = 4_000;
const MAX_CONTEXT_CHARS = 2_000;
const MAX_COMPLETION_CHARS = 800;

export function attachInlineCompletionServer(server: Server, deps: InlineCompletionDeps): void {
  const wss = new WebSocketServer({ server, path: "/inline-completion" });

  wss.on("connection", (socket) => {
    socket.send(
      JSON.stringify({
        type: "status",
        status: deps.getStatus()
      } satisfies InlineCompletionMessage)
    );

    socket.on("message", (raw) => {
      void (async () => {
        const started = Date.now();
        try {
          const incoming = JSON.parse(String(raw)) as {
            prefix?: string;
            filePath?: string;
            language?: string;
          };
          const prefix = String(incoming.prefix ?? "");
          const provider = deps.providerRouter.routeForTask("completion");
          const completion = await buildLlmCompletion(prefix, incoming, deps);
          deps.telemetry?.record("inline_completion_latency_ms", Date.now() - started);
          socket.send(
            JSON.stringify({
              type: "completion",
              text: completion,
              provider
            } satisfies InlineCompletionMessage)
          );
        } catch (e) {
          const message = e instanceof Error ? e.message : "Invalid inline completion payload.";
          socket.send(
            JSON.stringify({
              type: "error",
              message
            } satisfies InlineCompletionMessage)
          );
        }
      })();
    });
  });
}

async function readFileContextSnippet(
  projectRoot: string,
  relPath: string,
  maxChars: number
): Promise<string> {
  const rel = relPath.replace(/\\/g, "/").replace(/^\//, "");
  const abs = path.join(projectRoot, rel);
  try {
    const text = await fs.readFile(abs, "utf8");
    if (text.length <= maxChars) return text;
    return text.slice(-maxChars);
  } catch {
    return "";
  }
}

async function buildLlmCompletion(
  prefix: string,
  incoming: { filePath?: string; language?: string },
  deps: InlineCompletionDeps
): Promise<string> {
  const trimmed = prefix.trim();
  if (!trimmed) {
    return "";
  }

  const prefixSlice = prefix.length > MAX_PREFIX_CHARS ? prefix.slice(-MAX_PREFIX_CHARS) : prefix;
  let repoContext = "";
  const relFile = String(incoming.filePath ?? "").trim();
  if (relFile) {
    repoContext = await readFileContextSnippet(deps.projectRoot, relFile, MAX_CONTEXT_CHARS);
    if (!repoContext) {
      try {
        const hits = await deps.contextEngine.search(trimmed.slice(-120) || relFile, 3);
        repoContext = hits
          .map((h) => `${h.chunk.filePath}:\n${h.chunk.content.slice(0, 400)}`)
          .join("\n---\n")
          .slice(0, MAX_CONTEXT_CHARS);
      } catch {
        /* index may be cold */
      }
    }
  }

  if (!deps.skia.getStatus().enabled) {
    return heuristicCompletion(prefixSlice);
  }

  const lang = incoming.language ? `Language: ${incoming.language}\n` : "";
  const prompt = [
    "You are an inline code completion engine for SKIA Forge.",
    "Output ONLY the text that should appear immediately after the user's cursor.",
    "No markdown fences, no explanations, no duplicate of the prefix.",
    lang,
    repoContext ? `File context (truncated):\n${repoContext}\n` : "",
    `Code prefix at cursor:\n${prefixSlice}`,
    "Continuation:"
  ].join("\n");

  try {
    const upstream = await deps.skia.intelligence(prompt, "code", deps.pickHeaders?.());
    const text = extractTextFromSkiaChatResponse(upstream as Record<string, unknown>).trim();
    if (!text) return heuristicCompletion(prefixSlice);
    const cleaned = stripCompletionArtifacts(text, prefixSlice);
    return cleaned.slice(0, MAX_COMPLETION_CHARS);
  } catch {
    return heuristicCompletion(prefixSlice);
  }
}

function stripCompletionArtifacts(text: string, prefix: string): string {
  let out = text.replace(/^```[\w]*\n?/i, "").replace(/\n?```$/i, "").trim();
  if (out.startsWith(prefix)) {
    out = out.slice(prefix.length);
  }
  const fenceIdx = out.indexOf("```");
  if (fenceIdx >= 0) out = out.slice(0, fenceIdx).trim();
  return out;
}

function heuristicCompletion(prefix: string): string {
  const lastLine = prefix.split(/\r?\n/).pop() ?? "";
  if (/^\s*$/.test(lastLine)) return "  ";
  if (lastLine.trimEnd().endsWith("{")) return "\n  \n}";
  if (lastLine.includes("function ") && !lastLine.includes("{")) return " {\n  \n}";
  return "";
}
