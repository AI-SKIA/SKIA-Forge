import { buildSdlcTimeline, type SdlcTimelineV1 } from "./sdlcTimeline.js";
import { computeSdlcHeuristics, type SdlcInsightsV1 } from "./sdlcHeuristics.js";
import { detectSdlcPatterns, type SdlcPatternsV1 } from "./sdlcPatterns.js";
import { buildSdlcRecommendations, type SdlcRecommendationsV1 } from "./sdlcRecommendations.js";
import { computeSdlcHealthScore } from "./sdlcHealthScore.js";
import { querySdlcEvents } from "./sdlcEventModel.js";
import { detectSdlcDrift, type SdlcDriftV1 } from "./sdlcDrift.js";
import { classifySdlcRisk, type SdlcRiskV1 } from "./sdlcRisk.js";
import { forecastSdlcTrends, type SdlcForecastV1 } from "./sdlcForecast.js";
import type { SkiarulesConfig } from "../skiarules/skiarulesTypes.js";

export type SdlcInsightsBundleV1 = {
  scopePath?: string;
  timeline: SdlcTimelineV1;
  heuristics: SdlcInsightsV1;
  patterns: SdlcPatternsV1;
  recommendations: SdlcRecommendationsV1;
  healthScore: number;
};

export type SdlcInsightsBundleV2 = SdlcInsightsBundleV1 & {
  drift: SdlcDriftV1;
  risk: SdlcRiskV1;
  forecast: SdlcForecastV1;
};

export async function buildSdlcInsightsBundle(
  projectRoot: string,
  scopePath?: string,
  skiarulesConfig?: SkiarulesConfig | null
): Promise<SdlcInsightsBundleV2> {
  const [timeline, heuristics, events] = await Promise.all([
    buildSdlcTimeline(projectRoot, scopePath),
    computeSdlcHeuristics(projectRoot, scopePath),
    querySdlcEvents(projectRoot, { path: scopePath, limit: 1500 })
  ]);
  const patterns = detectSdlcPatterns(events);
  const recommendations = buildSdlcRecommendations({ timeline, heuristics, patterns });
  const healthScore = computeSdlcHealthScore({ timeline, heuristics, patterns });
  const v1: SdlcInsightsBundleV1 = {
    ...(scopePath ? { scopePath } : {}),
    timeline,
    heuristics,
    patterns,
    recommendations,
    healthScore
  };
  const drift = detectSdlcDrift(v1, skiarulesConfig ?? null);
  const risk = classifySdlcRisk(v1, drift);
  const forecast = forecastSdlcTrends(v1, drift, risk);
  return {
    ...v1,
    drift,
    risk,
    forecast
  };
}
