// Extracted reference types from upstream self-improvement orchestrator.

export type ImprovementSuggestion = {
    category: string;
    summary: string;
    confidence: number;
};

// Health snapshot shape consumed by the orchestrator
export interface HealthSnapshot {
    backend: 'ok' | 'fail';
    frontend: 'ok' | 'fail';
    llm: 'ok' | 'warn' | 'fail';     // updated
    search: 'ok' | 'warn' | 'fail';  // updated
    database: 'ok' | 'fail';
}

export interface SelfImprovementResult {
    observations: string[];
    suggestions: ImprovementSuggestion[];
    heuristics: string[];
    strategies: string[];
}
