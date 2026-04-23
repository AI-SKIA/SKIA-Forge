export interface ExplanationResult {
  summary: string;
  details: string[];
}

export function explainDecisions(_decisionContext: string): ExplanationResult {
  // TODO: Produce structured explanations for why a decision was selected.
  return {
    summary: "",
    details: [],
  };
}

export function explainAlternatives(_decisionContext: string): string[] {
  // TODO: Describe viable alternatives and why they were not selected.
  return [];
}

export function explainTradeoffs(_decisionContext: string): string[] {
  // TODO: Summarize tradeoffs across speed, quality, and risk dimensions.
  return [];
}
