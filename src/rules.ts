import type { SkiarulesConfig } from "./forge/modules/skiarules/skiarulesTypes.js";
import { loadSkiarules } from "./forge/modules/skiarules/skiarulesLoader.js";

/**
 * @deprecated use SkiarulesConfig from skiarules for full typing.
 * Remaining bridge for governance and legacy callers; populated from the D1-12 deep loader.
 */
export type SkiaRules = SkiarulesConfig;

export async function loadSkiaRules(projectRoot: string): Promise<SkiaRules> {
  const r = await loadSkiarules(projectRoot);
  if (!r.ok) {
    console.warn(`[skia] .skiarules: ${r.error.message}`);
    return {};
  }
  if (r.config == null) {
    return {};
  }
  return r.config;
}
