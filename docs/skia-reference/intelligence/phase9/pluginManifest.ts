export interface PluginMetadata {
  name: string;
  version: string;
  author: string;
}

export interface PluginPermissions {
  scopes: string[];
}

export interface PluginCapabilities {
  tools: string[];
  commands: string[];
  services: string[];
}

export function defineMetadataSchema(): PluginMetadata {
  // TODO: Define plugin metadata schema and validation constraints.
  return { name: "", version: "", author: "" };
}

export function definePermissionsSchema(): PluginPermissions {
  // TODO: Define permissions schema for plugin isolation boundaries.
  return { scopes: [] };
}

export function defineCapabilitiesSchema(): PluginCapabilities {
  // TODO: Define capabilities schema for plugin-declared functionality.
  return { tools: [], commands: [], services: [] };
}
