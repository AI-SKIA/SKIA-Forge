import type { Server } from "node:http";
import { WebSocketServer } from "ws";
import { InlineCompletionMessage, SkiaStatus } from "./types.js";
import { ProviderRouter } from "./providerRouter.js";

export function attachInlineCompletionServer(
  server: Server,
  providerRouter: ProviderRouter,
  getStatus: () => SkiaStatus
): void {
  const wss = new WebSocketServer({ server, path: "/inline-completion" });

  wss.on("connection", (socket) => {
    socket.send(
      JSON.stringify({
        type: "status",
        status: getStatus()
      } satisfies InlineCompletionMessage)
    );

    socket.on("message", (raw) => {
      try {
        const incoming = JSON.parse(String(raw)) as { prefix?: string };
        const prefix = String(incoming.prefix ?? "");
        const provider = providerRouter.routeForTask("completion");
        const completion = buildCompletion(prefix);
        socket.send(
          JSON.stringify({
            type: "completion",
            text: completion,
            provider
          } satisfies InlineCompletionMessage)
        );
      } catch {
        socket.send(
          JSON.stringify({
            type: "error",
            message: "Invalid inline completion payload."
          } satisfies InlineCompletionMessage)
        );
      }
    });
  });
}

function buildCompletion(prefix: string): string {
  if (!prefix.trim()) {
    return "function newFeature() {\n  // TODO: implement\n}";
  }
  return `${prefix}\n// SKIA suggestion: continue with focused implementation.`;
}
