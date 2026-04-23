import { randomBytes } from "node:crypto";

const DEFAULT_MAX_CONCURRENT = 1;
const DEFAULT_MAX_QUEUED = 100;

export class EmbedIndexQueueBackpressureError extends Error {
  readonly code = "EMBED_QUEUE_BACKPRESSURE";
  readonly maxQueued: number;
  readonly depth: number;
  constructor(depth: number, maxQueued: number) {
    super(
      `Embedding index queue is at capacity (queued: ${depth}, max: ${maxQueued}). Try again after current jobs complete.`
    );
    this.name = "EmbedIndexQueueBackpressureError";
    this.depth = depth;
    this.maxQueued = maxQueued;
  }
}

type JobState = "queued" | "running" | "succeeded" | "failed";

type Runnable = () => Promise<unknown>;

type Enqueued = {
  id: string;
  work: Runnable;
  /** When set, Promise resolves or rejects with final outcome */
  settle?: (ok: boolean, v?: unknown) => void;
  fireAndForget: boolean;
};

type JobInfo = {
  id: string;
  state: JobState;
  enqueuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  result?: unknown;
  errorMessage?: string;
  fireAndForget: boolean;
};

function newJobId(): string {
  return `embjob_${Date.now()}_${randomBytes(6).toString("hex")}`;
}

/**
 * D1-02+ — In-process queue for multi-file and very large (50K+ chunk) embed index runs.
 * `maxConcurrent` throttles parallel work (default 1 = safe for provider rate limits).
 * `maxQueued` bounds waiting job depth; beyond that, submit() throws (HTTP 429).
 * LanceDB: replace `EmbeddingVectorStore` implementation; queue contract unchanged.
 */
export class EmbedIndexQueue {
  private readonly maxConcurrent: number;
  private readonly maxQueued: number;
  private active = 0;
  private readonly waiting: Enqueued[] = [];
  private readonly byId = new Map<string, JobInfo>();

  constructor(options?: { maxConcurrent?: number; maxQueued?: number }) {
    this.maxConcurrent = options?.maxConcurrent ?? DEFAULT_MAX_CONCURRENT;
    this.maxQueued = options?.maxQueued ?? DEFAULT_MAX_QUEUED;
  }

  getQueueDepth(): number {
    return this.waiting.length;
  }

  getConfig(): { maxConcurrent: number; maxQueued: number; active: number } {
    return { maxConcurrent: this.maxConcurrent, maxQueued: this.maxQueued, active: this.active };
  }

  getJob(jobId: string): JobInfo | null {
    return this.byId.get(jobId) ?? null;
  }

  listRecentJobIds(limit = 25): string[] {
    return [...this.byId.keys()].slice(-Math.max(0, limit));
  }

  private assertQueueCapacity(): void {
    if (this.waiting.length >= this.maxQueued) {
      throw new EmbedIndexQueueBackpressureError(this.waiting.length, this.maxQueued);
    }
  }

  private addJobInfo(id: string, fireAndForget: boolean): void {
    this.byId.set(id, {
      id,
      state: "queued",
      enqueuedAt: new Date().toISOString(),
      fireAndForget
    });
  }

  private transition(id: string, to: JobState, result?: unknown, err?: Error): void {
    const r = this.byId.get(id);
    if (!r) {
      return;
    }
    r.state = to;
    if (to === "running" && !r.startedAt) {
      r.startedAt = new Date().toISOString();
    }
    if (to === "succeeded" || to === "failed") {
      r.finishedAt = new Date().toISOString();
      if (result !== undefined) {
        r.result = result;
      }
      if (err) {
        r.errorMessage = err.message;
      }
    }
  }

  /**
   * Await a slot, run, return. Records job in map for optional introspection.
   */
  runWaiting(work: () => Promise<unknown>): Promise<unknown> {
    this.assertQueueCapacity();
    const id = newJobId();
    this.addJobInfo(id, false);
    return new Promise((resolve, reject) => {
      this.waiting.push({
        id,
        fireAndForget: false,
        work: work as Runnable,
        settle: (ok, v) => (ok ? resolve(v) : reject(v))
      });
      this.drain();
    });
  }

  private async executeItem(item: Enqueued): Promise<void> {
    this.transition(item.id, "running");
    try {
      const result = await item.work();
      this.transition(item.id, "succeeded", result, undefined);
      if (item.settle) {
        item.settle(true, result);
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      this.transition(item.id, "failed", undefined, err);
      if (item.settle) {
        item.settle(false, e);
      }
    }
  }

  private drain(): void {
    while (this.active < this.maxConcurrent && this.waiting.length) {
      const item = this.waiting.shift()!;
      this.active++;
      void (async () => {
        try {
          await this.executeItem(item);
        } finally {
          this.active--;
          this.drain();
        }
      })();
    }
  }

  /**
   * Run in background; returns job id. Poll with getJob.
   */
  enqueueAsync(work: () => Promise<unknown>): string {
    this.assertQueueCapacity();
    const id = newJobId();
    this.addJobInfo(id, true);
    this.waiting.push({ id, work, fireAndForget: true });
    this.drain();
    return id;
  }
}

let globalQueue: EmbedIndexQueue | null = null;

export function getEmbedIndexQueue(
  _projectRoot: string,
  env: NodeJS.ProcessEnv
): EmbedIndexQueue {
  if (!globalQueue) {
    const maxC = Math.max(1, parseInt(env.EMBED_QUEUE_MAX_CONCURRENT ?? "1", 10) || 1);
    const maxQ = Math.max(1, parseInt(env.EMBED_QUEUE_MAX_QUEUED ?? "100", 10) || 100);
    globalQueue = new EmbedIndexQueue({ maxConcurrent: maxC, maxQueued: maxQ });
  }
  return globalQueue;
}

/** Test-only: clears singleton to isolate queue behavior between tests. */
export function _resetGlobalEmbedIndexQueueForTests(): void {
  globalQueue = null;
}
