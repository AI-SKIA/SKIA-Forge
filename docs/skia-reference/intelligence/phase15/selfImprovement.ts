/*
  SKIA Self-Improvement Engine

  This module implements a pure, deterministic self-improvement "brain" used by
  SKIA's operational jobs, controllers, and health/incident pipelines. It
  analyzes monitoring observations and incident/context text and returns
  structured, prioritized improvement suggestions, evolved heuristics, and
  reasoning strategy tags.

  Important constraints:
  - No I/O, no logging, no network calls, no side effects.
  - Deterministic outputs for the same inputs.
  - Designed to be safe to call from jobs, controllers, and health endpoints.
*/

export interface ImprovementSuggestion {
  category: string;
  recommendation: string;
}

/**
 * Analyze monitoring and health observations and produce a prioritized list
 * of concrete, actionable internal improvement suggestions.
 *
 * The function parses inputs like "backend:fail", "llm:slow",
 * "search:intermittent", counts occurrences, detects recurring failures, and
 * returns suggestions sorted by computed severity/frequency.
 *
 * Pure and deterministic: same observations => same suggestions.
 */
export function suggestInternalImprovements(
  observations: string[],
): ImprovementSuggestion[] {
  if (!observations || observations.length === 0) return [];

  type SubsystemStats = { count: number; statusCounts: Record<string, number>; score: number };
  const stats: Record<string, SubsystemStats> = {};

  const statusWeight: Record<string, number> = {
    fail: 5,
    down: 5,
    degraded: 4,
    high: 4,
    error: 4,
    slow: 3,
    intermittent: 3,
    ok: 0,
    degraded_latency: 3,
  };

  // Parse observations into subsystem and status and accumulate scores
  for (const raw of observations) {
    if (!raw || typeof raw !== 'string') continue;
    const parts = raw.split(':').map((p) => p.trim().toLowerCase()).filter(Boolean);
    if (parts.length === 0) continue;
    const subsystem = parts[0];
    const status = parts[1] ?? 'unknown';

    if (!stats[subsystem]) stats[subsystem] = { count: 0, statusCounts: {}, score: 0 };
    stats[subsystem].count += 1;
    stats[subsystem].statusCounts[status] = (stats[subsystem].statusCounts[status] || 0) + 1;

    const weight = statusWeight[status] ?? (status.includes('slow') ? 3 : 1);
    stats[subsystem].score += weight;
  }

  // Build suggestions per subsystem based on observed patterns
  const suggestionsWithScore: { suggestion: ImprovementSuggestion; score: number; subsystem: string }[] = [];

  const push = (category: string, recommendation: string, score: number, subsystem: string) => {
    suggestionsWithScore.push({ suggestion: { category, recommendation }, score, subsystem });
  };

  const subsystems = Object.keys(stats).sort(); // deterministic order

  for (const s of subsystems) {
    const st = stats[s];
    const mostCommonStatus = Object.entries(st.statusCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';

    // Heuristics for recommendations per subsystem
    switch (s) {
      case 'backend':
        if (mostCommonStatus === 'fail' || st.score >= 8) {
          push(
            'backend',
            'Increase backend health-check frequency, add a circuit breaker around /api/health, and enable autoscaling for error bursts.',
            st.score,
            s,
          );
        } else if (mostCommonStatus === 'intermittent' || st.score >= 4) {
          push(
            'backend',
            'Add retry-with-backoff for transient errors, and instrument request latency and error-rate metrics.',
            st.score,
            s,
          );
        }
        break;

      case 'llm':
      case 'ai':
        if (mostCommonStatus === 'slow' || st.score >= 4) {
          push(
            'llm',
            'Introduce response caching for frequent prompts, prefer streaming LLM results, and add request timeouts with graceful degradation.',
            st.score,
            s,
          );
        }
        break;

      case 'search':
        push(
          'search',
          'Add search timeouts and exponential backoff retries; implement fallback-to-secondary-search and cache popular queries.',
          st.score,
          s,
        );
        break;

      case 'database':
      case 'db':
        push(
          'database',
          'Add DB connection pool monitoring, enforce connection timeouts, add retry-with-backoff for transient DB errors, and surface DB health metrics.',
          st.score,
          s,
        );
        break;

      case 'auth':
        push(
          'auth',
          'Instrument auth latency and error rates, add token refresh safeguards, and rate-limit abusive clients to reduce overload.',
          st.score,
          s,
        );
        break;

      case 'uptime':
      case 'statuspage':
        push(
          'resilience',
          'Investigate infrastructure and scaling limits, implement automated failover paths, and improve status page telemetry.',
          st.score,
          s,
        );
        break;

      case 'errorrate':
      case 'error_rate':
        push(
          'observability',
          'Instrument error-rate metrics, define alert thresholds, and create runbooks for the most common error classes.',
          st.score,
          s,
        );
        break;

      default:
        // Generic handling for unknown subsystems: suggest observability/resilience improvements
        if (st.score > 0) {
          push(
            'resilience',
            `For ${s}: add targeted health checks, retries with jitter, and instrument metrics to diagnose recurring issues.`,
            st.score,
            s,
          );
        }
        break;
    }
  }

  // Cross-cutting suggestions based on aggregated signals
  // If multiple subsystems show problems, suggest platform-level improvements
  const totalScore = Object.values(stats).reduce((a, b) => a + b.score, 0);
  const troubledSubsystems = Object.keys(stats).filter((k) => stats[k].score > 0);

  if (troubledSubsystems.length >= 3 || totalScore >= 15) {
    push(
      'observability',
      'Standardize metrics and tracing across services, add centralized dashboards and alerting for SLO breaches.',
      Math.max(5, Math.floor(totalScore / 2)),
      'platform',
    );
    push(
      'resilience',
      'Run a resilience review: enforce defensive timeouts, add circuit breakers, and define retry policies with backoff and jitter.',
      Math.max(5, Math.floor(totalScore / 3)),
      'platform',
    );
  }

  // Sort suggestions by score desc, then by category for deterministic ordering
  suggestionsWithScore.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.suggestion.category < b.suggestion.category) return -1;
    if (a.suggestion.category > b.suggestion.category) return 1;
    return a.subsystem < b.subsystem ? -1 : a.subsystem > b.subsystem ? 1 : 0;
  });

  // Return only the suggestion objects, preserving order
  return suggestionsWithScore.map((s) => s.suggestion);
}

