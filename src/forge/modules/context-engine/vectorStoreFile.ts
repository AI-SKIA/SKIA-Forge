import fs from "node:fs/promises";
import path from "node:path";
import type {
  EmbeddingSearchOptions,
  EmbeddingStoreStats,
  EmbeddingVectorStore
} from "./embeddingVectorStore.js";
import type { SemanticCodeChunk } from "./semanticChunking.js";

const STORE_VERSION = 1;
const MAX_PREVIEW = 200;

export type StoredEmbeddingRow = {
  id: string;
  filePath: string;
  language: string;
  kind: string;
  name: string;
  parentName?: string;
  startLine: number;
  endLine: number;
  contentPreview: string;
  mtimeIso: string;
  model?: string;
  dimensions: number;
  vector: number[];
  embeddedAt: string;
};

type StoreFile = {
  version: number;
  updatedAt: string;
  rows: StoredEmbeddingRow[];
};

function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * D1-04 (file mode): JSON vector store under `.skia/` (not LanceDB) — portable, swap to Lance later.
 */
export class FileEmbeddingVectorStore implements EmbeddingVectorStore {
  private readonly filePath: string;
  private cache: StoreFile | null = null;

  constructor(projectRoot: string) {
    this.filePath = path.join(projectRoot, ".skia", "embeddings-v1.json");
  }

  get storePath(): string {
    return this.filePath;
  }

  private async load(): Promise<StoreFile> {
    if (this.cache) return this.cache;
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      this.cache = JSON.parse(raw) as StoreFile;
      if (!this.cache || !Array.isArray(this.cache.rows)) {
        this.cache = { version: STORE_VERSION, updatedAt: new Date().toISOString(), rows: [] };
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        this.cache = { version: STORE_VERSION, updatedAt: new Date().toISOString(), rows: [] };
      } else {
        throw e;
      }
    }
    return this.cache as StoreFile;
  }

  private async persist(s: StoreFile): Promise<void> {
    s.updatedAt = new Date().toISOString();
    this.cache = s;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(s, null, 2), "utf8");
  }

  async replaceFileEmbeddings(
    filePathRel: string,
    mtimeIso: string,
    language: string,
    model: string | undefined,
    items: { chunk: SemanticCodeChunk; vector: number[] }[]
  ): Promise<void> {
    const s = await this.load();
    s.rows = s.rows.filter((r) => r.filePath !== filePathRel);
    const now = new Date().toISOString();
    for (const { chunk, vector } of items) {
      s.rows.push({
        id: chunk.id,
        filePath: filePathRel,
        language,
        kind: chunk.kind,
        name: chunk.name,
        parentName: chunk.parentName,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        contentPreview: chunk.content.slice(0, MAX_PREVIEW),
        mtimeIso,
        model,
        dimensions: vector.length,
        vector,
        embeddedAt: now
      });
    }
    await this.persist(s);
  }

  async getStats(): Promise<EmbeddingStoreStats> {
    const s = await this.load();
    return { rowCount: s.rows.length, storePath: this.filePath, updatedAt: s.updatedAt };
  }

  async searchByVector(
    queryVector: number[],
    topK: number,
    options?: EmbeddingSearchOptions
  ): Promise<{ row: StoredEmbeddingRow; score: number }[]> {
    const s = await this.load();
    let rows = s.rows;
    if (options?.where?.trim()) {
      rows = rows.filter((r) => simpleWhereMatch(r, options.where!));
    }
    const withScores = rows
      .map((row) => ({ row, score: cosineSimilarity(queryVector, row.vector) }))
      .filter((x) => x.score > 0);
    withScores.sort((a, b) => b.score - a.score);
    return withScores.slice(0, topK);
  }
}

/** Best-effort filter for v1 file store; Lance uses full SQL `where`. */
function simpleWhereMatch(r: StoredEmbeddingRow, where: string): boolean {
  const w = where.trim();
  const q = (s: string) => s.replaceAll("''", "'");
  const mLang = w.match(/language\s*=\s*'((?:''|[^'])*)'/i);
  if (mLang && r.language !== q(mLang[1]!)) {
    return false;
  }
  const mKind = w.match(/kind\s*=\s*'((?:''|[^'])*)'/i);
  if (mKind && r.kind !== q(mKind[1]!)) {
    return false;
  }
  const mFile = w.match(/filePath\s*=\s*'((?:''|[^'])*)'/i);
  if (mFile && r.filePath !== q(mFile[1]!)) {
    return false;
  }
  return true;
}
