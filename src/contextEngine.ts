import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import ignore from "ignore";
import chokidar, { type FSWatcher } from "chokidar";
import { FileManifestEntry, IndexChunk, ProjectIndex, SearchResult } from "./types.js";
import { StructureIndexCache } from "./forge/modules/context-engine/structureIndexCache.js";
import { loadSkiarules, createSkiarulesWatcher } from "./forge/modules/skiarules/skiarulesLoader.js";
import {
  checkArchitectureImports,
  type ArchitectureViolation
} from "./forge/modules/skiarules/architectureEnforcer.js";
import type { SkiarulesConfig } from "./forge/modules/skiarules/skiarulesTypes.js";
import { getDiagnosticsForFile, type SkiarulesFileDiagnostics } from "./forge/modules/skiarules/architectureDiagnostics.js";
import {
  buildLspSkiarulesDiagnosticsBundleV1,
  type LspSkiarulesDiagnosticsBundleV1
} from "./forge/modules/skiarules/lspDiagnosticsShape.js";
import { buildSdlcTimeline, type SdlcTimelineV1 } from "./forge/modules/sdlc/sdlcTimeline.js";
import {
  cosineLikeScore,
  detectLanguage,
  estimateTokenCount,
  sha256,
  toPosixPath
} from "./utils.js";

