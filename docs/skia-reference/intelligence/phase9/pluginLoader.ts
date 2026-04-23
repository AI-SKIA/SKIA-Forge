import { createHash, createVerify } from "crypto";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";

export interface PluginManifest {
  id: string;
  entry: string;
  integritySha256?: string;
  signature?: string;
}

function readManifest(pluginRoot: string): PluginManifest | null {
  const p = join(pluginRoot, "manifest.json");
  if (!existsSync(p)) return null;
  try {
    const raw = readFileSync(p, "utf8");
    const m = JSON.parse(raw) as PluginManifest;
    if (!m?.id || !m?.entry) return null;
    return m;
  } catch {
    return null;
  }
}

export function discoverPlugins(rootPath: string): string[] {
  if (!existsSync(rootPath)) return [];
  const out: string[] = [];
  for (const ent of readdirSync(rootPath, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const dir = join(rootPath, ent.name);
    if (readManifest(dir)) out.push(ent.name);
  }
  return out.sort();
}

export function validatePluginSignature(pluginRoot: string): boolean {
  const manifest = readManifest(pluginRoot);
  if (!manifest) return false;

  const entryPath = join(pluginRoot, manifest.entry);
  if (!existsSync(entryPath)) return false;
  const bundle = readFileSync(entryPath);

  if (manifest.integritySha256) {
    const digest = createHash("sha256").update(bundle).digest("hex");
    if (digest !== manifest.integritySha256) return false;
  }

  const pub = process.env.SKIA_PLUGIN_SIGNING_PUB_PEM?.trim();
  if (pub && manifest.signature) {
    try {
      const verify = createVerify("RSA-SHA256");
      verify.update(bundle);
      verify.end();
      if (!verify.verify(pub, Buffer.from(manifest.signature, "base64"))) return false;
    } catch {
      return false;
    }
  } else if (manifest.signature && !pub) {
    return false;
  } else if (!manifest.integritySha256) {
    return false;
  }

  return true;
}

export function loadPlugin(pluginId: string): boolean {
  const root = process.env.SKIA_PLUGIN_ROOT?.trim();
  if (!root) return false;
  const base = join(root, pluginId);
  return validatePluginSignature(base);
}

export function unloadPlugin(pluginId: string): boolean {
  const root = process.env.SKIA_PLUGIN_ROOT?.trim();
  if (!root) return false;
  const base = join(root, pluginId);
  return existsSync(base);
}
