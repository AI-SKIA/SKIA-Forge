import { performance } from "node:perf_hooks";
import fs from "node:fs/promises";
import path from "node:path";
import { extractStructuralSymbols } from "./extractStructuralSymbols.js";

export type StructureIndexEntry = {
  relPath: string;
  engine: "empty" | "tree_sitter_javascript" | "typescript";
  symbolCount: number;
  updatedAt: string;
  parseDurationMs: number;
};

/**
 * D1-01: In-memory structural index updated per file (e.g. on save).
 * Not region-incremental Tree-sitter; full re-parse of one file, tracked in ms.
 */
export class StructureIndexCache {
  private readonly byPath = new Map<string, StructureIndexEntry>();

  get size(): number {
    return this.byPath.size;
  }

  get(relPath: string): StructureIndexEntry | undefined {
    return this.byPath.get(toPosix(relPath));
  }

  remove(relPath: string): void {
    this.byPath.delete(toPosix(relPath));
  }

  clear(): void {
    this.byPath.clear();
  }

  getMaxParseDurationMs(): number {
    let m = 0;
    for (const e of this.byPath.values()) {
      if (e.parseDurationMs > m) m = e.parseDurationMs;
    }
    return m;
  }

  listPaths(): string[] {
    return [...this.byPath.keys()].sort();
  }

  toSummary(): { fileCount: number; maxParseDurationMs: number; paths: string[] } {
    return {
      fileCount: this.byPath.size,
      maxParseDurationMs: this.getMaxParseDurationMs(),
      paths: this.listPaths()
    };
  }

  /**
   * Read file, parse structurally, store entry, or remove if missing/ignored/unsupported.
   */
  async updateFromFile(
    projectRoot: string,
    relPath: string,
    ig: { ignores: (path: string) => boolean }
  ): Promise<void> {
    const rel = toPosix(relPath);
    if (ig.ignores(rel)) {
      this.remove(rel);
      return;
    }
    const abs = path.join(projectRoot, rel);
    let mtime: Date;
    let content: string;
    try {
      const s = await fs.stat(abs);
      if (!s.isFile()) {
        this.remove(rel);
        return;
      }
      mtime = s.mtime;
      content = await fs.readFile(abs, "utf8");
    } catch {
      this.remove(rel);
      return;
    }
    const t0 = performance.now();
    const { engine, symbols } = extractStructuralSymbols(rel, content);
    const parseDurationMs = performance.now() - t0;
    if (engine === "unsupported") {
      this.remove(rel);
      return;
    }
    const round = Math.round(parseDurationMs * 1000) / 1000;
    this.byPath.set(rel, {
      relPath: rel,
      engine,
      symbolCount: symbols.length,
      updatedAt: mtime.toISOString(),
      parseDurationMs: round
    });
  }
}

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}
