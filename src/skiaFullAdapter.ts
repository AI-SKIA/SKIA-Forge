import {
  buildSkiaFullEmbeddingRequestRecord,
  parseSkiaFullEmbeddingVector,
  SKIA_FULL_EMBEDDING_PATH_DEFAULT
} from "./skiaFullEmbeddingContract.js";
import type {
  DiffRequest,
  DiffResponse,
  ProposeEditRequest,
  ProposeEditResponse,
  ProposeRefactorRequest,
  ProposeRefactorResponse,
  RepoAnalyzeRequest,
  RepoAnalyzeResponse
} from "./types/codeIntelligence.js";
import type {
  SkiaFullAdapterStatus,
  SkiaFullChatResponse,
  SkiaFullEmbeddingResponse,
  SkiaFullEmbeddingVectorResult,
  SkiaFullMetaRouteResponse,
  SkiaFullRoutingEstimateResponse,
  SkiaFullSearchResponse,
  SkiaFullSovereignCoreResponse,
  SkiaFullTraceExplainResponse
} from "./types/skiaFullResponses.js";

export type SkiaFullAdapterConfig = {
  enabled: boolean;
  baseUrl: string;
  timeoutMs: number;
  allowLocalFallback: boolean;
  brainOnly: boolean;
  authBearer?: string;
  apiKey?: string;
  /** POST path on embedding-engine (default `/embed`). */
  embeddingPath?: string;
  /** Base URL for embedding-engine (defaults to `baseUrl` when unset). */
  embeddingBaseUrl?: string;
  embedModel?: string;
};

export type SkiaFullSearchResult = SkiaFullSearchResponse | SkiaFullMetaRouteResponse;
export type SkiaBrainProbeRow = {
  name: string;
  method: "GET" | "POST";
  path: string;
  status: number;
  ok: boolean;
  reachable: boolean;
  detail?: string;
};

export class SkiaFullAdapter {
  constructor(private readonly config: SkiaFullAdapterConfig) {}

  getStatus(): SkiaFullAdapterStatus {
    return {
      enabled: this.config.enabled,
      baseUrl: this.config.baseUrl,
      timeoutMs: this.config.timeoutMs,
      allowLocalFallback: this.config.allowLocalFallback,
      brainOnly: this.config.brainOnly,
      hasAuthBearer: Boolean(this.config.authBearer),
      hasApiKey: Boolean(this.config.apiKey),
      embeddingPath: this.config.embeddingPath ?? SKIA_FULL_EMBEDDING_PATH_DEFAULT
    };
  }

  async intelligence(
    query: string,
    category?: string,
    passthroughHeaders?: Record<string, string>,
    options?: {
      structuredOutput?: boolean;
      tools?: Array<{
        name: string;
        description?: string;
        parameters?: Array<{ name: string; type?: string; description?: string; required?: boolean }>;
      }>;
    }
  ): Promise<SkiaFullChatResponse> {
    // Primary evolved brain path from SKIA-FULL runtime.
    return this.postJson<SkiaFullChatResponse>(
      "/api/skia/chat",
      {
        messages: [{ role: "user", content: query }],
        mode: category ?? "general",
        source: "skia-forge",
        ...(options?.structuredOutput ? { structuredOutput: true } : {}),
        ...(options?.tools?.length ? { tools: options.tools } : {})
      },
      passthroughHeaders
    );
  }

  async search(query: string, passthroughHeaders?: Record<string, string>): Promise<SkiaFullSearchResult> {
    // Keep compatibility with search-specific API where available,
    // while falling back to meta routing if search contract drifts.
    try {
      return await this.postJson<SkiaFullSearchResponse>("/api/skia/search", { query }, passthroughHeaders);
    } catch {
      return this.postJson<SkiaFullMetaRouteResponse>("/api/meta/route", {
        query,
        intent: "search",
        source: "skia-forge"
      }, passthroughHeaders);
    }
  }

  async sovereignCore(
    payload: Record<string, unknown>,
    passthroughHeaders?: Record<string, string>
  ): Promise<SkiaFullSovereignCoreResponse> {
    const message =
      typeof payload.message === "string"
        ? payload.message
        : typeof payload.directive === "string"
          ? payload.directive
          : typeof payload.query === "string"
            ? payload.query
            : "sovereign probe";
    return this.postJson<SkiaFullSovereignCoreResponse>(
      "/api/agents/sovereign/run",
      { message, ...payload },
      passthroughHeaders
    );
  }

  async routeReasoning(
    query: string,
    intent?: string,
    passthroughHeaders?: Record<string, string>
  ): Promise<SkiaFullMetaRouteResponse> {
    return this.postJson<SkiaFullMetaRouteResponse>("/api/meta/route", {
      query,
      intent: intent ?? "analysis",
      source: "skia-forge"
    }, passthroughHeaders);
  }

