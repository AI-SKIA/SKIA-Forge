import fs from "node:fs/promises";
import type { IncomingMessage, Server } from "node:http";
import { WebSocketServer } from "ws";
import { InlineCompletionMessage, SkiaStatus } from "./types.js";
import { ProviderRouter } from "./providerRouter.js";
import type { SkiaFullAdapter } from "./skiaFullAdapter.js";
import type { ContextEngine } from "./contextEngine.js";
import type { TelemetryStore } from "./telemetry.js";
import { extractTextFromSkiaChatResponse } from "./forge/modules/agent-planner/agentPlannerRequest.js";
import { assertSafeFilePath } from "./forge/modules/tools/toolPath.js";
import { verifyBearerToken } from "./middleware/requireAuth.js";

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

/** Browsers cannot set headers on a WebSocket, so the JWT may ride in the subprotocol list. */
export const INLINE_WS_BEARER_PROTOCOL = "skia.bearer";

function tokenFromUpgrade(req: IncomingMessage): string | undefined {
  const auth = req.headers.authorization?.trim();
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const protocols = String(req.headers["sec-websocket-protocol"] ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const i = protocols.indexOf(INLINE_WS_BEARER_PROTOCOL);
  return i >= 0 ? protocols[i + 1] : undefined;
}

export function attachInlineCompletionServer(server: Server, deps: InlineCompletionDeps): void {
  const tokens = new WeakMap<IncomingMessage, string>();
  const wss = new WebSocketServer({
    server,
    path: "/inline-completion",
    verifyClient: ({ req }, done) => {
      const token = tokenFromUpgrade(req);
      if (!verifyBearerToken(token)) {
        done(false, 401, "Unauthorized");
        return;
      }
      tokens.set(req, token as string);
      done(true);
    },
    handleProtocols: (protocols) =>
      protocols.has(INLINE_WS_BEARER_PROTOCOL) ? INLINE_WS_BEARER_PROTOCOL : false
  });

  wss.on("connection", (socket, req) => {
    const token = tokens.get(req);
    const upstreamHeaders: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {};
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
          const completion = await buildLlmCompletion(prefix, incoming, deps, upstreamHeaders);
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
  const safe = assertSafeFilePath(projectRoot, relPath.replace(/\\/g, "/"));
  if (!safe.ok) return "";
  try {
    const text = await fs.readFile(safe.absPath, "utf8");
    if (text.length <= maxChars) return text;
    return text.slice(-maxChars);
  } catch {
    return "";
  }
}

async function buildLlmCompletion(
  prefix: string,
  incoming: { filePath?: string; language?: string },
  deps: InlineCompletionDeps,
  upstreamHeaders: Record<string, string>
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
    const upstream = await deps.skia.intelligence(prompt, "code", { ...deps.pickHeaders?.(), ...upstreamHeaders });
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