const INDEX_DIR = ".skia";
const INDEX_FILE = "index.json";
const DEFAULT_IGNORES = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/.vs/**",
  "**/.idea/**"
];

type IgnoreLike = { ignores: (p: string) => boolean };

export class ContextEngine {
  private index: ProjectIndex | null = null;
  private watcher: FSWatcher | null = null;
  private rebuildTimer: NodeJS.Timeout | null = null;
  /** D1-01: per-file structural re-parse on watcher events (in-memory, parse-time in ms). */
  private readonly structureIndex = new StructureIndexCache();
  private activeIgnore: IgnoreLike | null = null;
  /** D1-12: last good .skiarules; invalid updates keep the previous config. */
  private skiarules: SkiarulesConfig | null = null;
  private skiaRulesWatcher: { close: () => Promise<void> } | null = null;

  constructor(private readonly projectRoot: string) {
    void this.loadSkiarulesInitial();
  }

  private async loadSkiarulesInitial(): Promise<void> {
    const r = await loadSkiarules(this.projectRoot);
    if (r.ok && r.config != null) {
      this.skiarules = r.config;
    } else if (!r.ok) {
      console.warn(`[contextEngine] .skiarules: ${r.error.message}`);
    }
    if (!this.skiaRulesWatcher) {
      this.skiaRulesWatcher = createSkiarulesWatcher(this.projectRoot, (next) => {
        if (next.ok) {
          this.skiarules = next.config;
        } else {
          console.warn(`[contextEngine] .skiarules: ${next.error.message}`);
        }
      });
    }
  }

  /** D1-12: current validated config, or `null` if never loaded / missing. */
  getSkiarulesConfig(): SkiarulesConfig | null {
    return this.skiarules;
  }

  /**
   * D1-12: full architecture + naming + anti-pattern diagnostics for one file (reads current bytes from disk).
   */
  async getDiagnosticsForPath(relPathPosix: string): Promise<SkiarulesFileDiagnostics> {
    const cfg = this.skiarules;
    const rel = toPosixPath(relPathPosix);
    const abs = path.join(this.projectRoot, rel);
    let content = "";
    try {
      const st = await fs.stat(abs);
      if (st.isFile()) {
        content = await fs.readFile(abs, "utf8");
      }
    } catch {
      return {
        path: rel,
        architecture: [],
        naming: [],
        antiPatterns: []
      };
    }
    return getDiagnosticsForFile(this.projectRoot, rel, content, cfg);
  }

  /**
   * D1-12: optional count of architecture boundary violations across all indexed source paths.
   */
  async getArchitectureSkiarulesDiags(): Promise<{
    violationCount: number;
    sample: ArchitectureViolation[];
  }> {
    const cfg = this.skiarules;
    if (!cfg?.architecture?.boundaries?.length) {
      return { violationCount: 0, sample: [] };
    }
    const paths = this.structureIndex.listPaths();
    const max = 500;
    const all: ArchitectureViolation[] = [];
    for (const rel of paths.slice(0, max)) {
      if (!/\.(m?[jt]sx?|mjs|cjs)$/i.test(rel)) {
        continue;
      }
      const v = await checkArchitectureImports(this.projectRoot, rel, null, cfg);
      all.push(...v);
    }
    return {
      violationCount: all.length,
      sample: all.slice(0, 20)
    };
  }

  /**
   * D1-15: LSP-ready combined bundle (per-file + optional project architecture sample) for internal/RPC use.
   */
  async getLspSkiarulesBundleForPath(
    relPathPosix: string,
    options?: { includeProjectArchitecture?: boolean }
  ): Promise<LspSkiarulesDiagnosticsBundleV1> {
    const d = await this.getDiagnosticsForPath(relPathPosix);
    if (options?.includeProjectArchitecture === false) {
      return buildLspSkiarulesDiagnosticsBundleV1(d, null);
    }
    const p = await this.getArchitectureSkiarulesDiags();
    return buildLspSkiarulesDiagnosticsBundleV1(d, p);
  }

  /** D2-02: timeline projection for a path or full project. */
  async getSdlcTimeline(relPathPosix?: string): Promise<SdlcTimelineV1> {
    const scoped = relPathPosix ? toPosixPath(relPathPosix) : undefined;
    return buildSdlcTimeline(this.projectRoot, scoped);
  }

  getStructureIndexSummary() {
    return this.structureIndex.toSummary();
  }

  /**
   * D1-06: for incremental embed on save, align with the same .gitignore / .skiaignore
   * rules the structural pass uses.
   */
  isPathIgnoredByProjectRules(relativePathPosix: string): boolean {
    if (!this.activeIgnore) {
      return false;
    }
    return this.activeIgnore.ignores(toPosixPath(relativePathPosix));
  }

  /** D1-01: Force structural re-parse for one relative path (also used to validate the in-memory index). */
  async reparseStructureFile(relativePath: string): Promise<void> {
    this.activeIgnore = this.activeIgnore ?? (await this.loadIgnoreMatcher());
    await this.structureIndex.updateFromFile(
      this.projectRoot,
      toPosixPath(relativePath),
      this.activeIgnore
    );
  }

  async buildIndex(): Promise<ProjectIndex> {
    const ig = await this.loadIgnoreMatcher();
    this.activeIgnore = ig;
    const files = await fg("**/*", {
      cwd: this.projectRoot,
      onlyFiles: true,
      dot: true,
      ignore: DEFAULT_IGNORES
    });

    const manifest: FileManifestEntry[] = [];
    const chunks: IndexChunk[] = [];

    for (const relativePath of files) {
      const normalized = toPosixPath(relativePath);
      if (ig.ignores(normalized)) {
        continue;
      }

      const absolutePath = path.join(this.projectRoot, relativePath);
      const [stats, content] = await Promise.all([
        fs.stat(absolutePath),
        fs.readFile(absolutePath, "utf8").catch(() => "")
      ]);

      const language = detectLanguage(relativePath);
      manifest.push({
        path: normalized,
        language,
        size: stats.size,
        modifiedAt: stats.mtime.toISOString()
      });

      const fileChunks = chunkFile(normalized, language, content);
      chunks.push(...fileChunks);
    }

    this.index = {
      generatedAt: new Date().toISOString(),
      rootPath: this.projectRoot,
      files: manifest,
      chunks
    };

    await this.persistIndex(this.index);
    return this.index;
  }

  async getIndex(): Promise<ProjectIndex> {
    if (this.index) {
      return this.index;
    }
    const loaded = await this.loadPersistedIndex();
    this.index = loaded;
    return loaded;
  }

  async search(query: string, topK = 10): Promise<SearchResult[]> {
    const index = await this.getIndex();
    return index.chunks
      .map((chunk) => ({
        chunk,
        score: cosineLikeScore(query, `${chunk.symbolName}\n${chunk.content}`)
      }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async startIncrementalWatcher(
    onReindexed?: (index: ProjectIndex) => void,
    incrementalEmbed?: { onFileChange: (relPosix: string) => void; onFileUnlink: (relPosix: string) => void }
  ): Promise<void> {
    if (this.watcher) {
      return Promise.resolve();
    }
    this.activeIgnore = this.activeIgnore ?? (await this.loadIgnoreMatcher());

    this.watcher = chokidar.watch(this.projectRoot, {
      ignored: DEFAULT_IGNORES,
      ignoreInitial: true,
      persistent: true
    });

    const schedule = () => {
      if (this.rebuildTimer) {
        clearTimeout(this.rebuildTimer);
      }
      this.rebuildTimer = setTimeout(async () => {
        const index = await this.buildIndex();
        onReindexed?.(index);
      }, 200);
    };

    const pumpFileAddOrChange = async (absPath: string): Promise<void> => {
      if (!this.activeIgnore) {
        this.activeIgnore = await this.loadIgnoreMatcher();
      }
      const rel = path.relative(this.projectRoot, path.resolve(absPath));
      if (rel.startsWith("..")) {
        return;
      }
      const relP = toPosixPath(rel);
      await this.structureIndex.updateFromFile(this.projectRoot, relP, this.activeIgnore);
      incrementalEmbed?.onFileChange(relP);
    };

    const onUnlink = (absPath: string) => {
      const rel = path.relative(this.projectRoot, path.resolve(absPath));
      if (rel.startsWith("..")) {
        return;
      }
      const relP = toPosixPath(rel);
      this.structureIndex.remove(relP);
      incrementalEmbed?.onFileUnlink(relP);
    };

    this.watcher.on("add", (p) => {
      schedule();
      if (typeof p === "string") void pumpFileAddOrChange(p);
    });
    this.watcher.on("change", (p) => {
      schedule();
      if (typeof p === "string") void pumpFileAddOrChange(p);
    });
    this.watcher.on("unlink", (p) => {
      schedule();
      if (typeof p === "string") onUnlink(p);
    });
    return new Promise<void>((resolve) => {
      const w = this.watcher!;
      const t = setTimeout(() => resolve(), 3000);
      w.once("ready", () => {
        clearTimeout(t);
        resolve();
      });
    });
  }

  async stopIncrementalWatcher(): Promise<void> {
    if (!this.watcher) {
      return;
    }
    this.watcher.removeAllListeners();
    await this.watcher.close();
    this.watcher = null;
    if (this.rebuildTimer) {
      clearTimeout(this.rebuildTimer);
      this.rebuildTimer = null;
    }
  }

  private async persistIndex(index: ProjectIndex): Promise<void> {
    const dir = path.join(this.projectRoot, INDEX_DIR);
    await fs.mkdir(dir, { recursive: true });
    const indexPath = path.join(dir, INDEX_FILE);
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2), "utf8");
  }

  private async loadPersistedIndex(): Promise<ProjectIndex> {
    const indexPath = path.join(this.projectRoot, INDEX_DIR, INDEX_FILE);
    try {
      const raw = await fs.readFile(indexPath, "utf8");
      return JSON.parse(raw) as ProjectIndex;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return this.buildIndex();
      }
      throw error;
    }
  }

  private async loadIgnoreMatcher() {
    const ig = ignore();
    const files = [".gitignore", ".skiaignore"];
    for (const fileName of files) {
      try {
        const raw = await fs.readFile(path.join(this.projectRoot, fileName), "utf8");
        ig.add(raw);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
    }
    return ig;
  }
}

