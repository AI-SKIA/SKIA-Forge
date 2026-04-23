export interface McpCapability {
  id: string;
  description: string;
}

const ALLOWED_HOST = process.env.SKIA_MCP_ALLOWED_HOST || "";

function assertSafeEndpoint(url: string): URL {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error("Invalid MCP endpoint URL");
  }
  if (u.protocol !== "https:" && process.env.NODE_ENV === "production") {
    throw new Error("MCP endpoints must use HTTPS in production");
  }
  if (ALLOWED_HOST && u.hostname !== ALLOWED_HOST) {
    throw new Error("MCP host not allowlisted");
  }
  return u;
}

export function connectToMcpServers(endpoints: string[]): boolean {
  if (!Array.isArray(endpoints) || endpoints.length === 0) return false;
  try {
    endpoints.forEach((e) => assertSafeEndpoint(e));
    return true;
  } catch {
    return false;
  }
}

export function registerCapabilities(capabilities: McpCapability[]): boolean {
  if (!Array.isArray(capabilities)) return false;
  return capabilities.every((c) => typeof c.id === "string" && c.id.length > 0 && /^[a-z0-9._-]+$/i.test(c.id));
}

export function routeMcpRequest(requestType: string, payload: string): string {
  if (!/^[a-z0-9._-]{1,64}$/i.test(requestType)) {
    return JSON.stringify({ ok: false, error: "invalid_request_type" });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return JSON.stringify({ ok: false, error: "invalid_json_payload" });
  }
  if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
    return JSON.stringify({ ok: true, requestType, keys: Object.keys(parsed as object).slice(0, 32) });
  }
  return JSON.stringify({ ok: false, error: "payload_must_be_object" });
}
