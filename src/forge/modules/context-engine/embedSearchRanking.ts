import { cosineLikeScore } from "../../../utils.js";
import type { StoredEmbeddingRow } from "./vectorStoreFile.js";

export type VectorSearchHit = { row: StoredEmbeddingRow; score: number };

const PREVIEW_SLICE = 400;

/** D1-05: keyword overlap of query against chunk structure + preview (0–1). */
export function structuralRelevanceForEmbed(
  query: string,
  row: StoredEmbeddingRow
): number {
  const text = [row.name, row.parentName ?? "", row.kind, row.filePath, row.contentPreview.slice(0, PREVIEW_SLICE)]
    .filter((s) => s.length > 0)
    .join(" ");
  return cosineLikeScore(query, text);
}

/**
 * Recency in (0,1] from the newest of `embeddedAt` and `mtimeIso` vs `now`.
 * Exponential falloff; halfLifeDays controls decay speed.
 */
export function recencyFactor01(
  row: StoredEmbeddingRow,
  nowMs: number,
  halfLifeDays: number
): number {
  const tEmb = Date.parse(row.embeddedAt);
  const tM = Date.parse(row.mtimeIso);
  const t = Math.max(
    Number.isFinite(tEmb) ? tEmb : 0,
    Number.isFinite(tM) ? tM : 0
  );
  if (t === 0) {
    return 0.5;
  }
  const halfMs = halfLifeDays * 24 * 60 * 60 * 1000;
  if (!Number.isFinite(halfMs) || halfMs <= 0) {
    return 1;
  }
  const age = Math.max(0, nowMs - t);
  return Math.min(1, Math.exp((-age * Math.LN2) / halfMs));
}

export type HybridRankEnv = {
  recencyHalfLifeDays: number;
  /** Minimum structural factor (avoids killing vector-only good hits). */
  structFloor: number;
  /** Minimum recency factor. */
  recencyFloor: number;
  /** Fetch at least this many L2 candidates before re-rank (capped 50 in caller). */
  candidateMult: number;
  minCandidateExtra: number;
};

const DEFAULTS: HybridRankEnv = {
  recencyHalfLifeDays: 21,
  structFloor: 0.1,
  recencyFloor: 0.12,
  candidateMult: 4,
  minCandidateExtra: 12
};

function parsePositive(s: string | undefined, def: number): number {
  const n = parseInt(s ?? "", 10);
  if (!Number.isFinite(n) || n <= 0) {
    return def;
  }
  return n;
}

function parsePositiveFloat(s: string | undefined, def: number): number {
  const n = parseFloat(s ?? "");
  if (!Number.isFinite(n) || n <= 0) {
    return def;
  }
  return n;
}

function optNonNegative01(envVal: string | undefined, def: number): number {
  const n = parseFloat(envVal ?? "");
  if (Number.isFinite(n) && n >= 0) {
    return Math.min(1, n);
  }
  return def;
}

export function readHybridRankEnv(env: NodeJS.ProcessEnv): HybridRankEnv {
  return {
    recencyHalfLifeDays: parsePositiveFloat(
      env.EMBED_HYBRID_RECENCY_HALF_LIFE_DAYS,
      DEFAULTS.recencyHalfLifeDays
    ),
    structFloor: optNonNegative01(env.EMBED_HYBRID_STRUCT_FLOOR, DEFAULTS.structFloor),
    recencyFloor: optNonNegative01(env.EMBED_HYBRID_RECENCY_FLOOR, DEFAULTS.recencyFloor),
    candidateMult: parsePositive(
      env.EMBED_HYBRID_CANDIDATE_MULT,
      DEFAULTS.candidateMult
    ),
    minCandidateExtra: parsePositive(
      env.EMBED_HYBRID_CANDIDATE_MIN_EXTRA,
      DEFAULTS.minCandidateExtra
    )
  };
}

function clamp01Float(x: number): number {
  if (!Number.isFinite(x) || x < 0) {
    return 0;
  }
  return Math.min(1, x);
}

/**
 * Hybrid score = (vector) × (struct) × (recency), each in [0,1] with floors on struct/rec.
 */
export function hybridEmbedProduct(
  query: string,
  hit: VectorSearchHit,
  nowMs: number,
  cfg: HybridRankEnv
): { score: number; vector: number; structural: number; recency: number } {
  const v = clamp01Float(hit.score);
  const sRaw = structuralRelevanceForEmbed(query, hit.row);
  const s = Math.max(cfg.structFloor, clamp01Float(sRaw));
  const rRaw = recencyFactor01(hit.row, nowMs, cfg.recencyHalfLifeDays);
  const r = Math.max(cfg.recencyFloor, clamp01Float(rRaw));
  return { score: v * s * r, vector: v, structural: s, recency: r };
}

/** L2 pool size: cap 50, at least `topK * mult` and `topK + extra`. */
export function candidateCountForTopK(
  topK: number,
  cfg: HybridRankEnv,
  cap = 50
): number {
  return Math.min(
    cap,
    Math.max(topK, topK * cfg.candidateMult, topK + cfg.minCandidateExtra)
  );
}

export function rankVectorHitsHybrid(
  query: string,
  hits: VectorSearchHit[],
  nowMs: number,
  cfg: HybridRankEnv
): { row: StoredEmbeddingRow; score: number; vectorScore: number; structural: number; recency: number }[] {
  const withParts = hits.map((h) => {
    const p = hybridEmbedProduct(query, h, nowMs, cfg);
    return {
      row: h.row,
      score: p.score,
      vectorScore: p.vector,
      structural: p.structural,
      recency: p.recency
    };
  });
  withParts.sort((a, b) => b.score - a.score);
  return withParts;
}
