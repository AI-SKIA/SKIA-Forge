import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import chokidar, { FSWatcher } from "chokidar";
import type { SkiarulesConfig, SkiarulesLoadError } from "./skiarulesTypes.js";
import { skiarulesConfigSchema } from "./skiarulesTypes.js";

const FILE = ".skiarules";
const RELOAD_DEBOUNCE_MS = 200;

export const SKIARULES_FILE = FILE;

function toErr(message: string, filePath: string, cause?: unknown): SkiarulesLoadError {
  return {
    ok: false,
    message,
    path: filePath,
    cause: cause instanceof Error ? cause.message : cause ? String(cause) : undefined
  };
}

export type LoadSkiarulesResult = { ok: true; config: SkiarulesConfig | null } | { ok: false; error: SkiarulesLoadError };

export async function loadSkiarules(projectRoot: string): Promise<LoadSkiarulesResult> {
  const filePath = path.join(projectRoot, FILE);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      return { ok: true, config: null };
    }
    return { ok: false, error: toErr("Failed to read .skiarules.", filePath, e) };
  }
  let data: unknown;
  try {
    data = YAML.parse(raw) ?? {};
  } catch (e) {
    return { ok: false, error: toErr("Invalid YAML in .skiarules.", filePath, e) };
  }
  if (data === null || typeof data !== "object") {
    return { ok: false, error: toErr(".skiarules must parse to an object.", filePath, undefined) };
  }
  const parsed = skiarulesConfigSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: toErr(`Schema validation failed: ${parsed.error.message}`, filePath, parsed.error)
    };
  }
  return { ok: true, config: parsed.data };
}

export function createSkiarulesWatcher(
  projectRoot: string,
  onChange: (result: LoadSkiarulesResult) => void
): { watcher: FSWatcher; close: () => Promise<void> } {
  const p = path.join(projectRoot, FILE);
  const watcher = chokidar.watch(p, { ignoreInitial: true, persistent: true, awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 100 } });
  let t: ReturnType<typeof setTimeout> | null = null;
  const run = () => {
    if (t) {
      clearTimeout(t);
    }
    t = setTimeout(async () => {
      t = null;
      onChange(await loadSkiarules(projectRoot));
    }, RELOAD_DEBOUNCE_MS);
  };
  watcher.on("add", run);
  watcher.on("change", run);
  watcher.on("unlink", run);
  return {
    watcher,
    close: async () => {
      if (t) {
        clearTimeout(t);
        t = null;
      }
      await watcher.close();
    }
  };
}
