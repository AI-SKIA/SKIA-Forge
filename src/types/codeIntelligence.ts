/**
 * Mirrors Skia-FULL `src/types/codeIntelligence.ts` for Forge adapter contracts only.
 * Source of truth for behavior remains the brain (api.skia.ca / Skia-FULL).
 */
export type ChangeType = "add" | "remove" | "replace" | "context";
export type RiskLevel = "low" | "medium" | "high";
export type AnalysisDepth = "shallow" | "deep";

export type ConfidenceScore = number;

export interface DiffHunk {
  startLine: number;
  endLine: number;
  originalLines: string[];
  proposedLines: string[];
  changeType: ChangeType;
}

export interface FileChange {
  filePath: string;
  originalContent: string;
  proposedContent: string;
  hunks: DiffHunk[];
  rationale: string;
  requiresApproval: boolean;
}

export interface RefactorStep {
  stepIndex: number;
  description: string;
  affectedFiles: string[];
  estimatedRisk: RiskLevel;
}

export interface RefactorPlan {
  steps: RefactorStep[];
}

export interface DiffOptions {
  contextLines?: number;
  ignoreWhitespace?: boolean;
  unifiedFormat?: boolean;
}

export type RepoAnalyzeRequest =
  | {
      repoPath: string;
      fileList?: never;
      analysisDepth: AnalysisDepth;
      focusAreas: string[];
    }
  | {
      repoPath?: never;
      fileList: string[];
      analysisDepth: AnalysisDepth;
      focusAreas: string[];
    };

export interface ProposeEditRequest {
  filePath: string;
  originalContent: string;
  instruction: string;
  context?: string;
}

export interface ProposeRefactorFileInput {
  filePath: string;
  content: string;
}

export interface ProposeRefactorRequest {
  files: ProposeRefactorFileInput[];
  goal: string;
  constraints: string[];
}

export interface DiffRequest {
  original: string;
  proposed: string;
  filePath?: string;
  options?: DiffOptions;
}

export interface ResponseMeta {
  rationale: string;
  governanceFlags: string[];
  confidence: ConfidenceScore;
}

export interface RepoAnalyzeResponse extends ResponseMeta {
  summary: string;
  findings: string[];
  suggestedRefactors: string[];
}

export interface ProposeEditResponse extends ResponseMeta {
  filePath: string;
  change: FileChange;
  requiresApproval: boolean;
}

export interface ProposeRefactorResponse extends ResponseMeta {
  plan: RefactorPlan;
  changes: FileChange[];
  requiresApproval: boolean;
}

export interface DiffResponse extends ResponseMeta {
  filePath?: string;
  hunks: DiffHunk[];
  summary: string;
}
