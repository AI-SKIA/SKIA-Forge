import test from "node:test";
import assert from "node:assert/strict";
import {
  structuralRelevanceForEmbed,
  recencyFactor01,
  hybridEmbedProduct,
  rankVectorHitsHybrid,
  readHybridRankEnv,
  candidateCountForTopK
} from "./embedSearchRanking.js";
import type { StoredEmbeddingRow } from "./vectorStoreFile.js";

const baseRow = (o: Partial<StoredEmbeddingRow>): StoredEmbeddingRow => ({
  id: "id1",
  filePath: "src/x.ts",
  language: "typescript",
  kind: "function",
  name: "parseConfig",
  parentName: "Config",
  startLine: 1,
  endLine: 10,
  contentPreview: "function parseConfig() { }",
  mtimeIso: "2020-01-01T00:00:00.000Z",
  dimensions: 3,
  vector: [1, 0, 0],
  embeddedAt: "2020-01-01T00:00:00.000Z",
  ...o
});

test("structuralRelevance is higher when query terms match name/kind", () => {
  const a = baseRow({ name: "unrelated" });
  const b = baseRow({ name: "parseConfig" });
  assert.ok(
    structuralRelevanceForEmbed("parseConfig handler", b) >=
      structuralRelevanceForEmbed("parseConfig handler", a)
  );
});

test("recencyFactor01 prefers newer embeddedAt", () => {
  const now = new Date("2024-06-15T00:00:00.000Z").getTime();
  const old = baseRow({ embeddedAt: "2020-01-01T00:00:00.000Z" });
  const young = baseRow({ embeddedAt: "2024-06-10T00:00:00.000Z" });
  assert.ok(recencyFactor01(young, now, 7) > recencyFactor01(old, now, 7));
});

test("hybridEmbedProduct multiplies vector × structural × recency", () => {
  const cfg = readHybridRankEnv({} as NodeJS.ProcessEnv);
  const row = baseRow({ name: "queryterm" });
  const hit = { row, score: 0.8 };
  const p = hybridEmbedProduct("queryterm", hit, Date.now(), cfg);
  assert.ok(p.vector > 0);
  assert.ok(p.structural > 0);
  assert.ok(p.recency > 0);
  assert.equal(p.score, p.vector * p.structural * p.recency);
});

test("rankVectorHitsHybrid sorts by hybrid score", () => {
  const cfg = readHybridRankEnv({} as NodeJS.ProcessEnv);
  const pool = [
    { row: baseRow({ name: "unrelated" }), score: 0.9 },
    { row: baseRow({ name: "targetHelper" }), score: 0.9 }
  ];
  const out = rankVectorHitsHybrid(
    "targetHelper",
    pool,
    new Date("2020-01-10").getTime(),
    { ...cfg, structFloor: 0.01, recencyFloor: 0.01, minCandidateExtra: 12, candidateMult: 4, recencyHalfLifeDays: 7 }
  );
  assert.equal(out[0]!.row.name, "targetHelper");
});

test("candidateCountForTopK is capped and scales with topK", () => {
  const cfg = readHybridRankEnv({} as NodeJS.ProcessEnv);
  assert.equal(candidateCountForTopK(8, cfg, 50), 32);
  assert.equal(candidateCountForTopK(50, cfg, 50), 50);
});