/**
 * Evolve and normalize heuristic labels.
 *
 * This function performs deterministic, rule-based evolution of the input
 * heuristic set: it normalizes, removes duplicates, and adds resilience or
 * performance heuristics based on simple keyword matches (e.g. "unstable",
 * "slow", "latency"). The function is pure and stable.
 */
export function refineHeuristics(heuristics: string[]): string[] {
  if (!heuristics || heuristics.length === 0) return [];

  const normalized: string[] = heuristics
    .map((h) => (h ?? '').toString().trim())
    .filter(Boolean)
    .map((h) => h.toLowerCase().replace(/\s+/g, '-'));

  // Start with a deterministic order: sort unique normalized inputs
  const unique = Array.from(new Set(normalized)).sort();

  const additions: string[] = [];

  for (const h of unique) {
    if (h.includes('unstable') || h.includes('flap') || h.includes('flapping')) {
      additions.push('increase-backend-timeouts', 'add-backend-circuit-breaker', 'enable-retry-with-backoff');
    }
    if (h.includes('slow') || h.includes('latency') || h.includes('timeout')) {
      additions.push('prefer-streaming-llm', 'enable-llm-result-caching', 'increase-request-timeouts-with-grace');
    }
    if (h.includes('search')) {
      additions.push('fallback-to-secondary-search', 'add-search-timeout-and-retry');
    }
    if (h.includes('db') || h.includes('database') || h.includes('sql')) {
      additions.push('monitor-db-connection-pool', 'add-db-retries-with-backoff');
    }
  }

  // Combine inputs and additions in deterministic order and deduplicate
  const combined = [...unique, ...additions];
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const c of combined) {
    if (!seen.has(c)) {
      seen.add(c);
      deduped.push(c);
    }
  }

  return deduped;
}

/**
 * Analyze a free-form incident/context string and return a set of reasoning
 * strategy tags.
 *
 * The function uses simple keyword matching to derive strategy tags such as
 * "escalate-human-review-for-critical-incidents", "enable-defensive-timeouts",
 * or "enable-aggressive-caching". The output is de-duplicated and stable.
 */
export function updateReasoningStrategies(context: string): string[] {
  if (!context || typeof context !== 'string' || context.trim().length === 0) return [];

  const c = context.toLowerCase();
  const tags: string[] = [];

  const push = (t: string) => {
    if (!tags.includes(t)) tags.push(t);
  };

  if (c.includes('critical') || c.includes('outage') || c.includes('data loss') || c.includes('data-loss')) {
    push('escalate-human-review-for-critical-incidents');
    push('prefer-conservative-failover');
  }

  if (c.includes('slow') || c.includes('latency') || c.includes('timeout') || c.includes('time-out')) {
    push('prioritize-availability-over-latency');
    push('enable-defensive-timeouts');
  }

  if (c.includes('inconsistent') || c.includes('incorrect') || c.includes('wrong answer') || c.includes('bad data')) {
    push('prioritize-correctness-over-speed');
  }

  if (c.includes('high traffic') || c.includes('high-traffic') || c.includes('load') || c.includes('spike')) {
    push('enable-aggressive-caching');
  }

  if (c.includes('failover') || c.includes('flapping') || c.includes('unstable')) {
    push('prefer-conservative-failover');
    push('enable-automatic-retry-with-backoff');
  }

  if (c.includes('error rate') || c.includes('error-rate') || c.includes('errors') || c.includes('exception')) {
    push('instrument-error-metrics-and-alerts');
  }

  // Ensure deterministic ordering
  return tags.sort();
}