  async routingEstimate(
    payload: Record<string, unknown>,
    passthroughHeaders?: Record<string, string>
  ): Promise<SkiaFullRoutingEstimateResponse> {
    return this.postJson<SkiaFullRoutingEstimateResponse>("/api/routing/estimate", payload, passthroughHeaders);
  }

  async analyzeRepo(
    payload: RepoAnalyzeRequest,
    passthroughHeaders?: Record<string, string>
  ): Promise<RepoAnalyzeResponse> {
    const data = await this.postJson(
      "/api/skia/code/analyze",
      payload as unknown as Record<string, unknown>,
      passthroughHeaders
    );
    return data as unknown as RepoAnalyzeResponse;
  }

  async proposeEdit(
    payload: ProposeEditRequest,
    passthroughHeaders?: Record<string, string>
  ): Promise<ProposeEditResponse> {
    const data = await this.postJson(
      "/api/skia/code/propose-edit",
      payload as unknown as Record<string, unknown>,
      passthroughHeaders
    );
    return data as unknown as ProposeEditResponse;
  }

  async proposeRefactor(
    payload: ProposeRefactorRequest,
    passthroughHeaders?: Record<string, string>
  ): Promise<ProposeRefactorResponse> {
    const data = await this.postJson(
      "/api/skia/code/propose-refactor",
      payload as unknown as Record<string, unknown>,
      passthroughHeaders
    );
    return data as unknown as ProposeRefactorResponse;
  }

  async computeDiff(
    payload: DiffRequest,
    passthroughHeaders?: Record<string, string>
  ): Promise<DiffResponse> {
    const data = await this.postJson(
      "/api/skia/code/diff",
      payload as unknown as Record<string, unknown>,
      passthroughHeaders
    );
    return data as unknown as DiffResponse;
  }

  /** Phase D2 — multi-tool security orchestration on the Skia-FULL brain. */
  async runFullSecurityAudit(
    payload: { repoPath: string; webUrl?: string },
    passthroughHeaders?: Record<string, string>
  ): Promise<Record<string, unknown>> {
    return this.postJson(
      "/api/security/full-audit",
      payload as unknown as Record<string, unknown>,
      passthroughHeaders
    );
  }

  async traceExplain(
    traceId: string,
    passthroughHeaders?: Record<string, string>
  ): Promise<SkiaFullTraceExplainResponse> {
    return this.getJson<SkiaFullTraceExplainResponse>(`/api/tracing/traces/${encodeURIComponent(traceId)}/explain`, passthroughHeaders);
  }

  /**
   * D1-03: aligned with `skiaFullEmbeddingContract` — `input`+`text`+`source` in body; parses `embedding` or `vector`.
   * Does not throw — for probes and compatibility checks.
   */
  async tryEmbedding(
    text: string,
    passthroughHeaders?: Record<string, string>
  ): Promise<
    | { ok: true; data: SkiaFullEmbeddingResponse; vector: number[]; model?: string }
    | { ok: false; reason: string; statusCode?: number }
  > {
    if (!this.config.enabled) {
      return { ok: false, reason: "SKIA-FULL adapter is disabled" };
    }
    const path = this.config.embeddingPath ?? SKIA_FULL_EMBEDDING_PATH_DEFAULT;
    const base = (this.config.embeddingBaseUrl ?? this.config.baseUrl).replace(/\/$/, "");
    try {
      const body = buildSkiaFullEmbeddingRequestRecord({
        text,
        source: "skia-forge",
        model: this.config.embedModel
      });
      const data = await this.postJsonToBase<SkiaFullEmbeddingResponse>(base, path, body, passthroughHeaders);
      const parsed = parseSkiaFullEmbeddingVector(data);
      if (!parsed) {
        return { ok: true, data, vector: [], model: undefined };
      }
      return { ok: true, data, vector: parsed.vector, model: parsed.model };
    } catch (e) {
      return {
        ok: false,
        reason: e instanceof Error ? e.message : "error"
      };
    }
  }

  /**
   * Strict embedding: throws if upstream or response shape is invalid.
   */
  async embedTextOrThrow(
    text: string,
    passthroughHeaders?: Record<string, string>
  ): Promise<SkiaFullEmbeddingVectorResult> {
    if (!this.config.enabled) {
      throw new Error("SKIA-FULL adapter is disabled");
    }
    const path = this.config.embeddingPath ?? SKIA_FULL_EMBEDDING_PATH_DEFAULT;
    const base = (this.config.embeddingBaseUrl ?? this.config.baseUrl).replace(/\/$/, "");
    const body = buildSkiaFullEmbeddingRequestRecord({
      text,
      source: "skia-forge",
      model: this.config.embedModel
    });
    const data = await this.postJsonToBase<SkiaFullEmbeddingResponse>(base, path, body, passthroughHeaders);
    const parsed = parseSkiaFullEmbeddingVector(data);
    if (!parsed?.vector.length) {
      throw new Error("Invalid embedding response: no vector in contract shape");
    }
    return { vector: parsed.vector, model: parsed.model };
  }

