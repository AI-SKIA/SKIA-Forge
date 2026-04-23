type ScopeMap = Record<string, { tools?: string[]; commands?: string[]; services?: string[] }>;

function readScopeMap(): ScopeMap {
  const raw = process.env.SKIA_PLUGIN_SCOPES_JSON?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as ScopeMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function getToolAccess(pluginId: string): string[] {
  const scopes = readScopeMap()[pluginId]?.tools;
  return Array.isArray(scopes) && scopes.length ? scopes : ["read:metadata"];
}

export function getCommandAccess(pluginId: string): string[] {
  const scopes = readScopeMap()[pluginId]?.commands;
  return Array.isArray(scopes) && scopes.length ? scopes : [];
}

export function getServiceAccess(pluginId: string): string[] {
  const scopes = readScopeMap()[pluginId]?.services;
  return Array.isArray(scopes) && scopes.length ? scopes : ["internal:telemetry"];
}
