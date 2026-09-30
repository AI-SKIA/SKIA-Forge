/**
 * Optional post-lexical-index embedding bootstrap (H5 / G2).
 * Default OFF — requires EMBED_BOOTSTRAP_AFTER_INDEX=true AND
 * SKIA_EMBEDDING_VECTOR_PROVISIONED=true.
 */

export function isEmbedBootstrapAfterIndexEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const bootstrap = (env.EMBED_BOOTSTRAP_AFTER_INDEX || "").toLowerCase() === "true";
  const provisioned = (env.SKIA_EMBEDDING_VECTOR_PROVISIONED || "").toLowerCase() === "true";
  return bootstrap && provisioned;
}

export function embedBootstrapMaxFiles(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.EMBED_BOOTSTRAP_MAX_FILES || 50);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 50;
}

/** Paths to feed runEmbedIndexRequest after buildIndex (capped). */
export function pathsForEmbedBootstrap(
  files: Array<{ path: string }>,
  env: NodeJS.ProcessEnv = process.env
): string[] {
  if (!isEmbedBootstrapAfterIndexEnabled(env)) return [];
  const max = embedBootstrapMaxFiles(env);
  return files.map((f) => f.path).filter(Boolean).slice(0, max);
}
