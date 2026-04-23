import path from "node:path";
import * as lancedb from "@lancedb/lancedb";
import type { Connection, Table } from "@lancedb/lancedb";
import { SKIA_FULL_EMBED_DIM_DEFAULT } from "../../../skiaFullEmbeddingContract.js";
import type {
  EmbeddingSearchOptions,
  EmbeddingStoreStats,
  EmbeddingVectorStore
} from "./embeddingVectorStore.js";
import type { SemanticCodeChunk } from "./semanticChunking.js";
import type { StoredEmbeddingRow } from "./vectorStoreFile.js";

const TABLE = "skia_forge_embeddings_v1";
const VECTOR_COL = "vector";
const EXPECTED_LANCE_INDEX_SUFFIX = "vector";

function sqlLiteral(s: string): string {
  return `'${s.replaceAll("'", "''")}'`;
}

/** Up to 2 retries (3 total attempts) for transient Lance I/O. */
export async function withLanceRetry<T>(fn: () => Promise<T>): Promise<T> {
  const maxRetries = 2;
  let last: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

function rowToStored(r: Record<string, unknown>): StoredEmbeddingRow {
  return {
    id: String(r.id ?? ""),
    filePath: String(r.filePath ?? ""),
    language: String(r.language ?? ""),
    kind: String(r.kind ?? ""),
    name: String(r.name ?? ""),
    parentName: r.parentName == null || r.parentName === "" ? undefined : String(r.parentName),
    startLine: Number(r.startLine ?? 0),
    endLine: Number(r.endLine ?? 0),
    contentPreview: String(r.contentPreview ?? ""),
    mtimeIso: String(r.mtimeIso ?? ""),
    model: r.model == null || r.model === "" ? undefined : String(r.model),
    dimensions: Number(r.dimensions ?? 0),
    vector: (r[VECTOR_COL] as number[]) ?? [],
    embeddedAt: String(r.embeddedAt ?? "")
  };
}

/**
 * D1-04 + D1-03 — Lance: IVF or HNSW ANN, `nprobes` / `refineFactor`, optional SQL `where` (hybrid).
 * Queue and index HTTP handlers unchanged; tuning via `EmbeddingSearchOptions` + env defaults.
 */
export class LanceEmbeddingVectorStore implements EmbeddingVectorStore {
  private readonly uri: string;
  private readonly defaultDim: number;
  private readonly lanceEnv: NodeJS.ProcessEnv;
  private connection: Promise<Connection> | null = null;
  private table: Table | null = null;
  private lastUpdated = new Date().toISOString();

  constructor(projectRoot: string, env: NodeJS.ProcessEnv) {
    this.lanceEnv = env;
    this.uri =
      env.EMBED_LANCE_URI?.trim() ||
      path.join(projectRoot, ".skia", "lance-embeddings");
    const d = parseInt(env.SKIA_FULL_EMBED_DIM ?? String(SKIA_FULL_EMBED_DIM_DEFAULT), 10);
    this.defaultDim = Number.isFinite(d) && d > 0 ? d : SKIA_FULL_EMBED_DIM_DEFAULT;
  }

  private get indexMode(): "off" | "ivf" | "hnsw" {
    const m = (this.lanceEnv.EMBED_LANCE_VECTOR_INDEX ?? "ivf").toLowerCase().replaceAll("-", "_");
    if (m === "off" || m === "none" || m === "false" || m === "0") {
      return "off";
    }
    if (m === "hnsw" || m === "hnswpq" || m === "hnsw_sq" || m === "hnswsq") {
      return "hnsw";
    }
    return "ivf";
  }

  private get minIndexRows(): number {
    const n = parseInt(this.lanceEnv.EMBED_LANCE_INDEX_MIN_ROWS ?? "64", 10);
    return Number.isFinite(n) && n > 0 ? n : 64;
  }

  get storePath(): string {
    return this.uri;
  }

  private async getDb(): Promise<Connection> {
    if (!this.connection) {
      this.connection = withLanceRetry(async () => lancedb.connect(this.uri));
    }
    return this.connection;
  }

  private async getTableForRead(): Promise<Table | null> {
    if (this.table) {
      return this.table;
    }
    const db = await this.getDb();
    const names = await db.tableNames();
    if (!names.includes(TABLE)) {
      return null;
    }
    this.table = await db.openTable(TABLE);
    return this.table;
  }

  private async getTableForWrite(vectorDim: number): Promise<Table> {
    if (this.table) {
      return this.table;
    }
    const db = await this.getDb();
    const names = await db.tableNames();
    if (names.includes(TABLE)) {
      this.table = await db.openTable(TABLE);
      return this.table;
    }
    const dim = vectorDim > 0 ? vectorDim : this.defaultDim;
    const zero = new Float32Array(dim);
    const placeholder: Record<string, unknown> = {
      id: "__skia_forge_init__",
      filePath: "",
      language: "",
      kind: "",
      name: "",
      parentName: "",
      startLine: 1,
      endLine: 1,
      contentPreview: "",
      mtimeIso: new Date().toISOString(),
      model: "",
      dimensions: dim,
      vector: Array.from(zero),
      embeddedAt: new Date().toISOString()
    };
    this.table = await db.createTable(TABLE, [placeholder], { mode: "create" });
    await this.table.delete(`id = ${sqlLiteral("__skia_forge_init__")}`);
    return this.table;
  }

  private static expectedDim(items: { vector: number[] }[]): number {
    if (items.length === 0) {
      return 0;
    }
    const d0 = items[0]!.vector.length;
    for (const it of items) {
      if (it.vector.length !== d0) {
        throw new Error(
          `Embedding dimension mismatch in batch: ${it.vector.length} vs ${d0}`
        );
      }
    }
    return d0;
  }

  private async hasVectorIndex(tbl: Table): Promise<boolean> {
    const indices = await tbl.listIndices();
    return indices.some(
      (i) =>
        (i.name && i.name.includes(EXPECTED_LANCE_INDEX_SUFFIX)) ||
        (i.columns as string[] | undefined)?.includes(VECTOR_COL)
    );
  }

  private async maybeBuildVectorIndex(tbl: Table): Promise<void> {
    if (this.indexMode === "off") {
      return;
    }
    const n = await tbl.countRows();
    if (n < this.minIndexRows) {
      return;
    }
    if (await this.hasVectorIndex(tbl)) {
      return;
    }
    const config =
      this.indexMode === "hnsw"
        ? lancedb.Index.hnswPq({ distanceType: "cosine", numPartitions: 1 })
        : lancedb.Index.ivfPq({
            distanceType: "cosine",
            numPartitions: Math.max(1, Math.min(128, Math.floor(Math.sqrt(n))))
          });
    const waitSec = Math.min(
      600,
      Math.max(30, parseInt(this.lanceEnv.EMBED_LANCE_INDEX_BUILD_TIMEOUT_SEC ?? "300", 10) || 300)
    );
    try {
      await tbl.createIndex(VECTOR_COL, {
        config,
        replace: true,
        waitTimeoutSeconds: waitSec
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      process.emitWarning(
        `[LanceEmbeddingVectorStore] createIndex failed; ANN may be unavailable: ${msg}`,
        { code: "SKIA_LANCE_INDEX" }
      );
    }
  }

  async replaceFileEmbeddings(
    filePathRel: string,
    mtimeIso: string,
    language: string,
    model: string | undefined,
    items: { chunk: SemanticCodeChunk; vector: number[] }[]
  ): Promise<void> {
    return withLanceRetry(async () => {
      const dim = LanceEmbeddingVectorStore.expectedDim(
        items.map((i) => ({ vector: i.vector }))
      );
      const tbl = await this.getTableForWrite(dim);
      const pred = `filePath = ${sqlLiteral(filePathRel)}`;
      await tbl.delete(pred);
      if (items.length === 0) {
        this.lastUpdated = new Date().toISOString();
        return;
      }
      if (dim === 0) {
        return;
      }
      const now = new Date().toISOString();
      const rows: Record<string, unknown>[] = [];
      for (const { chunk, vector } of items) {
        if (vector.length !== dim) {
          throw new Error(
            `Vector length ${vector.length} does not match batch dimension ${dim}`
          );
        }
        rows.push({
          id: chunk.id,
          filePath: filePathRel,
          language,
          kind: chunk.kind,
          name: chunk.name,
          parentName: chunk.parentName ?? "",
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          contentPreview: chunk.content.slice(0, 200),
          mtimeIso,
          model: model ?? "",
          dimensions: vector.length,
          vector: Array.from(vector),
          embeddedAt: now
        });
      }
      await tbl.add(rows, { mode: "append" });
      this.lastUpdated = now;
      await this.maybeBuildVectorIndex(tbl);
    });
  }

  async getStats(): Promise<EmbeddingStoreStats> {
    return withLanceRetry(async () => {
      const t = await this.getTableForRead();
      if (!t) {
        return {
          rowCount: 0,
          storePath: this.uri,
          updatedAt: this.lastUpdated,
          lanceVectorIndex: { type: this.indexMode, present: false }
        };
      }
      const rowCount = await t.countRows();
      const present = rowCount > 0 && (await this.hasVectorIndex(t));
      return {
        rowCount,
        storePath: this.uri,
        updatedAt: this.lastUpdated,
        lanceVectorIndex: { type: this.indexMode, present }
      };
    });
  }

  async searchByVector(
    queryVector: number[],
    topK: number,
    options?: EmbeddingSearchOptions
  ): Promise<{ row: StoredEmbeddingRow; score: number }[]> {
    return withLanceRetry(async () => {
      const t = await this.getTableForRead();
      if (!t) {
        return [];
      }
      const n = await t.countRows();
      if (n === 0) {
        return [];
      }
      const bypass = options?.bypassVectorIndex === true;
      let vq = t
        .vectorSearch(queryVector)
        .column(VECTOR_COL)
        .limit(topK)
        .distanceType("cosine");
      if (options?.where?.trim()) {
        vq = vq.where(options.where.trim()) as typeof vq;
      }
      if (bypass) {
        vq = vq.bypassVectorIndex();
      }
      const np = options?.nprobes;
      if (np != null && Number.isFinite(np)) {
        vq = vq.nprobes(Math.max(1, Math.floor(np)));
      }
      const rf = options?.refineFactor;
      if (rf != null && Number.isFinite(rf)) {
        vq = vq.refineFactor(Math.max(1, Math.floor(rf)));
      }
      const raw = (await vq.toArray()) as Record<string, unknown>[];
      return raw.map((row) => {
        const d = row._distance;
        const dist = typeof d === "number" ? d : Number(d);
        const score = Number.isFinite(dist) ? Math.max(0, 1 - dist) : 0;
        return { row: rowToStored(row), score };
      });
    });
  }
}