  async probeBrainContracts(passthroughHeaders?: Record<string, string>): Promise<SkiaBrainProbeRow[]> {
    const checks: Array<{
      name: string;
      method: "GET" | "POST";
      path: string;
      body?: Record<string, unknown>;
    }> = [
      {
        name: "skia.chat",
        method: "POST",
        path: "/api/skia/chat",
        body: { messages: [{ role: "user", content: "probe" }] }
      },
      {
        name: "meta.route",
        method: "POST",
        path: "/api/meta/route",
        body: { query: "probe", intent: "analysis" }
      },
      {
        name: "routing.estimate",
        method: "POST",
        path: "/api/routing/estimate",
        body: { task: "probe", tokens: 100 }
      },
      { name: "health", method: "GET", path: "/api/health" }
    ];

    const out: SkiaBrainProbeRow[] = [];
    for (const check of checks) {
      try {
        const res = await fetch(`${this.config.baseUrl}${check.path}`, {
          method: check.method,
          headers: this.buildHeaders(passthroughHeaders),
          body: check.method === "POST" ? JSON.stringify(check.body ?? {}) : undefined
        });
        const detail = (await res.text()).slice(0, 180);
        out.push({
          name: check.name,
          method: check.method,
          path: check.path,
          status: res.status,
          ok: res.ok,
          reachable: true,
          detail
        });
      } catch {
        out.push({
          name: check.name,
          method: check.method,
          path: check.path,
          status: 0,
          ok: false,
          reachable: false,
          detail: "network or transport error"
        });
      }
    }
    return out;
  }

  private async postJsonToBase<TResponse = Record<string, unknown>>(
    baseUrl: string,
    path: string,
    body: Record<string, unknown>,
    passthroughHeaders?: Record<string, string>
  ): Promise<TResponse> {
    if (!this.config.enabled) {
      throw new Error("SKIA-FULL adapter is disabled.");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: this.buildHeaders(passthroughHeaders),
        body: JSON.stringify(body),
        signal: controller.signal
      });
      const data = (await res.json()) as Record<string, unknown>;
      const confidenceBand = res.headers.get('X-SKIA-Confidence-Band');
      if (confidenceBand) {
        data.confidenceBand = confidenceBand;
      }
      if (!res.ok) {
        throw new Error(
          `Embedding upstream error ${res.status}: ${
            typeof data.error === "string" ? data.error : "unknown"
          }`
        );
      }
      return data as TResponse;
    } finally {
      clearTimeout(timer);
    }
  }

  private async postJson<TResponse = Record<string, unknown>>(
    path: string,
    body: Record<string, unknown>,
    passthroughHeaders?: Record<string, string>
  ): Promise<TResponse> {
    if (!this.config.enabled) {
      throw new Error("SKIA-FULL adapter is disabled.");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const res = await fetch(`${this.config.baseUrl}${path}`, {
        method: "POST",
        headers: this.buildHeaders(passthroughHeaders),
        body: JSON.stringify(body),
        signal: controller.signal
      });
      const data = (await res.json()) as Record<string, unknown>;
      const confidenceBand = res.headers.get('X-SKIA-Confidence-Band');
      if (confidenceBand) {
        data.confidenceBand = confidenceBand;
      }
      if (!res.ok) {
        throw new Error(
          `SKIA-FULL upstream error ${res.status}: ${
            typeof data.error === "string" ? data.error : "unknown"
          }`
        );
      }
      return data as TResponse;
    } finally {
      clearTimeout(timer);
    }
  }

  private async getJson<TResponse = Record<string, unknown>>(
    path: string,
    passthroughHeaders?: Record<string, string>
  ): Promise<TResponse> {
    if (!this.config.enabled) {
      throw new Error("SKIA-FULL adapter is disabled.");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const res = await fetch(`${this.config.baseUrl}${path}`, {
        method: "GET",
        headers: this.buildHeaders(passthroughHeaders),
        signal: controller.signal
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(
          `SKIA-FULL upstream error ${res.status}: ${
            typeof data.error === "string" ? data.error : "unknown"
          }`
        );
      }
      return data as TResponse;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Platform emergent goals from Skia-FULL Phase 17C (poll for Forge self-improvement targets). */
  async getEmergentGoals(
    passthroughHeaders?: Record<string, string>
  ): Promise<{ data?: { goals?: unknown[] }; goals?: unknown[] }> {
    return this.getJson("/api/intelligence/goals", passthroughHeaders);
  }

  private buildHeaders(passthroughHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      "content-type": "application/json"
    };
    if (this.config.authBearer) {
      headers.authorization = `Bearer ${this.config.authBearer}`;
    }
    if (this.config.apiKey) {
      headers["x-api-key"] = this.config.apiKey;
    }
    if (passthroughHeaders) {
      for (const [key, value] of Object.entries(passthroughHeaders)) {
        if (typeof value === "string" && value.length > 0) {
          headers[key.toLowerCase()] = value;
        }
      }
    }
    return headers;
  }
}