export function chunkFile(filePath: string, language: string, content: string): IndexChunk[] {
  const lines = content.split(/\r?\n/);
  const chunks: IndexChunk[] = [];

  if (lines.length === 0 || content.trim().length === 0) {
    return [];
  }

  const window = 40;
  for (let start = 0; start < lines.length; start += window) {
    const end = Math.min(start + window, lines.length);
    const chunkContent = lines.slice(start, end).join("\n").trim();
    if (!chunkContent) {
      continue;
    }
    const symbolName = guessSymbolName(chunkContent, filePath);
    const symbolType = guessSymbolType(chunkContent);
    const id = sha256(`${filePath}:${start}:${chunkContent}`);
    chunks.push({
      id,
      filePath,
      language,
      symbolName,
      symbolType,
      startLine: start + 1,
      endLine: end,
      tokenCount: estimateTokenCount(chunkContent),
      content: chunkContent,
      checksum: sha256(chunkContent),
      updatedAt: new Date().toISOString()
    });
  }

  return chunks;
}

function guessSymbolName(content: string, fallback: string): string {
  const functionMatch = content.match(/\b(?:function|def)\s+([a-zA-Z0-9_]+)/);
  if (functionMatch) return functionMatch[1];
  const classMatch = content.match(/\bclass\s+([a-zA-Z0-9_]+)/);
  if (classMatch) return classMatch[1];
  const exportMatch = content.match(/\bexport\s+(?:const|function|class)\s+([a-zA-Z0-9_]+)/);
  if (exportMatch) return exportMatch[1];
  return fallback;
}

function guessSymbolType(content: string): IndexChunk["symbolType"] {
  if (/\bclass\s+/.test(content)) return "class";
  if (/\b(function|def)\s+/.test(content)) return "function";
  if (/\bexport\s+/.test(content)) return "module";
  return "unknown";
}
